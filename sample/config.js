const path = require('path');
const output = path.join(__dirname, './models');

/** @type {import('./config').AutoOptions} */
const options = {
  directory: output,
  caseFile: 'l',
  caseModel: 'p',
  caseProp: 'o',
  lang: 'ts',
  useDefine: false,
  singularize: true,
  spaces: true,
  noAlias: true,
  indentation: 2,
  version: 'v6',
  generateMigration: true
};

// Edit the configuration below for your database dialect

// sqlite
const storage = path.join(__dirname, './northwind.sqlite');
/** @type {import('./config').Config} */
const sqlite = {
  dbname: 'northwind',
  user: '',
  pass: '',
  options: { dialect: 'sqlite', storage: storage },
  autoOptions: { dialect: 'sqlite', storage: storage, ...options },
};

// mssql
/** @type {import('./config').Config} */
const mssql = {
  dbname: 'northwind',
  user: 'mssql',
  pass: 'mssql',
  options: { dialect: 'mssql' },
  autoOptions: { dialect: 'mssql', ...options },
};

// mysql
/** @type {import('./config').Config} */
const mysql = {
  dbname: 'afrikmart',
  user: 'root',
  pass: '',
  options: { dialect: 'mysql' },
  autoOptions: { dialect: 'mysql', ...options },
};

// postgres
/** @type {import('./config').Config} */
const postgres = {
  dbname: 'postgres',
  user: 'postgres',
  pass: '4663789',
  options: { dialect: 'postgres' },
  autoOptions: { dialect: 'postgres', ...options },
};

// Change to export appropriate config for your database
module.exports = mysql;
