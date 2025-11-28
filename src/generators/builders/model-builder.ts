import _ from 'lodash';
import { ColumnDescription } from 'sequelize/types';
import { DialectOptions, FKSpec } from '../../dialects/dialect-options';
import { CaseOption, LangOption, qNameJoin, qNameSplit, recase, Relation, makeTableName } from '../../types';
import {
  addSchemaForRelations,
  getTypeScriptCreationOptionalFields,
  getTypeScriptPrimaryKeys,
  isParanoidField,
  isTimestampField,
} from '../../utils/generator-utils';
import { FieldBuilder } from './field-builder';
import {
  AssociationDefinition,
  ClassDeclaration,
  FieldDefinition,
  ImportStatement,
  ModelStructure,
  ProcessorContext,
  TableOptions,
} from '../types/model-structure';

export class ModelBuilder {
  private fieldBuilder: FieldBuilder;

  constructor() {
    this.fieldBuilder = new FieldBuilder();
  }

  buildModel(
    table: string,
    tables: { [tableName: string]: { [fieldName: string]: ColumnDescription } },
    foreignKeys: { [tableName: string]: { [fieldName: string]: FKSpec } },
    relations: Relation[],
    indexes: { [tableName: string]: any[] },
    hasTriggerTables: { [tableName: string]: boolean },
    dialect: DialectOptions,
    options: {
      version: 'v6' | 'v7';
      lang: LangOption;
      caseModel?: CaseOption;
      caseProp?: CaseOption;
      caseFile?: CaseOption;
      singularize: boolean;
      skipFields?: string[];
      additional?: any;
      noIndexes?: boolean;
      useDefine?: boolean;
      space: string[];
    }
  ): ModelStructure {
    const [schemaName, tableNameOrig] = qNameSplit(table);
    const tableName = makeTableName(options.caseModel, tableNameOrig, options.singularize, options.lang);

    // Build processor context
    const context: ProcessorContext = {
      version: options.version,
      lang: options.lang,
      dialect,
      space: options.space,
      caseProp: options.caseProp,
      additional: options.additional,
    };

    // Build imports
    const imports = this.buildImports(table, tables, foreignKeys, relations, options);

    // Build fields
    const fields = this.buildFields(table, tables, foreignKeys, context, options);

    // Build associations
    const associations = this.buildAssociations(table, relations, options);

    // Build table options
    const tableOptions = this.buildTableOptions(
      table,
      tableNameOrig,
      schemaName,
      tables,
      hasTriggerTables,
      indexes,
      dialect,
      options
    );

    // Build class declaration
    const classDeclaration: ClassDeclaration = {
      name: tableName,
      fields: fields.filter((f) => f !== null) as FieldDefinition[],
      associations,
    };

    // Add extends and generic params for TypeScript
    if (options.lang === 'ts') {
      if (options.version === 'v6') {
        classDeclaration.extends = 'Model';
        classDeclaration.genericParams = [`#TABLE#Attributes`, `#TABLE#CreationAttributes`];
      } else {
        classDeclaration.extends = 'Model';
        classDeclaration.genericParams = [`InferAttributes<#TABLE#>`, `InferCreationAttributes<#TABLE#>`];
      }
    }

    // Build interfaces for v6 TypeScript
    let interfaces: ModelStructure['interfaces'];
    if (options.lang === 'ts' && options.version === 'v6') {
      interfaces = this.buildInterfaces(table, tables, context, options);
    }

    // Build exports
    const exports = [{ type: 'named' as const, name: tableName }];

    return {
      imports,
      classDeclaration,
      exports,
      interfaces,
    };
  }

  private buildImports(
    table: string,
    tables: { [tableName: string]: { [fieldName: string]: ColumnDescription } },
    foreignKeys: { [tableName: string]: { [fieldName: string]: FKSpec } },
    relations: Relation[],
    options: any
  ): ImportStatement[] {
    const imports: ImportStatement[] = [];

    if (options.lang === 'ts') {
      if (options.version === 'v6') {
        imports.push({
          from: 'sequelize',
          imports: ['DataTypes', 'Model', 'Optional'],
        });
        imports.push({
          from: 'sequelize',
          imports: ['Sequelize'],
          isTypeOnly: true,
        });
      } else {
        imports.push({
          from: '@sequelize/core',
          imports: [
            'Sequelize',
            'DataTypes',
            'Model',
            'InferAttributes',
            'InferCreationAttributes',
            'CreationOptional',
            'NonAttribute',
          ],
        });
        imports.push({
          from: '@sequelize/core/decorators-legacy',
          imports: [
            'Attribute',
            'PrimaryKey',
            'AutoIncrement',
            'ColumnName',
            'NotNull',
            'Default',
            'Table',
            'Unique',
            'Comment',
            'BelongsToMany',
            'BelongsTo',
            'HasMany',
            'HasOne',
          ],
        });
      }

      // Add model imports for associations
      const needed: Record<string, Set<string>> = {};
      const tableForRelations = addSchemaForRelations(table, relations, qNameSplit, qNameJoin);

      relations.forEach((rel) => {
        if (!rel.isM2M) {
          if (rel.childTable === tableForRelations) {
            needed[rel.parentTable] ??= new Set();
            needed[rel.parentTable].add(rel.parentModel);
            if (options.version === 'v6') {
              needed[rel.parentTable].add(rel.parentModel + 'Id');
            }
          } else if (rel.parentTable === tableForRelations) {
            needed[rel.childTable] ??= new Set();
            needed[rel.childTable].add(rel.childModel);
            if (options.version === 'v6') {
              needed[rel.childTable].add(`${rel.childModel}Id`);
              if (!rel.isOne) {
                needed[rel.childTable].add(`${rel.childModel}CreationAttributes`);
              }
            }
          }
        } else {
          if (rel.parentTable === tableForRelations) {
            needed[rel.childTable] ??= new Set();
            needed[rel.childTable].add(rel.childModel);
            if (options.version === 'v6') {
              needed[rel.childTable].add(`${rel.childModel}Id`);
            }
          }
        }
      });

      if (needed[table]) {
        delete needed[table];
      }

      Object.keys(needed).sort().forEach((fkTable) => {
        const set = needed[fkTable];
        const [fkSchema, fkTableName] = qNameSplit(fkTable);
        const filename = recase(options.caseFile, fkTableName, options.singularize);
        if (options.version === 'v6') {
          imports.push({
            from: `./${filename}`,
            imports: Array.from(set.values()).sort(),
            isTypeOnly: true,
          });
        } else {
          imports.push({
            from: `./${filename}`,
            imports: [Array.from(set.values())[0]],
          });
        }
      });
    } else if (options.lang === 'es6' || options.lang === 'esm') {
      imports.push({
        from: 'sequelize',
        imports: ['Sequelize'],
      });
    } else {
      imports.push({
        from: 'sequelize',
        imports: ['Sequelize'],
      });
    }

    return imports;
  }

