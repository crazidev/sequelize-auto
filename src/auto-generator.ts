import _ from 'lodash';
import { ColumnDescription } from 'sequelize/types';
import { DialectOptions, FKSpec } from './dialects/dialect-options';
import {
  AutoOptions,
  CaseFileOption,
  CaseOption,
  Field,
  IndexSpec,
  LangOption,
  makeIndent,
  makeTableName,
  pluralize,
  qNameJoin,
  qNameSplit,
  recase,
  Relation,
  singularize,
  TableData,
  TSField,
} from './types';

/** Generates text from each table in TableData */
export class AutoGenerator {
  dialect: DialectOptions;
  tables: { [tableName: string]: { [fieldName: string]: ColumnDescription } };
  foreignKeys: { [tableName: string]: { [fieldName: string]: FKSpec } };
  hasTriggerTables: { [tableName: string]: boolean };
  indexes: { [tableName: string]: IndexSpec[] };
  relations: Relation[];
  space: string[];
  options: {
    indentation?: number;
    spaces?: boolean;
    lang?: LangOption;
    caseModel?: CaseOption;
    caseProp?: CaseOption;
    caseFile?: CaseFileOption;
    skipFields?: string[];
    additional?: any;
    schema?: string;
    singularize: boolean;
    useDefine: boolean;
    noIndexes?: boolean;
    version?: 'v6' | 'v7';
  };

  constructor(tableData: TableData, dialect: DialectOptions, options: AutoOptions) {
    this.tables = tableData.tables;
    this.foreignKeys = tableData.foreignKeys;
    this.hasTriggerTables = tableData.hasTriggerTables;
    this.indexes = tableData.indexes;
    this.relations = tableData.relations;
    this.dialect = dialect;
    this.options = options;
    this.options.lang = this.options.lang || 'es5';
    this.options.version = options.version || 'v6';
    this.space = makeIndent(this.options.spaces, this.options.indentation);
  }

  makeHeaderTemplate() {
    let header = '';
    const sp = this.space[1];

    if (this.options.lang === 'ts') {
      if (this.options.version === 'v6') {
        header += "import * as Sequelize from 'sequelize';\n";
        header += "import { DataTypes, Model, CreationOptional } from 'sequelize';\n";
      } else {
        header += this.makeHeaderImportV7();
      }
    } else if (this.options.lang === 'es5') {
      if (this.options.version == 'v6') {
        header += "const { Sequelize, DataTypes, Model } = require('sequelize');\n";
      } else {
        header += this.makeHeaderImportV7();
      }
    } else {
      header += "import _sequelize from 'sequelize';\n";
      header += 'const { Model, Sequelize, DataTypes } = _sequelize;\n\n';
    }
    return header;
  }

  /// Generate import header for sequelize version 7 ESM
  makeHeaderImportV7() {
    var header = '';
    header += "import * as Sequelize from '@sequelize/core';\n";
    header += "import { DataTypes, Model, InferAttributes, InferCreationAttributes } from '@sequelize/core';\n";
    header += `import ${
      this.options.lang === 'ts' ? 'type ' : ''
    }{ CreationOptional, NonAttribute } from '@sequelize/core';\n`;
    header +=
      "import { Attribute, PrimaryKey, AutoIncrement, ColumnName, NotNull, Default, Table, Unique, Comment, BelongsToMany, BelongsTo, HasMany, HasOne } from '@sequelize/core/decorators-legacy';\n\n";
    return header;
  }

  generateText() {
    const tableNames = _.keys(this.tables);
    const text: { [name: string]: string } = {};

    const header = this.makeHeaderTemplate();

    tableNames.forEach((table) => {
      let str = header;
      const [schemaName, tableNameOrig] = qNameSplit(table);
      const tableName = makeTableName(
        this.options.caseModel,
        tableNameOrig,
        this.options.singularize,
        this.options.lang
      );

      const associations = this.addTypeScriptAssociationMixins(table);
      if (this.options.lang == 'ts') {
        const needed = _.keys(associations.needed).sort();
        needed.forEach((fkTable) => {
          const set = associations.needed[fkTable];
          const [fkSchema, fkTableName] = qNameSplit(fkTable);
          const filename = recase(this.options.caseFile, fkTableName, this.options.singularize);
          str += `import ${this.options.lang === 'ts' ? '' : ''} { `;
          str += Array.from(set.values()).sort().join(', ');
          str += ` } from './${filename}${this.options.lang === 'ts' ? '' : '.js'}';\n`;
        });
      }

      str += '\n';

      if (this.options.version === 'v6') {
        if (this.options.lang === 'ts') {
          str +=
            'export class #TABLE# extends Model<\n Sequelize.InferAttributes<#TABLE#>,\n Sequelize.InferCreationAttributes<#TABLE#>\n> {\n';
          str += this.addTypeScriptFields(table, false);
          str += '\n';
          str += this.space[1] + 'static initModel(sequelize: Sequelize.Sequelize): typeof #TABLE# {\n';
        } else {
          if (this.options.lang !== 'es5') {
            str += 'export ';
          }
          str += this.space[1] + 'static initModel(sequelize) {\n';
        }

        if (this.options.useDefine) {
          str += this.space[2] + "return sequelize.define('#TABLE#', {\n";
        } else {
          str += this.space[2] + 'return #TABLE#.init({\n';
        }
      } else {
        str += this.generateTabelOptionV7(table);
        if (this.options.lang === 'ts') {
          str += 'export class #TABLE# extends Model<InferAttributes<#TABLE#>, InferCreationAttributes<#TABLE#>> {';
        } else {
          str += 'export class #TABLE# extends Model {';
        }
      }

      str += this.addTable(table);

      const lang = this.options.lang;
      if (this.options.version === 'v6') {
        if (lang === 'ts' && this.options.useDefine) {
          str += ') as typeof #TABLE#;\n';
        } else {
          str += ');\n';
        }
      }

      if (this.options.version === 'v6') {
        str += this.space[1] + '}\n';
      }

      if (this.options.lang === 'ts') {
        str += '\n' + associations.str;
        str += '}\n';
      } else {
        str += '}\n';
      }

      if (this.options.lang === 'es5') {
        str += 'module.exports = #TABLE#;';
      }

      const re = new RegExp('#TABLE#', 'g');
      str = str.replace(re, tableName);

      text[table] = str;
    });

    return text;
  }

