import { qNameSplit, recase } from '../utils/GeneratorUtils';
import {
  V6FieldGenerator,
  V6ImportGenerator,
  V6IndexGenerator,
  V6RelationGenerator,
  V6TableOptionsGenerator,
} from './components';
import { BaseModelGenerator } from './BaseModelGenerator';
import { GeneratedModel, GeneratorContext } from './IGenerator';

/**
 * V6 Model Generator - Sequelize v6 style model generation
 */
export class V6ModelGenerator extends BaseModelGenerator {
  private importGenerator = new V6ImportGenerator();
  private fieldGenerator = new V6FieldGenerator();
  private tableOptionsGenerator = new V6TableOptionsGenerator();
  private indexGenerator = new V6IndexGenerator();
  private relationGenerator = new V6RelationGenerator();

  generateModel(table: string, context: GeneratorContext): GeneratedModel {
    const [schemaName, tableNameOrig] = qNameSplit(table);
    const tableName = this.getModelName(table, context.options);

    let str = '';

    if (context.options.lang === 'ts') {
      str = this.generateTypeScriptModel(table, tableName, context);
    } else {
      str = this.generateJavaScriptModel(table, tableName, context);
    }

    str = this.replaceTablePlaceholder(str, tableName);

    return {
      tableName: table,
      modelName: tableName,
      content: str,
    };
  }

  private generateTypeScriptModel(table: string, tableName: string, context: GeneratorContext): string {
    const space = context.space;
    let str = '';

    // Generate associations first to know what imports we need
    const associations = this.relationGenerator.generateTSMixins(context, table);

    // Generate imports
    str += this.importGenerator.generateTS(context, table, associations);
    str += '\n';

    // Generate interface for attributes
    str += '\nexport interface #TABLE#Attributes {\n';
    str += this.fieldGenerator.generateTSInterfaceFields(context, table, true);
    str += '}\n\n';

    // Generate primary key and optional types
    const fieldResult = this.fieldGenerator.generateTS(context, table);

    if (fieldResult.primaryKeys.length) {
      str += `export type #TABLE#Pk = ${fieldResult.primaryKeys
        .map((k) => `"${recase(context.options.caseProp, k)}"`)
        .join(' | ')};\n`;
      str += `export type #TABLE#Id = #TABLE#[#TABLE#Pk];\n`;
    }

    if (fieldResult.creationOptionalFields.length) {
      str += `export type #TABLE#OptionalAttributes = ${fieldResult.creationOptionalFields
        .map((k) => `"${recase(context.options.caseProp, k)}"`)
        .join(' | ')};\n`;
      str +=
        'export type #TABLE#CreationAttributes = Optional<#TABLE#Attributes, #TABLE#OptionalAttributes>;\n\n';
    } else {
      str += 'export type #TABLE#CreationAttributes = #TABLE#Attributes;\n\n';
    }

    // Generate class declaration
    str +=
      'export class #TABLE# extends Model<#TABLE#Attributes, #TABLE#CreationAttributes> implements #TABLE#Attributes {\n';

    // Generate class fields
    str += this.fieldGenerator.generateTSInterfaceFields(context, table, false);

    // Add association mixins
    str += '\n' + associations.str;

    // Generate initModel method
    str += '\n' + space[1] + 'static initModel(sequelize: Sequelize.Sequelize): typeof #TABLE# {\n';

    if (context.options.useDefine) {
      str += space[2] + "return sequelize.define('#TABLE#', {\n";
    } else {
      str += space[2] + 'return #TABLE#.init({\n';
    }

    // Add field definitions
    str += fieldResult.fields;

    // Add table options with indexes
    const indexesStr = this.indexGenerator.generateIndexes(context, table);
    str += this.tableOptionsGenerator.generateOptionsWithIndexes(
      context,
      table,
      fieldResult.hasTimestamps,
      fieldResult.hasParanoid,
      indexesStr
    );

    // Close the init call
    if (context.options.useDefine) {
      str += ') as typeof #TABLE#;\n';
    } else {
      str += ');\n';
    }

    // Close class
    str += space[1] + '}\n}\n';

    return str;
  }

  private generateJavaScriptModel(table: string, tableName: string, context: GeneratorContext): string {
    const space = context.space;
    let str = '';

    // Generate imports/header
    str += this.importGenerator.generate(context, table);

    // Add field definitions
    const fieldStr = this.fieldGenerator.generateJS(context, table);
    str += fieldStr;

    // Add table options with indexes
    const fieldResult = this.fieldGenerator.generateTS(context, table);
    const indexesStr = this.indexGenerator.generateIndexes(context, table);
    str += this.tableOptionsGenerator.generateOptionsWithIndexes(
      context,
      table,
      fieldResult.hasTimestamps,
      fieldResult.hasParanoid,
      indexesStr
    );

    str += ');\n';

    // Close based on language
    if (context.options.lang === 'es6' || context.options.lang === 'esm') {
      if (context.options.useDefine) {
        str += space[1] + '}\n}\n';
      } else {
        str += space[1] + '}\n}\n';
      }
    } else {
      str += '};\n';
    }

    return str;
  }
}
