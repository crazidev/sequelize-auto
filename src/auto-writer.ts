import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import util from 'util';
import { FKSpec, TableData } from '.';
import {
  AutoOptions,
  CaseFileOption,
  CaseOption,
  LangOption,
  makeIndent,
  makeTableName,
  pluralize,
  qNameSplit,
  recase,
  Relation,
} from './types';
const mkdirp = require('mkdirp');

/** Writes text into files from TableData.text, and writes init-models */
export class AutoWriter {
  tableText: { [name: string]: string };
  tableMigration: { [name: string]: string };
  foreignKeys: { [tableName: string]: { [fieldName: string]: FKSpec } };
  relations: Relation[];
  space: string[];
  options: {
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
    generateMigration?: boolean;
  };
  constructor(tableData: TableData, options: AutoOptions) {
    this.tableText = tableData.text as { [name: string]: string };
    this.tableMigration = tableData.migration as { [name: string]: string };
    this.foreignKeys = tableData.foreignKeys;
    this.relations = tableData.relations;
    this.options = options;
    this.space = makeIndent(this.options.spaces, this.options.indentation);
  }

  write() {
    if (this.options.noWrite) {
      return Promise.resolve();
    }

    mkdirp.sync(path.resolve(this.options.directory || './models'));

    const tables = _.keys(this.tableText);
    const tablesM = _.keys(this.tableText);

    // write the individual model files
    const promises = tables.map((t, index) => {
      return this.createFile(t, index);
    });

    const isTypeScript = this.options.lang === 'ts';
    const assoc = this.createAssociations(isTypeScript);

    // get table names without schema
    // TODO: add schema to model and file names when schema is non-default for the dialect
    const tableNames = tables
      .map((t) => {
        const [schemaName, tableName] = qNameSplit(t);
        return tableName as string;
      })
      .sort();

    // write the init-models file
    if (!this.options.noInitModels) {
      const initString = this.createInitString(tableNames, assoc, this.options.lang);
      const initFilePath = path.join(this.options.directory, 'init-models' + (isTypeScript ? '.ts' : '.js'));
      const writeFile = util.promisify(fs.writeFile);
      const initPromise = writeFile(path.resolve(initFilePath), initString);

      promises.push(initPromise);
    }

    if (this.options.generateMigration) {
      promises.push(this.generateFkFile(tableNames));
    }

    return Promise.all(promises);
  }

