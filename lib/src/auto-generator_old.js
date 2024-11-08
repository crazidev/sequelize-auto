Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AutoGenerator", {
    enumerable: true,
    get: function() {
        return AutoGenerator;
    }
});
const _lodash = /*#__PURE__*/ _interop_require_default(require("lodash"));
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
class AutoGenerator {
    generateText() {
        const tableNames = _lodash.default.keys(this.tables);
        const header = this.makeHeaderTemplate();
        const text = {};
        tableNames.forEach((table)=>{
            let str = header;
            const [schemaName, tableNameOrig] = (0, _types.qNameSplit)(table);
            const tableName = (0, _types.makeTableName)(this.options.caseModel, tableNameOrig, this.options.singularize, this.options.lang);
            if (this.options.lang === 'ts') {
                const associations = this.addTypeScriptAssociationMixins(table);
                const needed = _lodash.default.keys(associations.needed).sort();
                needed.forEach((fkTable)=>{
                    const set = associations.needed[fkTable];
                    const [fkSchema, fkTableName] = (0, _types.qNameSplit)(fkTable);
                    const filename = (0, _types.recase)(this.options.caseFile, fkTableName, this.options.singularize);
                    str += 'import type { ';
                    str += Array.from(set.values()).sort().join(', ');
                    str += ` } from './${filename}';\n`;
                });
                // str += '\nexport interface #TABLE#Attributes {\n';
                // str += this.addTypeScriptFields(table, true) + '}\n\n';
                const primaryKeys = this.getTypeScriptPrimaryKeys(table);
                // if (primaryKeys.length) {
                //   str += `export type #TABLE#Pk = ${primaryKeys
                //     .map((k) => `"${recase(this.options.caseProp, k)}"`)
                //     .join(' | ')};\n`;
                //   str += `export type #TABLE#Id = #TABLE#[#TABLE#Pk];\n`;
                // }
                // const creationOptionalFields = this.getTypeScriptCreationOptionalFields(table);
                // if (creationOptionalFields.length) {
                //   str += `export type #TABLE#OptionalAttributes = ${creationOptionalFields
                //     .map((k) => `"${recase(this.options.caseProp, k)}"`)
                //     .join(' | ')};\n`;
                //   str += 'export type #TABLE#CreationAttributes = Optional<#TABLE#Attributes, #TABLE#OptionalAttributes>;\n\n';
                // } else {
                //   str += 'export type #TABLE#CreationAttributes = #TABLE#Attributes;\n\n';
                // }
                str += `\nexport class #TABLE# extends Model<\n${this.space[2]}InferAttributes<#TABLE#>,\n${this.space[2]}InferCreationAttributes<#TABLE#>\n> {\n`;
                str += this.addTypeScriptFields(table, false);
                str += '\n' + associations.str;
                str += '\n' + this.space[1] + 'static initModel(sequelize: Sequelize.Sequelize): typeof #TABLE# {\n';
                if (this.options.useDefine) {
                    str += this.space[2] + "return sequelize.define('#TABLE#', {\n";
                } else {
                    str += this.space[2] + 'return #TABLE#.init({\n';
                }
            }
            str += this.addTable(table);
            const lang = this.options.lang;
            if (lang === 'ts' && this.options.useDefine) {
                str += ') as typeof #TABLE#;\n';
            } else {
                str += ');\n';
            }
            if (lang === 'es6' || lang === 'esm' || lang === 'ts') {
                if (this.options.useDefine) {
                    str += this.space[1] + '}\n}\n';
                } else {
                    // str += this.space[1] + "return #TABLE#;\n";
                    str += this.space[1] + '}\n}\n';
                }
            } else {
                str += '};\n';
            }
            const re = new RegExp('#TABLE#', 'g');
            str = str.replace(re, tableName);
            text[table] = str;
        });
        return text;
    }
    generateMigration() {}
    makeHeaderTemplate() {
        let header = '';
        const sp = this.space[1];
        if (this.options.lang === 'ts') {
            header += "import * as Sequelize from 'sequelize';\n";
            header += `import {\n${sp}CreationOptional,\n${sp}DataTypes,\n${sp}InferCreationAttributes, \n${sp}InferAttributes,\n${sp}Model\n} from 'sequelize';\n\n`;
        } else if (this.options.lang === 'es6') {
            header += "const Sequelize = require('sequelize');\n";
            header += 'module.exports = (sequelize, DataTypes) => {\n';
            header += sp + 'return #TABLE#.init(sequelize, DataTypes);\n';
            header += '}\n\n';
            header += 'class #TABLE# extends Sequelize.Model {\n';
            header += sp + 'static init(sequelize, DataTypes) {\n';
            if (this.options.useDefine) {
                header += sp + "return sequelize.define('#TABLE#', {\n";
            } else {
                header += sp + 'return super.init({\n';
            }
        } else if (this.options.lang === 'esm') {
            header += "import _sequelize from 'sequelize';\n";
            header += 'const { Model, Sequelize } = _sequelize;\n\n';
            header += 'export default class #TABLE# extends Model {\n';
            header += sp + 'static init(sequelize, DataTypes) {\n';
            if (this.options.useDefine) {
                header += sp + "return sequelize.define('#TABLE#', {\n";
            } else {
                header += sp + 'return super.init({\n';
            }
        } else {
            header += "const Sequelize = require('sequelize');\n";
            header += 'module.exports = function(sequelize, DataTypes) {\n';
            header += sp + "return sequelize.define('#TABLE#', {\n";
        }
        return header;
    }
    // Create a string for the model of the table
    addTable(table) {
        const [schemaName, tableNameOrig] = (0, _types.qNameSplit)(table);
        const space = this.space;
        let timestamps = this.options.additional && this.options.additional.timestamps === true || false;
        let paranoid = this.options.additional && this.options.additional.paranoid === true || false;
        // add all the fields
        let str = '';
        const fields = _lodash.default.keys(this.tables[table]);
        fields.forEach((field, index)=>{
            timestamps || (timestamps = this.isTimestampField(field));
            paranoid || (paranoid = this.isParanoidField(field));
            str += this.addField(table, field);
        });
        // trim off last ",\n"
        str = str.substring(0, str.length - 2) + '\n';
        // add the table options
        str += space[1] + '}, {\n';
        if (!this.options.useDefine) {
            str += space[2] + 'sequelize,\n';
        }
        str += space[2] + "tableName: '" + tableNameOrig + "',\n";
        if (schemaName && this.dialect.hasSchema) {
            str += space[2] + "schema: '" + schemaName + "',\n";
        }
        if (this.hasTriggerTables[table]) {
            str += space[2] + 'hasTrigger: true,\n';
        }
        str += space[2] + 'timestamps: ' + timestamps + ',\n';
        if (paranoid) {
            str += space[2] + 'paranoid: true,\n';
        }
        // conditionally add additional options
        const hasadditional = _lodash.default.isObject(this.options.additional) && _lodash.default.keys(this.options.additional).length > 0;
        if (hasadditional) {
            _lodash.default.each(this.options.additional, (value, key)=>{
                if (key === 'name') {
                    // name: true - preserve table name always
                    str += space[2] + 'name: {\n';
                    str += space[3] + "singular: '" + table + "',\n";
                    str += space[3] + "plural: '" + table + "'\n";
                    str += space[2] + '},\n';
                } else if (key === 'timestamps' || key === 'paranoid') {
                // handled above
                } else {
                    value = _lodash.default.isBoolean(value) ? value : "'" + value + "'";
                    str += space[2] + key + ': ' + value + ',\n';
                }
            });
        }
        // add indexes
        if (!this.options.noIndexes) {
            str += this.addIndexes(table);
        }
        str = space[2] + str.trim();
        str = str.substring(0, str.length - 1);
        str += '\n' + space[1] + '}';
        return str;
    }
    // Create a string containing field attributes (type, defaultValue, etc.)
    addField(table, field) {
        // ignore Sequelize standard fields
        const additional = this.options.additional;
        if (additional && additional.timestamps !== false && (this.isTimestampField(field) || this.isParanoidField(field))) {
            return '';
        }
        if (this.isIgnoredField(field)) {
            return '';
        }
        // Find foreign key
        const foreignKey = this.foreignKeys[table] && this.foreignKeys[table][field] ? this.foreignKeys[table][field] : null;
        const fieldObj = this.tables[table][field];
        if (_lodash.default.isObject(foreignKey)) {
            fieldObj.foreignKey = foreignKey;
        }
        const fieldName = (0, _types.recase)(this.options.caseProp, field);
        let str = this.quoteName(fieldName) + ': {\n';
        const quoteWrapper = '"';
        const unique = fieldObj.unique || fieldObj.foreignKey && fieldObj.foreignKey.isUnique;
        const isSerialKey = fieldObj.foreignKey && fieldObj.foreignKey.isSerialKey || this.dialect.isSerialKey && this.dialect.isSerialKey(fieldObj);
        let wroteAutoIncrement = false;
        const space = this.space;
        // column's attributes
        const fieldAttrs = _lodash.default.keys(fieldObj);
        fieldAttrs.forEach((attr)=>{
            // We don't need the special attribute from postgresql; "unique" is handled separately
            if (attr === 'special' || attr === 'elementType' || attr === 'unique') {
                return true;
            }
            if (isSerialKey && !wroteAutoIncrement) {
                str += space[3] + 'autoIncrement: true,\n';
                // Resort to Postgres' GENERATED BY DEFAULT AS IDENTITY instead of SERIAL
                if (this.dialect.name === 'postgres' && fieldObj.foreignKey && fieldObj.foreignKey.isPrimaryKey === true && (fieldObj.foreignKey.generation === 'ALWAYS' || fieldObj.foreignKey.generation === 'BY DEFAULT')) {
                    str += space[3] + 'autoIncrementIdentity: true,\n';
                }
                wroteAutoIncrement = true;
            }
            if (attr === 'foreignKey') {
                if (foreignKey && foreignKey.isForeignKey) {
                    str += space[3] + 'references: {\n';
                    str += space[4] + "model: '" + fieldObj[attr].foreignSources.target_table + "',\n";
                    str += space[4] + "key: '" + fieldObj[attr].foreignSources.target_column + "'\n";
                    str += space[3] + '}';
                } else {
                    return true;
                }
            } else if (attr === 'references') {
                // covered by foreignKey
                return true;
            } else if (attr === 'primaryKey') {
                if (fieldObj[attr] === true && (!_lodash.default.has(fieldObj, 'foreignKey') || !!fieldObj.foreignKey.isPrimaryKey)) {
                    str += space[3] + 'primaryKey: true';
                } else {
                    return true;
                }
            } else if (attr === 'autoIncrement') {
                if (fieldObj[attr] === true && !wroteAutoIncrement) {
                    str += space[3] + 'autoIncrement: true,\n';
                    // Resort to Postgres' GENERATED BY DEFAULT AS IDENTITY instead of SERIAL
                    if (this.dialect.name === 'postgres' && fieldObj.foreignKey && fieldObj.foreignKey.isPrimaryKey === true && (fieldObj.foreignKey.generation === 'ALWAYS' || fieldObj.foreignKey.generation === 'BY DEFAULT')) {
                        str += space[3] + 'autoIncrementIdentity: true,\n';
                    }
                    wroteAutoIncrement = true;
                }
                return true;
            } else if (attr === 'allowNull') {
                str += space[3] + attr + ': ' + fieldObj[attr];
            } else if (attr === 'defaultValue') {
                let defaultVal = fieldObj.defaultValue;
                if (this.dialect.name === 'mssql' && defaultVal && defaultVal.toLowerCase() === '(newid())') {
                    defaultVal = null; // disable adding "default value" attribute for UUID fields if generating for MS SQL
                }
                if (this.dialect.name === 'mssql' && ([
                    '(NULL)',
                    'NULL'
                ].includes(defaultVal) || typeof defaultVal === 'undefined')) {
                    defaultVal = null; // Override default NULL in MS SQL to javascript null
                }
                if (defaultVal === null || defaultVal === undefined) {
                    return true;
                }
                if (isSerialKey) {
                    return true; // value generated in the database
                }
                let val_text = defaultVal;
                if (_lodash.default.isString(defaultVal)) {
                    const field_type = fieldObj.type.toLowerCase();
                    defaultVal = this.escapeSpecial(defaultVal);
                    while(defaultVal.startsWith('(') && defaultVal.endsWith(')')){
                        // remove extra parens around mssql defaults
                        defaultVal = defaultVal.replace(/^[(]/, '').replace(/[)]$/, '');
                    }
                    if (field_type === 'bit(1)' || field_type === 'bit' || field_type === 'boolean') {
                        // convert string to boolean
                        val_text = /1|true/i.test(defaultVal) ? 'true' : 'false';
                    } else if (this.isArray(field_type)) {
                        // remove outer {}
                        val_text = defaultVal.replace(/^{/, '').replace(/}$/, '');
                        if (val_text && this.isString(fieldObj.elementType)) {
                            // quote the array elements
                            val_text = val_text.split(',').map((s)=>`"${s}"`).join(',');
                        }
                        val_text = `[${val_text}]`;
                    } else if (field_type.match(/^(json)/)) {
                        // don't quote json
                        val_text = defaultVal;
                    } else if (field_type === 'uuid' && (defaultVal === 'gen_random_uuid()' || defaultVal === 'uuid_generate_v4()')) {
                        val_text = 'DataTypes.UUIDV4';
                    } else if (defaultVal.match(/\w+\(\)$/)) {
                        // replace db function with sequelize function
                        val_text = "Sequelize.Sequelize.fn('" + defaultVal.replace(/\(\)$/g, '') + "')";
                    } else if (this.isNumber(field_type)) {
                        if (defaultVal.match(/\(\)/g)) {
                            // assume it's a server function if it contains parens
                            val_text = "Sequelize.Sequelize.literal('" + defaultVal + "')";
                        } else {
                            // don't quote numbers
                            val_text = defaultVal;
                        }
                    } else if (defaultVal.match(/\(\)/g)) {
                        // embedded function, pass as literal
                        val_text = "Sequelize.Sequelize.literal('" + defaultVal + "')";
                    } else if (field_type.indexOf('date') === 0 || field_type.indexOf('timestamp') === 0) {
                        if (_lodash.default.includes([
                            'current_timestamp',
                            'current_date',
                            'current_time',
                            'localtime',
                            'localtimestamp'
                        ], defaultVal.toLowerCase())) {
                            val_text = "Sequelize.Sequelize.literal('" + defaultVal + "')";
                        } else {
                            val_text = quoteWrapper + defaultVal + quoteWrapper;
                        }
                    } else {
                        val_text = quoteWrapper + defaultVal + quoteWrapper;
                    }
                }
                // val_text = _.isString(val_text) && !val_text.match(/^sequelize\.[^(]+\(.*\)$/)
                // ? self.sequelize.escape(_.trim(val_text, '"'), null, self.options.dialect)
                // : val_text;
                // don't prepend N for MSSQL when building models...
                // defaultVal = _.trimStart(defaultVal, 'N');
                str += space[3] + attr + ': ' + val_text;
            } else if (attr === 'comment' && (!fieldObj[attr] || this.dialect.name === 'mssql')) {
                return true;
            } else {
                let val = attr !== 'type' ? null : this.getSqType(fieldObj, attr);
                if (val == null) {
                    val = fieldObj[attr];
                    val = _lodash.default.isString(val) ? quoteWrapper + this.escapeSpecial(val) + quoteWrapper : val;
                }
                str += space[3] + attr + ': ' + val;
            }
            str += ',\n';
        });
        if (unique) {
            const uniq = _lodash.default.isString(unique) ? quoteWrapper + unique.replace(/\"/g, '\\"') + quoteWrapper : unique;
            str += space[3] + 'unique: ' + uniq + ',\n';
        }
        if (field !== fieldName) {
            str += space[3] + "field: '" + field + "',\n";
        }
        // removes the last `,` within the attribute options
        str = str.trim().replace(/,+$/, '') + '\n';
        str = space[2] + str + space[2] + '},\n';
        return str;
    }
    addIndexes(table) {
        const indexes = this.indexes[table];
        const space = this.space;
        let str = '';
        if (indexes && indexes.length) {
            str += space[2] + 'indexes: [\n';
            indexes.forEach((idx)=>{
                str += space[3] + '{\n';
                if (idx.name) {
                    str += space[4] + `name: "${idx.name}",\n`;
                }
                if (idx.unique) {
                    str += space[4] + 'unique: true,\n';
                }
                if (idx.type) {
                    if ([
                        'UNIQUE',
                        'FULLTEXT',
                        'SPATIAL'
                    ].includes(idx.type)) {
                        str += space[4] + `type: "${idx.type}",\n`;
                    } else {
                        str += space[4] + `using: "${idx.type}",\n`;
                    }
                }
                str += space[4] + `fields: [\n`;
                idx.fields.forEach((ff)=>{
                    str += space[5] + `{ name: "${ff.attribute}"`;
                    if (ff.collate) {
                        str += `, collate: "${ff.collate}"`;
                    }
                    if (ff.length) {
                        str += `, length: ${ff.length}`;
                    }
                    if (ff.order && ff.order !== 'ASC') {
                        str += `, order: "${ff.order}"`;
                    }
                    str += ' },\n';
                });
                str += space[4] + ']\n';
                str += space[3] + '},\n';
            });
            str += space[2] + '],\n';
        }
        return str;
    }
    /** Get the sequelize type from the Field */ getSqType(fieldObj, attr) {
        const attrValue = fieldObj[attr];
        if (!attrValue.toLowerCase) {
            console.log('attrValue', attr, attrValue);
            return attrValue;
        }
        const type = attrValue.toLowerCase();
        const length = type.match(/\(\d+\)/);
        const precision = type.match(/\(\d+,\d+\)/);
        let val = null;
        let typematch = null;
        if (type === 'boolean' || type === 'bit(1)' || type === 'bit' || type === 'tinyint(1)') {
            val = 'DataTypes.BOOLEAN';
        // postgres range types
        } else if (type === 'numrange') {
            val = 'DataTypes.RANGE(DataTypes.DECIMAL)';
        } else if (type === 'int4range') {
            val = 'DataTypes.RANGE(DataTypes.INTEGER)';
        } else if (type === 'int8range') {
            val = 'DataTypes.RANGE(DataTypes.BIGINT)';
        } else if (type === 'daterange') {
            val = 'DataTypes.RANGE(DataTypes.DATEONLY)';
        } else if (type === 'tsrange' || type === 'tstzrange') {
            val = 'DataTypes.RANGE(DataTypes.DATE)';
        } else if (typematch = type.match(/^(bigint|smallint|mediumint|tinyint|int)/)) {
            // integer subtypes
            val = 'DataTypes.' + (typematch[0] === 'int' ? 'INTEGER' : typematch[0].toUpperCase());
            if (/unsigned/i.test(type)) {
                val += '.UNSIGNED';
            }
            if (/zerofill/i.test(type)) {
                val += '.ZEROFILL';
            }
        } else if (type === 'nvarchar(max)' || type === 'varchar(max)') {
            val = 'DataTypes.TEXT';
        } else if (type.match(/n?varchar|string|varying/)) {
            val = 'DataTypes.STRING' + (!_lodash.default.isNull(length) ? length : '');
        } else if (type.match(/^n?char/)) {
            val = 'DataTypes.CHAR' + (!_lodash.default.isNull(length) ? length : '');
        } else if (type.match(/^real/)) {
            val = 'DataTypes.REAL';
        } else if (type.match(/text$/)) {
            val = 'DataTypes.TEXT' + (!_lodash.default.isNull(length) ? length : '');
        } else if (type === 'date') {
            val = 'DataTypes.DATEONLY';
        } else if (type.match(/^(date|timestamp|year)/)) {
            val = 'DataTypes.DATE' + (!_lodash.default.isNull(length) ? length : '');
        } else if (type.match(/^(time)/)) {
            val = 'DataTypes.TIME';
        } else if (type.match(/^(float|float4)/)) {
            val = 'DataTypes.FLOAT' + (!_lodash.default.isNull(precision) ? precision : '');
        } else if (type.match(/^(decimal|numeric)/)) {
            val = 'DataTypes.DECIMAL' + (!_lodash.default.isNull(precision) ? precision : '');
        } else if (type.match(/^money/)) {
            val = 'DataTypes.DECIMAL(19,4)';
        } else if (type.match(/^smallmoney/)) {
            val = 'DataTypes.DECIMAL(10,4)';
        } else if (type.match(/^(float8|double)/)) {
            val = 'DataTypes.DOUBLE' + (!_lodash.default.isNull(precision) ? precision : '');
        } else if (type.match(/^uuid|uniqueidentifier/)) {
            val = 'DataTypes.UUID';
        } else if (type.match(/^jsonb/)) {
            val = 'DataTypes.JSONB';
        } else if (type.match(/^json/)) {
            val = 'DataTypes.JSON';
        } else if (type.match(/^geometry/)) {
            const gtype = fieldObj.elementType ? `(${fieldObj.elementType})` : '';
            val = `DataTypes.GEOMETRY${gtype}`;
        } else if (type.match(/^geography/)) {
            const gtype = fieldObj.elementType ? `(${fieldObj.elementType})` : '';
            val = `DataTypes.GEOGRAPHY${gtype}`;
        } else if (type.match(/^array/)) {
            const eltype = this.getSqType(fieldObj, 'elementType');
            val = `DataTypes.ARRAY(${eltype})`;
        } else if (type.match(/(binary|image|blob|bytea)/)) {
            val = 'DataTypes.BLOB';
        } else if (type.match(/^hstore/)) {
            val = 'DataTypes.HSTORE';
        } else if (type.match(/^inet/)) {
            val = 'DataTypes.INET';
        } else if (type.match(/^cidr/)) {
            val = 'DataTypes.CIDR';
        } else if (type.match(/^oid/)) {
            val = 'DataTypes.INTEGER';
        } else if (type.match(/^macaddr/)) {
            val = 'DataTypes.MACADDR';
        } else if (type.match(/^enum(\(.*\))?$/)) {
            const enumValues = this.getEnumValues(fieldObj);
            val = `DataTypes.ENUM(${enumValues})`;
        }
        return val;
    }
    getTypeScriptPrimaryKeys(table) {
        const fields = _lodash.default.keys(this.tables[table]);
        return fields.filter((field)=>{
            const fieldObj = this.tables[table][field];
            return fieldObj['primaryKey'];
        });
    }
    getTypeScriptCreationOptionalFields(table) {
        const fields = _lodash.default.keys(this.tables[table]);
        return fields.filter((field)=>{
            const fieldObj = this.tables[table][field];
            return fieldObj.allowNull || !!fieldObj.defaultValue || fieldObj.defaultValue === '' || fieldObj.autoIncrement || this.isTimestampField(field);
        });
    }
    /** Add schema to table so it will match the relation data.  Fixes mysql problem. */ addSchemaForRelations(table) {
        if (!table.includes('.') && !this.relations.some((rel)=>rel.childTable === table)) {
            // if no tables match the given table, then assume we need to fix the schema
            const first = this.relations.find((rel)=>!!rel.childTable);
            if (first) {
                const [schemaName, tableName] = (0, _types.qNameSplit)(first.childTable);
                if (schemaName) {
                    table = (0, _types.qNameJoin)(schemaName, table);
                }
            }
        }
        return table;
    }
    addTypeScriptAssociationMixins(table) {
        const sp = this.space[1];
        const needed = {};
        let str = '';
        table = this.addSchemaForRelations(table);
        this.relations.forEach((rel)=>{
            if (!rel.isM2M) {
                if (rel.childTable === table) {
                    var _needed, _rel_parentTable;
                    // current table is a child that belongsTo parent
                    const pparent = _lodash.default.upperFirst(rel.parentProp);
                    str += `${sp}// ${rel.childModel} belongsTo ${rel.parentModel} via ${rel.parentId}\n`;
                    str += `${sp}declare ${rel.parentProp}?: Sequelize.NonAttribute<${rel.parentModel}>\n`;
                    str += `${sp}declare get${pparent}: Sequelize.BelongsToGetAssociationMixin<${rel.parentModel}>;\n`;
                    str += `${sp}declare set${pparent}: Sequelize.BelongsToSetAssociationMixin<${rel.parentModel}, number>;\n`;
                    str += `${sp}declare create${pparent}: Sequelize.BelongsToCreateAssociationMixin<${rel.parentModel}>;\n`;
                    var _;
                    (_ = (_needed = needed)[_rel_parentTable = rel.parentTable]) !== null && _ !== void 0 ? _ : _needed[_rel_parentTable] = new Set();
                    needed[rel.parentTable].add(rel.parentModel);
                    needed[rel.parentTable].add(rel.parentModel + 'Id');
                } else if (rel.parentTable === table) {
                    var _needed1, _rel_childTable;
                    var _1;
                    (_1 = (_needed1 = needed)[_rel_childTable = rel.childTable]) !== null && _1 !== void 0 ? _1 : _needed1[_rel_childTable] = new Set();
                    const pchild = _lodash.default.upperFirst(rel.childProp);
                    if (rel.isOne) {
                        // const hasModelSingular = singularize(hasModel);
                        str += `${sp}// ${rel.parentModel} hasOne ${rel.childModel} via ${rel.parentId}\n`;
                        str += `${sp}declare ${rel.childProp}?: Sequelize.NonAttribute<${rel.childModel}>\n`;
                        str += `${sp}declare get${pchild}: Sequelize.HasOneGetAssociationMixin<${rel.childModel}>;\n`;
                        str += `${sp}declare set${pchild}: Sequelize.HasOneSetAssociationMixin<${rel.childModel}, number>;\n`;
                        str += `${sp}declare create${pchild}: Sequelize.HasOneCreateAssociationMixin<${rel.childModel}>;\n`;
                        needed[rel.childTable].add(rel.childModel);
                        // needed[rel.childTable].add(`${rel.childModel}Id`);
                        needed[rel.childTable].add(`${rel.childModel}CreationAttributes`);
                    } else {
                        const hasModel = rel.childModel;
                        const sing = _lodash.default.upperFirst((0, _types.singularize)(rel.childProp));
                        const lur = (0, _types.pluralize)(rel.childProp);
                        const plur = _lodash.default.upperFirst(lur);
                        str += `${sp}// ${rel.parentModel} hasMany ${rel.childModel} via ${rel.parentId}\n`;
                        str += `${sp}declare ${lur}?: Sequelize.NonAttribute<${rel.childModel}[]>;\n`;
                        str += `${sp}declare get${plur}: Sequelize.HasManyGetAssociationsMixin<${hasModel}>;\n`;
                        str += `${sp}declare set${plur}: Sequelize.HasManySetAssociationsMixin<${hasModel}, number>;\n`;
                        str += `${sp}declare add${sing}: Sequelize.HasManyAddAssociationMixin<${hasModel}, number>;\n`;
                        str += `${sp}declare add${plur}: Sequelize.HasManyAddAssociationsMixin<${hasModel}, number>;\n`;
                        str += `${sp}declare create${sing}: Sequelize.HasManyCreateAssociationMixin<${hasModel}, '${rel.parentId}'>;\n`;
                        str += `${sp}declare remove${sing}: Sequelize.HasManyRemoveAssociationMixin<${hasModel}, number>;\n`;
                        str += `${sp}declare remove${plur}: Sequelize.HasManyRemoveAssociationsMixin<${hasModel}, number>;\n`;
                        str += `${sp}declare has${sing}: Sequelize.HasManyHasAssociationMixin<${hasModel}, number>;\n`;
                        str += `${sp}declare has${plur}: Sequelize.HasManyHasAssociationsMixin<${hasModel}, number>;\n`;
                        str += `${sp}declare count${plur}: Sequelize.HasManyCountAssociationsMixin;\n`;
                        needed[rel.childTable].add(hasModel);
                    // needed[rel.childTable].add(`${hasModel}Id`);
                    }
                }
            } else {
                // rel.isM2M
                if (rel.parentTable === table) {
                    var _needed2, _otherTable;
                    // many-to-many
                    const isParent = rel.parentTable === table;
                    const thisModel = isParent ? rel.parentModel : rel.childModel;
                    const otherModel = isParent ? rel.childModel : rel.parentModel;
                    const otherModelSingular = _lodash.default.upperFirst((0, _types.singularize)(isParent ? rel.childProp : rel.parentProp));
                    const lotherModelPlural = (0, _types.pluralize)(isParent ? rel.childProp : rel.parentProp);
                    const otherModelPlural = _lodash.default.upperFirst(lotherModelPlural);
                    const otherTable = isParent ? rel.childTable : rel.parentTable;
                    str += `${sp}// ${thisModel} belongsToMany ${otherModel} via ${rel.parentId} and ${rel.childId}\n`;
                    str += `${sp}declare ${lotherModelPlural}: Sequelize.NonAttribute<${otherModel}[]>;\n`;
                    str += `${sp}declare get${otherModelPlural}: Sequelize.BelongsToManyGetAssociationsMixin<${otherModel}>;\n`;
                    str += `${sp}declare set${otherModelPlural}: Sequelize.BelongsToManySetAssociationsMixin<${otherModel}, number>;\n`;
                    str += `${sp}declare add${otherModelSingular}: Sequelize.BelongsToManyAddAssociationMixin<${otherModel}, number>;\n`;
                    str += `${sp}declare add${otherModelPlural}: Sequelize.BelongsToManyAddAssociationsMixin<${otherModel}, number>;\n`;
                    str += `${sp}declare create${otherModelSingular}: Sequelize.BelongsToManyCreateAssociationMixin<${otherModel}, '${rel.parentId}'>;\n`;
                    str += `${sp}declare remove${otherModelSingular}: Sequelize.BelongsToManyRemoveAssociationMixin<${otherModel}, number>;\n`;
                    str += `${sp}declare remove${otherModelPlural}: Sequelize.BelongsToManyRemoveAssociationsMixin<${otherModel}, number>;\n`;
                    str += `${sp}declare has${otherModelSingular}: Sequelize.BelongsToManyHasAssociationMixin<${otherModel}, number>;\n`;
                    str += `${sp}declare has${otherModelPlural}: Sequelize.BelongsToManyHasAssociationsMixin<${otherModel}, number>;\n`;
                    str += `${sp}declare count${otherModelPlural}: Sequelize.BelongsToManyCountAssociationsMixin;\n`;
                    var _2;
                    (_2 = (_needed2 = needed)[_otherTable = otherTable]) !== null && _2 !== void 0 ? _2 : _needed2[_otherTable] = new Set();
                    needed[otherTable].add(otherModel);
                // needed[otherTable].add(`${otherModel}Id`);
                }
            }
        });
        if (needed[table]) {
            delete needed[table]; // don't add import for self
        }
        return {
            needed,
            str
        };
    }
    addTypeScriptFields(table, isInterface) {
        const sp = this.space[1];
        const fields = _lodash.default.keys(this.tables[table]);
        const notNull = isInterface ? '' : '';
        let str = '';
        var primaryKeys = this.getTypeScriptPrimaryKeys(table);
        fields.forEach((field)=>{
            if (!this.options.skipFields || !this.options.skipFields.includes(field)) {
                const name = this.quoteName((0, _types.recase)(this.options.caseProp, field));
                const isOptional = this.getTypeScriptFieldOptional(table, field);
                if (primaryKeys.includes(name)) {
                    str += `${sp} declare ${name}${isOptional ? '?' : notNull}: CreationOptional<${this.getTypeScriptType(table, field)}>;\n`;
                } else {
                    str += `${sp} declare ${name}${isOptional ? '?' : notNull}: ${this.getTypeScriptType(table, field)};\n`;
                }
            }
        });
        return str;
    }
    getTypeScriptFieldOptional(table, field) {
        const fieldObj = this.tables[table][field];
        return fieldObj.allowNull;
    }
    getTypeScriptType(table, field) {
        const fieldObj = this.tables[table][field];
        return this.getTypeScriptFieldType(fieldObj, 'type');
    }
    getTypeScriptFieldType(fieldObj, attr) {
        const rawFieldType = fieldObj[attr] || '';
        const fieldType = String(rawFieldType).toLowerCase();
        let jsType;
        if (this.isArray(fieldType)) {
            const eltype = this.getTypeScriptFieldType(fieldObj, 'elementType');
            jsType = eltype + '[]';
        } else if (this.isNumber(fieldType)) {
            jsType = 'number';
        } else if (this.isBoolean(fieldType)) {
            jsType = 'boolean';
        } else if (this.isDate(fieldType)) {
            jsType = 'Date';
        } else if (this.isString(fieldType)) {
            jsType = 'string';
        } else if (this.isEnum(fieldType)) {
            const values = this.getEnumValues(fieldObj);
            jsType = values.join(' | ');
        } else if (this.isJSON(fieldType)) {
            jsType = 'object';
        } else {
            console.log(`Missing TypeScript type: ${fieldType || fieldObj['type']}`);
            jsType = 'any';
        }
        return jsType;
    }
    getEnumValues(fieldObj) {
        if (fieldObj.special) {
            // postgres
            return fieldObj.special.map((v)=>`"${v}"`);
        } else {
            // mysql
            return fieldObj.type.substring(5, fieldObj.type.length - 1).split(',');
        }
    }
    isTimestampField(field) {
        const additional = this.options.additional;
        if (additional.timestamps === false) {
            return false;
        }
        return !additional.createdAt && (0, _types.recase)('c', field) === 'createdAt' || additional.createdAt === field || !additional.updatedAt && (0, _types.recase)('c', field) === 'updatedAt' || additional.updatedAt === field;
    }
    isParanoidField(field) {
        const additional = this.options.additional;
        if (additional.timestamps === false || additional.paranoid === false) {
            return false;
        }
        return !additional.deletedAt && (0, _types.recase)('c', field) === 'deletedAt' || additional.deletedAt === field;
    }
    isIgnoredField(field) {
        return this.options.skipFields && this.options.skipFields.includes(field);
    }
    escapeSpecial(val) {
        if (typeof val !== 'string') {
            return val;
        }
        return val.replace(/[\\]/g, '\\\\').replace(/[\"]/g, '\\"').replace(/[\/]/g, '\\/').replace(/[\b]/g, '\\b').replace(/[\f]/g, '\\f').replace(/[\n]/g, '\\n').replace(/[\r]/g, '\\r').replace(/[\t]/g, '\\t');
    }
    /** Quote the name if it is not a valid identifier */ quoteName(name) {
        return /^[$A-Z_][0-9A-Z_$]*$/i.test(name) ? name : "'" + name + "'";
    }
    isNumber(fieldType) {
        return /^(smallint|mediumint|tinyint|int|bigint|float|money|smallmoney|double|decimal|numeric|real|oid)/.test(fieldType);
    }
    isBoolean(fieldType) {
        return /^(boolean|bit)/.test(fieldType);
    }
    isDate(fieldType) {
        return /^(datetime|timestamp)/.test(fieldType);
    }
    isString(fieldType) {
        return /^(char|nchar|string|varying|varchar|nvarchar|text|longtext|mediumtext|tinytext|ntext|uuid|uniqueidentifier|date|time|inet|cidr|macaddr)/.test(fieldType);
    }
    isArray(fieldType) {
        return /(^array)|(range$)/.test(fieldType);
    }
    isEnum(fieldType) {
        return /^(enum)/.test(fieldType);
    }
    isJSON(fieldType) {
        return /^(json|jsonb)/.test(fieldType);
    }
    constructor(tableData, dialect, options){
        _define_property(this, "dialect", void 0);
        _define_property(this, "tables", void 0);
        _define_property(this, "foreignKeys", void 0);
        _define_property(this, "hasTriggerTables", void 0);
        _define_property(this, "indexes", void 0);
        _define_property(this, "relations", void 0);
        _define_property(this, "space", void 0);
        _define_property(this, "options", void 0);
        this.tables = tableData.tables;
        this.foreignKeys = tableData.foreignKeys;
        this.hasTriggerTables = tableData.hasTriggerTables;
        this.indexes = tableData.indexes;
        this.relations = tableData.relations;
        this.dialect = dialect;
        this.options = options;
        this.options.lang = this.options.lang || 'es5';
        this.space = (0, _types.makeIndent)(this.options.spaces, this.options.indentation);
    }
}
