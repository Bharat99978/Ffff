const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let ffmpeg = null;
let logs = '';

app.post('/start', (req, res) => {
  const { streamKey, videoUrl, orientation } = req.body;
  if (!streamKey || !videoUrl) return res.send('Stream key and video URL are required.');

  if (ffmpeg) return res.send('Streaming is already running.');

  const rtmpUrl = `rtmp://a.rtmp.youtube.com/live2/${streamKey}`;
  const ffmpegArgs = ['-re', '-stream_loop', '-1', '-i', videoUrl];

  if (orientation === 'transpose1') ffmpegArgs.push('-vf', 'transpose=1');
  if (orientation === 'transpose2') ffmpegArgs.push('-vf', 'transpose=2');

  ffmpegArgs.push('-c', 'copy', '-f', 'flv', rtmpUrl);

  ffmpeg = spawn('ffmpeg', ffmpegArgs);

  ffmpeg.stdout.on('data', data => logs += `stdout: ${data}\n`);
  ffmpeg.stderr.on('data', data => logs += `stderr: ${data}\n`);
  ffmpeg.on('close', code => {
    logs += `FFmpeg exited with code ${code}\n`;
    ffmpeg = null;
  });

  res.send('Streaming started.');
});

app.post('/stop', (req, res) => {
  if (!ffmpeg) return res.send('No stream is running.');
  ffmpeg.kill('SIGINT');
  res.send('Streaming stopped.');
});

app.get('/logs', (req, res) => {
  res.send(logs);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
