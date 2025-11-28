import _ from 'lodash';
import { Field } from '../types';
import {
  escapeSpecial,
  getSqType,
  isIgnoredField,
  isParanoidField,
  isTimestampField,
  makeIndent,
  qNameSplit,
  recase,
  TSField,
} from '../utils/GeneratorUtils';
import { GeneratedMigration, GeneratorContext, GeneratorOptions, IMigrationGenerator } from './IGenerator';

/**
 * Migration Generator - Generates Sequelize migration files
 * 
 * This generator creates migration files that can be used to create
 * or modify database tables using Sequelize migrations.
 */
export class MigrationGenerator implements IMigrationGenerator {
  /**
   * Generate a migration file for a single table
   */
  generateMigration(table: string, context: GeneratorContext): GeneratedMigration {
    const [schemaName, tableNameOrig] = qNameSplit(table);
    const space = context.space;
    const fields = _.keys(context.tables[table]);

    let str = '';

    // Migration header
    str += "'use strict';\n\n";

    // Up function
    str += 'module.exports = {\n';
    str += `${space[1]}async up(queryInterface, Sequelize) {\n`;
    str += `${space[2]}await queryInterface.createTable('${tableNameOrig}', {\n`;

    // Generate column definitions
    fields.forEach((field) => {
      if (isIgnoredField(field, context.options.skipFields)) {
        return;
      }

      str += this.generateMigrationField(context, table, field);
    });

    // Remove trailing comma
    str = str.replace(/,\n$/, '\n');

    str += `${space[2]}});\n`;

    // Add indexes
    const indexes = context.indexes[table];
    if (indexes && indexes.length && !context.options.noIndexes) {
      str += '\n';
      indexes.forEach((idx) => {
        if (!idx.primary) {
          str += `${space[2]}await queryInterface.addIndex('${tableNameOrig}', {\n`;
          if (idx.name) {
            str += `${space[3]}name: '${idx.name}',\n`;
          }
          if (idx.unique) {
            str += `${space[3]}unique: true,\n`;
          }
          str += `${space[3]}fields: [${idx.fields.map((f) => `'${f.attribute}'`).join(', ')}],\n`;
          str += `${space[2]}});\n`;
        }
      });
    }

    str += `${space[1]}},\n\n`;

    // Down function
    str += `${space[1]}async down(queryInterface, Sequelize) {\n`;
    str += `${space[2]}await queryInterface.dropTable('${tableNameOrig}');\n`;
    str += `${space[1]}}\n`;
    str += '};\n';

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const fileName = `${timestamp}-create-${tableNameOrig.toLowerCase()}.js`;

    return {
      tableName: table,
      content: str,
      fileName,
    };
  }

  /**
   * Generate a single field definition for the migration
   */
  private generateMigrationField(context: GeneratorContext, table: string, field: string): string {
    const space = context.space;
    const fieldObj = context.tables[table][field] as Field;
    const foreignKey =
      context.foreignKeys[table] && context.foreignKeys[table][field]
        ? context.foreignKeys[table][field]
        : null;

    if (_.isObject(foreignKey)) {
      fieldObj.foreignKey = foreignKey;
    }

    const isSerialKey =
      (fieldObj.foreignKey && fieldObj.foreignKey.isSerialKey) ||
      (context.dialect.isSerialKey && context.dialect.isSerialKey(fieldObj));

    let str = `${space[3]}${field}: {\n`;

    // Type
    const sqType = getSqType(fieldObj as TSField, context.dialect.name);
    if (sqType) {
      str += `${space[4]}type: ${sqType.replace('DataTypes.', 'Sequelize.')},\n`;
    }

    // Primary key
    if (fieldObj.primaryKey) {
      str += `${space[4]}primaryKey: true,\n`;
    }

    // Auto increment
    if (isSerialKey || fieldObj.autoIncrement) {
      str += `${space[4]}autoIncrement: true,\n`;
    }

    // Allow null
    str += `${space[4]}allowNull: ${fieldObj.allowNull !== false},\n`;

    // Default value
    if (fieldObj.defaultValue !== null && fieldObj.defaultValue !== undefined && !isSerialKey) {
      let defaultVal = fieldObj.defaultValue;
      if (_.isString(defaultVal)) {
        defaultVal = escapeSpecial(defaultVal);
        // Handle common defaults
        if (defaultVal.match(/^(current_timestamp|now\(\)|getdate\(\))$/i)) {
          str += `${space[4]}defaultValue: Sequelize.literal('${defaultVal}'),\n`;
        } else if (
          (fieldObj.type.toLowerCase() === 'uuid' || fieldObj.type.toLowerCase() === 'uniqueidentifier') &&
          (defaultVal === 'gen_random_uuid()' || defaultVal === 'uuid_generate_v4()')
        ) {
          str += `${space[4]}defaultValue: Sequelize.UUIDV4,\n`;
        } else {
          str += `${space[4]}defaultValue: "${defaultVal}",\n`;
        }
      } else if (_.isBoolean(defaultVal)) {
        str += `${space[4]}defaultValue: ${defaultVal},\n`;
      } else if (_.isNumber(defaultVal)) {
        str += `${space[4]}defaultValue: ${defaultVal},\n`;
      }
    }

    // Unique
    if (fieldObj.unique) {
      str += `${space[4]}unique: true,\n`;
    }

    // Foreign key references
    if (foreignKey && foreignKey.isForeignKey) {
      str += `${space[4]}references: {\n`;
      str += `${space[5]}model: '${foreignKey.foreignSources.target_table}',\n`;
      str += `${space[5]}key: '${foreignKey.foreignSources.target_column}',\n`;
      str += `${space[4]}},\n`;
      
      // On delete/update for foreign keys
      str += `${space[4]}onDelete: 'SET NULL',\n`;
      str += `${space[4]}onUpdate: 'CASCADE',\n`;
    }

    // Comment
    if (fieldObj.comment && context.dialect.name !== 'mssql') {
      str += `${space[4]}comment: "${escapeSpecial(fieldObj.comment)}",\n`;
    }

    str += `${space[3]}},\n`;

    return str;
  }

  /**
   * Generate migrations for all tables
   */
  generateAllMigrations(context: GeneratorContext): Map<string, GeneratedMigration> {
    const tableNames = _.keys(context.tables);
    const migrations = new Map<string, GeneratedMigration>();

    tableNames.forEach((table) => {
      const migration = this.generateMigration(table, context);
      migrations.set(table, migration);
    });

    return migrations;
  }
}

/**
 * V6 Migration Generator - Same as base MigrationGenerator
 */
export class V6MigrationGenerator extends MigrationGenerator {}

/**
 * V7 Migration Generator - Sequelize v7 style migrations
 * V7 migrations are similar but may use different imports
 */
export class V7MigrationGenerator extends MigrationGenerator {
  generateMigration(table: string, context: GeneratorContext): GeneratedMigration {
    const migration = super.generateMigration(table, context);

    // V7 uses @sequelize/core imports
    let content = migration.content;
    content = content.replace(
      "'use strict';\n\n",
      "'use strict';\n\n// Note: For Sequelize v7, ensure you're using @sequelize/core\n"
    );

    return {
      ...migration,
      content,
    };
  }
}
