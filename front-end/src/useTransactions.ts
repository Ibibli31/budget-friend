// owns the transaction and category state, and every call that changes it

import { useCallback, useEffect, useState } from 'react'

import {
  deleteTransaction,
  getCategories,
  getTransactions,
  updateTransaction,
  type Category,
  type Transaction,
  type TransactionEdit,
} from './api'
import { currentPeriod, type Period } from './period'

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [period, setPeriod] = useState<Period>(currentPeriod)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // switches to a month and fetches it, along with the categories rows can be
  // assigned to
  const loadPeriod = useCallback(async (target: Period) => {
    setPeriod(target)
    setLoading(true)
    try {
      const [loadedTransactions, loadedCategories] = await Promise.all([
        getTransactions(target),
        getCategories(),
      ])
      setTransactions(loadedTransactions)
      setCategories(loadedCategories)
      setError(null)
    } catch (err) {
      setError(errorMessage(err, 'Failed to load transactions'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadPeriod sets state after awaiting the fetch
    void loadPeriod(currentPeriod())
  }, [loadPeriod])

  // patches the row and swaps in what the server returned, reporting failure
  const editTransaction = useCallback(async (id: number, edit: TransactionEdit) => {
    setError(null)
    try {
      const updated = await updateTransaction(id, edit)
      setTransactions(current => current.map(t => (t.id === id ? updated : t)))
      return updated
    } catch (err) {
      setError(errorMessage(err, 'Failed to update transaction'))
      return null
    }
  }, [])

  const removeTransaction = useCallback(async (id: number) => {
    setError(null)
    try {
      await deleteTransaction(id)
      setTransactions(current => current.filter(t => t.id !== id))
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete transaction'))
    }
  }, [])

  return {
    transactions,
    categories,
    period,
    loading,
    error,
    loadPeriod,
    editTransaction,
    removeTransaction,
  }
}
