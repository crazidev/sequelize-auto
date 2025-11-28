import { ColumnDescription } from 'sequelize';
import { DialectOptions, FKSpec } from '../dialects/dialect-options';
import { IndexSpec, Relation, TableData } from '../types';
import { CaseFileOption, CaseOption, LangOption } from '../utils/GeneratorUtils';

/** Configuration options for generators */
export interface GeneratorOptions {
  indentation?: number;
  spaces?: boolean;
  lang?: LangOption;
  caseModel?: CaseOption;
  caseProp?: CaseOption;
  caseFile?: CaseFileOption;
  skipFields?: string[];
  additional?: any;
  schema?: string;
  singularize: boolean;
  useDefine: boolean;
  noIndexes?: boolean;
  noAlias?: boolean;
  version?: 'v6' | 'v7';
  /** Association mixin generation mode: 'all' | 'property' | 'none' */
  associationMixins?: 'all' | 'property' | 'none';
}

/** Result from generating a model file */
export interface GeneratedModel {
  tableName: string;
  modelName: string;
  content: string;
}

/** Result from generating the init-models file */
export interface GeneratedInit {
  content: string;
  fileName: string;
}

/** Result from generating a migration file */
export interface GeneratedMigration {
  tableName: string;
  content: string;
  fileName: string;
}

/** Context passed to generators containing all table metadata */
export interface GeneratorContext {
  tables: { [tableName: string]: { [fieldName: string]: ColumnDescription } };
  foreignKeys: { [tableName: string]: { [fieldName: string]: FKSpec } };
  hasTriggerTables: { [tableName: string]: boolean };
  indexes: { [tableName: string]: IndexSpec[] };
  relations: Relation[];
  dialect: DialectOptions;
  options: GeneratorOptions;
  space: string[];
}

/**
 * Main generator interface for creating model files.
 * Implementations: V6ModelGenerator, V7ModelGenerator
 */
export interface IModelGenerator {
  /**
   * Generate model file content for a single table
   * @param table - The qualified table name (schema.table or table)
   * @param context - Generator context with all metadata
   */
  generateModel(table: string, context: GeneratorContext): GeneratedModel;

  /**
   * Generate model files for all tables
   * @param tableData - Complete table data
   * @param dialect - Dialect-specific options
   * @param options - Generator options
   */
  generateAllModels(tableData: TableData, dialect: DialectOptions, options: GeneratorOptions): Map<string, GeneratedModel>;
}

/**
 * Generator interface for creating init-models file.
 */
export interface IInitGenerator {
  /**
   * Generate the init-models file content
   * @param modelNames - List of model names to initialize
   * @param relations - Relationships between models
   * @param options - Generator options
   */
  generateInit(
    modelNames: string[],
    relations: Relation[],
    options: GeneratorOptions
  ): GeneratedInit;
}

/**
 * Generator interface for creating migration files.
 */
export interface IMigrationGenerator {
  /**
   * Generate a migration file for a table
   * @param table - The qualified table name
   * @param context - Generator context with all metadata
   */
  generateMigration(table: string, context: GeneratorContext): GeneratedMigration;
}

/**
 * Factory function type for creating the appropriate generator based on version
 */
export type GeneratorFactoryFn<T> = (options: GeneratorOptions) => T;
