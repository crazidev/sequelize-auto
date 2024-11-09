Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AutoBuilder", {
    enumerable: true,
    get: function() {
        return AutoBuilder;
    }
});
const _lodash = /*#__PURE__*/ _interop_require_default(require("lodash"));
const _sequelize = require("sequelize");
const _dialects = require("./dialects/dialects");
const _types = require("./types");
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
        var info = gen[key](arg);
        var value = info.value;
    } catch (error) {
        reject(error);
        return;
    }
    if (info.done) {
        resolve(value);
    } else {
        Promise.resolve(value).then(_next, _throw);
    }
}
function _async_to_generator(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
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
class AutoBuilder {
    build() {
        let prom;
        if (this.dialect.showTablesQuery) {
            const showTablesSql = this.dialect.showTablesQuery(this.schema);
            prom = this.executeQuery(showTablesSql);
        } else {
            prom = this.queryInterface.showAllTables();
        }
        if (this.views) {
            // Add views to the list of tables
            prom = prom.then((tr)=>{
                // in mysql, use database name instead of schema
                const vschema = this.dialect.name === 'mysql' ? this.sequelize.getDatabaseName() : this.schema;
                const showViewsSql = this.dialect.showViewsQuery(vschema);
                return this.executeQuery(showViewsSql).then((tr2)=>tr.concat(tr2));
            });
        }
        return prom.then((tr)=>this.processTables(tr)).catch((err)=>{
            console.error(err);
            return this.tableData;
        });
    }
    processTables(tableResult) {
        // tables is an array of either three things:
        // * objects with two properties table_name and table_schema
        // * objects with two properties tableName and tableSchema
        // * objects with a single name property
        // The first happens for dialects which support schemas (e.g. mssql, postgres).
        // The second happens for dialects which do not support schemas (e.g. sqlite).
        let tables = _lodash.default.map(tableResult, (t)=>{
            return {
                table_name: t.table_name || t.tableName || t.name || String(t),
                table_schema: t.table_schema || t.tableSchema || t.schema || this.schema || null
            };
        });
        // include/exclude tables
        if (this.includeTables) {
            const optables = mapOptionTables(this.includeTables, this.schema);
            tables = _lodash.default.intersectionWith(tables, optables, isTableEqual);
        } else if (this.skipTables) {
            const skipTables = mapOptionTables(this.skipTables, this.schema);
            tables = _lodash.default.differenceWith(tables, skipTables, isTableEqual);
        }
        const promises = tables.map((t)=>{
            return this.mapForeignKeys(t).then(()=>this.mapTable(t));
        });
        return Promise.all(promises).then(()=>this.tableData);
    }
    mapForeignKeys(table) {
        const tableQname = makeTableQName(table);
        const sql = this.dialect.getForeignKeysQuery(table.table_name, table.table_schema || this.sequelize.getDatabaseName());
        const dialect = this.dialect;
        const foreignKeys = this.tableData.foreignKeys;
        return this.executeQuery(sql).then((res)=>{
            res.forEach(assignColumnDetails);
        }).catch((err)=>console.error(err));
        function assignColumnDetails(row, ix, rows) {
            let ref;
            if (dialect.remapForeignKeysRow) {
                ref = dialect.remapForeignKeysRow(table.table_name, row);
            } else {
                ref = row;
            }
            if (!_lodash.default.isEmpty(_lodash.default.trim(ref.source_column)) && !_lodash.default.isEmpty(_lodash.default.trim(ref.target_column))) {
                ref.isForeignKey = true;
                ref.foreignSources = _lodash.default.pick(ref, [
                    'source_table',
                    'source_schema',
                    'target_schema',
                    'target_table',
                    'source_column',
                    'target_column'
                ]);
            }
            if (dialect.isUnique && dialect.isUnique(ref, rows)) {
                ref.isUnique = ref.constraint_name || true;
            }
            if (_lodash.default.isFunction(dialect.isPrimaryKey) && dialect.isPrimaryKey(ref)) {
                ref.isPrimaryKey = true;
            }
            if (dialect.isSerialKey && dialect.isSerialKey(ref)) {
                ref.isSerialKey = true;
            }
            foreignKeys[tableQname] = foreignKeys[tableQname] || {};
            foreignKeys[tableQname][ref.source_column] = _lodash.default.assign({}, foreignKeys[tableQname][ref.source_column], ref);
        }
    }
    mapTable(table) {
        var _this = this;
        return _async_to_generator(function*() {
            try {
                const fields = yield _this.queryInterface.describeTable(table.table_name, table.table_schema);
                _this.tableData.tables[makeTableQName(table)] = fields;
                // for postgres array or user-defined types, get element type
                if (_this.dialect.showElementTypeQuery && (_lodash.default.some(fields, {
                    type: "ARRAY"
                }) || _lodash.default.some(fields, {
                    type: "USER-DEFINED"
                }))) {
                    // get the subtype of the fields
                    const stquery = _this.dialect.showElementTypeQuery(table.table_name, table.table_schema);
                    const elementTypes = yield _this.executeQuery(stquery);
                    // add element type to "elementType" property of field
                    elementTypes.forEach((et)=>{
                        const fld = fields[et.column_name];
                        if (fld.type === "ARRAY") {
                            fld.elementType = et.element_type;
                            if (et.element_type === "USER-DEFINED" && et.enum_values && !fld.special.length) {
                                fld.elementType = "ENUM";
                                // fromArray is a method defined on Postgres QueryGenerator only
                                fld.special = _this.queryInterface.queryGenerator.fromArray(et.enum_values);
                            }
                        } else if (fld.type === "USER-DEFINED") {
                            fld.type = !fld.special.length ? et.udt_name : "ENUM";
                        }
                    });
                    // TODO - in postgres, query geography_columns and geometry_columns for detail type and srid
                    if (elementTypes.some((et)=>et.udt_name === 'geography') && _this.dialect.showGeographyTypeQuery) {
                        const gquery = _this.dialect.showGeographyTypeQuery(table.table_name, table.table_schema);
                        const gtypes = yield _this.executeQuery(gquery);
                        gtypes.forEach((gt)=>{
                            const fld = fields[gt.column_name];
                            if (fld.type === 'geography') {
                                fld.elementType = `'${gt.udt_name}', ${gt.data_type}`;
                            }
                        });
                    }
                    if (elementTypes.some((et)=>et.udt_name === 'geometry') && _this.dialect.showGeometryTypeQuery) {
                        const gquery = _this.dialect.showGeometryTypeQuery(table.table_name, table.table_schema);
                        const gtypes = yield _this.executeQuery(gquery);
                        gtypes.forEach((gt)=>{
                            const fld = fields[gt.column_name];
                            if (fld.type === 'geometry') {
                                fld.elementType = `'${gt.udt_name}', ${gt.data_type}`;
                            }
                        });
                    }
                }
                // for mssql numeric types, get the precision. QueryInterface.describeTable does not return it
                if (_this.dialect.showPrecisionQuery && (_lodash.default.some(fields, {
                    type: "DECIMAL"
                }) || _lodash.default.some(fields, {
                    type: "NUMERIC"
                }))) {
                    const prequery = _this.dialect.showPrecisionQuery(table.table_name, table.table_schema);
                    const columnPrec = yield _this.executeQuery(prequery);
                    columnPrec.forEach((cp)=>{
                        const fld = fields[cp.column_name];
                        if (cp.numeric_precision && (fld.type === 'DECIMAL' || fld.type === 'NUMERIC')) {
                            fld.type = `${fld.type}(${cp.numeric_precision},${cp.numeric_scale})`;
                        }
                    });
                }
                _this.tableData.indexes[makeTableQName(table)] = yield _this.queryInterface.showIndex({
                    tableName: table.table_name,
                    schema: table.table_schema
                });
                // if there is no primaryKey, and `id` field exists, then make id the primaryKey (#480)
                if (!_lodash.default.some(fields, {
                    primaryKey: true
                })) {
                    const idname = _lodash.default.keys(fields).find((f)=>f.toLowerCase() === 'id');
                    const idfield = idname && fields[idname];
                    if (idfield) {
                        idfield.primaryKey = true;
                    }
                }
                const countTriggerSql = _this.dialect.countTriggerQuery(table.table_name, table.table_schema || "");
                const triggerResult = yield _this.executeQuery(countTriggerSql);
                const triggerCount = triggerResult && triggerResult[0] && triggerResult[0].trigger_count;
                if (triggerCount > 0) {
                    _this.tableData.hasTriggerTables[makeTableQName(table)] = true;
                }
            } catch (err) {
                console.error(err);
            }
        })();
    }
    executeQuery(query) {
        return this.sequelize.query(query, {
            type: _sequelize.QueryTypes.SELECT,
            raw: true
        });
    }
    constructor(sequelize, options){
        _define_property(this, "sequelize", void 0);
        _define_property(this, "queryInterface", void 0);
        _define_property(this, "dialect", void 0);
        _define_property(this, "includeTables", void 0);
        _define_property(this, "skipTables", void 0);
        _define_property(this, "schema", void 0);
        _define_property(this, "views", void 0);
        _define_property(this, "tableData", void 0);
        this.sequelize = sequelize;
        this.queryInterface = this.sequelize.getQueryInterface();
        this.dialect = _dialects.dialects[this.sequelize.getDialect()];
        this.includeTables = options.tables;
        this.skipTables = options.skipTables;
        this.schema = options.schema;
        this.views = !!options.views;
        this.tableData = new _types.TableData();
    }
}
// option tables are a list of strings; each string is either
// table name (e.g. "Customer") or schema dot table name (e.g. "dbo.Customer")
function mapOptionTables(arr, defaultSchema) {
    return _lodash.default.map(arr, (t)=>{
        const sp = t.split('.');
        return {
            table_name: sp[sp.length - 1],
            table_schema: sp.length > 1 ? sp[sp.length - 2] : defaultSchema
        };
    });
}
function isTableEqual(a, b) {
    return a.table_name === b.table_name && (!b.table_schema || a.table_schema === b.table_schema);
}
function makeTableQName(table) {
    return [
        table.table_schema,
        table.table_name
    ].filter(Boolean).join(".");
}
