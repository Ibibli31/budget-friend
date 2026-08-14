const { query, pool } = require('../../src/db');
const { DEFAULT_USER_ID } = require('../../src/config');

// Seeds the hardcoded user (id 1, since it's the first row in a fresh test
// db) that DEFAULT_USER_ID is configured to point at in tests/setup.js.
async function ensureDefaultUser() {
  await query(
    `INSERT INTO users (username, email, first_name, last_name)
     VALUES ('default', 'default@budgetfriend.local', 'Default', 'User')
     ON CONFLICT (username) DO NOTHING`
  );
}

async function clearTransactions() {
  await query('DELETE FROM transactions WHERE user_id = $1', [DEFAULT_USER_ID]);
}

async function insertTransaction({
  date,
  amount = 10,
  merchant = 'Test Merchant',
  description = null,
  source = 'rbc_debit',
}) {
  const result = await query(
    `INSERT INTO transactions (amount, date, merchant, description, source, user_id, category_id)
     VALUES ($1, $2, $3, $4, $5, $6, NULL)
     RETURNING *`,
    [amount, date, merchant, description, source, DEFAULT_USER_ID]
  );
  return result.rows[0];
}

module.exports = { ensureDefaultUser, clearTransactions, insertTransaction, pool };
