#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bank = JSON.parse(fs.readFileSync(path.join(ROOT, 'samples/pitchcheck/complete-story-bank-170.json'), 'utf8'));
const media = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/reference/web/complete-media-170.json'), 'utf8'));
const outputRoot = path.join(ROOT, 'projects/complete-story-bank-170');
const approvedRoot = path.join(ROOT, 'projects/topical-satire-golden-set-10');
const reportPath = path.join(ROOT, 'docs/pitchcheck-complete-170-audit.md');
const reviewRoot = path.join(outputRoot, '_review-sheets');
const errors = [];
const rows = [];
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function pngSize(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const expectedCta = {
  6: sha256(path.join(ROOT, 'projects/asset-pilot-son-100/assets/pitchcheck/approved-cta/card-06-approved.png')),
  7: sha256(path.join(ROOT, 'projects/asset-pilot-son-100/assets/pitchcheck/approved-cta/card-07-approved.png')),
};
const contentHashes = [];
const mediaHashes = [];
let approvedPixelMatches = 0;

if (bank.topics.length !== 170) errors.push(`Expected 170 topics, found ${bank.topics.length}`);
if (media.totals?.cards !== 850 || media.totals?.gaps !== 0) errors.push(`Media manifest incomplete: ${JSON.stringify(media.totals)}`);

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
    const size = pngSize(file);
    if (!size || size.width !== 1080 || size.height !== 1350) errors.push(`${topic.id} card ${card}: wrong dimensions ${JSON.stringify(size)}`);
    if (fs.statSync(file).size < 50_000) errors.push(`${topic.id} card ${card}: suspiciously small file`);
    const digest = sha256(file);
    if (card <= 5) contentHashes.push(digest);
    if (card >= 6 && digest !== expectedCta[card]) errors.push(`${topic.id} card ${card}: approved CTA hash mismatch`);
    if (topic.productionTier === 'approved-golden-set') {
      const approved = path.join(approvedRoot, topic.id, 'output', `card-${String(card).padStart(2, '0')}.png`);
      if (!fs.existsSync(approved) || digest !== sha256(approved)) errors.push(`${topic.id} card ${card}: approved golden render changed`);
      else approvedPixelMatches += 1;
    }
  }
  if (!fs.existsSync(path.join(outputDir, 'contact-sheet.jpg'))) errors.push(`${topic.id}: contact sheet missing`);
  rows.push(`| ${topic.id} | ${rendered}/7 | ${audit.mediaAudit?.length || 0}/5 | ${topic.productionTier} |`);
}

if (new Set(contentHashes).size !== 850) errors.push(`Rendered content duplicate: ${contentHashes.length} cards, ${new Set(contentHashes).size} unique`);
if (new Set(mediaHashes).size !== 850) errors.push(`Source media duplicate: ${mediaHashes.length} cards, ${new Set(mediaHashes).size} unique`);
if (approvedPixelMatches !== 70) errors.push(`Approved pixel matches: ${approvedPixelMatches}/70`);

fs.mkdirSync(reviewRoot, { recursive: true });
for (let offset = 0; offset < bank.topics.length; offset += 10) {
  const batch = bank.topics.slice(offset, offset + 10);
  const inputs = batch.flatMap((topic) => ['-i', path.join(outputRoot, topic.id, 'output/contact-sheet.jpg')]);
  const scales = batch.map((_, index) => `[${index}:v]scale=540:338[s${index}]`).join(';');
  const pads = Array.from({ length: 10 - batch.length }, (_, index) => `color=c=#050706:s=540x338[p${index}]`).join(';');
  const labels = [
    ...batch.map((_, index) => `[s${index}]`),
    ...Array.from({ length: 10 - batch.length }, (_, index) => `[p${index}]`),
  ].join('');
  const filter = `${scales}${pads ? `;${pads}` : ''};${labels}xstack=inputs=10:layout=0_0|540_0|0_338|540_338|0_676|540_676|0_1014|540_1014|0_1352|540_1352[out]`;
  const target = path.join(reviewRoot, `review-${String(offset + 1).padStart(3, '0')}-${String(offset + batch.length).padStart(3, '0')}.jpg`);
  const result = spawnSync('ffmpeg', ['-y', ...inputs, '-filter_complex', filter, '-map', '[out]', '-frames:v', '1', '-update', '1', target], { stdio: 'ignore', timeout: 120000 });
  if (result.status !== 0) errors.push(`Review sheet failed: ${path.basename(target)}`);
}

const report = [
  '# PitchCheck Complete 170 Audit',
  '',
  `- Generated: ${new Date().toISOString()}`,
  `- Stories: ${bank.topics.length}`,
  `- Rendered cards: ${contentHashes.length + bank.topics.length * 2}`,
  `- Unique content renders: ${new Set(contentHashes).size}/850`,
  `- Unique source media: ${new Set(mediaHashes).size}/850`,
  `- Approved golden pixel matches: ${approvedPixelMatches}/70`,
  `- Review sheets: ${Math.ceil(bank.topics.length / 10)}`,
  `- Errors: ${errors.length}`,
  '',
  '| Topic | Cards | Media | Tier |',
  '| --- | ---: | ---: | --- |',
  ...rows,
  '',
  ...(errors.length ? ['## Errors', '', ...errors.map((error) => `- ${error}`)] : ['All strict media, render, CTA, dimensions, layout, duplicate, and approved-golden checks passed.']),
].join('\n');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${report}\n`, 'utf8');
if (errors.length) throw new Error(errors.join('\n'));
console.log('complete 170 audit passed: 1190 cards, 850 unique media, 70 approved pixels matched');
