Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "dialects", {
    enumerable: true,
    get: function() {
        return dialects;
    }
});
const _mssql = require("./mssql");
const _mysql = require("./mysql");
const _postgres = require("./postgres");
const _sqlite = require("./sqlite");
const dialects = {
    mssql: _mssql.mssqlOptions,
    mysql: _mysql.mysqlOptions,
    mariadb: _mysql.mysqlOptions,
    postgres: _postgres.postgresOptions,
    sqlite: _sqlite.sqliteOptions
};
