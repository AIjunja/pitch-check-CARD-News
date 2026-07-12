#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const planPath = path.join(ROOT, 'assets/reference/web/topical-satire-golden-set-10/video-source-plan.json');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const args = process.argv.slice(2);
const topicIndex = args.indexOf('--topic');
const requestedTopic = topicIndex >= 0 ? args[topicIndex + 1] : null;
const selected = requestedTopic ? plan.topics.filter((item) => item.topicId === requestedTopic) : plan.topics;
const outputRoot = path.join(ROOT, 'assets/reference/web/topical-satire-golden-set-10/candidates');
fs.mkdirSync(outputRoot, { recursive: true });

function run(command, commandArgs, timeout = 180000) {
  return spawnSync(command, commandArgs, { encoding: 'utf8', timeout });
}

function durationOf(file) {
  const probe = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  return Math.max(1, Number(probe.stdout.trim()) || 1);
}

for (const [topicIndexValue, topic] of selected.entries()) {
  const topicDir = path.join(outputRoot, topic.topicId);
  fs.mkdirSync(topicDir, { recursive: true });
  const sources = [];

  for (const role of ['historical', 'current']) {
    const source = topic[role];
    const videoFile = path.join(topicDir, `${role}.mp4`);
    if (!fs.existsSync(videoFile)) {
      const result = run('yt-dlp', [
        '--no-update', '--no-playlist', '--download-sections', '*0-240', '--force-keyframes-at-cuts',
        '-f', 'best[height<=480]/best', '--merge-output-format', 'mp4', '-o', videoFile,
        `https://www.youtube.com/watch?v=${source.videoId}`,
      ], 240000);
      if (result.status !== 0 || !fs.existsSync(videoFile)) {
        sources.push({ role, ...source, status: 'download-failed', error: result.stderr?.slice(-500) || '' });
        continue;
      }
    }

    const duration = durationOf(videoFile);
    const sheetFile = path.join(topicDir, `${role}-contact.jpg`);
    const interval = Math.max(1, duration / 20);
    const sheet = run('ffmpeg', [
      '-y', '-i', videoFile,
      '-vf', `fps=1/${interval.toFixed(3)},scale=300:-2,drawtext=text='%{pts\\:hms}':x=8:y=8:fontsize=22:fontcolor=white:borderw=3:bordercolor=black,tile=5x4:padding=4:margin=4`,
      '-frames:v', '1', '-q:v', '2', sheetFile,
    ], 120000);
    sources.push({
      role,
      ...source,
      url: `https://www.youtube.com/watch?v=${source.videoId}`,
      status: sheet.status === 0 && fs.existsSync(sheetFile) ? 'ready' : 'contact-failed',
      duration,
      videoPath: path.relative(ROOT, videoFile).replaceAll('\\', '/'),
      contactPath: path.relative(ROOT, sheetFile).replaceAll('\\', '/'),
    });
  }

  fs.writeFileSync(path.join(topicDir, 'candidate-manifest.json'), `${JSON.stringify({ topicId: topic.topicId, sources }, null, 2)}\n`);
  console.log(`${topicIndexValue + 1}/${selected.length} ${topic.topicId} ${sources.map((item) => `${item.role}:${item.status}`).join(' ')}`);
}
