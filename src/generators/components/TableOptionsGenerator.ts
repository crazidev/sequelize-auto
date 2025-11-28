import _ from 'lodash';
import { qNameSplit } from '../../utils/GeneratorUtils';
import { GeneratorContext } from '../IGenerator';
import { ITableOptionsGenerator } from './IComponentGenerator';

/**
 * Abstract base class for table options generation
 */
export abstract class BaseTableOptionsGenerator implements ITableOptionsGenerator {
  abstract generateTS(context: GeneratorContext, table: string): string;
  abstract generateJS(context: GeneratorContext, table: string): string;

  generate(context: GeneratorContext, table: string): string {
    if (context.options.lang === 'ts') {
      return this.generateTS(context, table);
    }
    return this.generateJS(context, table);
  }

  /**
   * Generate common table options (shared between V6 and V7)
   */
  protected generateCommonOptions(
    context: GeneratorContext,
    table: string,
    hasTimestamps: boolean,
    hasParanoid: boolean
  ): string {
    const space = context.space;
    const [schemaName, tableNameOrig] = qNameSplit(table);
    let str = '';

    if (!context.options.useDefine) {
      str += space[2] + 'sequelize,\n';
    }
    str += space[2] + "tableName: '" + tableNameOrig + "',\n";

    if (schemaName && context.dialect.hasSchema) {
      str += space[2] + "schema: '" + schemaName + "',\n";
    }

    if (context.hasTriggerTables[table]) {
      str += space[2] + 'hasTrigger: true,\n';
    }

    str += space[2] + 'timestamps: ' + hasTimestamps + ',\n';

    if (hasParanoid) {
      str += space[2] + 'paranoid: true,\n';
    }

    // conditionally add additional options
    const additional = context.options.additional;
    const hasadditional = _.isObject(additional) && _.keys(additional).length > 0;

    if (hasadditional) {
      _.each(additional, (value: any, key: string) => {
        if (key === 'name') {
          // name: true - preserve table name always
          str += space[2] + 'name: {\n';
          str += space[3] + "singular: '" + table + "',\n";
          str += space[3] + "plural: '" + table + "'\n";
          str += space[2] + '},\n';
        } else if (key === 'timestamps' || key === 'paranoid') {
          // handled above
        } else {
          const formattedValue = _.isBoolean(value) ? value : "'" + value + "'";
          str += space[2] + key + ': ' + formattedValue + ',\n';
        }
      });
    }

    return str;
  }
}

/**
 * V6 Table Options Generator - Sequelize v6 style model options
 */
export class V6TableOptionsGenerator extends BaseTableOptionsGenerator {
  generateTS(context: GeneratorContext, table: string): string {
    return this.generateOptions(context, table, true);
  }

  generateJS(context: GeneratorContext, table: string): string {
    return this.generateOptions(context, table, false);
  }

  /**
   * Generate the options block for V6 models
   */
  generateOptions(
    context: GeneratorContext,
    table: string,
    hasTimestamps: boolean = false,
    hasParanoid: boolean = false,
    indexesStr: string = ''
  ): string {
    const space = context.space;

    let str = space[1] + '}, {\n';
    str += this.generateCommonOptions(context, table, hasTimestamps, hasParanoid);

    // Add indexes
    if (indexesStr) {
      str += indexesStr;
    }

    str = space[2] + str.trim();
    str = str.substring(0, str.length - 1);
    str += '\n' + space[1] + '}';

    return str;
  }

  /**
   * Generate the complete options block including indexes
   */
  generateOptionsWithIndexes(
    context: GeneratorContext,
    table: string,
    hasTimestamps: boolean,
    hasParanoid: boolean,
    indexesStr: string
  ): string {
    const space = context.space;

    let str = space[1] + '}, {\n';
    str += this.generateCommonOptions(context, table, hasTimestamps, hasParanoid);

    // Add indexes
    if (indexesStr) {
      str += indexesStr;
    }

    str = space[2] + str.trim();
    str = str.substring(0, str.length - 1);
    str += '\n' + space[1] + '}';

    return str;
  }
}

/**
 * V7 Table Options Generator - Sequelize v7 style with @Table decorator
 */
export class V7TableOptionsGenerator extends BaseTableOptionsGenerator {
  generateTS(context: GeneratorContext, table: string): string {
    const [, tableNameOrig] = qNameSplit(table);
    const timestamps = context.options.additional?.timestamps === true || false;

    return `@Table({ timestamps: ${timestamps}, tableName: '${tableNameOrig}' })\n`;
  }

  generateJS(context: GeneratorContext, table: string): string {
    // V7 with JS falls back to V6 style
    const v6Generator = new V6TableOptionsGenerator();
    return v6Generator.generateJS(context, table);
  }
}
