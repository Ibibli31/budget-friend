const MONTHS = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

// converts "15 Mar 2004" to "2004-03-15"
function toIsoDate(statementDate) {
  const [day, mon, year] = statementDate.split(' ');
  return `${year}-${MONTHS[mon]}-${day.padStart(2, '0')}`;
}

// builds the key that groups identical rows
function dedupeKey({ date, amount, merchant, description }) {
  return JSON.stringify([date, amount, merchant, description]);
}

// shapes parser rows into `transactions` columns, numbering repeated rows
// 1, 2, 3...
function toTransactionRows(parsedTransactions) {
  const seen = new Map();

  return parsedTransactions.map(t => {
    if (t.deposit == null && t.withdrawal == null) {
      throw new Error(`Transaction row has no deposit or withdrawal amount: ${JSON.stringify(t)}`);
    }

    const row = {
      // withdrawals go negative, deposits positive
      amount: t.deposit != null ? t.deposit : -t.withdrawal,
      date: toIsoDate(t.date),
      merchant: t.merchant,
      description: t.description,
    };

    const occurrence = (seen.get(dedupeKey(row)) ?? 0) + 1;
    seen.set(dedupeKey(row), occurrence);

    return { ...row, occurrence };
  });
}

module.exports = { toTransactionRows };
