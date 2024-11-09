Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    TableData: function() {
        return TableData;
    },
    makeIndent: function() {
        return makeIndent;
    },
    makeTableName: function() {
        return makeTableName;
    },
    pluralize: function() {
        return pluralize;
    },
    qNameJoin: function() {
        return qNameJoin;
    },
    qNameSplit: function() {
        return qNameSplit;
    },
    recase: function() {
        return recase;
    },
    singularize: function() {
        return singularize;
    }
});
const _lodash = /*#__PURE__*/ _interop_require_default(require("lodash"));
const _reservedwords = require("reserved-words");
const _sequelize = require("sequelize");
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
class TableData {
    constructor(){
        /** Fields for each table; indexed by schemaName.tableName */ _define_property(this, "tables", void 0);
        /** Foreign keys for each table; indexed by schemaName.tableName */ _define_property(this, "foreignKeys", void 0);
        /** Flag `true` for each table that has any trigger.  This affects how Sequelize performs updates. */ _define_property(this, "hasTriggerTables", void 0);
        /** Indexes for each table; indexed by schemaName.tableName */ _define_property(this, "indexes", void 0);
        /** Relations between models, computed from foreign keys */ _define_property(this, "relations", void 0);
        /** Text to be written to the model files, indexed by schemaName.tableName */ _define_property(this, "text", void 0);
        _define_property(this, "migration", void 0);
        this.tables = {};
        this.foreignKeys = {};
        this.indexes = {};
        this.hasTriggerTables = {};
        this.relations = [];
    }
}
function qNameSplit(qname) {
    if (qname.indexOf(".") > 0) {
        const [schemaName, tableNameOrig] = qname.split(".");
        return [
            schemaName,
            tableNameOrig
        ];
    }
    return [
        null,
        qname
    ];
}
function qNameJoin(schema, table) {
    return !!schema ? schema + "." + table : table;
}
function pluralize(s) {
    let p = _sequelize.Utils.pluralize(s);
    if (p === _sequelize.Utils.singularize(s)) {
        p += 's';
    }
    return p;
}
function singularize(s) {
    return _sequelize.Utils.singularize(s);
}
function recase(opt, val, singular = false) {
    if (singular && val) {
        val = singularize(val);
    }
    if (!opt || opt === 'o' || !val) {
        return val || ''; // original
    }
    if (opt === 'c') {
        return _lodash.default.camelCase(val);
    }
    if (opt === 'k') {
        return _lodash.default.kebabCase(val);
    }
    if (opt === 'l') {
        return _lodash.default.snakeCase(val);
    }
    if (opt === 'p') {
        return _lodash.default.upperFirst(_lodash.default.camelCase(val));
    }
    if (opt === 'u') {
        return _lodash.default.snakeCase(val).toUpperCase();
    }
    return val;
}
const tsNames = [
    "DataTypes",
    "Model",
    "Optional",
    "Sequelize"
];
function makeTableName(opt, tableNameOrig, singular = false, lang = "es5") {
    let name = recase(opt, tableNameOrig, singular);
    if ((0, _reservedwords.check)(name) || lang == "ts" && tsNames.includes(name)) {
        name += "_";
    }
    return name;
}
function makeIndent(spaces, indent) {
    let sp = '';
    for(let x = 0; x < (indent || 2); ++x){
        sp += spaces === true ? ' ' : "\t";
    }
    let space = [];
    for(let i = 0; i < 6; i++){
        space[i] = sp.repeat(i);
    }
    return space;
}
