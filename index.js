const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// 🕊️ Middleware to add developer to every response
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (typeof body === 'object' && !Array.isArray(body)) {
      body.developer = 'Dexter 🕊️';
    }
    return originalJson(body);
  };
  next();
});

// ✅ API Status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    server_time: new Date().toISOString(),
    endpoints: {
      search: '/api/search?q=stepmom',
      videoDetails: '/api/video-details?q=https://www.pornhub.com/view_video.php?viewkey=...',
      categories: '/api/category?q=new|top|mostviewed'
    }
  });
});

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
      const image = $(el).find('img').attr('data-mediumthumb') || $(el).find('img').attr('data-thumb_url');
      const views = $(el).find('.views var').text().trim();
      results.push({ title, url, image, views });
    });

    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

// 🎬 Video Details API
app.get('/api/video-details', async (req, res) => {
  const videoUrl = req.query.q;
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
        download_urls = await Promise.all(flashvars.mediaDefinitions
          .filter(obj => obj.videoUrl && obj.quality)
          .map(async obj => {
            let size = 'Streaming (m3u8)';
            if (obj.videoUrl.endsWith('.mp4')) {
              try {
                const head = await axios.head(obj.videoUrl);
                const bytes = parseInt(head.headers['content-length']);
                if (bytes && !isNaN(bytes)) {
                  size = `${(bytes / 1024 / 1024).toFixed(2)} MB`;
                }
              } catch (e) {
                size = 'Unknown';
              }
            }
            return {
              quality: obj.quality || 'Unknown',
              url: obj.videoUrl,
              size
            };
          }));
      }
    }

    res.json({ title, views, likes, dislikes, download_urls });
  } catch (err) {
    res.status(500).json({ error: 'Video details fetch failed', details: err.message });
  }
});

// 📂 Category Videos API
app.get('/api/category', async (req, res) => {
  const category = req.query.q || 'new';
  let url = 'https://www.pornhub.com/video';

  if (category === 'top') url = 'https://www.pornhub.com/video?o=tr';
  else if (category === 'mostviewed') url = 'https://www.pornhub.com/video?o=mv';
  else url = 'https://www.pornhub.com/video?o=mr';

  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const $ = cheerio.load(data);
    const results = [];

    $('.videoblock.videoBox').each((i, el) => {
      const title = $(el).find('span.title a').text().trim();
      const videoUrl = 'https://www.pornhub.com' + $(el).find('span.title a').attr('href');
      const image = $(el).find('img').attr('data-mediumthumb') || $(el).find('img').attr('data-thumb_url');
      const views = $(el).find('.views var').text().trim();
      results.push({ title, url: videoUrl, image, views });
    });

    res.json({ category, results });
  } catch (err) {
    res.status(500).json({ error: 'Category load failed', details: err.message });
  }
});

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
