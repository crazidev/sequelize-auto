import _ from 'lodash';
import { Dialect, Sequelize } from 'sequelize';
import { AutoBuilder } from './auto-builder';
import { AutoGenerator } from './auto-generator';
import { AutoRelater } from './auto-relater';
import { AutoWriter } from './auto-writer';
import { dialects } from './dialects/dialects';
import { createGeneratorFactory, GeneratorOptions } from './generators';
import { AutoOptions, TableData } from './types';

/**
 * SequelizeAuto - Main class for generating Sequelize models from database
 * 
 * This class orchestrates the entire model generation process:
 * 1. Build - Extracts table metadata from the database
 * 2. Relate - Computes relationships between tables
 * 3. Generate - Creates model file content
 * 4. Write - Writes files to disk
 */
export class SequelizeAuto {
  sequelize: Sequelize;
  options: AutoOptions;

  constructor(database: string | Sequelize, username: string, password: string, options: AutoOptions) {
    if (options && options.dialect === 'sqlite' && !options.storage && database) {
      options.storage = database as string;
    }
    if (options && options.dialect === 'mssql') {
      // set defaults for tedious, to silence the warnings
      options.dialectOptions = options.dialectOptions || {};
      options.dialectOptions.options = options.dialectOptions.options || {};
      options.dialectOptions.options.trustServerCertificate = true;
      options.dialectOptions.options.enableArithAbort = true;
      options.dialectOptions.options.validateBulkLoadParameters = true;
    }

    if (database instanceof Sequelize) {
      this.sequelize = database;
    } else {
      this.sequelize = new Sequelize(database, username, password, options || {});
    }

    this.options = _.extend(
      {
        spaces: true,
        indentation: 2,
        directory: './models',
        additional: {},
        host: 'localhost',
        port: this.getDefaultPort(options.dialect),
        closeConnectionAutomatically: true,
        version: 'v6',
        associationMixins: 'all',
      },
      options || {}
    );

    if (!this.options.directory) {
      this.options.noWrite = true;
    }
  }

  /**
   * Run the complete model generation pipeline
   */
  async run(): Promise<TableData> {
    let td = await this.build();
    td = this.relate(td);
    const tt = this.generate(td);
    td.text = tt;
    await this.write(td);
    return td;
  }

  /**
   * Build table metadata from the database
   */
  build(): Promise<TableData> {
    const builder = new AutoBuilder(this.sequelize, this.options);
    return builder.build().then((tableData) => {
      if (this.options.closeConnectionAutomatically) {
        return this.sequelize.close().then(() => tableData);
      }
      return tableData;
    });
  }

  /**
   * Compute relationships between tables
   */
  relate(td: TableData): TableData {
    const relater = new AutoRelater(this.options);
    return relater.buildRelations(td);
  }

  /**
   * Generate model file content
   * Uses the new generator factory system for V6/V7 support
   */
  generate(tableData: TableData): { [name: string]: string } {
    const dialect = dialects[this.sequelize.getDialect() as Dialect];
    
    // Use the new generator factory system
    const generatorOptions: GeneratorOptions = {
      indentation: this.options.indentation,
      spaces: this.options.spaces,
      lang: this.options.lang,
      caseModel: this.options.caseModel,
      caseProp: this.options.caseProp,
      caseFile: this.options.caseFile,
      skipFields: this.options.skipFields,
      additional: this.options.additional,
      schema: this.options.schema,
      singularize: this.options.singularize,
      useDefine: this.options.useDefine,
      noIndexes: this.options.noIndexes,
      noAlias: this.options.noAlias,
      version: this.options.version || 'v6',
      associationMixins: this.options.associationMixins || 'all',
    };

    const factory = createGeneratorFactory(generatorOptions);
    const modelGenerator = factory.getModelGenerator();
    const models = modelGenerator.generateAllModels(tableData, dialect, generatorOptions);

    // Convert Map to object for backward compatibility
    const result: { [name: string]: string } = {};
    models.forEach((model, key) => {
      result[key] = model.content;
    });

    return result;
  }

  /**
   * Legacy generate method using AutoGenerator
   * Kept for backward compatibility
   */
  generateLegacy(tableData: TableData): { [name: string]: string } {
    const dialect = dialects[this.sequelize.getDialect() as Dialect];
    const generator = new AutoGenerator(tableData, dialect, this.options);
    return generator.generateText();
  }

  /**
   * Write generated files to disk
   */
  write(tableData: TableData): Promise<void[]> {
    const writer = new AutoWriter(tableData, this.options);
    return writer.write();
  }

  /**
   * Get the default port for a dialect
   */
  getDefaultPort(dialect?: Dialect): number {
    switch (dialect) {
      case 'mssql':
        return 1433;
      case 'postgres':
        return 5432;
      default:
        return 3306;
    }
  }
}

module.exports = SequelizeAuto;
module.exports.SequelizeAuto = SequelizeAuto;
module.exports.default = SequelizeAuto;
