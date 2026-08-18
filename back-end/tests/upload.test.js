const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

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

const SAMPLE_PDF = path.join(__dirname, '..', 'parser', 'tests', 'sample_statement.pdf');

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
  await clearCustomCategories();
});

function buildForm({ withSource = true, pdfBuffer, source = 'rbc_debit' } = {}) {
  const form = new FormData();
  if (withSource) form.append('source', source);
  const buffer = pdfBuffer ?? fs.readFileSync(SAMPLE_PDF);
  form.append('pdf', new Blob([buffer]), 'statement.pdf');
  return form;
}

test('persists parsed transactions with signed amounts and returns generated ids', async () => {
  const res = await fetch(`${baseUrl}/api/upload`, { method: 'POST', body: buildForm() });
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.ok(Array.isArray(body.transactions));
  assert.ok(body.transactions.length > 0);
  for (const t of body.transactions) {
    assert.ok(t.id);
    assert.equal(t.source, 'rbc_debit');
  }

  const withdrawal = body.transactions.find(t => t.description === 'ATM withdrawal');
  assert.equal(Number(withdrawal.amount), -100);

  const deposit = body.transactions.find(t => t.description === 'Transfer');
  assert.equal(Number(deposit.amount), 85);

  const dbRows = await query('SELECT * FROM transactions WHERE source = $1', ['rbc_debit']);
  assert.equal(dbRows.rows.length, body.transactions.length);
});

test('uploads with different source values coexist in history', async () => {
  const debitRes = await fetch(`${baseUrl}/api/upload`, {
    method: 'POST',
    body: buildForm({ source: 'rbc_debit' }),
  });
  assert.equal(debitRes.status, 200);

  const creditRes = await fetch(`${baseUrl}/api/upload`, {
    method: 'POST',
    body: buildForm({ source: 'rbc_credit' }),
  });
  assert.equal(creditRes.status, 200);

  const dbRows = await query('SELECT DISTINCT source FROM transactions ORDER BY source');
  assert.deepEqual(dbRows.rows.map(r => r.source), ['rbc_credit', 'rbc_debit']);
});

test('re-uploading the same statement skips every row', async () => {
  const first = await fetch(`${baseUrl}/api/upload`, { method: 'POST', body: buildForm() });
  const firstBody = await first.json();
  assert.equal(firstBody.skipped_count, 0);
  assert.equal(firstBody.inserted_count, firstBody.transactions.length);

  const second = await fetch(`${baseUrl}/api/upload`, { method: 'POST', body: buildForm() });
  assert.equal(second.status, 200);

  const secondBody = await second.json();
  assert.deepEqual(secondBody.transactions, []);
  assert.equal(secondBody.inserted_count, 0);
  assert.equal(secondBody.skipped_count, firstBody.inserted_count);

  const dbRows = await query('SELECT * FROM transactions');
  assert.equal(dbRows.rows.length, firstBody.inserted_count);
});

test('a partially-overlapping re-upload imports only the rows that are new', async () => {
  // seeds two rows that match the sample statement exactly
  await insertTransaction({
    date: '2004-03-15',
    amount: -100,
    merchant: 'Bank transaction',
    description: 'ATM withdrawal',
    source: 'rbc_debit',
  });
  await insertTransaction({
    date: '2004-03-15',
    amount: 85,
    merchant: 'Bank transaction',
    description: 'Transfer',
    source: 'rbc_debit',
  });

  const res = await fetch(`${baseUrl}/api/upload`, { method: 'POST', body: buildForm() });
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.skipped_count, 2);
  assert.equal(body.inserted_count, body.transactions.length);
  assert.ok(!body.transactions.some(t => t.description === 'ATM withdrawal' && Number(t.amount) === -100));

  const dbRows = await query('SELECT * FROM transactions');
  assert.equal(dbRows.rows.length, body.inserted_count + 2);
});

test('two identical transactions on one day both persist as separate occurrences', async () => {
  // exercises the constraint directly: same six facts, different occurrence
  const row = {
    date: '2004-03-22',
    amount: -20,
    merchant: 'Bank transaction',
    description: 'ATM withdrawal',
  };
  await insertTransaction({ ...row, occurrence: 1 });
  await insertTransaction({ ...row, occurrence: 2 });

  const dbRows = await query(
    'SELECT occurrence FROM transactions WHERE amount = -20 ORDER BY occurrence'
  );
  assert.deepEqual(dbRows.rows.map(r => r.occurrence), [1, 2]);

  await assert.rejects(
    () => insertTransaction({ ...row, occurrence: 2 }),
    err => err.code === '23505'
  );
});

