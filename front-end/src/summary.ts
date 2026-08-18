// rolls the fetched transactions up into the figures the summary strip shows

import type { Category, Transaction } from './api'

const UNCATEGORIZED = 'uncategorized'

export type CategorySpend = {
  key: string
  name: string
  total: number
}

export type Summary = {
  total: number
  byCategory: CategorySpend[]
}

// the outgoing part of an amount, as a positive number
function spend(amount: string): number {
  const value = Number(amount)
  return Number.isFinite(value) && value < 0 ? -value : 0
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export function summarize(
  transactions: Transaction[],
  categories: Category[],
): Summary {
  const names = new Map(categories.map(category => [String(category.id), category.name]))

  const totals = transactions.reduce((acc, transaction) => {
    const amount = spend(transaction.amount)
    if (amount === 0) return acc

    const key =
      transaction.category_id === null ? UNCATEGORIZED : String(transaction.category_id)
    acc.set(key, (acc.get(key) ?? 0) + amount)
    return acc
  }, new Map<string, number>())

  const byCategory = [...totals]
    .map(([key, total]) => ({
      key,
      name: key === UNCATEGORIZED ? 'Uncategorized' : names.get(key) ?? 'Other',
      total: round(total),
    }))
    .sort((a, b) => {
      if (a.key === UNCATEGORIZED) return 1
      if (b.key === UNCATEGORIZED) return -1
      return b.total - a.total
    })

  return {
    total: round(byCategory.reduce((sum, entry) => sum + entry.total, 0)),
    byCategory,
  }
}
