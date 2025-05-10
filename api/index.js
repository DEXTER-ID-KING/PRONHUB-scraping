const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Porn Scraper API');
});

module.exports = app;
