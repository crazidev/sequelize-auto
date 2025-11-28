import _ from 'lodash';
import { recase } from '../../types';
import { BaseRenderer } from './base-renderer';
import {
  AssociationDefinition,
  ClassDeclaration,
  FieldDefinition,
  ImportStatement,
  ModelStructure,
} from '../types/model-structure';

export class V6Renderer extends BaseRenderer {
  private lang: 'es5' | 'es6' | 'esm' | 'ts';
  private useDefine: boolean;
  private caseProp?: string;
  private caseModel?: string;

  constructor(
    space: string[],
    lang: 'es5' | 'es6' | 'esm' | 'ts',
    useDefine: boolean,
    caseProp?: string,
    caseModel?: string
  ) {
    super(space);
    this.lang = lang;
    this.useDefine = useDefine;
    this.caseProp = caseProp;
    this.caseModel = caseModel;
  }

  renderModel(structure: ModelStructure, tableName: string): string {
    let result = '';

    // Render imports
    if (this.lang === 'ts') {
      result += this.renderImports(structure.imports);
      result += '\n';

      // Render interfaces for TypeScript v6
      if (structure.interfaces) {
        result += this.renderInterfaces(structure.interfaces, tableName);
        result += '\n';
      }
    } else {
      result += this.renderImports(structure.imports);
    }

    // Render class declaration
    result += this.renderClassDeclaration(structure.classDeclaration, tableName);

    // Render fields
    structure.classDeclaration.fields.forEach((field) => {
      result += this.renderField(field, tableName);
    });

    // Render associations (for TypeScript)
    if (this.lang === 'ts') {
      result += this.renderAssociations(structure.classDeclaration.associations);
    }

    // Render init method
    if (this.lang === 'ts') {
      result += this.renderInitMethod(structure.classDeclaration, tableName);
    } else {
      result += this.renderTableOptions(structure.classDeclaration.initMethod, tableName);
    }

    // Close class/function
    result += this.renderClose(tableName);

    // Replace #TABLE# placeholder
    result = result.replace(/#TABLE#/g, tableName);

    return result;
  }

  protected renderImports(imports: ImportStatement[]): string {
    let result = '';
    imports.forEach((imp) => {
      if (this.lang === 'ts') {
        if (imp.isTypeOnly) {
          result += `import type { ${imp.imports.join(', ')} } from '${imp.from}';\n`;
        } else {
          result += `import { ${imp.imports.join(', ')} } from '${imp.from}';\n`;
        }
      } else if (this.lang === 'esm') {
        result += `import ${imp.imports[0]} from '${imp.from}';\n`;
      } else {
        result += `const ${imp.imports[0]} = require('${imp.from}');\n`;
      }
    });
    return result;
  }

  protected renderInterfaces(interfaces: NonNullable<ModelStructure['interfaces']>, tableName: string): string {
    let result = '';
    if (interfaces.attributes) {
      result += `export interface ${interfaces.attributes.replace(/#TABLE#/g, tableName)} {\n`;
      // Fields will be rendered separately
      result += '}\n\n';
    }
    if (interfaces.pk) {
      result += `export type ${interfaces.pk.replace(/#TABLE#/g, tableName)}Pk = ${interfaces.pk};\n`;
      if (interfaces.id) {
        result += `export type ${interfaces.id.replace(/#TABLE#/g, tableName)}Id = ${tableName}[${tableName}Pk];\n`;
      }
    }
    if (interfaces.creationAttributes) {
      const optionalAttrs = interfaces.creationAttributes.includes('OptionalAttributes')
        ? `${tableName}OptionalAttributes`
        : '';
      result += `export type ${tableName}CreationAttributes = ${interfaces.creationAttributes.replace(/#TABLE#/g, tableName)};\n\n`;
    }
    return result;
  }

  protected renderClassDeclaration(classDecl: ClassDeclaration, tableName: string): string {
    let result = '';

    if (this.lang === 'ts') {
      const genericParams = classDecl.genericParams
        ? classDecl.genericParams.map((p) => p.replace(/#TABLE#/g, tableName)).join(', ')
        : '';
      result += `export class ${tableName} extends ${classDecl.extends || 'Model'}<${genericParams}> implements ${tableName}Attributes {\n`;
    } else if (this.lang === 'es6') {
      result += `class ${tableName} extends Sequelize.Model {\n`;
      result += this.space[1] + 'static init(sequelize, DataTypes) {\n';
      if (this.useDefine) {
        result += this.space[2] + `return sequelize.define('${tableName}', {\n`;
      } else {
        result += this.space[2] + 'return super.init({\n';
      }
    } else if (this.lang === 'esm') {
      result += `export default class ${tableName} extends Model {\n`;
      result += this.space[1] + 'static init(sequelize, DataTypes) {\n';
      if (this.useDefine) {
        result += this.space[2] + `return sequelize.define('${tableName}', {\n`;
      } else {
        result += this.space[2] + 'return super.init({\n';
      }
    } else {
      // es5
      result += `module.exports = function(sequelize, DataTypes) {\n`;
      result += this.space[1] + `return sequelize.define('${tableName}', {\n`;
    }

    return result;
  }

  protected renderField(field: FieldDefinition, tableName: string): string {
    let result = '';

    if (this.lang === 'ts') {
      // TypeScript: render as class property declarations
      const optional = field.tsOptional ? '?' : '';
      result += `${this.space[1]}declare ${field.name}${optional}: ${field.tsType || 'any'};\n`;
    } else {
      // JavaScript: render as field definition object
      const fieldName = /^[$A-Z_][0-9A-Z_$]*$/i.test(field.name) ? field.name : `'${field.name}'`;
      result += `${this.space[field.dbName !== field.name ? 2 : 2]}${fieldName}: {\n`;

      // Render attributes
      field.attributes.forEach((attr) => {
        result += `${this.space[3]}${attr.name}: ${attr.value},\n`;
      });

      result = result.trim().replace(/,+$/, '') + '\n';
      result += `${this.space[2]}},\n`;
    }

    return result;
  }

  protected renderAssociations(associations: AssociationDefinition[]): string {
    // For v6, associations are handled via declare statements in TypeScript
    // This is a simplified version - full implementation would generate all mixin types
    let result = '';
    associations.forEach((assoc) => {
      result += `${this.space[1]}// ${assoc.type} association\n`;
      // Full implementation would generate all the mixin declarations
    });
    return result;
  }

  protected renderTableOptions(tableOptions: any, tableName: string): string {
    // This is handled in renderInitMethod for TypeScript
    // For non-TypeScript, this closes the field definition
    if (this.lang !== 'ts') {
      return '';
    }
    return '';
  }

  private renderInitMethod(classDecl: ClassDeclaration, tableName: string): string {
    let result = '';
    result += `\n${this.space[1]}static initModel(sequelize: Sequelize.Sequelize): typeof ${tableName} {\n`;

    if (this.useDefine) {
      result += `${this.space[2]}return sequelize.define('${tableName}', {\n`;
    } else {
      result += `${this.space[2]}return ${tableName}.init({\n`;
    }

    // Fields are already rendered above, so we just need to close the init call
    // The actual field rendering happens in renderField for v6

    return result;
  }

  private renderClose(tableName: string): string {
    let result = '';

    if (this.lang === 'ts') {
      // Close init method
      if (this.useDefine) {
        result += `) as typeof ${tableName};\n`;
      } else {
        result += ');\n';
      }
      result += `${this.space[1]}}\n}\n`;
    } else if (this.lang === 'es6' || this.lang === 'esm') {
      if (this.useDefine) {
        result += `${this.space[1]}}\n}\n`;
      } else {
        result += `${this.space[1]}}\n}\n`;
      }
      if (this.lang === 'es6') {
        result += 'module.exports = (sequelize, DataTypes) => {\n';
        result += `${this.space[1]}return ${tableName}.init(sequelize, DataTypes);\n`;
        result += '}\n';
      }
    } else {
      // es5
      result += `${this.space[1]}});\n`;
      result += '}\n';
    }

    return result;
  }
}
