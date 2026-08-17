const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const app = require('../src/index');
const { query } = require('../src/db');
const {
  ensureDefaultUser,
  clearTransactions,
  insertTransaction,
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
