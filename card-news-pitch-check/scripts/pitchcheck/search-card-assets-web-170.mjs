#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bank = JSON.parse(fs.readFileSync(path.join(ROOT, 'samples/pitchcheck/real-player-story-bank-grounded-170.json'), 'utf8'));
const outRoot = path.join(ROOT, 'assets/reference/web/real-player-card-web-search-170');
const args = process.argv.slice(2);
const after = (flag, fallback) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fallback; };
const offset = Number(after('--offset', 0));
const limit = Number(after('--limit', bank.topics.length));
const concurrency = Number(after('--concurrency', 4));
const topicArg = after('--topic', null);
const topicsFile = after('--topics-file', null);
const gapsFile = after('--gaps-file', null);
const alternatePass = Number(after('--alternate-pass', 0));
const gapRows = gapsFile ? JSON.parse(fs.readFileSync(path.resolve(gapsFile), 'utf8')) : [];
const gapCardsByTopic = new Map();
for (const gap of gapRows) {
  if (!gapCardsByTopic.has(gap.topicId)) gapCardsByTopic.set(gap.topicId, new Set());
  gapCardsByTopic.get(gap.topicId).add(Number(gap.card));
}
const requestedIds = topicsFile
  ? new Set(JSON.parse(fs.readFileSync(path.resolve(topicsFile), 'utf8')))
  : gapsFile
    ? new Set(JSON.parse(fs.readFileSync(path.resolve(gapsFile), 'utf8')).map((gap) => gap.topicId))
    : null;
const selected = requestedIds
  ? bank.topics.filter((topic) => requestedIds.has(topic.id))
  : topicArg ? bank.topics.filter((topic) => topic.id === topicArg) : bank.topics.slice(offset, offset + limit);
fs.mkdirSync(outRoot, { recursive: true });
const badUrl = /pinterest|pinimg|alamy|dreamstime|shutterstock|depositphotos|wallpaper|logo|icon|badge|jersey|shirt|kit|product|amazon|ebay|game|efootball|fifa\d|fc\d/i;

function decodeHtml(value) {
  return String(value || '').replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&#39;', "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function eventBase(topic) {
  const idTerms = topic.id.replace(/^[^-]+-\d+-?/, '').split('-').filter((word) => word.length > 2);
  const ranked = (topic.imageQueries || []).map((query, index) => ({ query, score: idTerms.filter((term) => query.toLowerCase().includes(term)).length * 4 + ((query.match(/\d+/g) || []).length * 5) + (index >= 3 ? 2 : 0) })).sort((a, b) => b.score - a.score);
  return ranked[0]?.query || `${topic.player} ${topic.category || ''}`;
}

function cardQueries(topic) {
  const base = eventBase(topic);
  return Array.from({ length: 5 }, (_, index) => {
    const plan = topic.assetSearch?.cardPlan?.[index] || {};
    const suffix = index === 0 ? 'key moment photo' : index === 1 ? 'match context archive' : index === 2 ? 'actual event photo' : index === 3 ? 'reaction celebration' : 'team fans emotion';
    return { card: index + 1, role: plan.role, need: plan.need, query: `${base} ${plan.need || ''} ${suffix}`.replace(/\s+/g, ' ').trim() };
  });
}

async function searchImages(query) {
  try {
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&qft=+filterui:imagesize-large&form=IRFLTR`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36' }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) return [];
    const html = await response.text();
    const results = [];
    for (const match of html.matchAll(/class="iusc"[^>]+m="([^"]+)"/g)) {
      try {
        const meta = JSON.parse(decodeHtml(match[1]));
        if (meta.murl && meta.purl && !badUrl.test(`${meta.murl} ${meta.purl} ${meta.t || ''}`)) results.push({ imageUrl: meta.murl, sourcePage: meta.purl, title: meta.t || '' });
      } catch {}
    }
    return results;
  } catch { return []; }
}

async function download(candidate) {
  try {
    const response = await fetch(candidate.imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 PitchCheck editorial research', Referer: candidate.sourcePage }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;
    const type = response.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 30000 || bytes.length > 15 * 1024 * 1024) return null;
    return { bytes, type, hash: crypto.createHash('sha256').update(bytes).digest('hex') };
  } catch { return null; }
}

async function processTopic(topic, position) {
  const dir = path.join(outRoot, topic.id);
  fs.mkdirSync(dir, { recursive: true });
  const hashes = new Set();
  const origins = new Set();
  const slots = [];
  for (const intent of cardQueries(topic)) {
    if (gapsFile && !gapCardsByTopic.get(topic.id)?.has(intent.card)) continue;
    const alternateSuffix = alternatePass === 1 ? 'news photograph archive'
      : alternatePass === 2 ? 'interview documentary still'
        : alternatePass === 3 ? 'team reaction celebration photograph'
          : alternatePass >= 4 ? ['match action wide shot', 'training archive', 'team huddle captain', 'stadium goal celebration', 'fans farewell tribute'][intent.card - 1] : '';
    const candidates = await searchImages(`${intent.query} ${alternateSuffix}`.trim());
    let slot = null;
    for (const candidate of candidates.slice(0, 20)) {
      if (origins.has(candidate.imageUrl)) continue;
      const image = await download(candidate);
      if (!image || hashes.has(image.hash)) continue;
      const ext = image.type.includes('png') ? '.png' : image.type.includes('webp') ? '.webp' : '.jpg';
      const suffix = alternatePass ? `-candidate-${String(alternatePass).padStart(2, '0')}` : '';
      const file = path.join(dir, `card-${String(intent.card).padStart(2, '0')}${suffix}${ext}`);
      fs.writeFileSync(file, image.bytes);
      hashes.add(image.hash); origins.add(candidate.imageUrl);
      slot = { ...intent, path: path.relative(ROOT, file).replace(/\\/g, '/'), imageUrl: candidate.imageUrl, sourcePage: candidate.sourcePage, title: candidate.title, hash: image.hash, status: 'visual-review-needed', rights: 'reference-only' };
      break;
    }
    slots.push(slot || { ...intent, path: null, status: 'research-needed' });
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), `${JSON.stringify({ topicId: topic.id, player: topic.player, hook: topic.hook, eventBase: eventBase(topic), slots }, null, 2)}\n`);
  console.log(`${position + 1}/${selected.length} ${topic.id} ${slots.filter((slot) => slot.path).length}/5`);
}

let cursor = 0;
async function worker() {
  while (cursor < selected.length) {
    const position = cursor++;
    await processTopic(selected[position], position);
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, worker));