  private generateFkFile(tableNames: string[]) {
    var str = '';
    str += `"use strict";\n`;
    str += `const { DataTypes } = require("sequelize");\n\n`;
    str += `/** @type {import('sequelize-cli').Migration} */\n`;
    str += `module.exports = {\n`;

    // Generate the "up" function
    str += `${this.space[1]}up(queryInterface, Sequelize) {\n`;
    str += `${this.space[2]}return queryInterface.sequelize.transaction(t => {\n`;
    str += `${this.space[3]}return Promise.all([\n`;

    tableNames.forEach((table) => {
      if (this.foreignKeys[table]) {
        const foreignKeys = this.foreignKeys[table];
        _.keys(foreignKeys).forEach((field) => {
          const foreignKey = foreignKeys[field];
          var fk_str = '';

          var constraint_name = this.generateConstraintName(table, field, foreignKey);

          // Add the index for the foreign key field first
          // fk_str += `${this.space[3]}queryInterface.addIndex("${table}", ["${field}"], {\n`;
          // fk_str += `${this.space[4]}transaction: t\n`;
          // fk_str += `${this.space[3]}}),\n\n`;

          // Add the foreign key constraint after the index
          fk_str += `${this.space[3]}queryInterface.addConstraint("${table}", {\n`;
          fk_str += `${this.space[4]}fields: ["${field}"],\n`;
          fk_str += `${this.space[4]}name: "${constraint_name}",\n`;
          fk_str += `${this.space[4]}type: "${foreignKey.isPrimaryKey ? 'primary key' : 'foreign key'}",\n`;
          if (foreignKey.isForeignKey) {
            fk_str += `${this.space[4]}references: {\n`;
            fk_str += `${this.space[5]}table: "${foreignKey.target_table}",\n`;
            fk_str += `${this.space[5]}field: "${foreignKey.target_column}"\n`;
            fk_str += `${this.space[4]}},\n`;
          }
          fk_str += `${this.space[4]}transaction: t\n`;
          fk_str += `${this.space[3]}}),\n\n`;

          if (foreignKey.isForeignKey) {
            str += fk_str;
          }
        });
      }
    });

    str += `${this.space[3]}]);\n`;
    str += `${this.space[2]}});\n`;
    str += `${this.space[1]}},\n\n`;

    // Generate the "down" function to remove the constraints and indexes
    str += `${this.space[1]}down(queryInterface, Sequelize) {\n`;
    str += `${this.space[2]}return queryInterface.sequelize.transaction(t => {\n`;
    str += `${this.space[3]}return Promise.all([\n`;

    tableNames.forEach((table) => {
      if (this.foreignKeys[table]) {
        const foreignKeys = this.foreignKeys[table];
        _.keys(foreignKeys).forEach((field) => {
          const foreignKey = foreignKeys[field];
          var fk_str_down = '';
          var constraint_name = this.generateConstraintName(table, field, foreignKey);
          // Remove the foreign key constraint
          fk_str_down += `${this.space[3]}queryInterface.removeConstraint("${table}", "${constraint_name}", { transaction: t }),\n`;

          // Remove the index for the foreign key field after removing the constraint
          // fk_str_down += `${this.space[3]}queryInterface.removeIndex("${table}", ["${field}"], { transaction: t }),\n`;

          if (foreignKey.isForeignKey) {
            str += fk_str_down;
          }
        });
      }
    });

    str += `${this.space[3]}]);\n`;
    str += `${this.space[2]}});\n`;
    str += `${this.space[1]}}\n`;
    str += `};\n`;

    const initFkFilePath = path.join(this.options.directory, 'migrations', 'zzz_add_constraints.js');
    const writeFile = util.promisify(fs.writeFile);
    const initFkPromise = writeFile(path.resolve(initFkFilePath), str);
    return initFkPromise;
  }

  generateConstraintName(table: string, field: string, foreignKey: FKSpec) {
    return `${table}(${field})-${foreignKey.target_table}(${foreignKey.target_column})_fk`;
  }

