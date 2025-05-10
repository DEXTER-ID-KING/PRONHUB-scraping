const { getBrowser } = require('../utils/puppeteerClient');

module.exports = async (req, res) => {
  const url = 'https://www.xvideos.com/new';

  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  const videos = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.thumb-block')).map(v => ({
      title: v.querySelector('p.title')?.textContent.trim(),
      thumbnail: v.querySelector('img')?.getAttribute('data-src') || v.querySelector('img')?.src,
      url: 'https://www.xvideos.com' + v.querySelector('a')?.getAttribute('href'),
    }));
  });

  await browser.close();
  res.status(200).json({ videos });
};
