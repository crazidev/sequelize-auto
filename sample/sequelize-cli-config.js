const config = require('./config');

const configuration = {
  "host": "127.0.0.1",
  "username": config.user,
  "password": config.pass,
  "database": "sequelize-migration-test",
  "dialect": config.autoOptions.dialect
};

module.exports = configuration;