test('the same statement uploaded under a different source is not treated as a duplicate', async () => {
  await fetch(`${baseUrl}/api/upload`, { method: 'POST', body: buildForm({ source: 'rbc_debit' }) });

  const res = await fetch(`${baseUrl}/api/upload`, {
    method: 'POST',
    body: buildForm({ source: 'rbc_credit' }),
  });

  const body = await res.json();
  assert.equal(body.skipped_count, 0);
  assert.ok(body.inserted_count > 0);
});

test('parser failure on a corrupt PDF returns 500 and persists nothing', async () => {
  const res = await fetch(`${baseUrl}/api/upload`, {
    method: 'POST',
    body: buildForm({ pdfBuffer: Buffer.from('not a real pdf') }),
  });
  assert.equal(res.status, 500);

  const dbRows = await query('SELECT * FROM transactions');
  assert.equal(dbRows.rows.length, 0);
});

test('missing source returns 400 and persists nothing', async () => {
  const res = await fetch(`${baseUrl}/api/upload`, {
    method: 'POST',
    body: buildForm({ withSource: false }),
  });
  assert.equal(res.status, 400);

  const dbRows = await query('SELECT * FROM transactions');
  assert.equal(dbRows.rows.length, 0);
});

async function uploadAndFind(merchant) {
  const res = await fetch(`${baseUrl}/api/upload`, { method: 'POST', body: buildForm() });
  assert.equal(res.status, 200);
  const body = await res.json();
  const row = body.transactions.find(t => t.merchant === merchant);
  assert.ok(row, `upload returned no row for merchant ${merchant}`);
  return row;
}

test('a merchant categorized earlier arrives pre-categorized on the next upload', async () => {
  const category = await insertCategory('Shopping Memory');
  await insertTransaction({
    date: '2004-02-01',
    amount: -50,
    merchant: 'The Bay',
    categoryId: category.id,
  });

  const row = await uploadAndFind('The Bay');
  assert.equal(row.category_id, category.id);
});

test('a merchant with no prior categorized transaction arrives uncategorized', async () => {
  await insertTransaction({ date: '2004-02-01', amount: -50, merchant: 'The Bay' });

  const row = await uploadAndFind('The Bay');
  assert.equal(row.category_id, null);
});

test('merchant matching ignores case and surrounding whitespace', async () => {
  const category = await insertCategory('Shopping Memory');
  await insertTransaction({
    date: '2004-02-01',
    amount: -50,
    merchant: '  the bay ',
    categoryId: category.id,
  });

  const row = await uploadAndFind('The Bay');
  assert.equal(row.category_id, category.id);
});

test('the most recently dated categorized transaction wins', async () => {
  const older = await insertCategory('Older Memory');
  const newer = await insertCategory('Newer Memory');
  await insertTransaction({
    date: '2004-01-01',
    amount: -50,
    merchant: 'The Bay',
    categoryId: older.id,
  });
  await insertTransaction({
    date: '2004-02-01',
    amount: -60,
    merchant: 'The Bay',
    categoryId: newer.id,
  });

  const row = await uploadAndFind('The Bay');
  assert.equal(row.category_id, newer.id);
});

test('another user\'s categorized merchant is not borrowed', async () => {
  const otherUserId = await ensureOtherUser();
  const category = await insertCategory('Other User Memory', otherUserId);
  await insertTransaction({
    date: '2004-02-01',
    amount: -50,
    merchant: 'The Bay',
    categoryId: category.id,
    userId: otherUserId,
  });

  const row = await uploadAndFind('The Bay');
  assert.equal(row.category_id, null);
});

test('categorizing an uploaded transaction never recategorizes its siblings', async () => {
  const category = await insertCategory('Shopping Memory');
  const uploaded = await uploadAndFind('The Bay');
  const sibling = await insertTransaction({ date: '2004-02-01', amount: -50, merchant: 'The Bay' });

  const patch = await fetch(`${baseUrl}/api/transactions/${uploaded.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_id: category.id }),
  });
  assert.equal(patch.status, 200);

  const others = await query(
    'SELECT category_id FROM transactions WHERE id <> $1',
    [uploaded.id]
  );
  assert.ok(others.rows.length > 1);
  assert.ok(others.rows.every(r => r.category_id === null));
  assert.equal(sibling.category_id, null);
});
