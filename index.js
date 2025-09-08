const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');

const ytdlp = require('yt-dlp-exec'); // npm i yt-dlp-exec

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);

app.get('/download', async (req, res) => {
  const url = req.query.url;
  if (!url || !url.includes('pornhub.com')) {
    return res.status(400).json({ error: 'Valid Pornhub video URL required' });
  }

  try {
    console.log(`🔍 Fetching info for: ${url}`);

    // Get video info in JSON
    const info = await ytdlp(url, { dumpSingleJson: true, noCheckCertificates: true });
    const title = info.title || 'Unknown';
    const safeTitle = title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    const outputPath = path.join(downloadsDir, `${safeTitle}.mp4`);

    // Find mp4 or fallback to m3u8
    let bestFormat = info.formats.find(f => f.ext === 'mp4' && f.vcodec !== 'none');
    if (!bestFormat) {
      bestFormat = info.formats.find(f => f.protocol === 'm3u8');
    }

    if (!bestFormat) {
      return res.status(404).json({ error: 'No suitable format found!' });
    }

    const formatUrl = bestFormat.url;
    console.log(`🎯 Selected format: ${bestFormat.ext || 'm3u8'} | ${bestFormat.height || 'N/A'}p`);

    if (bestFormat.protocol === 'm3u8') {
      console.log('🚀 Starting ffmpeg conversion...');
      const ffmpeg = require('child_process').spawn(ffmpegPath, [
        '-i', formatUrl,
        '-c', 'copy',
        '-y',
        outputPath
      ]);

      ffmpeg.stdout.on('data', data => console.log(`ffmpeg stdout: ${data}`));
      ffmpeg.stderr.on('data', data => console.log(`ffmpeg stderr: ${data}`));

      ffmpeg.on('close', code => {
        if (code === 0) {
          console.log('✅ Conversion completed:', outputPath);
          const downloadUrl = `${req.protocol}://${req.get('host')}/files/${encodeURIComponent(path.basename(outputPath))}`;
          res.json({ title, download: downloadUrl, note: 'Converted from m3u8 → mp4' });
        } else {
          console.error('❌ ffmpeg failed with code:', code);
          res.status(500).json({ error: 'ffmpeg failed to convert m3u8' });
        }
      });
    } else {
      console.log('⚡ Direct mp4 stream found, no conversion needed.');
      res.json({ title, direct_url: formatUrl, note: 'Direct mp4 stream (no conversion needed)' });
    }

  } catch (error) {
    console.error('❌ API error:', error);
    res.status(500).json({ error: `Failed to fetch video info: ${error}` });
  }
});

app.use('/files', express.static(downloadsDir));
app.get('/', (req, res) => res.send('Pornhub Downloader API is running!'));

app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
