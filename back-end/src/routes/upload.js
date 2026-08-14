const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const { transaction } = require('../db');
const { DEFAULT_USER_ID } = require('../config');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const MONTHS = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

// Parser dates look like "15 Mar 2004"; Postgres wants an unambiguous ISO date.
function toIsoDate(statementDate) {
  const [day, mon, year] = statementDate.split(' ');
  return `${year}-${MONTHS[mon]}-${day.padStart(2, '0')}`;
}

router.post('/', upload.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });

  const { source } = req.body;
  if (!source) return res.status(400).json({ error: 'source is required' });

  const parserPath = path.join(__dirname, '..', '..', 'parser', 'pdf_parser.py');
  const python = spawn('python3', [parserPath]);

  let stdout = '';
  let stderr = '';

  python.stdout.on('data', chunk => { stdout += chunk; });
  python.stderr.on('data', chunk => { stderr += chunk; });

  python.on('close', async code => {
    if (code !== 0) {
      return res.status(500).json({ error: 'Parser failed', details: stderr });
    }

    let parsed;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      return res.status(500).json({ error: 'Invalid JSON from parser', raw: stdout });
    }

    try {
      const rows = await transaction(async client => {
        const inserted = [];
        for (const t of parsed.transactions) {
          if (t.deposit == null && t.withdrawal == null) {
            throw new Error(`Transaction row has no deposit or withdrawal amount: ${JSON.stringify(t)}`);
          }
          // Withdrawals/deposits map onto the single signed `amount` column.
          const amount = t.deposit != null ? t.deposit : -t.withdrawal;
          const result = await client.query(
            `INSERT INTO transactions (amount, date, merchant, description, source, user_id, category_id)
             VALUES ($1, $2, $3, $4, $5, $6, NULL)
             RETURNING *`,
            [amount, toIsoDate(t.date), t.merchant, t.description, source, DEFAULT_USER_ID]
          );
          inserted.push(result.rows[0]);
        }
        return inserted;
      });
      res.json({
        period: parsed.period,
        opening_balance: parsed.opening_balance,
        closing_balance: parsed.closing_balance,
        transactions: rows,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to persist transactions', details: err.message });
    }
  });

  python.stdin.write(req.file.buffer);
  python.stdin.end();
});

module.exports = router;
