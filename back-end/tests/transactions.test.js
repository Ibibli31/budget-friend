const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const app = require('../src/index');
const { query } = require('../src/db');
const {
  ensureDefaultUser,
  ensureOtherUser,
  clearTransactions,
  clearCustomCategories,
  insertTransaction,
  insertCategory,
  pool,
} = require('./helpers/testDb');

let server;
let baseUrl;
let otherUserId;

before(async () => {
  await ensureDefaultUser();
  otherUserId = await ensureOtherUser();
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
  await pool.end();
});

beforeEach(async () => {
  await clearTransactions();
  await clearCustomCategories();
});

function patch(id, body) {
  return fetch(`${baseUrl}/api/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function seedThreeMonths() {
  const jan = await insertTransaction({ date: '2024-01-15', merchant: 'Jan Merchant' });
  const feb10 = await insertTransaction({ date: '2024-02-10', merchant: 'Feb Early' });
  const feb20 = await insertTransaction({ date: '2024-02-20', merchant: 'Feb Late' });
  return { jan, feb10, feb20 };
}

test('returns persisted transactions for the hardcoded user ordered by date DESC', async () => {
  const { jan, feb10, feb20 } = await seedThreeMonths();

  const res = await fetch(`${baseUrl}/api/transactions`);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.deepEqual(
    body.transactions.map(t => t.id),
    [feb20.id, feb10.id, jan.id]
  );
});

test('filters by month/year', async () => {
  const { feb10, feb20 } = await seedThreeMonths();

  const res = await fetch(`${baseUrl}/api/transactions?month=2&year=2024`);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.deepEqual(
    body.transactions.map(t => t.id),
    [feb20.id, feb10.id]
  );
});

test('filters by from/to', async () => {
  const { jan } = await seedThreeMonths();

  const res = await fetch(`${baseUrl}/api/transactions?from=2024-01-01&to=2024-01-31`);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.deepEqual(body.transactions.map(t => t.id), [jan.id]);
});

test('omitting params returns full unfiltered history', async () => {
  await seedThreeMonths();

  const res = await fetch(`${baseUrl}/api/transactions`);
  const body = await res.json();

  assert.equal(body.transactions.length, 3);
});

test('PATCH updates only the fields the body provides', async () => {
  const created = await insertTransaction({
    date: '2024-02-10',
    amount: 10,
    merchant: 'Old Merchant',
    description: 'Old description',
  });

  const res = await patch(created.id, { merchant: 'New Merchant' });
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.transaction.merchant, 'New Merchant');
  assert.equal(body.transaction.amount, created.amount);
  assert.equal(body.transaction.description, 'Old description');
  assert.equal(Number(body.transaction.id), Number(created.id));
});

test('PATCH updates the amount', async () => {
  const created = await insertTransaction({ date: '2024-02-10', amount: 10 });

  const res = await patch(created.id, { amount: '99.99' });
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.transaction.amount, '99.99');
});

test('PATCH updates the description', async () => {
  const created = await insertTransaction({ date: '2024-02-10' });

  const res = await patch(created.id, { description: 'Coffee with Sam' });
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.transaction.description, 'Coffee with Sam');
});

test('PATCH updates the date', async () => {
  const created = await insertTransaction({ date: '2024-02-10' });

  const res = await patch(created.id, { date: '2024-03-05' });
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.match(body.transaction.date, /^2024-03-05/);
});

test('PATCH assigns a category', async () => {
  const created = await insertTransaction({ date: '2024-02-10' });
  const category = await insertCategory('Hobbies');

  const res = await patch(created.id, { category_id: category.id });
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(Number(body.transaction.category_id), Number(category.id));
});

test('PATCH clears a category with an explicit null', async () => {
  const category = await insertCategory('Hobbies');
  const created = await insertTransaction({ date: '2024-02-10', categoryId: category.id });

  const res = await patch(created.id, { category_id: null });
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.transaction.category_id, null);
});

test('PATCH with no updatable fields returns 400', async () => {
  const created = await insertTransaction({ date: '2024-02-10' });

  const res = await patch(created.id, { user_id: 999 });
  assert.equal(res.status, 400);
});

test('PATCH 404s for an id that does not exist', async () => {
  const res = await patch(999999, { merchant: 'Nope' });
  assert.equal(res.status, 404);
});

test('PATCH 404s for an id owned by another user', async () => {
  const foreign = await insertTransaction({ date: '2024-02-10', userId: otherUserId });

  const res = await patch(foreign.id, { merchant: 'Nope' });
  assert.equal(res.status, 404);

  const unchanged = await fetch(`${baseUrl}/api/transactions`);
  assert.deepEqual((await unchanged.json()).transactions, []);
});

test('DELETE removes the row', async () => {
  const created = await insertTransaction({ date: '2024-02-10' });

  const res = await fetch(`${baseUrl}/api/transactions/${created.id}`, { method: 'DELETE' });
  assert.equal(res.status, 200);

  const remaining = await fetch(`${baseUrl}/api/transactions`);
  assert.deepEqual((await remaining.json()).transactions, []);
});

test('DELETE 404s for an id that does not exist', async () => {
  const res = await fetch(`${baseUrl}/api/transactions/999999`, { method: 'DELETE' });
  assert.equal(res.status, 404);
});

test('DELETE 404s for an id owned by another user', async () => {
  const foreign = await insertTransaction({ date: '2024-02-10', userId: otherUserId });

  const res = await fetch(`${baseUrl}/api/transactions/${foreign.id}`, { method: 'DELETE' });
  assert.equal(res.status, 404);

  const still = await query('SELECT id FROM transactions WHERE id = $1', [foreign.id]);
  assert.equal(still.rows.length, 1);
});

test('PATCH rejects a value the column cannot hold with 400', async () => {
  const created = await insertTransaction({ date: '2024-02-10' });

  for (const body of [{ date: '' }, { amount: 'abc' }, { date: 'not-a-date' }]) {
    const res = await patch(created.id, body);
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
  }
});

test('PATCH rejects a category id the user cannot see with 400', async () => {
  const created = await insertTransaction({ date: '2024-02-10' });

  const foreign = await insertCategory('Their Hobbies', otherUserId);

  for (const category_id of [999999, 'x', foreign.id]) {
    const res = await patch(created.id, { category_id });
    assert.equal(res.status, 400, `expected 400 for ${category_id}`);
  }
});

test('PATCH returns 409 when the edit collides with an existing row', async () => {
  await insertTransaction({ date: '2024-02-10', amount: 5, merchant: 'Tim Hortons' });
  const typo = await insertTransaction({ date: '2024-02-10', amount: 5, merchant: 'Tim Horton' });

  const res = await patch(typo.id, { merchant: 'Tim Hortons' });
  assert.equal(res.status, 409);
});

test('PATCH 404s for an id too large for the column', async () => {
  const res = await patch('99999999999999999999', { merchant: 'Nope' });
  assert.equal(res.status, 404);
});

test('DELETE 404s for an id too large for the column', async () => {
  const res = await fetch(`${baseUrl}/api/transactions/99999999999999999999`, {
    method: 'DELETE',
  });
  assert.equal(res.status, 404);
});

test('serializes date as a plain YYYY-MM-DD string and ids as numbers', async () => {
  await insertTransaction({ date: '2024-02-10' });

  const res = await fetch(`${baseUrl}/api/transactions`);
  const [transaction] = (await res.json()).transactions;

  assert.equal(transaction.date, '2024-02-10');
  assert.equal(typeof transaction.id, 'number');
  assert.equal(typeof transaction.user_id, 'number');
});
