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

// Seeds a second user, so tests can hold rows DEFAULT_USER_ID does not own.
async function ensureOtherUser() {
  const result = await query(
    `INSERT INTO users (username, email, first_name, last_name)
     VALUES ('other', 'other@budgetfriend.local', 'Other', 'User')
     ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
     RETURNING id`
  );
  return Number(result.rows[0].id);
}

async function clearTransactions() {
  await query('DELETE FROM transactions');
}

// Leaves the seeded defaults, which have no user_id.
async function clearCustomCategories() {
  await query('DELETE FROM categories WHERE user_id IS NOT NULL');
}

async function insertTransaction({
  date,
  amount = 10,
  merchant = 'Test Merchant',
  description = null,
  source = 'rbc_debit',
  occurrence = 1,
  categoryId = null,
  userId = DEFAULT_USER_ID,
}) {
  const result = await query(
    `INSERT INTO transactions (amount, date, merchant, description, occurrence, source, user_id, category_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [amount, date, merchant, description, occurrence, source, userId, categoryId]
  );
  return result.rows[0];
}

async function insertCategory(name, userId = DEFAULT_USER_ID) {
  const result = await query(
    'INSERT INTO categories (name, user_id) VALUES ($1, $2) RETURNING *',
    [name, userId]
  );
  return result.rows[0];
}

module.exports = {
  ensureDefaultUser,
  ensureOtherUser,
  clearTransactions,
  clearCustomCategories,
  insertTransaction,
  insertCategory,
  pool,
};
