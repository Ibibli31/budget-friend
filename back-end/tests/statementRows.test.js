const { test } = require('node:test');
const assert = require('node:assert/strict');

const { toTransactionRows } = require('../src/statementRows');

function parsedRow(overrides = {}) {
  return {
    date: '22 Mar 2004',
    description: 'ATM withdrawal',
    merchant: 'Bank transaction',
    withdrawal: 20,
    deposit: null,
    balance: null,
    ...overrides,
  };
}

test('converts statement dates to iso and withdrawals to negative amounts', () => {
  const [row] = toTransactionRows([parsedRow()]);

  assert.equal(row.date, '2004-03-22');
  assert.equal(row.amount, -20);
  assert.equal(row.merchant, 'Bank transaction');
  assert.equal(row.description, 'ATM withdrawal');
});

test('keeps deposits positive', () => {
  const [row] = toTransactionRows([
    parsedRow({ withdrawal: null, deposit: 85, description: 'Transfer' }),
  ]);

  assert.equal(row.amount, 85);
});

test('numbers rows that are identical so repeated purchases stay distinct', () => {
  const rows = toTransactionRows([parsedRow(), parsedRow()]);

  assert.deepEqual(rows.map(r => r.occurrence), [1, 2]);
});

test('numbers each distinct row independently', () => {
  const rows = toTransactionRows([
    parsedRow(),
    parsedRow({ withdrawal: 40 }),
    parsedRow(),
    parsedRow({ date: '23 Mar 2004' }),
  ]);

  assert.deepEqual(rows.map(r => r.occurrence), [1, 1, 2, 1]);
});

test('rows differing only by description are not the same row', () => {
  const rows = toTransactionRows([
    parsedRow(),
    parsedRow({ description: 'Cheque #30' }),
  ]);

  assert.deepEqual(rows.map(r => r.occurrence), [1, 1]);
});

test('a null description still groups with other null descriptions', () => {
  const rows = toTransactionRows([
    parsedRow({ description: null }),
    parsedRow({ description: null }),
  ]);

  assert.deepEqual(rows.map(r => r.occurrence), [1, 2]);
});

test('the same statement always numbers the same way', () => {
  const statement = [parsedRow(), parsedRow({ withdrawal: 40 }), parsedRow()];

  assert.deepEqual(
    toTransactionRows(statement).map(r => r.occurrence),
    toTransactionRows(statement).map(r => r.occurrence)
  );
});

test('rejects a row with neither a deposit nor a withdrawal', () => {
  assert.throws(
    () => toTransactionRows([parsedRow({ withdrawal: null, deposit: null })]),
    /no deposit or withdrawal/
  );
});
