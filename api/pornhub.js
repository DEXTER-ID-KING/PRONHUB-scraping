
const { getBrowser } = require('../utils/puppeteerClient');

module.exports = async (req, res) => {
  const { category = '29' } = req.query;
  const url = `https://www.pornhub.com/video?c=${category}`;

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const videos = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.videoPreviewBg')).map(v => ({
        title: v.querySelector('img')?.alt,
        thumbnail: v.querySelector('img')?.src,
        url: 'https://www.pornhub.com' + v.closest('a')?.getAttribute('href'),
      }));
    });

    await browser.close();
    res.status(200).json({ videos });
  } catch (err) {
    res.status(500).json({ error: 'Scraping failed', details: err.message });
  }
};
