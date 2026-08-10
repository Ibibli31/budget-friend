const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });

  const parserPath = path.join(__dirname, '..', 'pdf_parser.py');
  const python = spawn('python3', [parserPath]);

  let stdout = '';
  let stderr = '';

  python.stdout.on('data', chunk => { stdout += chunk; });
  python.stderr.on('data', chunk => { stderr += chunk; });

  python.on('close', code => {
    if (code !== 0) {
      return res.status(500).json({ error: 'Parser failed', details: stderr });
    }
    try {
      const parsed = JSON.parse(stdout);
      res.json(parsed);
    } catch {
      res.status(500).json({ error: 'Invalid JSON from parser', raw: stdout });
    }
  });

  python.stdin.write(req.file.buffer);
  python.stdin.end();
});

module.exports = router;
