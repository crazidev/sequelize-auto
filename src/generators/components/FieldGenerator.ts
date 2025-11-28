import _ from 'lodash';
import { ColumnDescription } from 'sequelize';
import { FKSpec } from '../../dialects/dialect-options';
import { Field } from '../../types';
import {
  escapeSpecial,
  getEnumValues,
  getSqType,
  getTypeScriptFieldType,
  isArray,
  isIgnoredField,
  isNumber,
  isParanoidField,
  isString,
  isTimestampField,
  quoteName,
  recase,
  TSField,
} from '../../utils/GeneratorUtils';
import { GeneratorContext } from '../IGenerator';
import { FieldGeneratorResult, IFieldGenerator } from './IComponentGenerator';

/**
 * Abstract base class for field generation
 */
export abstract class BaseFieldGenerator implements IFieldGenerator {
  abstract generateTS(context: GeneratorContext, table: string): FieldGeneratorResult;
  abstract generateJS(context: GeneratorContext, table: string): string;

  generate(context: GeneratorContext, table: string): string {
    if (context.options.lang === 'ts') {
      return this.generateTS(context, table).fields;
    }
    return this.generateJS(context, table);
  }

  /**
   * Get primary key fields for a table
   */
  protected getPrimaryKeys(context: GeneratorContext, table: string): string[] {
    const fields = _.keys(context.tables[table]);
    return fields.filter((field): boolean => {
      const fieldObj = context.tables[table][field];
      return fieldObj['primaryKey'] === true;
    });
  }

  /**
   * Get fields that are optional at creation time
   */
  protected getCreationOptionalFields(context: GeneratorContext, table: string): string[] {
    const fields = _.keys(context.tables[table]);
    const additional = context.options.additional;

    return fields.filter((field): boolean => {
      const fieldObj = context.tables[table][field];
      return (
        fieldObj.allowNull ||
        !!fieldObj.defaultValue ||
        fieldObj.defaultValue === '' ||
        fieldObj.autoIncrement ||
        isTimestampField(field, additional)
      );
    });
  }

  /**
   * Check if a field is a serial/auto-increment key
   */
  protected isSerialKey(context: GeneratorContext, fieldObj: Field): boolean {
    return (
      (fieldObj.foreignKey && fieldObj.foreignKey.isSerialKey) ||
      (context.dialect.isSerialKey && context.dialect.isSerialKey(fieldObj))
    );
  }

  /**
   * Get TypeScript type for a table field
   */
  protected getTypeScriptType(context: GeneratorContext, table: string, field: string): string {
    const fieldObj = context.tables[table][field] as TSField;
    return getTypeScriptFieldType(fieldObj, 'type');
  }

  /**
   * Check if a field is optional (nullable)
   */
  protected isFieldOptional(context: GeneratorContext, table: string, field: string): boolean {
    const fieldObj = context.tables[table][field];
    return fieldObj.allowNull === true;
  }

  /**
   * Generate default value string
   */
  protected generateDefaultValue(
    context: GeneratorContext,
    fieldObj: Field,
    isSerialKey: boolean
  ): string | null {
    let defaultVal = fieldObj.defaultValue;
    const dialectName = context.dialect.name;

    if (dialectName === 'mssql' && defaultVal && defaultVal.toLowerCase() === '(newid())') {
      return null; // disable adding "default value" attribute for UUID fields if generating for MS SQL
    }
    if (
      dialectName === 'mssql' &&
      (['(NULL)', 'NULL'].includes(defaultVal) || typeof defaultVal === 'undefined')
    ) {
      return null; // Override default NULL in MS SQL to javascript null
    }

    if (defaultVal === null || defaultVal === undefined) {
      return null;
    }
    if (isSerialKey) {
      return null; // value generated in the database
    }

    let val_text = defaultVal;
    const quoteWrapper = '"';

    if (_.isString(defaultVal)) {
      const field_type = fieldObj.type.toLowerCase();
      defaultVal = escapeSpecial(defaultVal);

      while (defaultVal.startsWith('(') && defaultVal.endsWith(')')) {
        // remove extra parens around mssql defaults
        defaultVal = defaultVal.replace(/^[(]/, '').replace(/[)]$/, '');
      }

      if (field_type === 'bit(1)' || field_type === 'bit' || field_type === 'boolean') {
        // convert string to boolean
        val_text = /1|true/i.test(defaultVal) ? 'true' : 'false';
      } else if (isArray(field_type)) {
        // remove outer {}
        val_text = defaultVal.replace(/^{/, '').replace(/}$/, '');
        if (val_text && isString(fieldObj.elementType)) {
          // quote the array elements
          val_text = val_text
            .split(',')
            .map((s) => `"${s}"`)
            .join(',');
        }
        val_text = `[${val_text}]`;
      } else if (field_type.match(/^(json)/)) {
        // don't quote json
        val_text = defaultVal;
      } else if (
        field_type === 'uuid' &&
        (defaultVal === 'gen_random_uuid()' || defaultVal === 'uuid_generate_v4()')
      ) {
        val_text = 'DataTypes.UUIDV4';
      } else if (defaultVal.match(/\w+\(\)$/)) {
        // replace db function with sequelize function
        val_text = "Sequelize.Sequelize.fn('" + defaultVal.replace(/\(\)$/g, '') + "')";
      } else if (isNumber(field_type)) {
        if (defaultVal.match(/\(\)/g)) {
          // assume it's a server function if it contains parens
          val_text = "Sequelize.Sequelize.literal('" + defaultVal + "')";
        } else {
          // don't quote numbers
          val_text = defaultVal;
        }
      } else if (defaultVal.match(/\(\)/g)) {
        // embedded function, pass as literal
        val_text = "Sequelize.Sequelize.literal('" + defaultVal + "')";
      } else if (field_type.indexOf('date') === 0 || field_type.indexOf('timestamp') === 0) {
        if (
          _.includes(
            ['current_timestamp', 'current_date', 'current_time', 'localtime', 'localtimestamp'],
            defaultVal.toLowerCase()
          )
        ) {
          val_text = "Sequelize.Sequelize.literal('" + defaultVal + "')";
        } else {
          val_text = quoteWrapper + defaultVal + quoteWrapper;
        }
      } else {
        val_text = quoteWrapper + defaultVal + quoteWrapper;
      }
    }

    return val_text;
  }
}

