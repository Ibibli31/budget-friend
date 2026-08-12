const { Pool } = require('pg');

// Connection is configured entirely via standard `pg` environment variables
// (DATABASE_URL, or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE). See README.
const pool = new Pool();

// Without a listener, an idle client erroring (e.g. dropped connection)
// emits an unhandled 'error' event and crashes the whole process.
pool.on('error', err => {
  console.error('Unexpected error on idle pg client', err);
});

function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
