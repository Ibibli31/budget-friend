import './App.css'
import TransactionList from './TransactionList'
import UploadStatement from './UploadStatement'
import { useTransactions } from './useTransactions'

function App() {
  const {
    transactions,
    categories,
    loading,
    error,
    reload,
    editTransaction,
    removeTransaction,
  } = useTransactions()

  return (
    <main>
      <h1>Budget Friend</h1>
      <UploadStatement onUploaded={reload} />
      <TransactionList
        transactions={transactions}
        categories={categories}
        loading={loading}
        error={error}
        onEdit={editTransaction}
        onDelete={removeTransaction}
      />
    </main>
  )
}

export default App
