const express = require('express');
const cors = require('cors');
const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const os = require('os');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

// Auto-download yt-dlp binary
async function ensureBinary() {
  const binaryPath = path.join(__dirname, 'yt-dlp' + (os.platform() === 'win32' ? '.exe' : ''));
  if (!fs.existsSync(binaryPath)) {
    console.log('Downloading yt-dlp binary...');
    await YTDlpWrap.downloadFromGithub(binaryPath);
    console.log('yt-dlp binary downloaded!');
  }
  return binaryPath;
}

app.use(cors());
app.use(express.json());

// API endpoint
app.get('/download', async (req, res) => {
  const url = req.query.url;
  if (!url || !url.includes('pornhub.com')) {
    return res.status(400).json({ error: 'Valid Pornhub video URL required' });
  }

  try {
    const binaryPath = await ensureBinary();
    const ytDlp = new YTDlpWrap(binaryPath);

    const videoInfo = await ytDlp.getVideoInfo(url);
    
    const title = videoInfo.title || 'Unknown';
    const duration = videoInfo.duration || 0;
    const thumbnail = videoInfo.thumbnail || '';
    
    const formats = videoInfo.formats
      .filter(f => f.ext === 'mp4' && f.vcodec !== 'none')
      .map(f => ({
        quality: `${f.height || 'unknown'}p`,
        url: f.url || '',
        filesize: f.filesize || 0
      }))
      .sort((a, b) => parseInt(b.quality) - parseInt(a.quality));

    res.json({
      title,
      duration_seconds: duration,
      thumbnail,
      formats: formats.slice(0, 5)
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch video info: ${error.message}` });
  }
});

app.get('/', (req, res) => res.send('Pornhub Downloader API is running!'));

// Start server after ensuring binary
async function startServer() {
  await ensureBinary();
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer();
