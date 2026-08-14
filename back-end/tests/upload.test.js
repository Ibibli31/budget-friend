const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const app = require('../index');
const { query } = require('../db');
const { ensureDefaultUser, clearTransactions, pool } = require('./helpers/testDb');

const SAMPLE_PDF = path.join(__dirname, '..', 'sample_statement.pdf');

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
