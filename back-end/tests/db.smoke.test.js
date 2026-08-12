const test = require('node:test');
const assert = require('node:assert/strict');
const { pool, query } = require('../db');

test('db module connects and runs a trivial query', async () => {
  const result = await query('SELECT 1 AS ok');
  assert.equal(result.rows[0].ok, 1);
  await pool.end();
});
