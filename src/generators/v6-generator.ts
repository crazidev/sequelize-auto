import _ from 'lodash';
import { ColumnDescription } from 'sequelize/types';
import { DialectOptions, FKSpec } from '../dialects/dialect-options';
import { CaseOption, LangOption, makeIndent, makeTableName, qNameSplit, Relation } from '../types';
import { ModelBuilder } from './builders/model-builder';
import { V6Renderer } from './renderers/v6-renderer';

export class V6Generator {
  private modelBuilder: ModelBuilder;
  private renderer: V6Renderer;
  private options: {
    lang: LangOption;
    caseModel?: CaseOption;
    caseProp?: CaseOption;
    caseFile?: CaseOption;
    singularize: boolean;
    skipFields?: string[];
    additional?: any;
    noIndexes?: boolean;
    useDefine: boolean;
    spaces?: boolean;
    indentation?: number;
  };

  constructor(
    dialect: DialectOptions,
    options: {
      lang?: LangOption;
      caseModel?: CaseOption;
      caseProp?: CaseOption;
      caseFile?: CaseOption;
      singularize: boolean;
      skipFields?: string[];
      additional?: any;
      noIndexes?: boolean;
      useDefine: boolean;
      spaces?: boolean;
      indentation?: number;
    }
  ) {
    this.options = {
      lang: options.lang || 'es5',
      caseModel: options.caseModel,
      caseProp: options.caseProp,
      caseFile: options.caseFile,
      singularize: options.singularize,
      skipFields: options.skipFields,
      additional: options.additional,
      noIndexes: options.noIndexes,
      useDefine: options.useDefine,
      spaces: options.spaces,
      indentation: options.indentation,
    };

    const space = makeIndent(this.options.spaces, this.options.indentation);
    this.modelBuilder = new ModelBuilder();
    this.renderer = new V6Renderer(
      space,
      this.options.lang,
      this.options.useDefine,
      this.options.caseProp,
      this.options.caseModel
    );
  }

  generateText(
    tables: { [tableName: string]: { [fieldName: string]: ColumnDescription } },
    foreignKeys: { [tableName: string]: { [fieldName: string]: FKSpec } },
    relations: Relation[],
    indexes: { [tableName: string]: any[] },
    hasTriggerTables: { [tableName: string]: boolean },
    dialect: DialectOptions
  ): { [name: string]: string } {
    const tableNames = _.keys(tables);
    const text: { [name: string]: string } = {};

    tableNames.forEach((table) => {
      const [schemaName, tableNameOrig] = qNameSplit(table);
      const tableName = makeTableName(
        this.options.caseModel,
        tableNameOrig,
        this.options.singularize,
        this.options.lang
      );

      // Build model structure
      const structure = this.modelBuilder.buildModel(
        table,
        tables,
        foreignKeys,
        relations,
        indexes,
        hasTriggerTables,
        dialect,
        {
          version: 'v6',
          ...this.options,
          space: makeIndent(this.options.spaces, this.options.indentation),
        }
      );

      // Render to string
      const rendered = this.renderer.renderModel(structure, tableName);
      text[table] = rendered;
    });

    return text;
  }
}
