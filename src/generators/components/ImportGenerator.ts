import { GeneratorContext } from '../IGenerator';
import { AssociationImports, IImportGenerator } from './IComponentGenerator';
import { qNameSplit, recase } from '../../utils/GeneratorUtils';

/**
 * Abstract base class for import generation
 */
export abstract class BaseImportGenerator implements IImportGenerator {
  abstract generateTS(context: GeneratorContext, table: string, associations: AssociationImports): string;
  abstract generateES6(context: GeneratorContext, tableName: string): string;
  abstract generateESM(context: GeneratorContext, tableName: string): string;
  abstract generateES5(context: GeneratorContext, tableName: string): string;

  generate(context: GeneratorContext, table: string): string {
    switch (context.options.lang) {
      case 'ts':
        return this.generateTS(context, table, { needed: {} });
      case 'es6':
        return this.generateES6(context, table);
      case 'esm':
        return this.generateESM(context, table);
      default:
        return this.generateES5(context, table);
    }
  }

  /**
   * Generate import statements for associated models (TypeScript)
   */
  protected generateAssociationImports(
    context: GeneratorContext,
    associations: AssociationImports,
    useType: boolean
  ): string {
    let str = '';
    const needed = Object.keys(associations.needed).sort();

    needed.forEach((fkTable) => {
      const set = associations.needed[fkTable];
      const [, fkTableName] = qNameSplit(fkTable);
      const filename = recase(context.options.caseFile, fkTableName, context.options.singularize);

      if (useType) {
        str += 'import type { ';
        str += Array.from(set.values()).sort().join(', ');
      } else {
        str += 'import { ';
        const values = Array.from(set.values());
        str += values.length > 0 ? values[0] : '';
      }
      str += ` } from './${filename}';\n`;
    });

    return str;
  }
}

/**
 * V6 Import Generator - Sequelize v6 style imports
 */
export class V6ImportGenerator extends BaseImportGenerator {
  generateTS(context: GeneratorContext, table: string, associations: AssociationImports): string {
    let header = '';

    header += "import * as Sequelize from 'sequelize';\n";
    header += "import { DataTypes, Model, Optional } from 'sequelize';\n";

    // Add association imports
    header += this.generateAssociationImports(context, associations, true);

    return header;
  }

  generateES6(context: GeneratorContext, tableName: string): string {
    const sp = context.space[1];
    let header = '';

    header += "const Sequelize = require('sequelize');\n";
    header += 'module.exports = (sequelize, DataTypes) => {\n';
    header += sp + 'return #TABLE#.init(sequelize, DataTypes);\n';
    header += '}\n\n';
    header += 'class #TABLE# extends Sequelize.Model {\n';
    header += sp + 'static init(sequelize, DataTypes) {\n';

    if (context.options.useDefine) {
      header += sp + "return sequelize.define('#TABLE#', {\n";
    } else {
      header += sp + 'return super.init({\n';
    }

    return header;
  }

  generateESM(context: GeneratorContext, tableName: string): string {
    const sp = context.space[1];
    let header = '';

    header += "import _sequelize from 'sequelize';\n";
    header += 'const { Model, Sequelize } = _sequelize;\n\n';
    header += 'export default class #TABLE# extends Model {\n';
    header += sp + 'static init(sequelize, DataTypes) {\n';

    if (context.options.useDefine) {
      header += sp + "return sequelize.define('#TABLE#', {\n";
    } else {
      header += sp + 'return super.init({\n';
    }

    return header;
  }

  generateES5(context: GeneratorContext, tableName: string): string {
    const sp = context.space[1];
    let header = '';

    header += "const Sequelize = require('sequelize');\n";
    header += 'module.exports = function(sequelize, DataTypes) {\n';
    header += sp + "return sequelize.define('#TABLE#', {\n";

    return header;
  }
}

/**
 * V7 Import Generator - Sequelize v7 style imports with decorators
 */
export class V7ImportGenerator extends BaseImportGenerator {
  generateTS(context: GeneratorContext, table: string, associations: AssociationImports): string {
    let header = '';

    header +=
      "import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute } from '@sequelize/core';\n";
    header +=
      "import { Attribute, PrimaryKey, AutoIncrement, ColumnName, NotNull, Default, Table, Unique, Comment, BelongsToMany, BelongsTo, HasMany, HasOne } from '@sequelize/core/decorators-legacy';\n\n";

    // Add association imports (use concrete imports, not type-only)
    header += this.generateAssociationImports(context, associations, false);

    return header;
  }

  generateES6(context: GeneratorContext, tableName: string): string {
    // V7 primarily targets TypeScript with decorators
    // For ES6, fall back to V6 style but with v7 sequelize imports
    const sp = context.space[1];
    let header = '';

    header += "const { Model, DataTypes } = require('@sequelize/core');\n";
    header += 'module.exports = (sequelize, DataTypes) => {\n';
    header += sp + 'return #TABLE#.init(sequelize, DataTypes);\n';
    header += '}\n\n';
    header += 'class #TABLE# extends Model {\n';
    header += sp + 'static init(sequelize, DataTypes) {\n';
    header += sp + 'return super.init({\n';

    return header;
  }

  generateESM(context: GeneratorContext, tableName: string): string {
    const sp = context.space[1];
    let header = '';

    header += "import { Model, DataTypes } from '@sequelize/core';\n\n";
    header += 'export default class #TABLE# extends Model {\n';
    header += sp + 'static init(sequelize, DataTypes) {\n';
    header += sp + 'return super.init({\n';

    return header;
  }

  generateES5(context: GeneratorContext, tableName: string): string {
    // V7 doesn't really support ES5, but provide a basic structure
    const sp = context.space[1];
    let header = '';

    header += "const { DataTypes } = require('@sequelize/core');\n";
    header += 'module.exports = function(sequelize, DataTypes) {\n';
    header += sp + "return sequelize.define('#TABLE#', {\n";

    return header;
  }
}
