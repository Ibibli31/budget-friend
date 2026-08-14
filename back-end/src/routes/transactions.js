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

module.exports = router;