  generateMigration() {
    const tableNames = _.keys(this.tables);

    const text: { [name: string]: string } = {};

    tableNames.forEach((table) => {
      let str = '';
      let fk_str = '';
      const [schemaName, tableNameOrig] = qNameSplit(table);
      const fields = _.keys(this.tables[table]);

      const tableName = makeTableName(
        this.options.caseModel,
        tableNameOrig,
        this.options.singularize,
        this.options.lang
      );

      str += `"use strict";\n`;
      str += `const { DataTypes } = require("sequelize");\n\n`;
      str += `/** @type {import('sequelize-cli').Migration} */\n`;
      str += `module.exports = {\n`;
      str += `${this.space[1]}up(queryInterface, Sequelize) {\n`;
      str += `${this.space[2]}return queryInterface.sequelize.transaction(t => {\n`;
      str += `${this.space[3]}return Promise.all([\n`;
      str += `${this.space[4]}queryInterface.createTable("${tableNameOrig}", {\n`;
      fields.forEach((field, index) => {
        str += this.addField(table, field, false);
      });
      str += `${this.space[4]}}, { transaction: t }),\n`;
      str += `${this.space[3]}]);\n`;
      str += `${this.space[2]}}\n`;
      str += `${this.space[1]})},\n`;

      str += `${this.space[1]}down(queryInterface, Sequelize) {\n`;
      str += `${this.space[2]}return queryInterface.sequelize.transaction(t => {\n`;
      str += `${this.space[3]}return Promise.all([\n`;
      str += `${this.space[4]}queryInterface.dropTable("${tableNameOrig}", { transaction: t }),\n`;
      str += `${this.space[3]}]);\n`;
      str += `${this.space[2]}}\n`;
      str += `${this.space[1]})},\n`;

      str += `}`;

      const re = new RegExp('#TABLE#', 'g');
      str = str.replace(re, tableName);

      text[table] = str;
    });

    return text;
  }

  generateTabelOptionV7(table: string) {
    const [, tableNameOrig] = qNameSplit(table);
    const space = this.space;
    let timestamps = (this.options.additional && this.options.additional.timestamps === true) || false;
    let paranoid = (this.options.additional && this.options.additional.paranoid === true) || false;
    var str = '';

    str += `@Table({ timestamps: ${timestamps}, tableName: '${tableNameOrig}' })\n`;
    return str;
  }

  // Create a string for the model of the table
  private addTable(table: string) {
    const [schemaName, tableNameOrig] = qNameSplit(table);
    const space = this.space;
    let timestamps = (this.options.additional && this.options.additional.timestamps === true) || false;
    let paranoid = (this.options.additional && this.options.additional.paranoid === true) || false;

    // add all the fields
    let str = '\n';
    const fields = _.keys(this.tables[table]);
    fields.forEach((field, index) => {
      timestamps ||= this.isTimestampField(field);
      paranoid ||= this.isParanoidField(field);
      str += this.addField(table, field, true);
    });

    if (this.options.version === 'v6') {
      // trim off last ",\n"
      str = str.substring(0, str.length - 2) + '\n';

      // add the table options
      str += space[1] + '}, {\n';
      if (!this.options.useDefine) {
        str += space[2] + 'sequelize,\n';
      }
      str += space[2] + "tableName: '" + tableNameOrig + "',\n";

      if (schemaName && this.dialect.hasSchema) {
        str += space[2] + "schema: '" + schemaName + "',\n";
      }

      if (this.hasTriggerTables[table]) {
        str += space[2] + 'hasTrigger: true,\n';
      }

      str += space[2] + 'timestamps: ' + timestamps + ',\n';
      if (paranoid) {
        str += space[2] + 'paranoid: true,\n';
      }

      // conditionally add additional options
      const hasadditional = _.isObject(this.options.additional) && _.keys(this.options.additional).length > 0;
      if (hasadditional) {
        _.each(this.options.additional, (value, key) => {
          if (key === 'name') {
            // name: true - preserve table name always
            str += space[2] + 'name: {\n';
            str += space[3] + "singular: '" + table + "',\n";
            str += space[3] + "plural: '" + table + "'\n";
            str += space[2] + '},\n';
          } else if (key === 'timestamps' || key === 'paranoid') {
            // handled above
          } else {
            value = _.isBoolean(value) ? value : "'" + value + "'";
            str += space[2] + key + ': ' + value + ',\n';
          }
        });
      }

      // add indexes
      if (!this.options.noIndexes) {
        str += this.addIndexes(table);
      }

      str = space[2] + str.trim();
      str = str.substring(0, str.length - 1);
      str += '\n' + space[1] + '}';
    }

    return str;
  }

