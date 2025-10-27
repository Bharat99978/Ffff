const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const os = require("os");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let ffmpeg = null;
let logs = "";
let fpsDropCount = 0;

/**
 * Start FFmpeg process
 */
function startFFmpeg(streamKey, videoUrl, orientation) {
  const rtmpUrl = `rtmp://a.rtmp.youtube.com/live2/${streamKey}`;

  // video filter chain
  let filters = ["fps=60", "format=yuv420p"];
  if (orientation === "transpose1") filters.unshift("transpose=1");
  if (orientation === "transpose2") filters.unshift("transpose=2");

  const ffmpegArgs = [
    "-re",
    "-i", videoUrl,
    "-vf", filters.join(","),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",
    "-b:v", "3500k",
    "-maxrate", "4000k",
    "-bufsize", "8000k",
    "-r", "60",
    "-g", "120",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
    "-ac", "2",
    "-f", "flv",
    rtmpUrl
  ];

  ffmpeg = spawn("ffmpeg", ffmpegArgs);
  logs += `\n🚀 FFmpeg started at ${new Date().toLocaleTimeString()}\n`;

  ffmpeg.stderr.on("data", (data) => {
    const line = data.toString();
    logs += line;
    const match = line.match(/fps=\s*([\d.]+)/);
    if (match) {
      const fps = parseFloat(match[1]);
      if (fps < 40) fpsDropCount++;
      else fpsDropCount = 0;
      if (fpsDropCount >= 5) {
        logs += "\n⚠️ FPS below 40 for 5 cycles — restarting...\n";
        restartFFmpeg(streamKey, videoUrl, orientation);
      }
    }
    if (logs.length > 25000) logs = logs.slice(-15000);
  });

  ffmpeg.on("close", (code) => {
    logs += `\n❌ FFmpeg exited with code ${code}\n`;
    ffmpeg = null;
  });
}

/**
 * Stop process safely
 */
function stopFFmpeg() {
  if (ffmpeg) {
    ffmpeg.kill("SIGKILL");
    logs += "\n🛑 Stream manually stopped\n";
    ffmpeg = null;
  }
}

/**
 * Restart with 5-second delay
 */
function restartFFmpeg(streamKey, videoUrl, orientation) {
  stopFFmpeg();
  setTimeout(() => startFFmpeg(streamKey, videoUrl, orientation), 5000);
}

/* ---------- ROUTES ---------- */
app.post("/start", (req, res) => {
  const { streamKey, videoUrl, orientation } = req.body;
  if (!streamKey || !videoUrl)
    return res.send("❌ Stream key and video URL required.");
  if (ffmpeg) return res.send("⚠️ Stream already running.");
  startFFmpeg(streamKey, videoUrl, orientation);
  res.send("✅ Streaming started.");
});

app.post("/stop", (_, res) => {
  stopFFmpeg();
  res.send("🛑 Streaming stopped.");
});

app.get("/logs", (_, res) => res.type("text/plain").send(logs));

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🧠 Detected ${os.cpus().length} CPU cores`);
});
