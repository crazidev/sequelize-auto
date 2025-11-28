import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import util from 'util';
import { FKSpec, TableData } from '.';
import { createGeneratorFactory, GeneratorOptions } from './generators';
import { Relation } from './types';
import { CaseFileOption, CaseOption, LangOption, makeIndent, makeTableName, qNameSplit, recase } from './utils/GeneratorUtils';

const mkdirp = require('mkdirp');

/**
 * Writer options interface
 */
export interface WriterOptions {
  caseFile?: CaseFileOption;
  caseModel?: CaseOption;
  caseProp?: CaseOption;
  directory: string;
  lang?: LangOption;
  noAlias?: boolean;
  noInitModels?: boolean;
  noWrite?: boolean;
  singularize?: boolean;
  useDefine?: boolean;
  spaces?: boolean;
  indentation?: number;
  version?: 'v6' | 'v7';
  associationMixins?: 'all' | 'property' | 'none';
}

/**
 * AutoWriter - Writes generated model files and init-models to disk
 * 
 * This is a "dumb" writer that receives file contents from generators
 * and writes them to the specified directory.
 */
export class AutoWriter {
  tableText: { [name: string]: string };
  foreignKeys: { [tableName: string]: { [fieldName: string]: FKSpec } };
  relations: Relation[];
  space: string[];
  options: WriterOptions;

  constructor(tableData: TableData, options: WriterOptions) {
    this.tableText = tableData.text as { [name: string]: string };
    this.foreignKeys = tableData.foreignKeys;
    this.relations = tableData.relations;
    this.options = options;
    this.space = makeIndent(this.options.spaces, this.options.indentation);
  }

  /**
   * Write all model files and init-models to disk
   */
  write(): Promise<void[]> {
    if (this.options.noWrite) {
      return Promise.resolve([]);
    }

    mkdirp.sync(path.resolve(this.options.directory || './models'));

    const tables = _.keys(this.tableText);

    // Write the individual model files
    const promises = tables.map((t) => {
      return this.createFile(t);
    });

    // Get table names without schema
    const tableNames = tables
      .map((t) => {
        const [, tableName] = qNameSplit(t);
        return tableName as string;
      })
      .sort();

    // Write the init-models file
    if (!this.options.noInitModels) {
      const initString = this.generateInitString(tableNames);
      const isTypeScript = this.options.lang === 'ts';
      const initFilePath = path.join(this.options.directory, 'init-models' + (isTypeScript ? '.ts' : '.js'));
      const writeFile = util.promisify(fs.writeFile);
      const initPromise = writeFile(path.resolve(initFilePath), initString);
      promises.push(initPromise);
    }

    return Promise.all(promises);
  }

  /**
   * Generate the init-models file content using the new generator system
   */
  protected generateInitString(tableNames: string[]): string {
    // Create a generator factory with our options
    const generatorOptions: GeneratorOptions = {
      spaces: this.options.spaces,
      indentation: this.options.indentation,
      lang: this.options.lang,
      caseModel: this.options.caseModel,
      caseProp: this.options.caseProp,
      caseFile: this.options.caseFile,
      singularize: this.options.singularize || false,
      useDefine: this.options.useDefine || false,
      noAlias: this.options.noAlias,
      version: this.options.version || 'v6',
      associationMixins: this.options.associationMixins || 'all',
    };

    const factory = createGeneratorFactory(generatorOptions);
    const initGenerator = factory.getInitGenerator();
    const result = initGenerator.generateInit(tableNames, this.relations, generatorOptions);

    return result.content;
  }

  /**
   * Write a single model file to disk
   */
  private createFile(table: string): Promise<void> {
    const [, tableName] = qNameSplit(table);
    const fileName = recase(this.options.caseFile, tableName, this.options.singularize);
    const filePath = path.join(
      this.options.directory,
      fileName + (this.options.lang === 'ts' ? '.ts' : '.js')
    );

    const writeFile = util.promisify(fs.writeFile);
    return writeFile(path.resolve(filePath), this.tableText[table]);
  }
}

/**
 * Legacy AutoWriter for backward compatibility
 * Uses the old association generation logic
 */
export class LegacyAutoWriter extends AutoWriter {
  /**
   * Generate init-models using legacy association generation
   */
  protected generateInitString(tableNames: string[]): string {
    const isTypeScript = this.options.lang === 'ts';
    const assoc = this.createAssociations(isTypeScript);

    switch (this.options.lang) {
      case 'ts':
        return this.createTsInitString(tableNames, assoc);
      case 'esm':
        return this.createESMInitString(tableNames, assoc);
      case 'es6':
        return this.createES5InitString(tableNames, assoc, 'const');
      default:
        return this.createES5InitString(tableNames, assoc, 'var');
    }
  }

