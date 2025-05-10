
const express = require('express');
const app = express();
const pornhub = require('./api/pornhub');
const xvideos = require('./api/xvideos');
const youporn = require('./api/youporn');

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Porn Scraper API Running');
});

app.get('/api/pornhub', pornhub);
app.get('/api/xvideos', xvideos);
app.get('/api/youporn', youporn);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
