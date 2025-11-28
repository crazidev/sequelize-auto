import { ColumnDescription } from 'sequelize';
import { FKSpec } from '../../dialects/dialect-options';
import { Field, IndexSpec, Relation } from '../../types';
import { GeneratorContext, GeneratorOptions } from '../IGenerator';

/**
 * Base interface for component generators
 */
export interface IComponentGenerator {
  /** Generate the component output */
  generate(context: GeneratorContext, table: string): string;
}

/**
 * Import statement generator interface
 * Handles import/require statements at the top of model files
 */
export interface IImportGenerator extends IComponentGenerator {
  /** Generate imports for TypeScript */
  generateTS(context: GeneratorContext, table: string, associations: AssociationImports): string;
  /** Generate imports for ES6 (CommonJS with class syntax) */
  generateES6(context: GeneratorContext, tableName: string): string;
  /** Generate imports for ESM (ES Modules) */
  generateESM(context: GeneratorContext, tableName: string): string;
  /** Generate imports for ES5 (CommonJS) */
  generateES5(context: GeneratorContext, tableName: string): string;
}

/**
 * Field/column generator interface
 * Handles generation of field definitions in model files
 */
export interface IFieldGenerator extends IComponentGenerator {
  /** Generate TypeScript field definitions */
  generateTS(context: GeneratorContext, table: string): FieldGeneratorResult;
  /** Generate JavaScript field definitions (ES5, ES6, ESM) */
  generateJS(context: GeneratorContext, table: string): string;
}

/**
 * Table options generator interface
 * Handles model configuration options (tableName, timestamps, etc.)
 */
export interface ITableOptionsGenerator extends IComponentGenerator {
  /** Generate TypeScript table options */
  generateTS(context: GeneratorContext, table: string): string;
  /** Generate JavaScript table options */
  generateJS(context: GeneratorContext, table: string): string;
}

/**
 * Index generator interface
 * Handles index definitions for models
 */
export interface IIndexGenerator extends IComponentGenerator {
  /** Generate index definitions */
  generateIndexes(context: GeneratorContext, table: string): string;
}

/**
 * Relation/association generator interface
 * Handles both TypeScript type declarations and runtime association code
 */
export interface IRelationGenerator extends IComponentGenerator {
  /** Generate TypeScript association mixins and declarations */
  generateTSMixins(context: GeneratorContext, table: string): AssociationResult;
  /** Generate runtime association code for init-models */
  generateAssociations(relations: Relation[], options: GeneratorOptions): string;
}

/**
 * Result from field generation containing field definitions and metadata
 */
export interface FieldGeneratorResult {
  /** The generated field definitions */
  fields: string;
  /** Whether timestamps were detected */
  hasTimestamps: boolean;
  /** Whether paranoid (soft delete) was detected */
  hasParanoid: boolean;
  /** Primary key field names */
  primaryKeys: string[];
  /** Fields that are optional at creation time */
  creationOptionalFields: string[];
}

/**
 * Result from association/relation generation
 */
export interface AssociationResult {
  /** The generated association declarations */
  str: string;
  /** Models that need to be imported */
  needed: Record<string, Set<string>>;
}

/**
 * Import requirements for associations
 */
export interface AssociationImports {
  needed: Record<string, Set<string>>;
}

/**
 * Field metadata extracted from the database schema
 */
export interface FieldMetadata {
  field: Field;
  fieldName: string;
  foreignKey: FKSpec | null;
  isSerialKey: boolean;
  unique: boolean | string;
}
