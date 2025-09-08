const express = require('express');
const cors = require('cors');
const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');
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

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);

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
    const safeTitle = title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    const outputPath = path.join(downloadsDir, `${safeTitle}.mp4`);

    // find best format (prefer mp4, fallback to m3u8)
    let bestFormat = videoInfo.formats.find(f => f.ext === 'mp4' && f.vcodec !== 'none');
    if (!bestFormat) {
      bestFormat = videoInfo.formats.find(f => f.protocol === 'm3u8');
    }

    if (!bestFormat) {
      return res.status(404).json({ error: 'No suitable format found!' });
    }

    const formatUrl = bestFormat.url;

    // If .m3u8 -> convert with ffmpeg
    if (bestFormat.protocol === 'm3u8') {
      const ffmpeg = spawn('ffmpeg', ['-i', formatUrl, '-c', 'copy', outputPath]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          const downloadUrl = `${req.protocol}://${req.get('host')}/files/${encodeURIComponent(path.basename(outputPath))}`;
          res.json({
            title,
            download: downloadUrl,
            note: 'Converted from m3u8 → mp4'
          });
        } else {
          res.status(500).json({ error: 'ffmpeg failed to convert m3u8' });
        }
      });
    } else {
      // If mp4 already → just return direct url
      res.json({
        title,
        direct_url: formatUrl,
        note: 'Direct mp4 stream (no conversion needed)'
      });
    }
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch video info: ${error.message}` });
  }
});

app.use('/files', express.static(downloadsDir));

app.get('/', (req, res) => res.send('Pornhub Downloader API is running!'));

// Start server after ensuring binary
async function startServer() {
  await ensureBinary();
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer();