/**
 * V6 Field Generator - Sequelize v6 style field definitions
 */
export class V6FieldGenerator extends BaseFieldGenerator {
  generateTS(context: GeneratorContext, table: string): FieldGeneratorResult {
    const sp = context.space[1];
    const fields = _.keys(context.tables[table]);
    let str = '';
    let hasTimestamps = context.options.additional?.timestamps === true || false;
    let hasParanoid = context.options.additional?.paranoid === true || false;

    fields.forEach((field) => {
      if (isIgnoredField(field, context.options.skipFields)) {
        return;
      }

      hasTimestamps ||= isTimestampField(field, context.options.additional);
      hasParanoid ||= isParanoidField(field, context.options.additional);

      // Skip timestamp fields in output
      if (
        context.options.additional &&
        context.options.additional.timestamps !== false &&
        (isTimestampField(field, context.options.additional) ||
          isParanoidField(field, context.options.additional))
      ) {
        return;
      }

      str += this.generateFieldV6(context, table, field);
    });

    // trim off last ",\n"
    if (str.length > 2) {
      str = str.substring(0, str.length - 2) + '\n';
    }

    return {
      fields: str,
      hasTimestamps,
      hasParanoid,
      primaryKeys: this.getPrimaryKeys(context, table),
      creationOptionalFields: this.getCreationOptionalFields(context, table),
    };
  }

  generateJS(context: GeneratorContext, table: string): string {
    const fields = _.keys(context.tables[table]);
    let str = '';

    fields.forEach((field) => {
      if (isIgnoredField(field, context.options.skipFields)) {
        return;
      }

      // Skip timestamp fields in output
      if (
        context.options.additional &&
        context.options.additional.timestamps !== false &&
        (isTimestampField(field, context.options.additional) ||
          isParanoidField(field, context.options.additional))
      ) {
        return;
      }

      str += this.generateFieldV6(context, table, field);
    });

    // trim off last ",\n"
    if (str.length > 2) {
      str = str.substring(0, str.length - 2) + '\n';
    }

    return str;
  }

