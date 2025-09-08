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

// Download and convert function
async function downloadFormat(fmt, title) {
  return new Promise((resolve, reject) => {
    const quality = fmt.height ? `${fmt.height}p` : 'unknown';
    const safeTitle = sanitizeFilename(title);
    const outputPath = path.join(downloadsDir, `${safeTitle}_${quality}.mp4`);

    if (fmt.protocol === 'm3u8') {
      console.log(`🚀 Converting m3u8 → mp4: ${quality}`);
      const ffmpeg = spawn(ffmpegPath, ['-i', fmt.url, '-c', 'copy', '-y', outputPath]);

      ffmpeg.stdout.on('data', data => console.log(`ffmpeg stdout: ${data}`));
      ffmpeg.stderr.on('data', data => console.log(`ffmpeg stderr: ${data}`));

      ffmpeg.on('close', code => {
        if (code === 0) {
          console.log(`✅ Converted: ${outputPath}`);
          resolve({ quality, download: `/files/${encodeURIComponent(path.basename(outputPath))}` });
        } else {
          console.error(`❌ ffmpeg failed for ${quality} with code: ${code}`);
          resolve(null);
        }
      });
    } else {
      // For direct mp4 streams, download server-side
      console.log(`⬇️ Downloading direct mp4: ${quality}`);
      const file = fs.createWriteStream(outputPath);
      const https = require('https');
      https.get(fmt.url, response => {
        if (response.statusCode !== 200) {
          console.error(`❌ Failed to download ${quality}: ${response.statusCode}`);
          resolve(null);
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`✅ Downloaded: ${outputPath}`);
          resolve({ quality, download: `/files/${encodeURIComponent(path.basename(outputPath))}` });
        });
      }).on('error', err => {
        console.error(`❌ Download error for ${quality}: ${err}`);
        resolve(null);
      });
    }
  });
}

// API endpoint
app.get('/download', async (req, res) => {
  const url = req.query.url;
  if (!url || !url.includes('pornhub.com')) {
    return res.status(400).json({ error: 'Valid Pornhub video URL required' });
  }

  try {
    console.log(`🔍 Fetching info for: ${url}`);

    const info = await ytdlp(url, { dumpSingleJson: true, noCheckCertificates: true });
    const title = info.title || 'Unknown';

    const mp4Formats = info.formats.filter(f => f.ext === 'mp4' && f.vcodec !== 'none');
    if (mp4Formats.length === 0) return res.status(404).json({ error: 'No mp4 formats available!' });

    const results = [];
    for (let fmt of mp4Formats) {
      const result = await downloadFormat(fmt, title);
      if (result) results.push(result);
    }

    res.json({
      title,
      formats: results,
      note: 'All mp4 formats downloaded/converted server-side'
    });

  } catch (error) {
    console.error('❌ API error:', error);
    res.status(500).json({ error: `Failed to fetch or download video: ${error}` });
  }
});

// Serve downloaded files
app.use('/files', express.static(downloadsDir));

app.get('/', (req, res) => res.send('Pornhub Downloader API running!'));

app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
