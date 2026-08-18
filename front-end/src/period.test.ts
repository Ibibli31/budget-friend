import { expect, test } from 'vitest'

import type { Transaction, UploadResult } from './api'
import {
  currentPeriod,
  formatPeriod,
  isSamePeriod,
  shiftPeriod,
  uploadedPeriod,
  type Period,
} from './period'

type Uploaded = Pick<UploadResult, 'period' | 'transactions'>

function transaction(date: string) {
  return { date } as Transaction
}

function result(overrides: Partial<Uploaded> = {}): Uploaded {
  return {
    period: 'January 15, 2024 to February 14, 2024',
    transactions: [],
    ...overrides,
  }
}

test('currentPeriod is a 1-based month of the current date', () => {
  const now = new Date()

  expect(currentPeriod()).toEqual({ month: now.getMonth() + 1, year: now.getFullYear() })
})

test('shifting back from January lands on December of the previous year', () => {
  expect(shiftPeriod({ month: 1, year: 2026 }, -1)).toEqual({ month: 12, year: 2025 })
})

test('shifting forward from December lands on January of the next year', () => {
  expect(shiftPeriod({ month: 12, year: 2025 }, 1)).toEqual({ month: 1, year: 2026 })
})

test('shifting within a year keeps the year', () => {
  expect(shiftPeriod({ month: 8, year: 2026 }, -1)).toEqual({ month: 7, year: 2026 })
  expect(shiftPeriod({ month: 8, year: 2026 }, 1)).toEqual({ month: 9, year: 2026 })
})

test('formatPeriod names the month in long form', () => {
  expect(formatPeriod({ month: 8, year: 2026 })).toBe('August 2026')
  expect(formatPeriod({ month: 1, year: 2025 })).toBe('January 2025')
})

test('isSamePeriod compares month and year', () => {
  const august: Period = { month: 8, year: 2026 }

  expect(isSamePeriod(august, { month: 8, year: 2026 })).toBe(true)
  expect(isSamePeriod(august, { month: 8, year: 2025 })).toBe(false)
  expect(isSamePeriod(august, { month: 7, year: 2026 })).toBe(false)
})

test('uploadedPeriod uses the latest inserted transaction date', () => {
  const target = uploadedPeriod(
    result({
      transactions: [transaction('2026-07-04'), transaction('2026-08-02'), transaction('2026-07-30')],
    }),
  )

  expect(target).toEqual({ month: 8, year: 2026 })
})

test('uploadedPeriod reads a timestamp date without shifting the month', () => {
  const target = uploadedPeriod(
    result({ transactions: [transaction('2026-09-01T00:00:00.000Z')] }),
  )

  expect(target).toEqual({ month: 9, year: 2026 })
})

test('uploadedPeriod falls back to the end of the statement period', () => {
  const target = uploadedPeriod(
    result({ period: 'January 15, 2024 to February 14, 2024', transactions: [] }),
  )

  expect(target).toEqual({ month: 2, year: 2024 })
})

test('uploadedPeriod returns null when there is nothing to go on', () => {
  expect(uploadedPeriod(result({ period: '', transactions: [] }))).toBeNull()
  expect(uploadedPeriod(result({ period: 'statement', transactions: [] }))).toBeNull()
  expect(uploadedPeriod(result({ period: '2024', transactions: [] }))).toBeNull()
  expect(
    uploadedPeriod(result({ period: null as unknown as string, transactions: [] })),
  ).toBeNull()
})
