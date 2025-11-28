const { Sequelize } = require('sequelize');
const SequelizeAuto = require('../index');

// Edit your database settings in config.js
const config = require('./config');

const sequelize = new Sequelize(
  'postgresql://neondb_owner:6zXa0SRoOUuG@ep-white-night-a474995j.us-east-1.aws.neon.tech/sequelize?sslmode=require&channel_binding=require'
);

var auto = new SequelizeAuto(sequelize, config.user, config.pass, config.autoOptions);

auto.run().then((data) => {
  const tableNames = Object.keys(data.tables);
  console.log(tableNames); // table list
  // console.log(data.foreignKeys); // foreign key list
  // console.log(data.text)         // text of generated files
});
