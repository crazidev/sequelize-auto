import { mssqlOptions } from "./mssql";
import { mysqlOptions } from "./mysql";
import { postgresOptions } from "./postgres";
import { sqliteOptions } from "./sqlite";
import { DialectOptions } from "./dialect-options";
import { Dialect } from "sequelize";

// Stub for unsupported dialects
const unsupportedDialect: DialectOptions = {
  name: 'unsupported',
  hasSchema: false,
  getForeignKeysQuery: () => '',
  countTriggerQuery: () => '',
  isPrimaryKey: () => false,
  isSerialKey: () => false,
  showViewsQuery: () => '',
};

export const dialects: { [name in Dialect]: DialectOptions } = {
  mssql: mssqlOptions,
  mysql: mysqlOptions,
  mariadb: mysqlOptions,
  postgres: postgresOptions,
  sqlite: sqliteOptions,
  db2: unsupportedDialect,
  snowflake: unsupportedDialect,
  oracle: unsupportedDialect,
};
