import { Relation } from '../types';
import { makeIndent, makeTableName, recase } from '../utils/GeneratorUtils';
import { V6RelationGenerator, V7RelationGenerator } from './components';
import { GeneratedInit, GeneratorOptions, IInitGenerator } from './IGenerator';

/**
 * Abstract base class for init-models file generation
 */
export abstract class BaseInitGenerator implements IInitGenerator {
  abstract generateInit(
    modelNames: string[],
    relations: Relation[],
    options: GeneratorOptions
  ): GeneratedInit;

  protected getSpace(options: GeneratorOptions): string[] {
    return makeIndent(options.spaces, options.indentation);
  }

  protected getFileName(options: GeneratorOptions): string {
    return 'init-models' + (options.lang === 'ts' ? '.ts' : '.js');
  }
}

/**
 * V6 Init Generator - Sequelize v6 style init-models file
 */
export class V6InitGenerator extends BaseInitGenerator {
  private relationGenerator = new V6RelationGenerator();

  generateInit(
    tableNames: string[],
    relations: Relation[],
    options: GeneratorOptions
  ): GeneratedInit {
    let content: string;

    switch (options.lang) {
      case 'ts':
        content = this.generateTsInit(tableNames, relations, options);
        break;
      case 'esm':
        content = this.generateEsmInit(tableNames, relations, options);
        break;
      case 'es6':
        content = this.generateEs5Init(tableNames, relations, options, 'const');
        break;
      default:
        content = this.generateEs5Init(tableNames, relations, options, 'var');
    }

    return {
      content,
      fileName: this.getFileName(options),
    };
  }

  private generateTsInit(tableNames: string[], relations: Relation[], options: GeneratorOptions): string {
    const sp = this.getSpace(options)[1];
    const modelNames: string[] = [];

    let str = 'import type { Sequelize } from "sequelize";\n';

    // Import statements
    tableNames.forEach((t) => {
      const fileName = recase(options.caseFile, t, options.singularize);
      const modelName = makeTableName(options.caseModel, t, options.singularize, options.lang);
      modelNames.push(modelName);
      str += `import { ${modelName} } from "./${fileName}";\n`;
    });

    // Re-export the model classes
    str += '\nexport {\n';
    modelNames.forEach((m) => {
      str += `${sp}${m},\n`;
    });
    str += '};\n';

    // Create the initialization function
    str += 'export function initModels(sequelize: Sequelize) {\n';
    modelNames.forEach((m) => {
      str += `${sp}${m}.initModel(sequelize);\n`;
    });

    // Add the associations
    const assoc = this.relationGenerator.generateAssociations(relations, options);
    str += '\n' + assoc;

    // Return the models
    str += `\n${sp}return {\n`;
    modelNames.forEach((m) => {
      str += `${this.getSpace(options)[2]}${m}: ${m},\n`;
    });
    str += `${sp}};\n`;
    str += '}\n';

    return str;
  }

  private generateEs5Init(
    tableNames: string[],
    relations: Relation[],
    options: GeneratorOptions,
    vardef: string
  ): string {
    const sp = this.getSpace(options)[1];
    const modelNames: string[] = [];

    let str = `${vardef} DataTypes = require("sequelize").DataTypes;\n`;

    // Import statements
    tableNames.forEach((t) => {
      const fileName = recase(options.caseFile, t, options.singularize);
      const modelName = makeTableName(options.caseModel, t, options.singularize, options.lang);
      modelNames.push(modelName);
      str += `${vardef} _${modelName} = require("./${fileName}");\n`;
    });

    // Create the initialization function
    str += '\nfunction initModels(sequelize) {\n';
    modelNames.forEach((m) => {
      str += `${sp}${vardef} ${m} = _${m}(sequelize, DataTypes);\n`;
    });

    // Add the associations
    const assoc = this.relationGenerator.generateAssociations(relations, options);
    str += '\n' + assoc;

    // Return the models
    str += `\n${sp}return {\n`;
    modelNames.forEach((m) => {
      str += `${this.getSpace(options)[2]}${m},\n`;
    });
    str += `${sp}};\n`;
    str += '}\n';
    str += 'module.exports = initModels;\n';
    str += 'module.exports.initModels = initModels;\n';
    str += 'module.exports.default = initModels;\n';

    return str;
  }

