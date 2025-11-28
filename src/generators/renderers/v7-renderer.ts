import { BaseRenderer } from './base-renderer';
import {
  AssociationDefinition,
  ClassDeclaration,
  FieldDefinition,
  ImportStatement,
  ModelStructure,
} from '../types/model-structure';

export class V7Renderer extends BaseRenderer {
  private lang: 'es5' | 'es6' | 'esm' | 'ts';

  constructor(space: string[], lang: 'es5' | 'es6' | 'esm' | 'ts') {
    super(space);
    this.lang = lang;
  }

  renderModel(structure: ModelStructure, tableName: string): string {
    let result = '';

    // Render imports
    result += this.renderImports(structure.imports);
    result += '\n';

    // Render table decorator (for TypeScript)
    if (this.lang === 'ts') {
      result += this.renderTableDecorator(structure.classDeclaration, tableName);
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

    // Close class
    result += '}\n';

    // Replace #TABLE# placeholder
    result = result.replace(/#TABLE#/g, tableName);

    return result;
  }

  protected renderImports(imports: ImportStatement[]): string {
    let result = '';
    imports.forEach((imp) => {
      if (this.lang === 'ts') {
        result += `import { ${imp.imports.join(', ')} } from '${imp.from}';\n`;
      } else {
        // For JavaScript v7, we still use Model.init() pattern
        result += `const ${imp.imports[0]} = require('${imp.from}');\n`;
      }
    });
    return result;
  }

  protected renderTableDecorator(classDecl: ClassDeclaration, tableName: string): string {
    // Table decorator is generated separately, this is a placeholder
    // The actual table options come from the initMethod
    return '';
  }

  protected renderClassDeclaration(classDecl: ClassDeclaration, tableName: string): string {
    let result = '';

    if (this.lang === 'ts') {
      const genericParams = classDecl.genericParams
        ? classDecl.genericParams.map((p) => p.replace(/#TABLE#/g, tableName)).join(', ')
        : '';
      result += `export class ${tableName} extends ${classDecl.extends || 'Model'}<${genericParams}> {\n`;
    } else {
      // For JavaScript v7, still use Model.init() pattern
      result += `class ${tableName} extends Model {\n`;
      result += `${this.space[1]}static init(sequelize, DataTypes) {\n`;
      result += `${this.space[2]}return super.init({\n`;
    }

    return result;
  }

  protected renderField(field: FieldDefinition, tableName: string): string {
    let result = '';

    if (this.lang === 'ts') {
      // Render decorators
      field.decorators.forEach((decorator) => {
        const args = decorator.arguments && decorator.arguments.length > 0
          ? `(${decorator.arguments.join(', ')})`
          : '';
        result += `${this.space[1]}@${decorator.name}${args}\n`;
      });

      // Render field declaration
      const optional = field.tsOptional ? '?' : '';
      let type = field.tsType || 'any';
      if (field.name === 'id' && field.decorators.some((d) => d.name === 'AutoIncrement')) {
        type = `CreationOptional<${type}>`;
      }
      result += `${this.space[1]}declare ${field.name}${optional}: ${type};\n`;

      // Handle paranoid field
      if (field.isParanoid) {
        result += '\n';
        result += `${this.space[1]}@DeletedAt\n`;
        result += `${this.space[1]}declare deletedAt: Date | null;\n`;
      }

      result += '\n';
    } else {
      // For JavaScript v7, render as field definition (similar to v6)
      const fieldName = /^[$A-Z_][0-9A-Z_$]*$/i.test(field.name) ? field.name : `'${field.name}'`;
      result += `${this.space[2]}${fieldName}: {\n`;

      // Render attributes (convert decorators to attributes for JS)
      field.attributes.forEach((attr) => {
        result += `${this.space[3]}${attr.name}: ${attr.value},\n`;
      });

      result = result.trim().replace(/,+$/, '') + '\n';
      result += `${this.space[2]}},\n`;
    }

    return result;
  }

  protected renderAssociations(associations: AssociationDefinition[]): string {
    let result = '';
    associations.forEach((assoc) => {
      if (this.lang === 'ts') {
        result += `${this.space[1]}// ${assoc.type} association\n`;
        const decoratorName = assoc.type === 'belongsTo' ? 'BelongsTo' :
          assoc.type === 'hasOne' ? 'HasOne' :
          assoc.type === 'hasMany' ? 'HasMany' :
          'BelongsToMany';

        const args: string[] = [];
        args.push(`() => ${assoc.targetModel}`);
        const options: string[] = [];
        if (assoc.foreignKey) {
          options.push(`foreignKey: '${assoc.foreignKey}'`);
        }
        if (assoc.otherKey) {
          options.push(`otherKey: '${assoc.otherKey}'`);
        }
        if (assoc.through) {
          options.push(`through: () => ${assoc.through}`);
        }
        if (assoc.inverse) {
          const inverseOpts: string[] = [];
          if (assoc.inverse.as) {
            inverseOpts.push(`as: '${assoc.inverse.as}'`);
          }
          if (assoc.inverse.type) {
            inverseOpts.push(`type: '${assoc.inverse.type}'`);
          }
          if (inverseOpts.length > 0) {
            options.push(`inverse: { ${inverseOpts.join(', ')} }`);
          }
        }
        if (options.length > 0) {
          args.push(`{ ${options.join(', ')} }`);
        }

        result += `${this.space[1]}@${decoratorName}(${args.join(', ')})\n`;
        const propType = assoc.type === 'hasMany' || assoc.type === 'belongsToMany' ? '[]' : '';
        result += `${this.space[1]}declare ${assoc.alias || assoc.targetModel.toLowerCase()}?: NonAttribute<${assoc.targetModel}${propType}>\n\n`;
      }
    });
    return result;
  }

  protected renderTableOptions(tableOptions: any, tableName: string): string {
    // For v7 TypeScript, table options are in the @Table decorator
    // This is handled separately
    return '';
  }
}
