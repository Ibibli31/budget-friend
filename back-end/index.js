const express = require('express');
const uploadRouter = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/api/upload', uploadRouter);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
