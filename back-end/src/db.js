const { Pool, types } = require('pg');

// DATE arrives as the stored YYYY-MM-DD string, BIGINT as a number.
types.setTypeParser(types.builtins.DATE, value => value);
types.setTypeParser(types.builtins.INT8, Number);

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

// Runs `callback(client)` inside a BEGIN/COMMIT block, rolling back on any
// error so multi-row writes are all-or-nothing.
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, transaction };
