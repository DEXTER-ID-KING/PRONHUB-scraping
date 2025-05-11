const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, 'temp');

app.use(cors());
app.use(express.static(TEMP_DIR));

// 🕊️ Developer Tag Middleware
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

// 🔃 Auto delete expired files
setInterval(() => {
  fs.readdir(TEMP_DIR, (err, files) => {
    if (err) return;
    files.forEach(file => {
      const filePath = path.join(TEMP_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        const now = Date.now();
        if ((now - stats.mtimeMs) > 15 * 60 * 1000) {
          fs.unlink(filePath, () => {});
        }
      });
    });
  });
}, 60 * 1000); // Every 1 min

// ✅ Status API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    server_time: new Date().toISOString(),
    endpoints: {
      search: '/api/search?q=stepmom',
      videoDetails: '/api/video-details?q=URL',
      categories: '/api/category?q=new|top|mostviewed',
      download: '/api/download?q=HD_VIDEO_URL_OR_M3U8'
    }
  });
});

// 🔍 Search
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

// 🎬 Video Details with download links
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
        download_urls = flashvars.mediaDefinitions
          .filter(obj => obj.videoUrl)
          .map(obj => {
            const tempId = crypto.randomBytes(6).toString('hex');
            const download_link = obj.videoUrl.endsWith('.m3u8')
              ? `${req.protocol}://${req.get('host')}/api/download?q=${encodeURIComponent(obj.videoUrl)}`
              : obj.videoUrl;

            return {
              quality: obj.quality || 'unknown',
              url: obj.videoUrl,
              download: download_link,
              format: obj.videoUrl.endsWith('.m3u8') ? 'm3u8 (convert via server)' : 'mp4 direct'
            };
          });
      }
    }

    res.json({ title, views, likes, dislikes, download_urls });
  } catch (err) {
    res.status(500).json({ error: 'Video details fetch failed', details: err.message });
  }
});

// 📂 Categories
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

// ⏬ FFmpeg Download & Temp Link
app.get('/api/download', async (req, res) => {
  const m3u8Url = req.query.q;
  if (!m3u8Url) return res.status(400).json({ error: 'Missing q param (m3u8 URL)' });

  const id = crypto.randomBytes(6).toString('hex');
  const outputPath = path.join(TEMP_DIR, `${id}.mp4`);

  const ffmpegCommand = `ffmpeg -y -i "${m3u8Url}" -c copy "${outputPath}"`;

  exec(ffmpegCommand, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: 'FFmpeg failed', details: stderr });
    }

    const link = `${req.protocol}://${req.get('host')}/${id}.mp4`;
    res.json({
      status: 'ready',
      expires_in: '15 minutes',
      download: link
    });
  });
});

// 🟢 Start server
app.listen(PORT, () => {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);
  console.log(`🟢 API running at http://localhost:${PORT}`);
});
