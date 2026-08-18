import { expect, test } from 'vitest'

import type { Category, Transaction } from './api'
import { summarize } from './summary'

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 1,
    amount: '-42.50',
    date: '2026-08-04',
    merchant: 'Loblaws',
    description: null,
    source: 'rbc_debit',
    occurrence: 1,
    created_at: '2026-08-05T12:00:00.000Z',
    user_id: 1,
    category_id: null,
    ...overrides,
  }
}

const CATEGORIES: Category[] = [
  { id: 7, name: 'Groceries', user_id: null },
  { id: 8, name: 'Transport', user_id: null },
]

test('totals the withdrawals as a positive spend figure', () => {
  const summary = summarize(
    [
      transaction({ id: 1, amount: '-42.50' }),
      transaction({ id: 2, amount: '-7.25' }),
    ],
    CATEGORIES,
  )

  expect(summary.total).toBe(49.75)
})

test('leaves deposits out of spend', () => {
  const summary = summarize(
    [
      transaction({ id: 1, amount: '-42.50' }),
      transaction({ id: 2, amount: '1500.00', merchant: 'Payroll' }),
    ],
    CATEGORIES,
  )

  expect(summary.total).toBe(42.5)
})

test('groups spend under the category names, largest first', () => {
  const summary = summarize(
    [
      transaction({ id: 1, amount: '-42.50', category_id: 7 }),
      transaction({ id: 2, amount: '-60.00', category_id: 8 }),
      transaction({ id: 3, amount: '-7.25', category_id: 7 }),
    ],
    CATEGORIES,
  )

  expect(summary.byCategory).toEqual([
    { key: '8', name: 'Transport', total: 60 },
    { key: '7', name: 'Groceries', total: 49.75 },
  ])
})

test('buckets uncategorized spend last', () => {
  const summary = summarize(
    [
      transaction({ id: 1, amount: '-500.00', category_id: null }),
      transaction({ id: 2, amount: '-60.00', category_id: 8 }),
    ],
    CATEGORIES,
  )

  expect(summary.byCategory).toEqual([
    { key: '8', name: 'Transport', total: 60 },
    { key: 'uncategorized', name: 'Uncategorized', total: 500 },
  ])
})

test('omits categories with no spend in the period', () => {
  const summary = summarize([transaction({ amount: '-42.50', category_id: 7 })], CATEGORIES)

  expect(summary.byCategory.map(entry => entry.name)).toEqual(['Groceries'])
})

test('names a category the list no longer knows about', () => {
  const summary = summarize([transaction({ amount: '-42.50', category_id: 99 })], CATEGORIES)

  expect(summary.byCategory).toEqual([{ key: '99', name: 'Other', total: 42.5 }])
})

test('reports zero for a period with no transactions', () => {
  const summary = summarize([], CATEGORIES)

  expect(summary.total).toBe(0)
  expect(summary.byCategory).toEqual([])
})

test('ignores an amount that is not a number', () => {
  const summary = summarize(
    [transaction({ id: 1, amount: '-10.00' }), transaction({ id: 2, amount: '' })],
    CATEGORIES,
  )

  expect(summary.total).toBe(10)
})

test('nets a refund against its category', () => {
  const summary = summarize(
    [
      transaction({ id: 1, amount: '-200.00', category_id: 7 }),
      transaction({ id: 2, amount: '-42.50', category_id: 7 }),
      transaction({ id: 3, amount: '200.00', category_id: 7 }),
    ],
    CATEGORIES,
  )

  expect(summary.total).toBe(42.5)
  expect(summary.byCategory).toEqual([{ key: '7', name: 'Groceries', total: 42.5 }])
})

test('a category credited more than it was spent contributes nothing', () => {
  const summary = summarize(
    [
      transaction({ id: 1, amount: '-42.50', category_id: 8 }),
      transaction({ id: 2, amount: '1500.00', category_id: 7, merchant: 'Payroll' }),
    ],
    CATEGORIES,
  )

  expect(summary.total).toBe(42.5)
  expect(summary.byCategory).toEqual([{ key: '8', name: 'Transport', total: 42.5 }])
})

test('leaves an uncategorized deposit out rather than netting it', () => {
  const summary = summarize(
    [
      transaction({ id: 1, amount: '-42.50', category_id: null }),
      transaction({ id: 2, amount: '1500.00', category_id: null, merchant: 'Payroll' }),
    ],
    CATEGORIES,
  )

  expect(summary.byCategory).toEqual([
    { key: 'uncategorized', name: 'Uncategorized', total: 42.5 },
  ])
})
