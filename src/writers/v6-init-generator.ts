import { CaseFileOption, CaseOption, LangOption, makeTableName, recase } from '../types';
import { InitStringGenerator } from './base/init-string-generator';

export class V6InitStringGenerator implements InitStringGenerator {
  generate(
    tableNames: string[],
    associations: string,
    options: {
      lang?: LangOption;
      caseFile?: CaseFileOption;
      caseModel?: CaseOption;
      singularize?: boolean;
      space: string[];
    }
  ): string {
    switch (options.lang) {
      case 'ts':
        return this.createTsInitString(tableNames, associations, options);
      case 'esm':
        return this.createESMInitString(tableNames, associations, options);
      case 'es6':
        return this.createES5InitString(tableNames, associations, options, 'const');
      default:
        return this.createES5InitString(tableNames, associations, options, 'var');
    }
  }

  private createTsInitString(
    tableNames: string[],
    associations: string,
    options: {
      caseFile?: CaseFileOption;
      caseModel?: CaseOption;
      singularize?: boolean;
      space: string[];
    }
  ): string {
    let str = 'import type { Sequelize } from "sequelize";\n';
    const sp = options.space[1];
    const modelNames: string[] = [];

    // Import statements
    tableNames.forEach((t) => {
      const fileName = recase(options.caseFile, t, options.singularize);
      const modelName = makeTableName(options.caseModel, t, options.singularize, 'ts');
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
    str += '\n' + associations;

    // Return the models
    str += `\n${sp}return {\n`;
    modelNames.forEach((m) => {
      str += `${options.space[2]}${m}: ${m},\n`;
    });
    str += `${sp}};\n`;
    str += '}\n';

    return str;
  }

  private createES5InitString(
    tableNames: string[],
    associations: string,
    options: {
      caseFile?: CaseFileOption;
      caseModel?: CaseOption;
      singularize?: boolean;
      space: string[];
    },
    vardef: string
  ): string {
    let str = `${vardef} DataTypes = require("sequelize").DataTypes;\n`;
    const sp = options.space[1];
    const modelNames: string[] = [];

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
    str += '\n' + associations;

    // Return the models
    str += `\n${sp}return {\n`;
    modelNames.forEach((m) => {
      str += `${options.space[2]}${m},\n`;
    });
    str += `${sp}};\n`;
    str += '}\n';
    str += 'module.exports = initModels;\n';
    str += 'module.exports.initModels = initModels;\n';
    str += 'module.exports.default = initModels;\n';
    return str;
  }

  private createESMInitString(
    tableNames: string[],
    associations: string,
    options: {
      caseFile?: CaseFileOption;
      caseModel?: CaseOption;
      singularize?: boolean;
      space: string[];
    }
  ): string {
    let str = 'import _sequelize from "sequelize";\n';
    str += 'const DataTypes = _sequelize.DataTypes;\n';
    const sp = options.space[1];
    const modelNames: string[] = [];

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
    str += '\n' + associations;

    // Return the models
    str += `\n${sp}return {\n`;
    modelNames.forEach((m) => {
      str += `${options.space[2]}${m},\n`;
    });
    str += `${sp}};\n`;
    str += '}\n';
    return str;
  }
}