  private generateFieldV6(context: GeneratorContext, table: string, field: string): string {
    const space = context.space;
    const fieldName = recase(context.options.caseProp, field);
    const foreignKey =
      context.foreignKeys[table] && context.foreignKeys[table][field]
        ? context.foreignKeys[table][field]
        : null;
    const fieldObj = context.tables[table][field] as Field;

    if (_.isObject(foreignKey)) {
      fieldObj.foreignKey = foreignKey;
    }

    const unique = fieldObj.unique || (fieldObj.foreignKey && fieldObj.foreignKey.isUnique);
    const isSerialKey = this.isSerialKey(context, fieldObj);
    const quoteWrapper = '"';

    let str = quoteName(fieldName) + ': {\n';
    let wroteAutoIncrement = false;

    // column's attributes
    const fieldAttrs = _.keys(fieldObj);

    fieldAttrs.forEach((attr) => {
      // Skip special attributes
      if (attr === 'special' || attr === 'elementType' || attr === 'unique') {
        return;
      }

      if (isSerialKey && !wroteAutoIncrement) {
        str += space[3] + 'autoIncrement: true,\n';

        // Resort to Postgres' GENERATED BY DEFAULT AS IDENTITY instead of SERIAL
        if (
          context.dialect.name === 'postgres' &&
          fieldObj.foreignKey &&
          fieldObj.foreignKey.isPrimaryKey === true &&
          (fieldObj.foreignKey.generation === 'ALWAYS' || fieldObj.foreignKey.generation === 'BY DEFAULT')
        ) {
          str += space[3] + 'autoIncrementIdentity: true,\n';
        }
        wroteAutoIncrement = true;
      }

      if (attr === 'foreignKey') {
        if (foreignKey && foreignKey.isForeignKey) {
          str += space[3] + 'references: {\n';
          str += space[4] + "model: '" + fieldObj[attr].foreignSources.target_table + "',\n";
          str += space[4] + "key: '" + fieldObj[attr].foreignSources.target_column + "'\n";
          str += space[3] + '},\n';
        }
      } else if (attr === 'references') {
        // covered by foreignKey
      } else if (attr === 'primaryKey') {
        if (fieldObj[attr] === true && (!_.has(fieldObj, 'foreignKey') || !!fieldObj.foreignKey.isPrimaryKey)) {
          str += space[3] + 'primaryKey: true,\n';
        }
      } else if (attr === 'autoIncrement') {
        if (fieldObj[attr] === true && !wroteAutoIncrement) {
          str += space[3] + 'autoIncrement: true,\n';
          if (
            context.dialect.name === 'postgres' &&
            fieldObj.foreignKey &&
            fieldObj.foreignKey.isPrimaryKey === true &&
            (fieldObj.foreignKey.generation === 'ALWAYS' || fieldObj.foreignKey.generation === 'BY DEFAULT')
          ) {
            str += space[3] + 'autoIncrementIdentity: true,\n';
          }
          wroteAutoIncrement = true;
        }
      } else if (attr === 'allowNull') {
        str += space[3] + attr + ': ' + fieldObj[attr] + ',\n';
      } else if (attr === 'defaultValue') {
        const val_text = this.generateDefaultValue(context, fieldObj, isSerialKey);
        if (val_text !== null) {
          str += space[3] + attr + ': ' + val_text + ',\n';
        }
      } else if (attr === 'comment' && (!fieldObj[attr] || context.dialect.name === 'mssql')) {
        // Skip empty comments or mssql comments
      } else {
        let val = attr !== 'type' ? null : getSqType(fieldObj, context.dialect.name);
        if (val == null) {
          val = (fieldObj as any)[attr];
          val = _.isString(val) ? quoteWrapper + escapeSpecial(val) + quoteWrapper : val;
        }
        str += space[3] + attr + ': ' + val + ',\n';
      }
    });

    if (unique) {
      const uniq = _.isString(unique) ? quoteWrapper + unique.replace(/\"/g, '\\"') + quoteWrapper : unique;
      str += space[3] + 'unique: ' + uniq + ',\n';
    }

    if (field !== fieldName) {
      str += space[3] + "field: '" + field + "',\n";
    }

    // removes the last `,` within the attribute options
    str = str.trim().replace(/,+$/, '') + '\n';
    str = space[2] + str + space[2] + '},\n';

    return str;
  }

  /**
   * Generate TypeScript interface fields (for V6 Attributes interface)
   */
  generateTSInterfaceFields(context: GeneratorContext, table: string, isInterface: boolean): string {
    const sp = context.space[1];
    const fields = _.keys(context.tables[table]);
    let str = '';

    fields.forEach((field) => {
      if (isIgnoredField(field, context.options.skipFields)) {
        return;
      }

      const name = quoteName(recase(context.options.caseProp, field));
      const isOptional = this.isFieldOptional(context, table, field);
      str += `${sp}${isInterface ? '' : 'declare '}${name}${isOptional ? '?' : ''}: ${this.getTypeScriptType(
        context,
        table,
        field
      )};\n`;
    });

    return str;
  }
}

/**
 * V7 Field Generator - Sequelize v7 style field definitions with decorators
 */
export class V7FieldGenerator extends BaseFieldGenerator {
  generateTS(context: GeneratorContext, table: string): FieldGeneratorResult {
    const space = context.space;
    const fields = _.keys(context.tables[table]);
    let str = '\n\n';
    let hasTimestamps = context.options.additional?.timestamps === true || false;
    let hasParanoid = context.options.additional?.paranoid === true || false;

    fields.forEach((field) => {
      if (isIgnoredField(field, context.options.skipFields)) {
        return;
      }

      hasTimestamps ||= isTimestampField(field, context.options.additional);
      hasParanoid ||= isParanoidField(field, context.options.additional);

      // Skip timestamp fields in output
      if (
        context.options.additional &&
        context.options.additional.timestamps !== false &&
        (isTimestampField(field, context.options.additional) ||
          isParanoidField(field, context.options.additional))
      ) {
        return;
      }

      str += this.generateFieldV7(context, table, field);
    });

    return {
      fields: str,
      hasTimestamps,
      hasParanoid,
      primaryKeys: this.getPrimaryKeys(context, table),
      creationOptionalFields: this.getCreationOptionalFields(context, table),
    };
  }

