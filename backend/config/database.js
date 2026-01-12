const knex = require('knex');
const knexConfig = require('../knexfile');

const environment = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[environment]);

// Test the connection
db.raw('SELECT 1')
  .then(() => {
    console.log('Database connection established successfully');
  })
  .catch((error) => {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  });

module.exports = db;