const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// 🔍 Search API
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing q param' });

  try {
    const { data } = await axios.get(`https://www.pornhub.com/video/search?search=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const $ = cheerio.load(data);
    const results = [];

    $('.videoblock.videoBox').each((i, el) => {
      const title = $(el).find('span.title a').text().trim();
      const url = 'https://www.pornhub.com' + $(el).find('span.title a').attr('href');
      const img = $(el).find('img').attr('data-thumb_url') || $(el).find('img').attr('src');
      const views = $(el).find('.views var').text().trim();
      results.push({ title, url, image: img, views });
    });

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

// 🎬 Video Detail API
app.get('/api/video-details', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) return res.status(400).json({ error: 'Missing url param' });

  try {
    const { data } = await axios.get(videoUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const $ = cheerio.load(data);
    const title = $('h1.title').text().trim();
    const views = $('span.views').first().text().trim();
    const likes = $('button.voteUp span.count').text().trim();
    const dislikes = $('button.voteDown span.count').text().trim();

    const match = data.match(/var flashvars_.*?=\s*({.*?});/);
    let download_urls = [];

    if (match) {
      const flashvars = JSON.parse(match[1]);
      if (flashvars.mediaDefinitions) {
        download_urls = flashvars.mediaDefinitions
          .filter(obj => obj.videoUrl && obj.quality)
          .map(obj => ({ quality: obj.quality, url: obj.videoUrl }));
      }
    }

    res.json({ title, views, likes, dislikes, download_urls });
  } catch (err) {
    res.status(500).json({ error: 'Video details fetch failed', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