  generateJS(context: GeneratorContext, table: string): string {
    // V7 with JS falls back to V6 style
    const v6Generator = new V6FieldGenerator();
    return v6Generator.generateJS(context, table);
  }

  private generateFieldV7(context: GeneratorContext, table: string, field: string): string {
    const space = context.space;
    const fieldName = recase(context.options.caseProp, field);
    const foreignKey =
      context.foreignKeys[table] && context.foreignKeys[table][field]
        ? context.foreignKeys[table][field]
        : null;
    const fieldObj = context.tables[table][field] as Field;

    if (_.isObject(foreignKey)) {
      fieldObj.foreignKey = foreignKey;
    }

    const unique = fieldObj.unique || (fieldObj.foreignKey && fieldObj.foreignKey.isUnique);
    const isSerialKey = this.isSerialKey(context, fieldObj);
    const quoteWrapper = '"';

    let str = '';
    let wroteAutoIncrement = false;

    // Generate decorators
    const fieldAttrs = _.keys(fieldObj);

    fieldAttrs.forEach((attr) => {
      if (attr === 'special' || attr === 'elementType' || attr === 'unique') {
        return;
      }

      if (isSerialKey && !wroteAutoIncrement) {
        str += space[1] + '@AutoIncrement\n';
        wroteAutoIncrement = true;
      }

      if (attr === 'foreignKey') {
        // Foreign keys handled by RelationGenerator in V7
      } else if (attr === 'references') {
        // covered by foreignKey
      } else if (attr === 'primaryKey') {
        if (fieldObj[attr] === true && (!_.has(fieldObj, 'foreignKey') || !!fieldObj.foreignKey.isPrimaryKey)) {
          str += space[1] + '@PrimaryKey\n';
        }
      } else if (attr === 'autoIncrement') {
        if (fieldObj[attr] === true && !wroteAutoIncrement) {
          str += space[1] + '@AutoIncrement\n';
          wroteAutoIncrement = true;
        }
      } else if (attr === 'allowNull') {
        if (fieldObj[attr] === false) {
          str += space[1] + '@NotNull\n';
        }
      } else if (attr === 'defaultValue') {
        const val_text = this.generateDefaultValue(context, fieldObj, isSerialKey);
        if (val_text !== null) {
          str += space[1] + `@Default(${val_text})\n`;
        }
      } else if (attr === 'comment' && fieldObj[attr] && context.dialect.name !== 'mssql') {
        const val = quoteWrapper + escapeSpecial(fieldObj[attr]) + quoteWrapper;
        str += space[1] + `@Comment(${val})\n`;
      } else if (attr === 'type') {
        const val = getSqType(fieldObj, context.dialect.name);
        if (val) {
          str += space[1] + `@Attribute(${val})\n`;
        }
      }
    });

    if (unique) {
      const uniq = _.isString(unique) ? quoteWrapper + unique.replace(/\"/g, '\\"') + quoteWrapper : unique;
      str += space[1] + `@Unique(${uniq})\n`;
    }

    if (field !== fieldName) {
      str += space[1] + `@ColumnName('${field}')\n`;
    }

    // Add the field declaration
    const isOptional = this.isFieldOptional(context, table, field);
    const tsType = this.getTypeScriptType(context, table, field);

    if (wroteAutoIncrement) {
      str += `${space[1]}declare ${quoteName(fieldName)}: CreationOptional<${tsType}>;\n`;
    } else {
      str += `${space[1]}${isOptional ? '' : 'declare '}${quoteName(fieldName)}${isOptional ? '?' : ''}: ${tsType};\n`;
    }

    // Handle paranoid field
    if (isParanoidField(field, context.options.additional)) {
      str += '\n';
      str += space[1] + '@DeletedAt\n';
      str += space[1] + 'declare deletedAt: Date | null;';
    }

    str += '\n';

    return str;
  }
}
