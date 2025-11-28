import { qNameSplit } from '../utils/GeneratorUtils';
import {
  V7FieldGenerator,
  V7ImportGenerator,
  V7IndexGenerator,
  V7RelationGenerator,
  V7TableOptionsGenerator,
} from './components';
import { BaseModelGenerator } from './BaseModelGenerator';
import { GeneratedModel, GeneratorContext } from './IGenerator';
import { V6ModelGenerator } from './V6ModelGenerator';

/**
 * V7 Model Generator - Sequelize v7 style model generation with decorators
 */
export class V7ModelGenerator extends BaseModelGenerator {
  private importGenerator = new V7ImportGenerator();
  private fieldGenerator = new V7FieldGenerator();
  private tableOptionsGenerator = new V7TableOptionsGenerator();
  private indexGenerator = new V7IndexGenerator();
  private relationGenerator = new V7RelationGenerator();

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

    // Generate @Table decorator
    str += this.tableOptionsGenerator.generateTS(context, table);

    // Generate class declaration
    str += 'export class #TABLE# extends Model<InferAttributes<#TABLE#>, InferCreationAttributes<#TABLE#>> {';

    // Generate field definitions with decorators
    const fieldResult = this.fieldGenerator.generateTS(context, table);
    str += fieldResult.fields;

    // Add association decorators
    str += associations.str;

    // Close class
    str += '}\n';

    return str;
  }

  private generateJavaScriptModel(table: string, tableName: string, context: GeneratorContext): string {
    // V7 primarily targets TypeScript with decorators
    // For JavaScript, fall back to V6-like generation
    const v6Generator = new V6ModelGenerator();
    const model = v6Generator.generateModel(table, context);
    return model.content;
  }
}
