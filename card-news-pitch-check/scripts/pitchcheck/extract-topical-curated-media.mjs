#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const base = path.join(ROOT, 'assets/reference/web/topical-satire-golden-set-10');
const sourcePlan = JSON.parse(fs.readFileSync(path.join(base, 'video-source-plan.json'), 'utf8'));
const mediaPlan = JSON.parse(fs.readFileSync(path.join(base, 'curated-media-plan.json'), 'utf8'));
const reviewPath = path.join(base, 'visual-review.json');
const review = fs.existsSync(reviewPath) ? JSON.parse(fs.readFileSync(reviewPath, 'utf8')) : { topics: [] };
const sourcesByTopic = new Map(sourcePlan.topics.map((item) => [item.topicId, item]));
const reviewByTopic = new Map(review.topics.map((item) => [item.topicId, item]));
const framesRoot = path.join(base, 'curated-frames');
fs.mkdirSync(framesRoot, { recursive: true });

function run(command, args, timeout = 120000) {
  return spawnSync(command, args, { encoding: 'utf8', timeout });
}

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function dimensions(file) {
  const result = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', file]);
  const [width, height] = result.stdout.trim().split('x').map(Number);
  return { width, height };
}

function durationOf(file) {
  const result = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  return Math.max(1, Number(result.stdout.trim()) || 1);
}

const output = { generatedAt: new Date().toISOString(), rights: mediaPlan.rights, topics: [] };

for (const [topicIndex, topic] of mediaPlan.topics.entries()) {
  const sources = sourcesByTopic.get(topic.topicId);
  const topicReview = reviewByTopic.get(topic.topicId);
  if (!sources) throw new Error(`Missing video sources: ${topic.topicId}`);
  const topicDir = path.join(framesRoot, topic.topicId);
  fs.mkdirSync(topicDir, { recursive: true });
  const cards = [];

  for (const card of topic.cards) {
    const source = sources[card.sourceRole];
    if (!source) throw new Error(`Missing ${card.sourceRole} source: ${topic.topicId}`);
    const videoPath = path.join(base, 'candidates', topic.topicId, `${card.sourceRole}.mp4`);
    if (!fs.existsSync(videoPath)) throw new Error(`Missing candidate video: ${videoPath}`);
    const framePath = path.join(topicDir, `card-${String(card.card).padStart(2, '0')}.jpg`);
    const interval = card.samplingInterval || durationOf(videoPath) / 20;
    const sampleIndex = card.samplingIndex ?? Math.round((card.timestamp - (card.samplingStart || 0)) / interval);
    const inputArgs = card.samplingStart ? ['-ss', String(card.samplingStart), '-i', videoPath] : ['-i', videoPath];
    const extract = run('ffmpeg', [
      '-y', ...inputArgs, '-vf', `fps=1/${interval},select=eq(n\\,${sampleIndex}),scale=1600:-2`,
      '-fps_mode', 'vfr', '-frames:v', '1', '-update', '1', '-q:v', '2', framePath,
    ]);
    if (extract.status !== 0 || !fs.existsSync(framePath)) throw new Error(`Frame extraction failed: ${topic.topicId} card ${card.card}`);
    cards.push({
      ...card,
      sourceUrl: `https://www.youtube.com/watch?v=${source.videoId}`,
      sourceTitle: source.title,
      sourceChannel: source.channel,
      path: path.relative(ROOT, framePath).replaceAll('\\', '/'),
      sha256: hash(framePath),
      ...dimensions(framePath),
      visualReview: topicReview?.status === 'pass' && topicReview.cards?.includes(card.card) ? 'pass' : 'pending',
    });
  }

  if (new Set(cards.map((card) => card.sha256)).size !== 5) throw new Error(`Duplicate frame in ${topic.topicId}`);
  output.topics.push({ topicId: topic.topicId, cards });
  console.log(`${topicIndex + 1}/${mediaPlan.topics.length} ${topic.topicId}`);
}

fs.writeFileSync(path.join(base, 'curated-media.json'), `${JSON.stringify(output, null, 2)}\n`);
