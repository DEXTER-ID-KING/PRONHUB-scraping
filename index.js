const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Porn Scraper API Running');
});

module.exports = app;