  private buildFields(
    table: string,
    tables: { [tableName: string]: { [fieldName: string]: ColumnDescription } },
    foreignKeys: { [tableName: string]: { [fieldName: string]: FKSpec } },
    context: ProcessorContext,
    options: any
  ): (FieldDefinition | null)[] {
    const fields = _.keys(tables[table]);
    return fields.map((field) => {
      const foreignKey =
        foreignKeys[table] && foreignKeys[table][field] ? foreignKeys[table][field] : null;
      const fieldObj = tables[table][field] as any;
      if (_.isObject(foreignKey)) {
        fieldObj.foreignKey = foreignKey;
      }
      return this.fieldBuilder.buildField(field, fieldObj, table, foreignKey, context, options.skipFields, options.additional);
    });
  }

  private buildAssociations(table: string, relations: Relation[], options: any): AssociationDefinition[] {
    const associations: AssociationDefinition[] = [];
    const tableForRelations = addSchemaForRelations(table, relations, qNameSplit, qNameJoin);

    relations.forEach((rel) => {
      if (!rel.isM2M) {
        if (rel.childTable === tableForRelations) {
          // belongsTo
          associations.push({
            type: 'belongsTo',
            targetModel: rel.parentModel,
            foreignKey: rel.parentId,
            alias: rel.parentProp,
          });
        } else if (rel.parentTable === tableForRelations) {
          if (rel.isOne) {
            // hasOne
            associations.push({
              type: 'hasOne',
              targetModel: rel.childModel,
              foreignKey: rel.parentId,
              alias: rel.childProp,
            });
          } else {
            // hasMany
            associations.push({
              type: 'hasMany',
              targetModel: rel.childModel,
              foreignKey: rel.parentId,
              alias: rel.childProp,
            });
          }
        }
      } else {
        // belongsToMany
        if (rel.parentTable === tableForRelations) {
          associations.push({
            type: 'belongsToMany',
            targetModel: rel.childModel,
            foreignKey: rel.parentId,
            otherKey: rel.childId,
            through: rel.joinModel,
            alias: rel.childProp,
          });
        }
      }
    });

    return associations;
  }

  private buildTableOptions(
    table: string,
    tableNameOrig: string,
    schemaName: string | null,
    tables: { [tableName: string]: { [fieldName: string]: ColumnDescription } },
    hasTriggerTables: { [tableName: string]: boolean },
    indexes: { [tableName: string]: any[] },
    dialect: DialectOptions,
    options: any
  ): TableOptions {
    let timestamps = (options.additional && options.additional.timestamps === true) || false;
    let paranoid = (options.additional && options.additional.paranoid === true) || false;

    // Check fields for timestamps
    const fields = Object.keys(tables[table] || {});
    fields.forEach((field) => {
      timestamps ||= isTimestampField(field, options.additional);
      paranoid ||= isParanoidField(field, options.additional);
    });

    return {
      tableName: tableNameOrig,
      schema: schemaName && dialect.hasSchema ? schemaName : undefined,
      timestamps,
      paranoid,
      hasTrigger: hasTriggerTables[table],
      indexes: options.noIndexes ? undefined : indexes[table],
      additional: options.additional,
    };
  }

  private buildInterfaces(
    table: string,
    tables: { [tableName: string]: { [fieldName: string]: ColumnDescription } },
    context: ProcessorContext,
    options: any
  ): ModelStructure['interfaces'] {
    const primaryKeys = getTypeScriptPrimaryKeys(tables, table);
    const creationOptionalFields = getTypeScriptCreationOptionalFields(
      tables,
      table,
      (field) => isTimestampField(field, options.additional)
    );

    return {
      attributes: '#TABLE#Attributes',
      creationAttributes: creationOptionalFields.length
        ? 'Optional<#TABLE#Attributes, #TABLE#OptionalAttributes>'
        : '#TABLE#Attributes',
      pk: primaryKeys.length
        ? primaryKeys.map((k) => `"${recase(options.caseProp, k)}"`).join(' | ')
        : undefined,
      id: primaryKeys.length ? '#TABLE#[#TABLE#Pk]' : undefined,
    };
  }
}
