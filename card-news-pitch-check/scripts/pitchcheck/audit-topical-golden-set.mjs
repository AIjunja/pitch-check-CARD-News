#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const valueAfter = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : fallback;
};
const bankPath = path.resolve(valueAfter('--bank', path.join(ROOT, 'samples/pitchcheck/topical-satire-golden-set-10.json')));
const outputRoot = path.resolve(valueAfter('--output', path.join(ROOT, 'projects/topical-satire-golden-set-10')));
const reportPath = path.resolve(valueAfter('--report', path.join(ROOT, 'docs/pitchcheck-topical-golden-set-audit.md')));
const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
const errors = [];
const rows = [];

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function dimensions(file) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', file], { encoding: 'utf8' });
  return result.stdout.trim();
}

const expectedCta = {
  6: sha256(path.join(ROOT, 'projects/asset-pilot-son-100/assets/pitchcheck/approved-cta/card-06-approved.png')),
  7: sha256(path.join(ROOT, 'projects/asset-pilot-son-100/assets/pitchcheck/approved-cta/card-07-approved.png')),
};
const contentHashes = [];
const mediaHashes = [];

if (bank.topics.length !== 10) errors.push(`Expected 10 topics, found ${bank.topics.length}`);
for (const topic of bank.topics) {
  const projectDir = path.join(outputRoot, topic.id);
  const outputDir = path.join(projectDir, 'output');
  const auditPath = path.join(projectDir, 'render-audit.json');
  if (!fs.existsSync(auditPath)) {
    errors.push(`${topic.id}: render audit missing`);
    continue;
  }
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  if (!audit.strictMedia) errors.push(`${topic.id}: strict media disabled`);
  if (audit.mediaAudit?.length !== 5) errors.push(`${topic.id}: expected five media audit rows`);
  for (const card of audit.mediaAudit || []) {
    if (card.visualReview !== 'pass') errors.push(`${topic.id} card ${card.card}: visual review is ${card.visualReview}`);
    if (card.layout?.body?.bottom + 12 > card.layout?.source?.top) errors.push(`${topic.id} card ${card.card}: copy overlaps footer`);
    mediaHashes.push(card.sha256);
  }

  let rendered = 0;
  for (let card = 1; card <= 7; card += 1) {
    const file = path.join(outputDir, `card-${String(card).padStart(2, '0')}.png`);
    if (!fs.existsSync(file)) {
      errors.push(`${topic.id} card ${card}: output missing`);
      continue;
    }
    rendered += 1;
    if (dimensions(file) !== '1080x1350') errors.push(`${topic.id} card ${card}: wrong dimensions ${dimensions(file)}`);
    if (fs.statSync(file).size < 50_000) errors.push(`${topic.id} card ${card}: suspiciously small file`);
    const digest = sha256(file);
    if (card <= 5) contentHashes.push(digest);
    if (card >= 6 && digest !== expectedCta[card]) errors.push(`${topic.id} card ${card}: approved CTA hash mismatch`);
  }
  if (!fs.existsSync(path.join(outputDir, 'contact-sheet.jpg'))) errors.push(`${topic.id}: contact sheet missing`);
  rows.push(`| ${topic.id} | ${rendered}/7 | ${audit.mediaAudit?.filter((card) => card.visualReview === 'pass').length || 0}/5 | pass |`);
}

if (new Set(contentHashes).size !== 50) errors.push(`Rendered content duplicate: ${contentHashes.length} cards, ${new Set(contentHashes).size} unique`);
if (new Set(mediaHashes).size !== 50) errors.push(`Source media duplicate: ${mediaHashes.length} cards, ${new Set(mediaHashes).size} unique`);

const report = [
  '# PitchCheck Topical Golden Set Audit',
  '',
  `- Generated: ${new Date().toISOString()}`,
  `- Stories: ${bank.topics.length}`,
  `- Rendered cards: ${contentHashes.length + bank.topics.length * 2}`,
  `- Unique content renders: ${new Set(contentHashes).size}/50`,
  `- Unique source frames: ${new Set(mediaHashes).size}/50`,
  `- Errors: ${errors.length}`,
  '',
  '| Topic | Cards | Reviewed media | Result |',
  '| --- | ---: | ---: | --- |',
  ...rows,
  '',
  ...(errors.length ? ['## Errors', '', ...errors.map((error) => `- ${error}`), ''] : ['All strict render, dimension, CTA hash, layout, and duplicate checks passed.', '']),
].join('\n');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${report}\n`);

if (errors.length) throw new Error(errors.join('\n'));
console.log('topical golden set audit passed: 70 cards, 50 unique reviewed media frames');
