import _ from 'lodash';
import { DialectOptions } from '../dialects/dialect-options';
import { TableData } from '../types';
import { makeIndent, makeTableName, qNameSplit } from '../utils/GeneratorUtils';
import {
  GeneratedModel,
  GeneratorContext,
  GeneratorOptions,
  IModelGenerator,
} from './IGenerator';

/**
 * Abstract base class for model generation
 */
export abstract class BaseModelGenerator implements IModelGenerator {
  abstract generateModel(table: string, context: GeneratorContext): GeneratedModel;

  generateAllModels(
    tableData: TableData,
    dialect: DialectOptions,
    options: GeneratorOptions
  ): Map<string, GeneratedModel> {
    const context = this.createContext(tableData, dialect, options);
    const tableNames = _.keys(tableData.tables);
    const models = new Map<string, GeneratedModel>();

    tableNames.forEach((table) => {
      const model = this.generateModel(table, context);
      models.set(table, model);
    });

    return models;
  }

  protected createContext(
    tableData: TableData,
    dialect: DialectOptions,
    options: GeneratorOptions
  ): GeneratorContext {
    return {
      tables: tableData.tables,
      foreignKeys: tableData.foreignKeys,
      hasTriggerTables: tableData.hasTriggerTables,
      indexes: tableData.indexes,
      relations: tableData.relations,
      dialect,
      options,
      space: makeIndent(options.spaces, options.indentation),
    };
  }

  /**
   * Replace #TABLE# placeholder with actual table name
   */
  protected replaceTablePlaceholder(str: string, tableName: string): string {
    const re = new RegExp('#TABLE#', 'g');
    return str.replace(re, tableName);
  }

  /**
   * Get the model name from table name
   */
  protected getModelName(table: string, options: GeneratorOptions): string {
    const [, tableNameOrig] = qNameSplit(table);
    return makeTableName(options.caseModel, tableNameOrig, options.singularize, options.lang);
  }
}
