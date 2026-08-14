const express = require('express');
const uploadRouter = require('./routes/upload');
const transactionsRouter = require('./routes/transactions');
const categoriesRouter = require('./routes/categories');

const app = express();

app.use('/api/upload', uploadRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/categories', categoriesRouter);

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
