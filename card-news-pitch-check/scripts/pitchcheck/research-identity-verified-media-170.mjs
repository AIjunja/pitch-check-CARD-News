#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bank = JSON.parse(fs.readFileSync(path.join(ROOT, 'samples/pitchcheck/complete-story-bank-170.json'), 'utf8'));
const approved = new Set(bank.topics.filter((topic) => topic.productionTier === 'approved-golden-set').map((topic) => topic.id));
const outRoot = path.join(ROOT, 'assets/reference/web/identity-verified-media-170');
const args = process.argv.slice(2);
const after = (flag, fallback) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : fallback; };
const concurrency = Number(after('--concurrency', 6));
const topicArg = after('--topic', null);
const selected = topicArg ? bank.topics.filter((topic) => topic.id === topicArg) : bank.topics.filter((topic) => !approved.has(topic.id));
const usedHashes = new Set();
const commonSingleNames = new Set(['son', 'park', 'lee', 'kim', 'ji', 'hwang', 'hunt', 'davies', 'kerr', 'marta', 'nani', 'pele', 'honda', 'kubo', 'nakata']);
const stop = new Set('the a an and or of to in on for with from at by is was are were football soccer official highlights interview story player match goal moment card actual source'.split(' '));
const tokens = (value) => String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((word) => word.length > 1 && !stop.has(word));
const normalized = (value) => tokens(value).join(' ');
const eventTerms = (topic) => [...new Set(tokens(`${topic.id.replace(/^[^-]+-\d+-?/, '')} ${(topic.imageQueries || []).join(' ')}`))].slice(0, 16);

function identityMatch(topic, entry) {
  const haystack = normalized(`${entry.title || ''} ${entry.description || ''} ${entry.channel || entry.uploader || ''}`);
  const nameTokens = tokens(topic.player);
  const full = nameTokens.join(' ');
  const reverse = [...nameTokens].reverse().join(' ');
  const surname = nameTokens.at(-1);
  const footballContext = /football|soccer|fifa|uefa|goal|match|league|cup|fc\b|united|city|barcelona|madrid|tottenham|arsenal|liverpool|chelsea|bayern|psg|brazil|argentina|portugal|korea|japan|england|spain|italy|france/i.test(`${entry.title} ${entry.description} ${entry.channel}`);
  if (nameTokens.length === 1) return haystack.includes(nameTokens[0]) && footballContext;
  if (haystack.includes(full) || haystack.includes(reverse)) return true;
  const allTokens = nameTokens.every((token) => haystack.includes(token));
  if (allTokens) return true;
  return !commonSingleNames.has(surname) && surname.length >= 5 && haystack.includes(surname) && footballContext;
}

function eventQuery(topic) {
  const slug = topic.id.replace(/^[^-]+-\d+-?/, '').replaceAll('-', ' ');
  return `"${topic.player}" ${slug} football`;
}

async function search(query, count = 30) {
  try {
    const { stdout } = await execFileAsync('yt-dlp', ['--flat-playlist', '--dump-single-json', '--playlist-end', String(count), `ytsearch${count}:${query}`], { timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
    return JSON.parse(stdout).entries || [];
  } catch {
    return [];
  }
}

function rank(topic, entries) {
  const terms = eventTerms(topic);
  return entries.filter((entry) => entry?.id && entry?.title && identityMatch(topic, entry)).map((entry) => {
    const haystack = normalized(`${entry.title} ${entry.description || ''} ${entry.channel || entry.uploader || ''}`);
    const overlap = terms.filter((term) => haystack.includes(term));
    let score = overlap.length * 8;
    if (/fifa|uefa|premier league|bbc|sky sports|espn|official|fc\b|united|city|barcelona|madrid|tottenham|arsenal|liverpool|chelsea|bayern|psg/i.test(`${entry.channel} ${entry.title}`)) score += 12;
    if (/gameplay|efootball|ea fc|pes 20|football manager|reaction channel/i.test(entry.title || '')) score -= 40;
    return { entry, score, overlap };
  }).filter((candidate) => candidate.score > -20).sort((a, b) => b.score - a.score);
}

async function thumbnail(entry) {
  try {
    const url = `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 PitchCheck editorial research' }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 12_000) return null;
    return { url, bytes, hash: crypto.createHash('sha256').update(bytes).digest('hex') };
  } catch {
    return null;
  }
}

async function processTopic(topic, position) {
  const primary = await search(eventQuery(topic));
  const secondary = await search(`"${topic.player}" football documentary interview highlights career`, 60);
  const preliminary = new Map([...primary, ...secondary].filter((entry) => entry?.id).map((entry) => [entry.id, entry]));
  const tertiary = rank(topic, [...preliminary.values()]).length >= 10
    ? []
    : await search(`"${topic.player}" club national team football`, 60);
  const byId = new Map([...preliminary.values(), ...tertiary].filter((entry) => entry?.id).map((entry) => [entry.id, entry]));
  const ranked = rank(topic, [...byId.values()]);
  const dir = path.join(outRoot, topic.id);
  fs.mkdirSync(dir, { recursive: true });
  const slots = [];
  for (const candidate of ranked) {
    if (slots.length >= 5) break;
    const image = await thumbnail(candidate.entry);
    if (!image || usedHashes.has(image.hash)) continue;
    usedHashes.add(image.hash);
    const card = slots.length + 1;
    const file = path.join(dir, `card-${String(card).padStart(2, '0')}.jpg`);
    fs.writeFileSync(file, image.bytes);
    slots.push({
      card,
      path: path.relative(ROOT, file).replaceAll('\\', '/'),
      sha256: image.hash,
      sourceUrl: `https://www.youtube.com/watch?v=${candidate.entry.id}`,
      sourceTitle: candidate.entry.title,
      sourceChannel: candidate.entry.channel || candidate.entry.uploader || null,
      matchedEventTerms: candidate.overlap,
      identityVerified: true,
      status: 'identity-verified',
      rights: 'reference-only',
    });
  }
  const manifest = { topicId: topic.id, player: topic.player, query: eventQuery(topic), slots, status: slots.length === 5 ? 'ready' : 'needs-research' };
  fs.writeFileSync(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`${position + 1}/${selected.length} ${topic.id} ${slots.length}/5`);
}

fs.mkdirSync(outRoot, { recursive: true });
let cursor = 0;
async function worker() {
  while (cursor < selected.length) {
    const position = cursor++;
    await processTopic(selected[position], position);
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, worker));

const manifests = selected.map((topic) => JSON.parse(fs.readFileSync(path.join(outRoot, topic.id, 'manifest.json'), 'utf8')));
const summary = {
  generatedAt: new Date().toISOString(),
  topics: manifests.length,
  ready: manifests.filter((manifest) => manifest.status === 'ready').length,
  cards: manifests.reduce((sum, manifest) => sum + manifest.slots.length, 0),
  gaps: manifests.flatMap((manifest) => Array.from({ length: 5 - manifest.slots.length }, (_, index) => ({ topicId: manifest.topicId, card: manifest.slots.length + index + 1 }))),
};
fs.writeFileSync(path.join(outRoot, 'index.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ topics: summary.topics, ready: summary.ready, cards: summary.cards, gaps: summary.gaps.length }, null, 2));
