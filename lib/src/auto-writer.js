Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AutoWriter", {
    enumerable: true,
    get: function() {
        return AutoWriter;
    }
});
const _fs = /*#__PURE__*/ _interop_require_default(require("fs"));
const _lodash = /*#__PURE__*/ _interop_require_default(require("lodash"));
const _path = /*#__PURE__*/ _interop_require_default(require("path"));
const _util = /*#__PURE__*/ _interop_require_default(require("util"));
const _types = require("./types");
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const mkdirp = require('mkdirp');
class AutoWriter {
    write() {
        if (this.options.noWrite) {
            return Promise.resolve();
        }
        mkdirp.sync(_path.default.resolve(this.options.directory || './models'));
        const tables = _lodash.default.keys(this.tableText);
        // write the individual model files
        const promises = tables.map((t)=>{
            return this.createFile(t);
        });
        const isTypeScript = this.options.lang === 'ts';
        const assoc = this.createAssociations(isTypeScript);
        // get table names without schema
        // TODO: add schema to model and file names when schema is non-default for the dialect
        const tableNames = tables.map((t)=>{
            const [schemaName, tableName] = (0, _types.qNameSplit)(t);
            return tableName;
        }).sort();
        // write the init-models file
        if (!this.options.noInitModels) {
            const initString = this.createInitString(tableNames, assoc, this.options.lang);
            const initFilePath = _path.default.join(this.options.directory, 'init-models' + (isTypeScript ? '.ts' : '.js'));
            const writeFile = _util.default.promisify(_fs.default.writeFile);
            const initPromise = writeFile(_path.default.resolve(initFilePath), initString);
            promises.push(initPromise);
        }
        return Promise.all(promises);
    }
    createInitString(tableNames, assoc, lang) {
        switch(lang){
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
    createFile(table) {
        // FIXME: schema is not used to write the file name and there could be collisions. For now it
        // is up to the developer to pick the right schema, and potentially chose different output
        // folders for each different schema.
        const [schemaName, tableName] = (0, _types.qNameSplit)(table);
        const fileName = (0, _types.recase)(this.options.caseFile, tableName, this.options.singularize);
        const filePath = _path.default.join(this.options.directory, fileName + (this.options.lang === 'ts' ? '.ts' : '.js'));
        const writeFile = _util.default.promisify(_fs.default.writeFile);
        return writeFile(_path.default.resolve(filePath), this.tableText[table]);
    }
    /** Create the belongsToMany/belongsTo/hasMany/hasOne association strings */ createAssociations(typeScript) {
        let strBelongs = '';
        let strBelongsToMany = '';
        const sp = this.space[1];
        const rels = this.relations;
        rels.forEach((rel)=>{
            if (rel.isM2M) {
                const asprop = (0, _types.recase)(this.options.caseProp, (0, _types.pluralize)(rel.childProp));
                strBelongsToMany += `${sp}${rel.parentModel}.belongsToMany(${rel.childModel}, { as: '${asprop}', through: ${rel.joinModel}, foreignKey: "${rel.parentId}", otherKey: "${rel.childId}" });\n`;
            } else {
                // const bAlias = (this.options.noAlias && rel.parentModel.toLowerCase() === rel.parentProp.toLowerCase()) ? '' : `as: "${rel.parentProp}", `;
                const asParentProp = (0, _types.recase)(this.options.caseProp, rel.parentProp);
                const bAlias = this.options.noAlias ? '' : `as: "${asParentProp}", `;
                strBelongs += `${sp}${rel.childModel}.belongsTo(${rel.parentModel}, { ${bAlias}foreignKey: "${rel.parentId}"});\n`;
                const hasRel = rel.isOne ? 'hasOne' : 'hasMany';
                // const hAlias = (this.options.noAlias && Utils.pluralize(rel.childModel.toLowerCase()) === rel.childProp.toLowerCase()) ? '' : `as: "${rel.childProp}", `;
                const asChildProp = (0, _types.recase)(this.options.caseProp, rel.childProp);
                const hAlias = this.options.noAlias ? '' : `as: "${asChildProp}", `;
                strBelongs += `${sp}${rel.parentModel}.${hasRel}(${rel.childModel}, { ${hAlias}foreignKey: "${rel.parentId}"});\n`;
            }
        });
        // belongsToMany must come first
        return strBelongsToMany + strBelongs;
    }
    // create the TypeScript init-models file to load all the models into Sequelize
    createTsInitString(tables, assoc) {
        let str = 'import type { Sequelize } from "sequelize";\n';
        const sp = this.space[1];
        const modelNames = [];
        // import statements
        tables.forEach((t)=>{
            const fileName = (0, _types.recase)(this.options.caseFile, t, this.options.singularize);
            const modelName = (0, _types.makeTableName)(this.options.caseModel, t, this.options.singularize, this.options.lang);
            modelNames.push(modelName);
            str += `import { ${modelName} } from "./${fileName}";\n`;
        // str += `import type { ${modelName}Attributes, ${modelName}CreationAttributes } from "./${fileName}";\n`;
        });
        // re-export the model classes
        str += '\nexport {\n';
        modelNames.forEach((m)=>{
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
            modelNames.forEach((m)=>{
                str += `${sp}${m}.initModel(sequelize);\n`;
            });
            // add the asociations
            str += '\n' + assoc;
            // return the models
            str += `\n${sp}return {\n`;
            modelNames.forEach((m)=>{
                str += `${this.space[2]}${m}: ${m},\n`;
            });
            str += `${sp}};\n`;
        } else {
            str += this.createV7ModelInit(tables, assoc);
        }
        str += '}\n';
        return str;
    }
    createV7ModelInit(tables, assoc) {
        let str = '';
        const sp = this.space[1];
        const modelNames = [];
        // import statements
        tables.forEach((t)=>{
            const fileName = (0, _types.recase)(this.options.caseFile, t, this.options.singularize);
            const modelName = (0, _types.makeTableName)(this.options.caseModel, t, this.options.singularize, this.options.lang);
            modelNames.push(modelName);
        });
        // return the models
        str += `${sp}return [\n`;
        modelNames.forEach((m)=>{
            str += `${this.space[2]}${m},\n`;
        });
        str += `${sp}];\n`;
        return str;
    }
    // create the ES5 init-models file to load all the models into Sequelize
    createES5InitString(tables, assoc, vardef) {
        let str = `${vardef} DataTypes = require("sequelize").DataTypes;\n`;
        const sp = this.space[1];
        const modelNames = [];
        // import statements
        tables.forEach((t)=>{
            const fileName = (0, _types.recase)(this.options.caseFile, t, this.options.singularize);
            const modelName = (0, _types.makeTableName)(this.options.caseModel, t, this.options.singularize, this.options.lang);
            modelNames.push(modelName);
            str += `${vardef} _${modelName} = require("./${fileName}");\n`;
        });
        // create the initialization function
        str += '\nfunction initModels(sequelize) {\n';
        modelNames.forEach((m)=>{
            str += `${sp}${vardef} ${m} = new _${m}(sequelize);\n`;
        });
        // add the asociations
        str += '\n' + assoc;
        // return the models
        str += `\n${sp}return {\n`;
        modelNames.forEach((m)=>{
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
    createESMInitString(tables, assoc) {
        let str = 'import _sequelize from "sequelize";\n';
        str += 'const DataTypes = _sequelize.DataTypes;\n';
        const sp = this.space[1];
        const modelNames = [];
        // import statements
        tables.forEach((t)=>{
            const fileName = (0, _types.recase)(this.options.caseFile, t, this.options.singularize);
            const modelName = (0, _types.makeTableName)(this.options.caseModel, t, this.options.singularize, this.options.lang);
            modelNames.push(modelName);
            str += `import ${modelName} from  "./${fileName}.js";\n`;
        });
        // create the initialization function
        str += '\nexport function initModels(sequelize) {\n';
        modelNames.forEach((m)=>{
            str += `${sp}${m}.init(sequelize);\n`;
        });
        // add the associations
        str += '\n' + assoc;
        // return the models
        str += `\n${sp}return {\n`;
        modelNames.forEach((m)=>{
            str += `${this.space[2]}${m},\n`;
        });
        str += `${sp}};\n`;
        str += '}\n';
        return str;
    }
    constructor(tableData, options){
        _define_property(this, "tableText", void 0);
        _define_property(this, "foreignKeys", void 0);
        _define_property(this, "relations", void 0);
        _define_property(this, "space", void 0);
        _define_property(this, "options", void 0);
        this.tableText = tableData.text;
        this.foreignKeys = tableData.foreignKeys;
        this.relations = tableData.relations;
        this.options = options;
        this.space = (0, _types.makeIndent)(this.options.spaces, this.options.indentation);
    }
}
