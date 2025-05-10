const puppeteer = require('puppeteer');

async function getBrowser() {
  return await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

module.exports = { getBrowser };