  // Create a string containing field attributes (type, defaultValue, etc.)
  private addField(table: string, field: string, add_reference: boolean): string {
    // ignore Sequelize standard fields
    const additional = this.options.additional;
    if (
      additional &&
      additional.timestamps !== false &&
      (this.isTimestampField(field) || this.isParanoidField(field))
    ) {
      return '';
    }

    if (this.isIgnoredField(field)) {
      return '';
    }

    // Find foreign key
    const foreignKey =
      this.foreignKeys[table] && this.foreignKeys[table][field] ? this.foreignKeys[table][field] : null;
    const fieldObj = this.tables[table][field] as Field;

    if (_.isObject(foreignKey)) {
      fieldObj.foreignKey = foreignKey;
    }

    let str = '';
    const fieldName = recase(this.options.caseProp, field);
    if (this.options.version === 'v6') {
      str = this.quoteName(fieldName) + ': {\n';
    }
    const quoteWrapper = '"';

    const unique = fieldObj.unique || (fieldObj.foreignKey && fieldObj.foreignKey.isUnique);

    const isSerialKey =
      (fieldObj.foreignKey && fieldObj.foreignKey.isSerialKey) ||
      (this.dialect.isSerialKey && this.dialect.isSerialKey(fieldObj));

    let wroteAutoIncrement = false;
    const space = this.space;

    // column's attributes
    const fieldAttrs = _.keys(fieldObj);

    fieldAttrs.forEach((attr, index) => {
      // We don't need the special attribute from postgresql; "unique" is handled separately
      if (attr === 'special' || attr === 'elementType' || attr === 'unique') {
        return true;
      }

      if (isSerialKey && !wroteAutoIncrement) {
        if (this.options.version === 'v6') {
          str += space[3] + 'autoIncrement: true,\n';

          // Resort to Postgres' GENERATED BY DEFAULT AS IDENTITY instead of SERIAL
          if (
            this.dialect.name === 'postgres' &&
            fieldObj.foreignKey &&
            fieldObj.foreignKey.isPrimaryKey === true &&
            (fieldObj.foreignKey.generation === 'ALWAYS' || fieldObj.foreignKey.generation === 'BY DEFAULT')
          ) {
            str += space[3] + 'autoIncrementIdentity: true,\n';
          }
        } else {
          str += space[1] + '@AutoIncrement\n';
        }

        wroteAutoIncrement = true;
      }

      if (attr === 'foreignKey') {
        if (foreignKey && foreignKey.isForeignKey && add_reference == true) {
          if (this.options.version === 'v6') {
            str += space[3] + 'references: {\n';
            str += space[4] + "model: '" + fieldObj[attr].foreignSources.target_table + "',\n";
            str += space[4] + "key: '" + fieldObj[attr].foreignSources.target_column + "'\n";
            str += space[3] + '},\n';
          }
        } else {
          return true;
        }
      } else if (attr === 'references') {
        // covered by foreignKey
        return true;
      } else if (attr === 'primaryKey') {
        if (fieldObj[attr] === true && (!_.has(fieldObj, 'foreignKey') || !!fieldObj.foreignKey.isPrimaryKey)) {
          if (this.options.version === 'v6') {
            str += space[3] + 'primaryKey: true,\n';
          } else {
            str += space[1] + '@PrimaryKey\n';
          }
        } else {
          return true;
        }
      } else if (attr === 'autoIncrement') {
        if (fieldObj[attr] === true && !wroteAutoIncrement) {
          str += space[3] + 'autoIncrement: true,\n';
          // Resort to Postgres' GENERATED BY DEFAULT AS IDENTITY instead of SERIAL
          if (
            this.dialect.name === 'postgres' &&
            fieldObj.foreignKey &&
            fieldObj.foreignKey.isPrimaryKey === true &&
            (fieldObj.foreignKey.generation === 'ALWAYS' || fieldObj.foreignKey.generation === 'BY DEFAULT')
          ) {
            str += space[3] + 'autoIncrementIdentity: true,\n';
          }
          wroteAutoIncrement = true;
        }
        return true;
      } else if (attr === 'allowNull') {
        if (this.options.version === 'v6') {
          str += space[3] + attr + ': ' + fieldObj[attr] + ',\n';
        } else {
          if (fieldObj[attr] == false) {
            str += space[1] + '@NotNull\n';
          }
        }
      } else if (attr === 'defaultValue') {
        let defaultVal = fieldObj.defaultValue;
        if (this.dialect.name === 'mssql' && defaultVal && defaultVal.toLowerCase() === '(newid())') {
          defaultVal = null as any; // disable adding "default value" attribute for UUID fields if generating for MS SQL
        }
        if (
          this.dialect.name === 'mssql' &&
          (['(NULL)', 'NULL'].includes(defaultVal) || typeof defaultVal === 'undefined')
        ) {
          defaultVal = null as any; // Override default NULL in MS SQL to javascript null
        }

        if (defaultVal === null || defaultVal === undefined) {
          return true;
        }
        if (isSerialKey) {
          return true; // value generated in the database
        }

        let val_text = defaultVal;
        if (_.isString(defaultVal)) {
          const field_type = fieldObj.type.toLowerCase();
          defaultVal = this.escapeSpecial(defaultVal);

          while (defaultVal.startsWith('(') && defaultVal.endsWith(')')) {
            // remove extra parens around mssql defaults
            defaultVal = defaultVal.replace(/^[(]/, '').replace(/[)]$/, '');
          }

          if (field_type === 'bit(1)' || field_type === 'bit' || field_type === 'boolean') {
            // convert string to boolean
            val_text = /1|true/i.test(defaultVal) ? 'true' : 'false';
          } else if (this.isArray(field_type)) {
            // remove outer {}
            val_text = defaultVal.replace(/^{/, '').replace(/}$/, '');
            if (val_text && this.isString(fieldObj.elementType)) {
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
          } else if (this.isNumber(field_type)) {
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

        // val_text = _.isString(val_text) && !val_text.match(/^sequelize\.[^(]+\(.*\)$/)
        // ? self.sequelize.escape(_.trim(val_text, '"'), null, self.options.dialect)
        // : val_text;
        // don't prepend N for MSSQL when building models...
        // defaultVal = _.trimStart(defaultVal, 'N');

        if (this.options.version === 'v6') {
          str += space[3] + attr + ': ' + val_text + ',\n';
        } else {
          str += space[1] + `@Default(${val_text})\n`;
        }
      } else if (attr === 'comment' && (!fieldObj[attr] || this.dialect.name === 'mssql')) {
        return true;
      } else {
        let val = attr !== 'type' ? null : this.getSqType(fieldObj, attr);
        if (val == null) {
          val = (fieldObj as any)[attr];
          val = _.isString(val) ? quoteWrapper + this.escapeSpecial(val) + quoteWrapper : val;
        }

        if (this.options.version === 'v6') {
          str += space[3] + attr + ': ' + val;
          str += ',\n';
        } else {
          if (attr == 'comment') {
            str += space[1] + `@Comment(${val})\n`;
          } else {
            str += space[1] + `@Attribute(${val})\n`;
          }
        }
      }
    });

    if (unique) {
      const uniq = _.isString(unique) ? quoteWrapper + unique.replace(/\"/g, '\\"') + quoteWrapper : unique;
      if (this.options.version == 'v6') {
        str += space[3] + 'unique: ' + uniq + ',\n';
      } else {
        str += space[1] + `@Unique(${uniq})\n`;
      }
    }

    if (field !== fieldName) {
      if (this.options.version === 'v6') {
        str += space[3] + "field: '" + field + "',\n";
      } else {
        str += space[1] + `@ColumnName('${field}')\n`;
      }
    }

    if (this.options.version === 'v6') {
      // removes the last `,` within the attribute options
      str = str.trim().replace(/,+$/, '') + '\n';
      str = space[2] + str + space[2] + '},\n';
    } else {
      str += this.generateTypeScriptDeclareV7(table, false, field, wroteAutoIncrement);
      if (this.isParanoidField(field)) {
        str += '\n';
        str += space[1] + '@DeletedAt';
        str += space[1] + 'declare deletedAt: Date | null;';
      }
      // str += space[1] + "declare " + this.quoteName(fieldName) + ': any \n';
    }
    str += '\n';
    return str;
  }

  private addIndexes(table: string) {
    const indexes = this.indexes[table];
    const space = this.space;
    let str = '';
    if (indexes && indexes.length) {
      str += space[2] + 'indexes: [\n';
      indexes.forEach((idx) => {
        str += space[3] + '{\n';
        if (idx.name) {
          str += space[4] + `name: "${idx.name}",\n`;
        }
        if (idx.unique) {
          str += space[4] + 'unique: true,\n';
        }
        if (idx.type) {
          if (['UNIQUE', 'FULLTEXT', 'SPATIAL'].includes(idx.type)) {
            str += space[4] + `type: "${idx.type}",\n`;
          } else {
            str += space[4] + `using: "${idx.type}",\n`;
          }
        }
        str += space[4] + `fields: [\n`;
        idx.fields.forEach((ff) => {
          str += space[5] + `{ name: "${ff.attribute}"`;
          if (ff.collate) {
            str += `, collate: "${ff.collate}"`;
          }
          if (ff.length) {
            str += `, length: ${ff.length}`;
          }
          if (ff.order && ff.order !== 'ASC') {
            str += `, order: "${ff.order}"`;
          }
          str += ' },\n';
        });
        str += space[4] + ']\n';
        str += space[3] + '},\n';
      });
      str += space[2] + '],\n';
    }
    return str;
  }

  /** Get the sequelize type from the Field */
  private getSqType(fieldObj: Field, attr: string): string {
    const attrValue = (fieldObj as any)[attr];
    if (!attrValue.toLowerCase) {
      console.log('attrValue', attr, attrValue);
      return attrValue;
    }
    const type: string = attrValue.toLowerCase();
    const length = type.match(/\(\d+\)/);
    const precision = type.match(/\(\d+,\d+\)/);
    let val = null;
    let typematch = null;

    if (type === 'boolean' || type === 'bit(1)' || type === 'bit' || type === 'tinyint(1)') {
      val = 'DataTypes.BOOLEAN';

      // postgres range types
    } else if (type === 'numrange') {
      val = 'DataTypes.RANGE(DataTypes.DECIMAL)';
    } else if (type === 'int4range') {
      val = 'DataTypes.RANGE(DataTypes.INTEGER)';
    } else if (type === 'int8range') {
      val = 'DataTypes.RANGE(DataTypes.BIGINT)';
    } else if (type === 'daterange') {
      val = 'DataTypes.RANGE(DataTypes.DATEONLY)';
    } else if (type === 'tsrange' || type === 'tstzrange') {
      val = 'DataTypes.RANGE(DataTypes.DATE)';
    } else if ((typematch = type.match(/^(bigint|smallint|mediumint|tinyint|int)/))) {
      // integer subtypes
      val = 'DataTypes.' + (typematch[0] === 'int' ? 'INTEGER' : typematch[0].toUpperCase());
      if (/unsigned/i.test(type)) {
        val += '.UNSIGNED';
      }
      if (/zerofill/i.test(type)) {
        val += '.ZEROFILL';
      }
    } else if (type === 'nvarchar(max)' || type === 'varchar(max)') {
      val = 'DataTypes.TEXT';
    } else if (type.match(/n?varchar|string|varying/)) {
      val = 'DataTypes.STRING' + (!_.isNull(length) ? length : '');
    } else if (type.match(/^n?char/)) {
      val = 'DataTypes.CHAR' + (!_.isNull(length) ? length : '');
    } else if (type.match(/^real/)) {
      val = 'DataTypes.REAL';
    } else if (type.match(/text$/)) {
      val = 'DataTypes.TEXT' + (!_.isNull(length) ? length : '');
    } else if (type === 'date') {
      val = 'DataTypes.DATEONLY';
    } else if (type.match(/^(date|timestamp|year)/)) {
      val = 'DataTypes.DATE' + (!_.isNull(length) ? length : '');
    } else if (type.match(/^(time)/)) {
      val = 'DataTypes.TIME';
    } else if (type.match(/^(float|float4)/)) {
      val = 'DataTypes.FLOAT' + (!_.isNull(precision) ? precision : '');
    } else if (type.match(/^(decimal|numeric)/)) {
      val = 'DataTypes.DECIMAL' + (!_.isNull(precision) ? precision : '');
    } else if (type.match(/^money/)) {
      val = 'DataTypes.DECIMAL(19,4)';
    } else if (type.match(/^smallmoney/)) {
      val = 'DataTypes.DECIMAL(10,4)';
    } else if (type.match(/^(float8|double)/)) {
      val = 'DataTypes.DOUBLE' + (!_.isNull(precision) ? precision : '');
    } else if (type.match(/^uuid|uniqueidentifier/)) {
      val = 'DataTypes.UUID';
    } else if (type.match(/^jsonb/)) {
      val = 'DataTypes.JSONB';
    } else if (type.match(/^json/)) {
      val = 'DataTypes.JSON';
    } else if (type.match(/^geometry/)) {
      const gtype = fieldObj.elementType ? `(${fieldObj.elementType})` : '';
      val = `DataTypes.GEOMETRY${gtype}`;
    } else if (type.match(/^geography/)) {
      const gtype = fieldObj.elementType ? `(${fieldObj.elementType})` : '';
      val = `DataTypes.GEOGRAPHY${gtype}`;
    } else if (type.match(/^array/)) {
      const eltype = this.getSqType(fieldObj, 'elementType');
      val = `DataTypes.ARRAY(${eltype})`;
    } else if (type.match(/(binary|image|blob|bytea)/)) {
      val = 'DataTypes.BLOB';
    } else if (type.match(/^hstore/)) {
      val = 'DataTypes.HSTORE';
    } else if (type.match(/^inet/)) {
      val = 'DataTypes.INET';
    } else if (type.match(/^cidr/)) {
      val = 'DataTypes.CIDR';
    } else if (type.match(/^oid/)) {
      val = 'DataTypes.INTEGER';
    } else if (type.match(/^macaddr/)) {
      val = 'DataTypes.MACADDR';
    } else if (type.match(/^enum(\(.*\))?$/)) {
      const enumValues = this.getEnumValues(fieldObj);
      val = `DataTypes.ENUM(${enumValues})`;
    }

    return val as string;
  }

  private getTypeScriptPrimaryKeys(table: string): Array<string> {
    const fields = _.keys(this.tables[table]);
    return fields.filter((field): boolean => {
      const fieldObj = this.tables[table][field];
      return fieldObj['primaryKey'];
    });
  }

  private getTypeScriptCreationOptionalFields(table: string): Array<string> {
    const fields = _.keys(this.tables[table]);
    return fields.filter((field): boolean => {
      const fieldObj = this.tables[table][field];
      return (
        fieldObj.allowNull ||
        !!fieldObj.defaultValue ||
        fieldObj.defaultValue === '' ||
        fieldObj.autoIncrement ||
        this.isTimestampField(field)
      );
    });
  }

  /** Add schema to table so it will match the relation data.  Fixes mysql problem. */
  private addSchemaForRelations(table: string) {
    if (!table.includes('.') && !this.relations.some((rel) => rel.childTable === table)) {
      // if no tables match the given table, then assume we need to fix the schema
      const first = this.relations.find((rel) => !!rel.childTable);
      if (first) {
        const [schemaName, tableName] = qNameSplit(first.childTable);
        if (schemaName) {
          table = qNameJoin(schemaName, table);
        }
      }
    }
    return table;
  }

  private addTypeScriptAssociationMixins(table: string): Record<string, any> {
    const sp = this.space[1];
    const needed: Record<string, Set<String>> = {};
    let str = '';

    table = this.addSchemaForRelations(table);

    this.relations.forEach((rel) => {
      if (!rel.isM2M) {
        if (rel.childTable === table) {
          // current table is a child that belongsTo parent
          const pparent = _.upperFirst(rel.parentProp);
          str += `${sp}// ${rel.childModel} belongsTo ${rel.parentModel} via ${rel.parentId}\n`;
          if (this.options.version === 'v7') {
            str +=
              sp +
              `@BelongsTo(() => ${rel.parentModel}, { foreignKey: '${rel.parentId}', inverse: { as: '${
                rel.parentProp
              }', type: '${rel.isOne ? 'hasOne' : 'hasMany'}' }})\n`;
            str += sp + `declare ${rel.parentProp}?: NonAttribute<${rel.parentModel}>\n\n`;
          } else {
            str += `${sp}declare ${rel.parentProp}?: ${rel.parentModel};\n`;
          }
          str += `${sp}declare get${pparent}: Sequelize.BelongsToGetAssociationMixin<${rel.parentModel}>;\n`;
          str += `${sp}declare set${pparent}: Sequelize.BelongsToSetAssociationMixin<${rel.parentModel}, number>;\n`;
          str += `${sp}declare create${pparent}: Sequelize.BelongsToCreateAssociationMixin<${rel.parentModel}>;\n\n`;

          needed[rel.parentTable] ??= new Set();
          needed[rel.parentTable].add(rel.parentModel);
        } else if (rel.parentTable === table) {
          needed[rel.childTable] ??= new Set();
          const pchild = _.upperFirst(rel.childProp);
          if (rel.isOne) {
            // const hasModelSingular = singularize(hasModel);
            str += `${sp}// ${rel.parentModel} hasOne ${rel.childModel} via ${rel.parentId}\n`;
            if (this.options.version === 'v7') {
              str +=
                sp +
                `@HasOne(() => ${rel.childModel}, { foreignKey: '${rel.parentId}', inverse: { as: '${rel.childProp}' }})\n`;
              str += sp + `declare ${rel.childProp}?: NonAttribute<${rel.childModel}>\n\n`;
            } else {
              str += `${sp}declare ${rel.childProp}?: ${rel.parentId};\n`;
            }
            str += `${sp}declare get${pchild}: Sequelize.HasOneGetAssociationMixin<${rel.childModel}>;\n`;
            str += `${sp}declare set${pchild}: Sequelize.HasOneSetAssociationMixin<${rel.childModel}, number>;\n`;
            str += `${sp}declare create${pchild}: Sequelize.HasOneCreateAssociationMixin<${rel.childModel}>;\n`;

            needed[rel.childTable].add(rel.childModel);
          } else {
            const hasModel = rel.childModel;
            const sing = _.upperFirst(singularize(rel.childProp));
            const lur = pluralize(rel.childProp);
            const plur = _.upperFirst(lur);
            str += `${sp}// ${rel.parentModel} hasMany ${rel.childModel} via ${rel.parentId}\n`;
            if (this.options.version === 'v7') {
              str +=
                sp +
                `@HasMany(() => ${rel.childModel}, { foreignKey: '${rel.parentId}', inverse: { as: '${rel.childProp}' } })\n`;
              str += sp + `declare ${rel.childProp}?: NonAttribute<${rel.childModel}[]>\n\n`;
            } else {
              str += `${sp}declare ${lur}: Sequelize.NonAttribute<${rel.childModel}[]>;\n`;
            }
            str += `${sp}declare get${plur}: Sequelize.HasManyGetAssociationsMixin<${hasModel}>;\n`;
            str += `${sp}declare set${plur}: Sequelize.HasManySetAssociationsMixin<${hasModel}, number>;\n`;
            str += `${sp}declare add${sing}: Sequelize.HasManyAddAssociationMixin<${hasModel}, number>;\n`;
            str += `${sp}declare add${plur}: Sequelize.HasManyAddAssociationsMixin<${hasModel}, number>;\n`;
            str += `${sp}declare create${sing}: Sequelize.HasManyCreateAssociationMixin<${hasModel}>;\n`;
            str += `${sp}declare remove${sing}: Sequelize.HasManyRemoveAssociationMixin<${hasModel}, number>;\n`;
            str += `${sp}declare remove${plur}: Sequelize.HasManyRemoveAssociationsMixin<${hasModel}, number>;\n`;
            str += `${sp}declare has${sing}: Sequelize.HasManyHasAssociationMixin<${hasModel}, number>;\n`;
            str += `${sp}declare has${plur}: Sequelize.HasManyHasAssociationsMixin<${hasModel}, number>;\n`;
            str += `${sp}declare count${plur}: Sequelize.HasManyCountAssociationsMixin${
              this.options.version === 'v7' ? `<${hasModel}>` : ''
            };\n\n`;

            needed[rel.childTable].add(hasModel);
          }
        }
      } else {
        // rel.isM2M
        if (rel.parentTable === table) {
          // many-to-many
          const isParent = rel.parentTable === table;
          const thisModel = isParent ? rel.parentModel : rel.childModel;
          const otherModel = isParent ? rel.childModel : rel.parentModel;
          const otherModelSingular = _.upperFirst(singularize(isParent ? rel.childProp : rel.parentProp));
          const lotherModelPlural = pluralize(isParent ? rel.childProp : rel.parentProp);
          const otherModelPlural = _.upperFirst(lotherModelPlural);
          const otherTable = isParent ? rel.childTable : rel.parentTable;
          str += `${sp}// ${thisModel} belongsToMany ${otherModel} via ${rel.parentId} and ${rel.childId}\n`;

          if (this.options.version === 'v7') {
            str += `${sp}@BelongsToMany(() => ${otherModel}, { through: ()=> ${rel.joinModel}, foreignKey: '${rel.parentId}', inverse:  { as: '${rel.childProp}'}, otherKey: '${rel.childId}', })\n`;
            str += sp + `declare ${rel.childProp}?: NonAttribute<${otherModel}[]>\n\n`;
          } else {
            str += `${sp}declare ${lotherModelPlural}: ${otherModel}[];\n`;
          }
          str += `${sp}declare get${otherModelPlural}: Sequelize.BelongsToManyGetAssociationsMixin<${otherModel}>;\n`;
          str += `${sp}declare set${otherModelPlural}: Sequelize.BelongsToManySetAssociationsMixin<${otherModel}, number>;\n`;
          str += `${sp}declare add${otherModelSingular}: Sequelize.BelongsToManyAddAssociationMixin<${otherModel}, number>;\n`;
          str += `${sp}declare add${otherModelPlural}: Sequelize.BelongsToManyAddAssociationsMixin<${otherModel}, number>;\n`;
          str += `${sp}declare create${otherModelSingular}: Sequelize.BelongsToManyCreateAssociationMixin<${otherModel}>;\n`;
          str += `${sp}declare remove${otherModelSingular}: Sequelize.BelongsToManyRemoveAssociationMixin<${otherModel}, number>;\n`;
          str += `${sp}declare remove${otherModelPlural}: Sequelize.BelongsToManyRemoveAssociationsMixin<${otherModel}, number>;\n`;
          str += `${sp}declare has${otherModelSingular}: Sequelize.BelongsToManyHasAssociationMixin<${otherModel}, number>;\n`;
          str += `${sp}declare has${otherModelPlural}: Sequelize.BelongsToManyHasAssociationsMixin<${otherModel}, number>;\n`;
          str += `${sp}declare count${otherModelPlural}: Sequelize.BelongsToManyCountAssociationsMixin${
            this.options.version === 'v7' ? `<${otherModel}>` : ''
          };\n`;

          needed[otherTable] ??= new Set();
          needed[otherTable].add(otherModel);
        }
      }
    });
    if (needed[table]) {
      delete needed[table]; // don't add import for self
    }

    return { needed, str };
  }

  private addTypeScriptFields(table: string, isInterface: boolean) {
    const sp = this.space[1];
    const fields = _.keys(this.tables[table]);
    let str = '';
    fields.forEach((field) => {
      if (!this.options.skipFields || !this.options.skipFields.includes(field)) {
        const name = this.quoteName(recase(this.options.caseProp, field));
        const isOptional = this.getTypeScriptFieldOptional(table, field);
        const isPrimaryKey = this.getTypeScriptPrimaryKeys(table).includes(name);

        if (isPrimaryKey) {
          str += `${sp}${isInterface ? '' : 'declare '}${name}${
            isOptional ? '?' : ''
          }: CreationOptional<${this.getTypeScriptType(table, field)}>;\n`;
        } else {
          str += `${sp}${isInterface ? '' : 'declare '}${name}${isOptional ? '?' : ''}: ${this.getTypeScriptType(
            table,
            field
          )};\n`;
        }
      }
    });
    return str;
  }

  private generateTypeScriptDeclareV7(table: string, isInterface: boolean, column: string, isAutoIncrement: boolean) {
    const sp = this.space[1];
    const fields = _.keys(this.tables[table]);
    var str = '';
    fields.forEach((field) => {
      if (!this.options.skipFields || !this.options.skipFields.includes(field)) {
        const name = this.quoteName(recase(this.options.caseProp, field));
        const isOptional = this.getTypeScriptFieldOptional(table, field);

        if (field == column) {
          if (this.options.lang === 'ts') {
            if (isAutoIncrement) {
              str += `${sp}declare ${name}: CreationOptional<${this.getTypeScriptType(table, field)}>;\n`;
            } else {
              if (this.options.lang === 'ts') {
                str += `${sp}${isInterface ? '' : 'declare '}${name}${isOptional ? '?' : ''}: ${this.getTypeScriptType(
                  table,
                  field
                )};\n`;
              }
            }
          } else {
            str += `${sp}${name};\n`;
          }
        }
      }
    });

    return str;
  }

  private getTypeScriptFieldOptional(table: string, field: string) {
    const fieldObj = this.tables[table][field];
    return fieldObj.allowNull;
  }

  private getTypeScriptType(table: string, field: string) {
    const fieldObj = this.tables[table][field] as TSField;
    return this.getTypeScriptFieldType(fieldObj, 'type');
  }

  private getTypeScriptFieldType(fieldObj: TSField, attr: keyof TSField) {
    const rawFieldType = fieldObj[attr] || '';
    const fieldType = String(rawFieldType).toLowerCase();

    let jsType: string;

    if (this.isArray(fieldType)) {
      const eltype = this.getTypeScriptFieldType(fieldObj, 'elementType');
      jsType = eltype + '[]';
    } else if (this.isNumber(fieldType)) {
      jsType = 'number';
    } else if (this.isBoolean(fieldType)) {
      jsType = 'boolean';
    } else if (this.isDate(fieldType)) {
      jsType = 'Date';
    } else if (this.isString(fieldType)) {
      jsType = 'string';
    } else if (this.isEnum(fieldType)) {
      const values = this.getEnumValues(fieldObj);
      jsType = values.join(' | ');
    } else if (this.isJSON(fieldType)) {
      jsType = 'object';
    } else {
      console.log(`Missing TypeScript type: ${fieldType || fieldObj['type']}`);
      jsType = 'any';
    }
    return jsType;
  }

  private getEnumValues(fieldObj: TSField): string[] {
    if (fieldObj.special) {
      // postgres
      return fieldObj.special.map((v) => `"${v}"`);
    } else {
      // mysql
      return fieldObj.type.substring(5, fieldObj.type.length - 1).split(',');
    }
  }

  private isTimestampField(field: string) {
    const additional = this.options.additional;
    if (additional.timestamps === false) {
      return false;
    }
    return (
      (!additional.createdAt && recase('c', field) === 'createdAt') ||
      additional.createdAt === field ||
      (!additional.updatedAt && recase('c', field) === 'updatedAt') ||
      additional.updatedAt === field
    );
  }

  private isParanoidField(field: string) {
    const additional = this.options.additional;
    if (additional.timestamps === false || additional.paranoid === false) {
      return false;
    }
    return (!additional.deletedAt && recase('c', field) === 'deletedAt') || additional.deletedAt === field;
  }

  private isIgnoredField(field: string) {
    return this.options.skipFields && this.options.skipFields.includes(field);
  }

  private escapeSpecial(val: string) {
    if (typeof val !== 'string') {
      return val;
    }
    return val
      .replace(/[\\]/g, '\\\\')
      .replace(/[\"]/g, '\\"')
      .replace(/[\/]/g, '\\/')
      .replace(/[\b]/g, '\\b')
      .replace(/[\f]/g, '\\f')
      .replace(/[\n]/g, '\\n')
      .replace(/[\r]/g, '\\r')
      .replace(/[\t]/g, '\\t');
  }

  /** Quote the name if it is not a valid identifier */
  private quoteName(name: string) {
    return /^[$A-Z_][0-9A-Z_$]*$/i.test(name) ? name : "'" + name + "'";
  }

  private isNumber(fieldType: string): boolean {
    return /^(smallint|mediumint|tinyint|int|bigint|float|money|smallmoney|double|decimal|numeric|real|oid)/.test(
      fieldType
    );
  }

  private isBoolean(fieldType: string): boolean {
    return /^(boolean|bit)/.test(fieldType);
  }

  private isDate(fieldType: string): boolean {
    return /^(datetime|timestamp)/.test(fieldType);
  }

  private isString(fieldType: string): boolean {
    return /^(char|nchar|string|varying|varchar|nvarchar|text|longtext|mediumtext|tinytext|ntext|uuid|uniqueidentifier|date|time|inet|cidr|macaddr)/.test(
      fieldType
    );
  }

  private isArray(fieldType: string): boolean {
    return /(^array)|(range$)/.test(fieldType);
  }

  private isEnum(fieldType: string): boolean {
    return /^(enum)/.test(fieldType);
  }

  private isJSON(fieldType: string): boolean {
    return /^(json|jsonb)/.test(fieldType);
  }
}
