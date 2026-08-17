const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const { transaction } = require('../db');
const { DEFAULT_USER_ID } = require('../config');
const { toTransactionRows } = require('../statementRows');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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
      const { inserted, skipped } = await transaction(async client => {
        const inserted = [];
        let skipped = 0;
        for (const row of toTransactionRows(parsed.transactions)) {
          // skips rows an earlier upload already persisted
          const result = await client.query(
            `INSERT INTO transactions (amount, date, merchant, description, occurrence, source, user_id, category_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)
             ON CONFLICT ON CONSTRAINT transactions_dedupe_unique DO NOTHING
             RETURNING *`,
            [row.amount, row.date, row.merchant, row.description, row.occurrence, source, DEFAULT_USER_ID]
          );
          if (result.rows.length === 0) {
            skipped += 1;
          } else {
            inserted.push(result.rows[0]);
          }
        }
        return { inserted, skipped };
      });
      res.json({
        period: parsed.period,
        opening_balance: parsed.opening_balance,
        closing_balance: parsed.closing_balance,
        transactions: inserted,
        inserted_count: inserted.length,
        skipped_count: skipped,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to persist transactions', details: err.message });
    }
  });

  python.stdin.write(req.file.buffer);
  python.stdin.end();
});

module.exports = router;
