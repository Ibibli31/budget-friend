import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  ApiError,
  deleteTransaction,
  getCategories,
  getTransactions,
  updateTransaction,
  uploadStatement,
  type Category,
  type Transaction,
} from './api'
import App from './App'

// mocks the api module rather than fetch
vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return {
    ...actual,
    getTransactions: vi.fn(),
    getCategories: vi.fn(),
    updateTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    uploadStatement: vi.fn(),
  }
})

const getTransactionsMock = vi.mocked(getTransactions)
const getCategoriesMock = vi.mocked(getCategories)
const updateTransactionMock = vi.mocked(updateTransaction)
const deleteTransactionMock = vi.mocked(deleteTransaction)
const uploadStatementMock = vi.mocked(uploadStatement)

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 1,
    amount: '42.50',
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

const CATEGORIES: Category[] = [{ id: 7, name: 'Groceries', user_id: null }]

function rowFor(merchant: string) {
  return screen.getByDisplayValue(merchant).closest('tr') as HTMLElement
}

// the list has its own alert region, separate from the uploader's
function listAlert() {
  return within(screen.getByRole('region', { name: /this month/i })).getByRole('alert')
}

beforeEach(() => {
  getTransactionsMock.mockReset().mockResolvedValue([])
  getCategoriesMock.mockReset().mockResolvedValue(CATEGORIES)
  updateTransactionMock.mockReset()
  deleteTransactionMock.mockReset().mockResolvedValue(undefined)
  uploadStatementMock.mockReset()
})

test('loads the current month on mount', async () => {
  getTransactionsMock.mockResolvedValue([transaction()])
  const now = new Date()

  render(<App />)

  expect(screen.getByRole('heading', { name: 'Budget Friend' })).toBeInTheDocument()
  expect(screen.getByLabelText(/statement pdf/i)).toBeInTheDocument()

  await waitFor(() => {
    expect(getTransactionsMock).toHaveBeenCalledWith({
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    })
  })
  expect(await screen.findByDisplayValue('Loblaws')).toBeInTheDocument()
})

test('a successful upload reloads the transaction list', async () => {
  getTransactionsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([transaction()])
  uploadStatementMock.mockResolvedValue({
    period: 'August 1, 2026 to August 31, 2026',
    opening_balance: 0,
    closing_balance: 0,
    transactions: [transaction()],
    inserted_count: 1,
    skipped_count: 0,
  })
  const user = userEvent.setup()

  render(<App />)

  expect(await screen.findByText(/no transactions/i)).toBeInTheDocument()

  await user.upload(
    screen.getByLabelText(/statement pdf/i),
    new File(['%PDF-1.4'], 'statement.pdf', { type: 'application/pdf' }),
  )
  await user.click(screen.getByRole('button', { name: /upload/i }))

  await waitFor(() => {
    expect(screen.getByDisplayValue('Loblaws')).toBeInTheDocument()
  })
})

test('assigning a category persists it and keeps it on screen', async () => {
  getTransactionsMock.mockResolvedValue([transaction()])
  updateTransactionMock.mockResolvedValue(transaction({ category_id: 7 }))
  const user = userEvent.setup()

  render(<App />)

  await screen.findByDisplayValue('Loblaws')
  const category = within(rowFor('Loblaws')).getByLabelText(/category/i)
  await user.selectOptions(category, '7')

  await waitFor(() => {
    expect(updateTransactionMock).toHaveBeenCalledWith(1, { category_id: 7 })
  })
  await waitFor(() => {
    expect(category).toHaveValue('7')
  })
})

test('deleting a row removes it from the list', async () => {
  getTransactionsMock.mockResolvedValue([
    transaction({ id: 1, merchant: 'Loblaws' }),
    transaction({ id: 2, merchant: 'Petro-Canada' }),
  ])
  const user = userEvent.setup()

  render(<App />)

  await screen.findByDisplayValue('Loblaws')
  await user.click(within(rowFor('Loblaws')).getByRole('button', { name: /delete/i }))

  await waitFor(() => {
    expect(deleteTransactionMock).toHaveBeenCalledWith(1)
  })
  await waitFor(() => {
    expect(screen.queryByDisplayValue('Loblaws')).not.toBeInTheDocument()
  })
  expect(screen.getByDisplayValue('Petro-Canada')).toBeInTheDocument()
})

test('shows the server error message when an edit fails', async () => {
  getTransactionsMock.mockResolvedValue([transaction()])
  updateTransactionMock.mockRejectedValue(new ApiError(404, 'Transaction not found'))
  const user = userEvent.setup()

  render(<App />)

  await screen.findByDisplayValue('Loblaws')
  await user.selectOptions(
    within(rowFor('Loblaws')).getByLabelText(/category/i),
    '7',
  )

  await waitFor(() => {
    expect(listAlert()).toHaveTextContent('Transaction not found')
  })
})

test('shows the server error message when the load fails', async () => {
  getTransactionsMock.mockRejectedValue(new ApiError(500, 'Failed to fetch transactions'))

  render(<App />)

  await waitFor(() => {
    expect(listAlert()).toHaveTextContent('Failed to fetch transactions')
  })
})
