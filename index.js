const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const ytdlp = require('yt-dlp-exec'); // npm i yt-dlp-exec

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);

// Helper function to sanitize file names
function sanitizeFilename(name) {
  return name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
}

// API endpoint
app.get('/download', async (req, res) => {
  const url = req.query.url;
  if (!url || !url.includes('pornhub.com')) {
    return res.status(400).json({ error: 'Valid Pornhub video URL required' });
  }

  try {
    console.log(`🔍 Fetching info for: ${url}`);

    // Get video info
    const info = await ytdlp(url, { dumpSingleJson: true, noCheckCertificates: true });
    const title = info.title || 'Unknown';
    const safeTitle = sanitizeFilename(title);

    // Filter all mp4 formats (video only, ignore audio-only)
    const mp4Formats = info.formats.filter(f => f.ext === 'mp4' && f.vcodec !== 'none');

    if (mp4Formats.length === 0) {
      return res.status(404).json({ error: 'No mp4 formats available!' });
    }

    // Process all formats sequentially
    const results = [];

    for (let fmt of mp4Formats) {
      const quality = fmt.height ? `${fmt.height}p` : 'unknown';
      const outputPath = path.join(downloadsDir, `${safeTitle}_${quality}.mp4`);

      console.log(`🎯 Processing format: ${fmt.ext} | ${quality}`);

      if (fmt.protocol === 'm3u8') {
        console.log(`🚀 Converting m3u8 → mp4 for ${quality}`);
        await new Promise((resolve, reject) => {
          const ffmpeg = spawn(ffmpegPath, ['-i', fmt.url, '-c', 'copy', '-y', outputPath]);

          ffmpeg.stdout.on('data', data => console.log(`ffmpeg stdout: ${data}`));
          ffmpeg.stderr.on('data', data => console.log(`ffmpeg stderr: ${data}`));

          ffmpeg.on('close', code => {
            if (code === 0) {
              console.log(`✅ Conversion completed: ${outputPath}`);
              results.push({ quality, download: `/files/${encodeURIComponent(path.basename(outputPath))}` });
              resolve();
            } else {
              console.error(`❌ ffmpeg failed for ${quality} with code: ${code}`);
              resolve(); // skip this format but continue
            }
          });
        });
      } else {
        // Direct mp4 stream, just save link
        results.push({ quality, direct_url: fmt.url });
      }
    }

    res.json({
      title,
      formats: results,
      note: 'All available mp4 formats processed'
    });

  } catch (error) {
    console.error('❌ API error:', error);
    res.status(500).json({ error: `Failed to fetch video info: ${error}` });
  }
});

// Serve files
app.use('/files', express.static(downloadsDir));

app.get('/', (req, res) => res.send('Pornhub Downloader API running!'));

app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
