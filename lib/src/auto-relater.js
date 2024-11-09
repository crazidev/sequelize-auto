Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AutoRelater", {
    enumerable: true,
    get: function() {
        return AutoRelater;
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
class AutoRelater {
    /** Create Relations from the foreign keys, and add to TableData */ buildRelations(td) {
        const fkTables = _lodash.default.keys(td.foreignKeys).sort();
        fkTables.forEach((t)=>{
            const fkFields = td.foreignKeys[t];
            const fkFieldNames = _lodash.default.keys(fkFields);
            fkFieldNames.forEach((fkFieldName)=>{
                const spec = fkFields[fkFieldName];
                if (spec.isForeignKey) {
                    this.addRelation(t, fkFieldName, spec, fkFields);
                }
            });
        });
        td.relations = _lodash.default.sortBy(this.relations, [
            'parentTable',
            'childTable'
        ]);
        return td;
    }
    /** Create a Relation object for the given foreign key */ addRelation(table, fkFieldName, spec, fkFields) {
        const [schemaName, tableName] = (0, _types.qNameSplit)(table);
        const schema = schemaName;
        const modelName = (0, _types.recase)(this.caseModel, tableName, this.singularize);
        const targetModel = (0, _types.recase)(this.caseModel, spec.foreignSources.target_table, this.singularize);
        const alias = this.getAlias(fkFieldName, spec.foreignSources.target_table, spec.foreignSources.source_table);
        const childAlias = this.getChildAlias(fkFieldName, spec.foreignSources.source_table, spec.foreignSources.target_table);
        const sourceProp = (0, _types.recase)(this.caseProp, fkFieldName);
        // use "hasOne" cardinality if this FK is also a single-column Primary or Unique key; else "hasMany"
        const isOne = spec.isPrimaryKey && !_lodash.default.some(fkFields, (f)=>f.isPrimaryKey && f.source_column !== fkFieldName) || !!spec.isUnique && !_lodash.default.some(fkFields, (f)=>f.isUnique === spec.isUnique && f.source_column !== fkFieldName);
        this.relations.push({
            parentId: sourceProp,
            parentModel: targetModel,
            parentProp: alias,
            parentTable: (0, _types.qNameJoin)(spec.foreignSources.target_schema || schema, spec.foreignSources.target_table),
            childModel: modelName,
            childProp: isOne ? (0, _types.singularize)(childAlias) : (0, _types.pluralize)(childAlias),
            childTable: (0, _types.qNameJoin)(spec.foreignSources.source_schema || schema, spec.foreignSources.source_table),
            isOne: isOne,
            isM2M: false
        });
        if (spec.isPrimaryKey) {
            // if FK is also part of the PK, see if there is a "many-to-many" junction
            const otherKeys = _lodash.default.filter(fkFields, (k)=>k.isForeignKey && k.isPrimaryKey && k.source_column !== fkFieldName);
            if (otherKeys.length === 1) {
                const otherKey = otherKeys[0];
                const otherModel = (0, _types.recase)(this.caseModel, otherKey.foreignSources.target_table, this.singularize);
                const otherProp = this.getAlias(otherKey.source_column, otherKey.foreignSources.target_table, otherKey.foreignSources.source_table, true);
                const otherId = (0, _types.recase)(this.caseProp, otherKey.source_column);
                this.relations.push({
                    parentId: sourceProp,
                    parentModel: targetModel,
                    parentProp: (0, _types.pluralize)(alias),
                    parentTable: (0, _types.qNameJoin)(spec.foreignSources.target_schema || schema, spec.foreignSources.target_table),
                    childModel: otherModel,
                    childProp: (0, _types.pluralize)(otherProp),
                    childTable: (0, _types.qNameJoin)(otherKey.foreignSources.target_schema || schema, otherKey.foreignSources.target_table),
                    childId: otherId,
                    joinModel: modelName,
                    isOne: isOne,
                    isM2M: true
                });
            }
        }
    }
    /** Convert foreign key name into alias name for belongsTo relations */ getAlias(fkFieldName, modelName, targetModel, isM2M = false) {
        let name = this.trimId(fkFieldName);
        if (name === fkFieldName || isM2M) {
            name = fkFieldName + "_" + modelName;
        }
        // singularize in case one column name is the singularized form of another column in the same model
        let singleName = (0, _types.singularize)(name);
        if (isM2M) {
            if (this.usedChildNames.has(modelName + "." + singleName)) {
                name = name + "_" + targetModel;
            }
            this.usedChildNames.add(modelName + "." + (0, _types.singularize)(name));
        } else {
            if (this.usedChildNames.has(targetModel + "." + singleName)) {
                name = name + "_" + modelName;
            }
            this.usedChildNames.add(targetModel + "." + (0, _types.singularize)(name));
        }
        return (0, _types.recase)(this.caseProp, name, true);
    }
    /** Convert foreign key name into alias name for hasMany/hasOne relations */ getChildAlias(fkFieldName, modelName, targetModel) {
        let name = modelName;
        // usedChildNames prevents duplicate names in same model
        if (this.usedChildNames.has(targetModel + "." + (0, _types.singularize)(name))) {
            name = this.trimId(fkFieldName);
            name = name + "_" + modelName;
        }
        // singularize in case one column name is the singularized form of another column in the same model
        name = (0, _types.singularize)(name);
        this.usedChildNames.add(targetModel + "." + name);
        return (0, _types.recase)(this.caseProp, name, true);
    }
    trimId(name) {
        this.pkSuffixes.forEach((suffix)=>{
            if (name.length > suffix.length + 1 && name.toLowerCase().endsWith(suffix.toLowerCase())) {
                name = name.substring(0, name.length - suffix.length);
            }
        });
        if (name.endsWith("_")) {
            name = name.substring(0, name.length - 1);
        }
        return name;
    }
    constructor(options){
        _define_property(this, "caseModel", void 0);
        _define_property(this, "caseProp", void 0);
        _define_property(this, "singularize", void 0);
        _define_property(this, "pkSuffixes", void 0);
        _define_property(this, "relations", void 0);
        _define_property(this, "usedChildNames", void 0);
        this.caseModel = options.caseModel || 'o';
        this.caseProp = options.caseProp || 'o';
        this.singularize = options.singularize;
        this.pkSuffixes = options.pkSuffixes || [];
        if (!this.pkSuffixes || this.pkSuffixes.length == 0) {
            this.pkSuffixes = [
                "id"
            ];
        }
        this.relations = [];
        this.usedChildNames = new Set();
    }
}