  /** Create the belongsToMany/belongsTo/hasMany/hasOne association strings */
  private createAssociations(typeScript: boolean): string {
    let strBelongs = '';
    let strBelongsToMany = '';
    const sp = this.space[1];

    const rels = this.relations;
    rels.forEach((rel) => {
      if (rel.isM2M) {
        const asprop = recase(this.options.caseProp, rel.childProp);
        strBelongsToMany += `${sp}${rel.parentModel}.belongsToMany(${rel.childModel}, { as: '${asprop}', through: ${rel.joinModel}, foreignKey: "${rel.parentId}", otherKey: "${rel.childId}" });\n`;
      } else {
        const asParentProp = recase(this.options.caseProp, rel.parentProp);
        const bAlias = this.options.noAlias ? '' : `as: "${asParentProp}", `;
        strBelongs += `${sp}${rel.childModel}.belongsTo(${rel.parentModel}, { ${bAlias}foreignKey: "${rel.parentId}"});\n`;

        const hasRel = rel.isOne ? 'hasOne' : 'hasMany';
        const asChildProp = recase(this.options.caseProp, rel.childProp);
        const hAlias = this.options.noAlias ? '' : `as: "${asChildProp}", `;
        strBelongs += `${sp}${rel.parentModel}.${hasRel}(${rel.childModel}, { ${hAlias}foreignKey: "${rel.parentId}"});\n`;
      }
    });

    // belongsToMany must come first
    return strBelongsToMany + strBelongs;
  }

  // create the TypeScript init-models file to load all the models into Sequelize
  private createTsInitString(tables: string[], assoc: string): string {
    let str = 'import type { Sequelize } from "sequelize";\n';
    const sp = this.space[1];
    const modelNames: string[] = [];

    // import statements
    tables.forEach((t) => {
      const fileName = recase(this.options.caseFile, t, this.options.singularize);
      const modelName = makeTableName(this.options.caseModel, t, this.options.singularize, this.options.lang);
      modelNames.push(modelName);
      str += `import { ${modelName} } from "./${fileName}";\n`;
    });

    // re-export the model classes
    str += '\nexport {\n';
    modelNames.forEach((m) => {
      str += `${sp}${m},\n`;
    });
    str += '};\n';

    // create the initialization function
    str += 'export function initModels(sequelize: Sequelize) {\n';
    modelNames.forEach((m) => {
      str += `${sp}${m}.initModel(sequelize);\n`;
    });

    // add the associations
    str += '\n' + assoc;

    // return the models
    str += `\n${sp}return {\n`;
    modelNames.forEach((m) => {
      str += `${this.space[2]}${m}: ${m},\n`;
    });
    str += `${sp}};\n`;
    str += '}\n';

    return str;
  }

  // create the ES5 init-models file to load all the models into Sequelize
  private createES5InitString(tables: string[], assoc: string, vardef: string): string {
    let str = `${vardef} DataTypes = require("sequelize").DataTypes;\n`;
    const sp = this.space[1];
    const modelNames: string[] = [];

    // import statements
    tables.forEach((t) => {
      const fileName = recase(this.options.caseFile, t, this.options.singularize);
      const modelName = makeTableName(this.options.caseModel, t, this.options.singularize, this.options.lang);
      modelNames.push(modelName);
      str += `${vardef} _${modelName} = require("./${fileName}");\n`;
    });

    // create the initialization function
    str += '\nfunction initModels(sequelize) {\n';
    modelNames.forEach((m) => {
      str += `${sp}${vardef} ${m} = _${m}(sequelize, DataTypes);\n`;
    });

    // add the associations
    str += '\n' + assoc;

    // return the models
    str += `\n${sp}return {\n`;
    modelNames.forEach((m) => {
      str += `${this.space[2]}${m},\n`;
    });
    str += `${sp}};\n`;
    str += '}\n';
    str += 'module.exports = initModels;\n';
    str += 'module.exports.initModels = initModels;\n';
    str += 'module.exports.default = initModels;\n';
    return str;
  }

  // create the ESM init-models file to load all the models into Sequelize
  private createESMInitString(tables: string[], assoc: string): string {
    let str = 'import _sequelize from "sequelize";\n';
    str += 'const DataTypes = _sequelize.DataTypes;\n';
    const sp = this.space[1];
    const modelNames: string[] = [];

    // import statements
    tables.forEach((t) => {
      const fileName = recase(this.options.caseFile, t, this.options.singularize);
      const modelName = makeTableName(this.options.caseModel, t, this.options.singularize, this.options.lang);
      modelNames.push(modelName);
      str += `import _${modelName} from  "./${fileName}.js";\n`;
    });

    // create the initialization function
    str += '\nexport default function initModels(sequelize) {\n';
    modelNames.forEach((m) => {
      str += `${sp}const ${m} = _${m}.init(sequelize, DataTypes);\n`;
    });

    // add the associations
    str += '\n' + assoc;

    // return the models
    str += `\n${sp}return {\n`;
    modelNames.forEach((m) => {
      str += `${this.space[2]}${m},\n`;
    });
    str += `${sp}};\n`;
    str += '}\n';
    return str;
  }
}
