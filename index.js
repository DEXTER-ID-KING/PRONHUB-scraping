const express = require('express');
const cors = require('cors');
const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Initialize yt-dlp (needs yt-dlp binary)
const ytDlp = new YTDlpWrap();

app.use(cors());
app.use(express.json());

// API endpoint: /download?url=<pornhub_video_url>
app.get('/download', async (req, res) => {
    const url = req.query.url;
    if (!url || !url.includes('pornhub.com')) {
        return res.status(400).json({ error: 'Valid Pornhub video URL required' });
    }

    try {
        // yt-dlp command to get video info (no download)
        const videoInfo = await ytDlp.getVideoInfo(url);
        
        // Extract useful data
        const title = videoInfo.title || 'Unknown';
        const duration = videoInfo.duration || 0;
        const thumbnail = videoInfo.thumbnail || '';
        
        // Filter MP4 formats
        const formats = videoInfo.formats
            .filter(f => f.ext === 'mp4' && f.vcodec !== 'none')
            .map(f => ({
                quality: `${f.height || 'unknown'}p`,
                url: f.url || '',
                filesize: f.filesize || 0
            }))
            .sort((a, b) => parseInt(b.quality) - parseInt(a.quality)); // Best quality first

        res.json({
            title,
            duration_seconds: duration,
            thumbnail,
            formats: formats.slice(0, 5) // Top 5 qualities
        });
    } catch (error) {
        res.status(500).json({ error: `Failed to fetch video info: ${error.message}` });
    }
});

// Health check endpoint
app.get('/', (req, res) => res.send('Pornhub Downloader API is running!'));

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