  private generateEsmInit(tableNames: string[], relations: Relation[], options: GeneratorOptions): string {
    const sp = this.getSpace(options)[1];
    const modelNames: string[] = [];

    let str = 'import _sequelize from "sequelize";\n';
    str += 'const DataTypes = _sequelize.DataTypes;\n';

    // Import statements
    tableNames.forEach((t) => {
      const fileName = recase(options.caseFile, t, options.singularize);
      const modelName = makeTableName(options.caseModel, t, options.singularize, options.lang);
      modelNames.push(modelName);
      str += `import _${modelName} from  "./${fileName}.js";\n`;
    });

    // Create the initialization function
    str += '\nexport default function initModels(sequelize) {\n';
    modelNames.forEach((m) => {
      str += `${sp}const ${m} = _${m}.init(sequelize, DataTypes);\n`;
    });

    // Add the associations
    const assoc = this.relationGenerator.generateAssociations(relations, options);
    str += '\n' + assoc;

    // Return the models
    str += `\n${sp}return {\n`;
    modelNames.forEach((m) => {
      str += `${this.getSpace(options)[2]}${m},\n`;
    });
    str += `${sp}};\n`;
    str += '}\n';

    return str;
  }
}

/**
 * V7 Init Generator - Sequelize v7 style init-models file
 * Note: V7 with decorators typically doesn't need a separate init file
 * as associations are defined via decorators. This provides a simplified version.
 */
export class V7InitGenerator extends BaseInitGenerator {
  private relationGenerator = new V7RelationGenerator();

  generateInit(
    tableNames: string[],
    relations: Relation[],
    options: GeneratorOptions
  ): GeneratedInit {
    // V7 with decorators handles associations differently
    // Provide a simplified TypeScript init file that just exports models
    if (options.lang === 'ts') {
      return {
        content: this.generateTsInit(tableNames, options),
        fileName: this.getFileName(options),
      };
    }

    // For non-TS, fall back to V6 style
    const v6Generator = new V6InitGenerator();
    return v6Generator.generateInit(tableNames, relations, options);
  }

  private generateTsInit(tableNames: string[], options: GeneratorOptions): string {
    const sp = this.getSpace(options)[1];
    const modelNames: string[] = [];

    let str = 'import type { Sequelize } from "@sequelize/core";\n';

    // Import statements
    tableNames.forEach((t) => {
      const fileName = recase(options.caseFile, t, options.singularize);
      const modelName = makeTableName(options.caseModel, t, options.singularize, options.lang);
      modelNames.push(modelName);
      str += `import { ${modelName} } from "./${fileName}";\n`;
    });

    // Re-export the model classes
    str += '\nexport {\n';
    modelNames.forEach((m) => {
      str += `${sp}${m},\n`;
    });
    str += '};\n';

    // Export an array of all models for registration
    str += '\n// All models for Sequelize registration\n';
    str += 'export const models = [\n';
    modelNames.forEach((m) => {
      str += `${sp}${m},\n`;
    });
    str += '];\n';

    // Create a simple initialization function
    str += '\n// Initialize models with Sequelize instance\n';
    str += 'export function initModels(sequelize: Sequelize) {\n';
    str += `${sp}// With v7 decorators, models are registered via sequelize.addModels()\n`;
    str += `${sp}// or by passing them to the Sequelize constructor options\n`;
    str += `${sp}return {\n`;
    modelNames.forEach((m) => {
      str += `${this.getSpace(options)[2]}${m},\n`;
    });
    str += `${sp}};\n`;
    str += '}\n';

    return str;
  }
}
