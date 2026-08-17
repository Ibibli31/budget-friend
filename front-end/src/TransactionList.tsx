import { useId, useState } from 'react'

import type { Category, Transaction, TransactionEdit } from './api'

// the editable text fields, held as strings while the row is being typed into
type Draft = {
  date: string
  merchant: string
  description: string
  amount: string
}

function toDraft(transaction: Transaction): Draft {
  return {
    date: transaction.date.slice(0, 10),
    merchant: transaction.merchant,
    description: transaction.description ?? '',
    amount: transaction.amount,
  }
}

type RowProps = {
  transaction: Transaction
  categories: Category[]
  onEdit: (id: number, edit: TransactionEdit) => Promise<Transaction | null>
  onDelete: (id: number) => void
}

function TransactionRow({ transaction, categories, onEdit, onDelete }: RowProps) {
  const [draft, setDraft] = useState(() => toDraft(transaction))

  // sends the field if it changed, then resyncs that one field with the
  // server's copy, leaving fields being typed into meanwhile untouched
  async function commit(field: keyof Draft, edit: TransactionEdit) {
    const stored = toDraft(transaction)
    if (draft[field] === stored[field]) return

    // date and amount are required, so an emptied field reverts
    if (draft[field] === '' && field !== 'description') {
      setDraft(current => ({ ...current, [field]: stored[field] }))
      return
    }

    const next = toDraft((await onEdit(transaction.id, edit)) ?? transaction)
    setDraft(current => ({ ...current, [field]: next[field] }))
  }

  return (
    <tr>
      <td>
        <input
          aria-label="Date"
          type="date"
          value={draft.date}
          onChange={event => setDraft({ ...draft, date: event.target.value })}
          onBlur={() => commit('date', { date: draft.date })}
        />
      </td>
      <td>
        <input
          aria-label="Merchant"
          value={draft.merchant}
          onChange={event => setDraft({ ...draft, merchant: event.target.value })}
          onBlur={() => commit('merchant', { merchant: draft.merchant })}
        />
      </td>
      <td>
        <input
          aria-label="Description"
          value={draft.description}
          onChange={event => setDraft({ ...draft, description: event.target.value })}
          onBlur={() => commit('description', { description: draft.description || null })}
        />
      </td>
      <td>
        <input
          aria-label="Amount"
          type="number"
          step="0.01"
          value={draft.amount}
          onChange={event => setDraft({ ...draft, amount: event.target.value })}
          onBlur={() => commit('amount', { amount: draft.amount })}
        />
      </td>
      <td>
        <select
          aria-label="Category"
          value={transaction.category_id === null ? '' : String(transaction.category_id)}
          onChange={event =>
            onEdit(transaction.id, {
              category_id: event.target.value === '' ? null : Number(event.target.value),
            })
          }
        >
          <option value="">Uncategorized</option>
          {categories.map(category => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <button type="button" onClick={() => onDelete(transaction.id)}>
          Delete
        </button>
      </td>
    </tr>
  )
}

type ListProps = {
  transactions: Transaction[]
  categories: Category[]
  loading: boolean
  error: string | null
  onEdit: (id: number, edit: TransactionEdit) => Promise<Transaction | null>
  onDelete: (id: number) => void
}

function TransactionList({
  transactions,
  categories,
  loading,
  error,
  onEdit,
  onDelete,
}: ListProps) {
  const headingId = useId()

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>This month</h2>

      {/* always-mounted live region for the outcome of an edit */}
      <p role="alert">{error}</p>

      {loading ? (
        <p>Loading transactions…</p>
      ) : transactions.length === 0 ? (
        <p>No transactions this month.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Merchant</th>
              <th scope="col">Description</th>
              <th scope="col">Amount</th>
              <th scope="col">Category</th>
              <th scope="col">
                <span aria-hidden="true">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(transaction => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                categories={categories}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export default TransactionList
