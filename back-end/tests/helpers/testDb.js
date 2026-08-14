const { query, pool } = require('../../db');
const { DEFAULT_USER_ID } = require('../../config');

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

module.exports = { ensureDefaultUser, clearTransactions, pool };
