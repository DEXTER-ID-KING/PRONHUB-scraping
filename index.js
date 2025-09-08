const express = require('express');
const cors = require('cors');
const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);

// Function to get yt-dlp path
async function getYtDlpBinary() {
  try {
    if (process.env.YT_DLP_PATH) {
      console.log('Using yt-dlp from YT_DLP_PATH environment variable.');
      return process.env.YT_DLP_PATH;
    }

    const binaryPath = path.join(__dirname, 'yt-dlp' + (os.platform() === 'win32' ? '.exe' : ''));
    if (!fs.existsSync(binaryPath)) {
      console.log('📥 Attempting to download yt-dlp binary...');
      try {
        await YTDlpWrap.downloadFromGithub(binaryPath);
        console.log('✅ yt-dlp binary downloaded!');
      } catch (err) {
        console.warn('⚠️ yt-dlp download failed, continuing with system-installed yt-dlp if available.');
      }
    } else {
      console.log('✅ yt-dlp binary already exists.');
    }
    return binaryPath;
  } catch (err) {
    console.error('❌ Error getting yt-dlp binary:', err.message || err);
    return null; // fallback
  }
}

// API endpoint
app.get('/download', async (req, res) => {
  const url = req.query.url;
  if (!url || !url.includes('pornhub.com')) {
    return res.status(400).json({ error: 'Valid Pornhub video URL required' });
  }

  try {
    const ytDlpPath = await getYtDlpBinary();
    if (!ytDlpPath) {
      console.warn('⚠️ yt-dlp binary not available, using system yt-dlp if installed.');
    }

    const ytDlp = new YTDlpWrap(ytDlpPath || 'yt-dlp');

    console.log(`🔍 Fetching info for: ${url}`);
    const videoInfo = await ytDlp.getVideoInfo(url);

    const title = videoInfo.title || 'Unknown';
    const safeTitle = title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    const outputPath = path.join(downloadsDir, `${safeTitle}.mp4`);

    let bestFormat = videoInfo.formats.find(f => f.ext === 'mp4' && f.vcodec !== 'none');
    if (!bestFormat) {
      bestFormat = videoInfo.formats.find(f => f.protocol === 'm3u8');
    }

    if (!bestFormat) {
      console.error('⚠️ No suitable format found!');
      return res.status(404).json({ error: 'No suitable format found!' });
    }

    const formatUrl = bestFormat.url;
    console.log(`🎯 Selected format: ${bestFormat.ext || 'm3u8'} | ${bestFormat.height || 'N/A'}p`);

    // If .m3u8 -> convert with ffmpeg
    if (bestFormat.protocol === 'm3u8') {
      console.log('🚀 Starting ffmpeg conversion...');
      const ffmpeg = spawn(ffmpegPath, [
        '-i', formatUrl,
        '-c', 'copy',
        '-y',
        outputPath
      ]);

      ffmpeg.stdout.on('data', (data) => console.log(`ffmpeg stdout: ${data}`));
      ffmpeg.stderr.on('data', (data) => console.log(`ffmpeg stderr: ${data}`));

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Conversion completed:', outputPath);
          const downloadUrl = `${req.protocol}://${req.get('host')}/files/${encodeURIComponent(path.basename(outputPath))}`;
          res.json({
            title,
            download: downloadUrl,
            note: 'Converted from m3u8 → mp4'
          });
        } else {
          console.error('❌ ffmpeg failed with code:', code);
          res.status(500).json({ error: 'ffmpeg failed to convert m3u8' });
        }
      });
    } else {
      console.log('⚡ Direct mp4 stream found, no conversion needed.');
      res.json({
        title,
        direct_url: formatUrl,
        note: 'Direct mp4 stream (no conversion needed)'
      });
    }

  } catch (error) {
    console.error('❌ API error:', error.message || error);
    res.status(500).json({ error: `Failed to fetch video info: ${error.message || error}` });
  }
});

// Serve converted files
app.use('/files', express.static(downloadsDir));

app.get('/', (req, res) => res.send('Pornhub Downloader API is running!'));

// Start server
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
