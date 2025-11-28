import { DialectOptions } from '../dialects/dialect-options';
import { TableData } from '../types';
import { makeIndent } from '../utils/GeneratorUtils';
import {
  V6FieldGenerator,
  V6ImportGenerator,
  V6IndexGenerator,
  V6RelationGenerator,
  V6TableOptionsGenerator,
  V7FieldGenerator,
  V7ImportGenerator,
  V7IndexGenerator,
  V7RelationGenerator,
  V7TableOptionsGenerator,
} from './components';
import { GeneratorContext, GeneratorOptions, IInitGenerator, IModelGenerator } from './IGenerator';
import { V6InitGenerator, V7InitGenerator } from './InitGenerator';
import { MigrationGenerator, V6MigrationGenerator, V7MigrationGenerator } from './MigrationGenerator';
import { V6ModelGenerator } from './V6ModelGenerator';
import { V7ModelGenerator } from './V7ModelGenerator';

/**
 * Generator factory that creates the appropriate generators based on options.
 * 
 * This is the main entry point for getting generators. It handles:
 * - Version-based generator selection (V6 vs V7)
 * - Component generator creation
 * - Context creation for generators
 */
export class GeneratorFactory {
  private options: GeneratorOptions;

  constructor(options: GeneratorOptions) {
    this.options = {
      ...options,
      version: options.version || 'v6',
      lang: options.lang || 'es5',
      spaces: options.spaces ?? true,
      indentation: options.indentation ?? 2,
      singularize: options.singularize ?? false,
      useDefine: options.useDefine ?? false,
      associationMixins: options.associationMixins || 'all',
    };
  }

  /**
   * Get the appropriate model generator based on version
   */
  getModelGenerator(): IModelGenerator {
    if (this.options.version === 'v7') {
      return new V7ModelGenerator();
    }
    return new V6ModelGenerator();
  }

  /**
   * Get the appropriate init generator based on version
   */
  getInitGenerator(): IInitGenerator {
    if (this.options.version === 'v7') {
      return new V7InitGenerator();
    }
    return new V6InitGenerator();
  }

  /**
   * Get the appropriate migration generator based on version
   */
  getMigrationGenerator(): MigrationGenerator {
    if (this.options.version === 'v7') {
      return new V7MigrationGenerator();
    }
    return new V6MigrationGenerator();
  }

  /**
   * Get component generators for direct access
   */
  getComponentGenerators() {
    if (this.options.version === 'v7') {
      return {
        import: new V7ImportGenerator(),
        field: new V7FieldGenerator(),
        tableOptions: new V7TableOptionsGenerator(),
        index: new V7IndexGenerator(),
        relation: new V7RelationGenerator(),
      };
    }

    return {
      import: new V6ImportGenerator(),
      field: new V6FieldGenerator(),
      tableOptions: new V6TableOptionsGenerator(),
      index: new V6IndexGenerator(),
      relation: new V6RelationGenerator(),
    };
  }

  /**
   * Create a generator context from table data and dialect
   */
  createContext(tableData: TableData, dialect: DialectOptions): GeneratorContext {
    return {
      tables: tableData.tables,
      foreignKeys: tableData.foreignKeys,
      hasTriggerTables: tableData.hasTriggerTables,
      indexes: tableData.indexes,
      relations: tableData.relations,
      dialect,
      options: this.options,
      space: makeIndent(this.options.spaces, this.options.indentation),
    };
  }

  /**
   * Get the configured options
   */
  getOptions(): GeneratorOptions {
    return { ...this.options };
  }

  /**
   * Check if using V7 generators
   */
  isV7(): boolean {
    return this.options.version === 'v7';
  }

  /**
   * Check if generating TypeScript
   */
  isTypeScript(): boolean {
    return this.options.lang === 'ts';
  }
}

/**
 * Convenience function to create a generator factory
 */
export function createGeneratorFactory(options: GeneratorOptions): GeneratorFactory {
  return new GeneratorFactory(options);
}

/**
 * Quick generation functions for common use cases
 */
export const generators = {
  /**
   * Generate all models for a table data set
   */
  generateModels(
    tableData: TableData,
    dialect: DialectOptions,
    options: GeneratorOptions
  ): Map<string, string> {
    const factory = new GeneratorFactory(options);
    const modelGenerator = factory.getModelGenerator();
    const models = modelGenerator.generateAllModels(tableData, dialect, options);

    const result = new Map<string, string>();
    models.forEach((model, key) => {
      result.set(key, model.content);
    });

    return result;
  },

  /**
   * Generate init-models file content
   */
  generateInit(
    tableNames: string[],
    relations: any[],
    options: GeneratorOptions
  ): string {
    const factory = new GeneratorFactory(options);
    const initGenerator = factory.getInitGenerator();
    const init = initGenerator.generateInit(tableNames, relations, options);
    return init.content;
  },

  /**
   * Generate migrations for all tables
   */
  generateMigrations(
    tableData: TableData,
    dialect: DialectOptions,
    options: GeneratorOptions
  ): Map<string, { content: string; fileName: string }> {
    const factory = new GeneratorFactory(options);
    const migrationGenerator = factory.getMigrationGenerator();
    const context = factory.createContext(tableData, dialect);
    const migrations = migrationGenerator.generateAllMigrations(context);

    const result = new Map<string, { content: string; fileName: string }>();
    migrations.forEach((migration, key) => {
      result.set(key, {
        content: migration.content,
        fileName: migration.fileName,
      });
    });

    return result;
  },
};
