const express = require('express');
const { query } = require('../db');
const { DEFAULT_USER_ID } = require('../config');

const router = express.Router();

router.get('/', async (req, res) => {
  const { month, year, from, to } = req.query;

  let where = 'user_id = $1';
  const params = [DEFAULT_USER_ID];

  if (from && to) {
    where += ' AND date >= $2 AND date <= $3';
    params.push(from, to);
  } else if (month && year) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    where += " AND date >= $2 AND date < ($2::date + interval '1 month')";
    params.push(start);
  } 

  try {
    const result = await query(
      `SELECT * FROM transactions WHERE ${where} ORDER BY date DESC`,
      params
    );
    res.json({ transactions: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions', details: err.message });
  }
});

// columns a PATCH body may set
const UPDATABLE_COLUMNS = ['merchant', 'amount', 'description', 'date', 'category_id'];

function parseId(value) {
  const id = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(id) ? id : null;
}

// Maps a write that Postgres rejected onto the status the client should see.
function writeFailure(err) {
  if (err.code === '23505') {
    return { status: 409, error: 'That change duplicates an existing transaction' };
  }
  if (err.code === '23503' || String(err.code).startsWith('22')) {
    return { status: 400, error: 'Invalid value', details: err.message };
  }
  return null;
}

router.patch('/:id', express.json(), async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(404).json({ error: 'Transaction not found' });

  const body = req.body ?? {};
  const columns = UPDATABLE_COLUMNS.filter(column => column in body);

  if (columns.length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided' });
  }

  if ('category_id' in body && body.category_id !== null) {
    const categoryId = parseId(String(body.category_id));
    const owned =
      categoryId !== null &&
      (await query(
        'SELECT 1 FROM categories WHERE id = $1 AND (user_id IS NULL OR user_id = $2)',
        [categoryId, DEFAULT_USER_ID]
      )).rowCount > 0;

    if (!owned) return res.status(400).json({ error: 'Unknown category' });
  }

  const assignments = columns.map((column, i) => `${column} = $${i + 1}`).join(', ');
  const params = columns.map(column => body[column]);

  try {
    const result = await query(
      `UPDATE transactions SET ${assignments}
       WHERE id = $${params.length + 1} AND user_id = $${params.length + 2}
       RETURNING *`,
      [...params, id, DEFAULT_USER_ID]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ transaction: result.rows[0] });
  } catch (err) {
    const failure = writeFailure(err);
    if (failure) {
      const { status, ...payload } = failure;
      return res.status(status).json(payload);
    }
    res.status(500).json({ error: 'Failed to update transaction', details: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(404).json({ error: 'Transaction not found' });

  try {
    const result = await query(
      'DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, DEFAULT_USER_ID]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete transaction', details: err.message });
  }
});

module.exports = router;
