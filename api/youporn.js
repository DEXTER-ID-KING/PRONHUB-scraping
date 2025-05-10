
const { getBrowser } = require('../utils/puppeteerClient');

module.exports = async (req, res) => {
  const url = `https://www.youporn.com/`;

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const videos = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.video-box')).map(v => ({
        title: v.querySelector('.video-title')?.innerText,
        thumbnail: v.querySelector('img')?.src,
        url: 'https://www.youporn.com' + v.querySelector('a')?.getAttribute('href'),
      }));
    });

    await browser.close();
    res.status(200).json({ videos });
  } catch (err) {
    res.status(500).json({ error: 'Scraping failed', details: err.message });
  }
};
