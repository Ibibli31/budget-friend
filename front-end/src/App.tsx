import './App.css'
import MonthStepper from './MonthStepper'
import TransactionList from './TransactionList'
import UploadStatement from './UploadStatement'
import { uploadedPeriod } from './period'
import { useTransactions } from './useTransactions'

function App() {
  const {
    transactions,
    categories,
    period,
    loading,
    error,
    loadPeriod,
    editTransaction,
    removeTransaction,
  } = useTransactions()

  return (
    <main>
      <h1>Budget Friend</h1>
      <UploadStatement
        onUploaded={result => void loadPeriod(uploadedPeriod(result) ?? period)}
      />
      <MonthStepper period={period} onChange={target => void loadPeriod(target)} />
      <TransactionList
        transactions={transactions}
        categories={categories}
        period={period}
        loading={loading}
        error={error}
        onEdit={editTransaction}
        onDelete={removeTransaction}
      />
    </main>
  )
}

export default App
