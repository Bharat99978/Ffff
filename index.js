const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let ffmpeg = null;
let logs = '';

// Start streaming
app.post('/start', (req, res) => {
  const { streamKey, videoUrl, orientation } = req.body;
  if (!streamKey || !videoUrl) {
    return res.status(400).send('Stream key and video URL are required.');
  }

  if (ffmpeg) {
    return res.status(400).send('Streaming is already running.');
  }

  const rtmpUrl = `rtmp://a.rtmp.youtube.com/live2/${streamKey}`;
  const ffmpegArgs = ['-re', '-stream_loop', '-1', '-i', videoUrl];

  // Video orientation
  if (orientation === 'transpose1') ffmpegArgs.push('-vf', 'transpose=1');
  if (orientation === 'transpose2') ffmpegArgs.push('-vf', 'transpose=2');

  // Output options
  ffmpegArgs.push('-c', 'copy', '-f', 'flv', rtmpUrl);

  // Spawn FFmpeg process
  ffmpeg = spawn('ffmpeg', ffmpegArgs);

  // Logging
  ffmpeg.stdout.on('data', data => logs += `stdout: ${data}\n`);
  ffmpeg.stderr.on('data', data => logs += `stderr: ${data}\n`);
  ffmpeg.on('close', code => {
    logs += `FFmpeg exited with code ${code}\n`;
    ffmpeg = null;
  });

  res.send('Streaming started.');
});

// Stop streaming
app.post('/stop', (req, res) => {
  if (!ffmpeg) {
    return res.status(400).send('No stream is running.');
  }
  ffmpeg.kill('SIGINT');
  res.send('Streaming stopped.');
});

// Get logs
app.get('/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(logs);
});

// Health check
app.get('/', (req, res) => res.send('Server is running.'));

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
