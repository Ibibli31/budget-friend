const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const app = require('../src/index');
const { ensureDefaultUser, clearTransactions, insertTransaction, pool } = require('./helpers/testDb');

let server;
let baseUrl;

before(async () => {
  await ensureDefaultUser();
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
});

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
