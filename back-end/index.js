const express = require('express');
const uploadRouter = require('./routes/upload');

const app = express();

app.use('/api/upload', uploadRouter);

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
