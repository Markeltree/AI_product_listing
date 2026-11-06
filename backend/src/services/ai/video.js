// Pulls evenly spaced key frames from a product video with ffmpeg, so the vision model can look at them.
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { config } from '../../config/index.js';
import { MAX_FRAMES } from '../../config/constants.js';

const exec = promisify(execFile);
const EXEC_OPTS = { maxBuffer: 16 * 1024 * 1024, windowsHide: true };

async function probeDuration(videoPath) {
  const { stdout } = await exec(config.ffprobe, [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', videoPath,
  ], EXEC_OPTS);
  const duration = parseFloat(stdout);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

// Videos recorded in the browser (MediaRecorder WEBM) often have no duration in their header,
// so ffprobe reports N/A. Reading the whole stream once gives the real length.
async function decodeDuration(videoPath) {
  const { stderr } = await exec(config.ffmpeg, [
    '-hide_banner', '-nostats', '-i', videoPath, '-map', '0:v:0', '-c', 'copy', '-f', 'null', '-',
  ], EXEC_OPTS).catch((err) => ({ stderr: err.stderr || '' }));
  const matches = [...String(stderr).matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
  if (!matches.length) return 0;
  const [, h, m, s] = matches[matches.length - 1];
  const duration = Number(h) * 3600 + Number(m) * 60 + Number(s);
  return duration > 0 ? duration : 0;
}

async function videoDuration(videoPath) {
  return (await probeDuration(videoPath).catch(() => 0)) || decodeDuration(videoPath);
}

async function grabFrame(videoPath, seconds, out, { width = 960, quality = 4 } = {}) {
  await exec(config.ffmpeg, [
    '-y', '-loglevel', 'error', '-ss', seconds.toFixed(2), '-i', videoPath,
    '-frames:v', '1', ...(width ? ['-vf', `scale=${width}:-2`] : []), '-q:v', String(quality), out,
  ], EXEC_OPTS);
  const stat = await fs.stat(out).catch(() => null);
  return Boolean(stat?.size);
}

// A listing photo: the frame at full video size.
export const grabFullFrame = (videoPath, seconds, out) => grabFrame(videoPath, seconds, out, { width: 0, quality: 2 });

// Frames spread across a haul video, small enough to send many to the AI. Returns [{ path, seconds }].
export async function sampleVideoFrames(videoPath, outDir, count) {
  await fs.mkdir(outDir, { recursive: true });
  const duration = await videoDuration(videoPath);
  const times = duration ? Array.from({ length: count }, (_, i) => (duration * (i + 0.5)) / count) : [0];
  const frames = [];
  for (const [i, seconds] of times.entries()) {
    const out = path.join(outDir, `sample-${i + 1}.jpg`);
    if (await grabFrame(videoPath, seconds, out, { width: 720, quality: 5 }).catch(() => false)) frames.push({ path: out, seconds });
  }
  return frames;
}

// The video's sound as a small MP3 for transcription. Returns null if the video has no sound.
export async function extractAudio(videoPath, out) {
  await exec(config.ffmpeg, ['-y', '-loglevel', 'error', '-i', videoPath, '-vn', '-ac', '1', '-b:a', '48k', out], EXEC_OPTS);
  const stat = await fs.stat(out).catch(() => null);
  return stat?.size ? out : null;
}

// Returns the paths of the written JPG frames. Throws if ffmpeg is missing; returns [] if the
// video has no readable frames.
export async function extractVideoFrames(videoPath, outDir, count = MAX_FRAMES) {
  await fs.mkdir(outDir, { recursive: true });
  const duration = await videoDuration(videoPath);
  // Unknown length: still try the first frame, which is better than nothing.
  const times = duration
    ? Array.from({ length: count }, (_, i) => (duration * (i + 0.5)) / count)
    : [0];
  const frames = [];
  for (const [i, seconds] of times.entries()) {
    const out = path.join(outDir, `frame-${i + 1}.jpg`);
    if (await grabFrame(videoPath, seconds, out)) frames.push(out);
  }
  return frames;
}