  private createInitString(tableNames: string[], assoc: string, lang?: string) {
    switch (lang) {
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
  private createFile(table: string, index: number) {
    // FIXME: schema is not used to write the file name and there could be collisions. For now it
    // is up to the developer to pick the right schema, and potentially chose different output
    // folders for each different schema.
    const [schemaName, tableName] = qNameSplit(table);
    const fileName = recase(this.options.caseFile, tableName, this.options.singularize);
    const filePath = path.join(this.options.directory, fileName + (this.options.lang === 'ts' ? '.ts' : '.js'));
    const writeFile = util.promisify(fs.writeFile);

    if (this.options.generateMigration) {
      const migrationsDir = path.join(this.options.directory, 'migrations');
      if (!fs.existsSync(migrationsDir)) {
        mkdirp.sync(migrationsDir);
      }
      const fileMigrationPath = path.join(migrationsDir, `create-${fileName}-table.js`);
      writeFile(path.resolve(fileMigrationPath), this.tableMigration[table]);
    }

    return writeFile(path.resolve(filePath), this.tableText[table]);
  }

  /** Create the belongsToMany/belongsTo/hasMany/hasOne association strings */
  private createAssociations(typeScript: boolean) {
    let strBelongs = '';
    let strBelongsToMany = '';
    const sp = this.space[1];

    const rels = this.relations;
    rels.forEach((rel) => {
      if (rel.isM2M) {
        const asprop = recase(this.options.caseProp, pluralize(rel.childProp));
        strBelongsToMany += `${sp}${rel.parentModel}.belongsToMany(${rel.childModel}, { as: '${asprop}', through: ${rel.joinModel}, foreignKey: "${rel.parentId}", otherKey: "${rel.childId}" });\n`;
      } else {
        // const bAlias = (this.options.noAlias && rel.parentModel.toLowerCase() === rel.parentProp.toLowerCase()) ? '' : `as: "${rel.parentProp}", `;
        const asParentProp = recase(this.options.caseProp, rel.parentProp);
        const bAlias = this.options.noAlias ? '' : `as: "${asParentProp}", `;
        strBelongs += `${sp}${rel.childModel}.belongsTo(${rel.parentModel}, { ${bAlias}foreignKey: "${rel.parentId}"});\n`;

        const hasRel = rel.isOne ? 'hasOne' : 'hasMany';
        // const hAlias = (this.options.noAlias && Utils.pluralize(rel.childModel.toLowerCase()) === rel.childProp.toLowerCase()) ? '' : `as: "${rel.childProp}", `;
        const asChildProp = recase(this.options.caseProp, rel.childProp);
        const hAlias = this.options.noAlias ? '' : `as: "${asChildProp}", `;
        strBelongs += `${sp}${rel.parentModel}.${hasRel}(${rel.childModel}, { ${hAlias}foreignKey: "${rel.parentId}"});\n`;
      }
    });

    // belongsToMany must come first
    return strBelongsToMany + strBelongs;
  }

  // create the TypeScript init-models file to load all the models into Sequelize
  private createTsInitString(tables: string[], assoc: string) {
    let str = 'import type { Sequelize } from "sequelize";\n';
    const sp = this.space[1];
    const modelNames: string[] = [];
    // import statements
    tables.forEach((t) => {
      const fileName = recase(this.options.caseFile, t, this.options.singularize);
      const modelName = makeTableName(this.options.caseModel, t, this.options.singularize, this.options.lang);
      modelNames.push(modelName);
      str += `import { ${modelName} } from "./${fileName}";\n`;
      // str += `import type { ${modelName}Attributes, ${modelName}CreationAttributes } from "./${fileName}";\n`;
    });

    // re-export the model classes
    str += '\nexport {\n';
    modelNames.forEach((m) => {
      str += `${sp}${m},\n`;
    });
    str += '};\n';

    if (this.options.version === 'v6') {
      str += 'export function initModels(sequelize: Sequelize) {\n';
    } else {
      str += 'export function initModels() {\n';
    }

    if (this.options.version === 'v6') {
      // create the initialization function
      modelNames.forEach((m) => {
        str += `${sp}${m}.initModel(sequelize);\n`;
      });

      // add the asociations
      str += '\n' + assoc;

      // return the models
      str += `\n${sp}return {\n`;
      modelNames.forEach((m) => {
        str += `${this.space[2]}${m}: ${m},\n`;
      });
      str += `${sp}};\n`;
    } else {
      str += this.createV7ModelInit(tables, assoc);
    }
    str += '}\n';

    return str;
  }

  private createV7ModelInit(tables: string[], assoc: string) {
    let str = '';
    const sp = this.space[1];
    const modelNames: string[] = [];
    // import statements
    tables.forEach((t) => {
      const fileName = recase(this.options.caseFile, t, this.options.singularize);
      const modelName = makeTableName(this.options.caseModel, t, this.options.singularize, this.options.lang);
      modelNames.push(modelName);
    });

    // return the models
    str += `${sp}return [\n`;
    modelNames.forEach((m) => {
      str += `${this.space[2]}${m},\n`;
    });
    str += `${sp}];\n`;

    return str;
  }

  // create the ES5 init-models file to load all the models into Sequelize
  private createES5InitString(tables: string[], assoc: string, vardef: string) {
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
      str += `${sp}${vardef} ${m} = new _${m}(sequelize);\n`;
    });

    // add the asociations
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
  private createESMInitString(tables: string[], assoc: string) {
    let str = 'import _sequelize from "sequelize";\n';
    str += 'const DataTypes = _sequelize.DataTypes;\n';
    const sp = this.space[1];
    const modelNames: string[] = [];
    // import statements
    tables.forEach((t) => {
      const fileName = recase(this.options.caseFile, t, this.options.singularize);
      const modelName = makeTableName(this.options.caseModel, t, this.options.singularize, this.options.lang);
      modelNames.push(modelName);
      str += `import ${modelName} from  "./${fileName}.js";\n`;
    });
    // create the initialization function
    str += '\nexport function initModels(sequelize) {\n';
    modelNames.forEach((m) => {
      str += `${sp}${m}.init(sequelize);\n`;
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
