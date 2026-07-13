#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { buildMediaIndex, parseRenderArgs, resolveCardMedia } from './lib/topical-render-inputs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const defaults = {
  bank: path.join(ROOT, 'samples/pitchcheck/topical-satire-golden-set-10.json'),
  media: path.join(ROOT, 'assets/reference/web/topical-satire-golden-set-10/curated-media.json'),
  output: path.join(ROOT, 'projects/topical-satire-golden-set-10'),
};
const options = parseRenderArgs(process.argv.slice(2), defaults);
for (const key of ['bank', 'media', 'output']) {
  if (!options[key]) throw new Error(`Missing --${key}`);
  options[key] = path.resolve(options[key]);
}

const bank = JSON.parse(fs.readFileSync(options.bank, 'utf8'));
const media = JSON.parse(fs.readFileSync(options.media, 'utf8'));
const mediaIndex = buildMediaIndex(media);
const args = process.argv.slice(2);
const numberAfter = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 ? Number(args[index + 1]) : fallback;
};
const offset = numberAfter('--offset', 0);
const limit = numberAfter('--limit', bank.topics.length);
const topics = (options.topic ? bank.topics.filter((topic) => topic.id === options.topic) : bank.topics).slice(offset, offset + limit);
if (!topics.length) throw new Error(`No topics selected${options.topic ? `: ${options.topic}` : ''}`);

const cta06 = path.join(ROOT, 'projects/asset-pilot-son-100/assets/pitchcheck/approved-cta/card-06-approved.png');
const cta07 = path.join(ROOT, 'projects/asset-pilot-son-100/assets/pitchcheck/approved-cta/card-07-approved.png');
const wordmark = path.join(ROOT, 'assets/brand/pitchcheck-wordmark-horizontal.png');
const fontBold = path.join(ROOT, 'assets/fonts/gmarket/GmarketSansTTFBold.ttf');
const fontMedium = path.join(ROOT, 'assets/fonts/gmarket/GmarketSansTTFMedium.ttf');
for (const file of [cta06, cta07, wordmark, fontBold, fontMedium]) {
  if (!fs.existsSync(file)) throw new Error(`Required brand asset missing: ${file}`);
}
fs.mkdirSync(options.output, { recursive: true });

const cache = new Map();
function dataUrl(file) {
  if (cache.has(file)) return cache.get(file);
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.ttf' ? 'font/ttf' : 'image/jpeg';
  const value = `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
  cache.set(file, value);
  return value;
}

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function highlightedLines(lines, accents) {
  let html = lines.map(esc).join('<br>');
  for (const accent of [...(accents || [])].sort((a, b) => b.length - a.length)) {
    html = html.split(esc(accent)).join(`<strong>${esc(accent)}</strong>`);
  }
  return html;
}

const fontBoldUrl = dataUrl(fontBold);
const fontMediumUrl = dataUrl(fontMedium);
const wordmarkUrl = dataUrl(wordmark);
const css = `
@font-face{font-family:Gmarket;src:url('${fontBoldUrl}');font-weight:800}
@font-face{font-family:Gmarket;src:url('${fontMediumUrl}');font-weight:500}
*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1350px;overflow:hidden;background:#050706;color:#fff;font-family:Gmarket,sans-serif;letter-spacing:0}
.card{position:relative;width:1080px;height:1350px;overflow:hidden;background:#050706}
.brand{position:absolute;z-index:8;left:64px;top:52px;width:238px;height:72px;padding:17px 20px;background:rgba(255,255,255,.94);border-radius:7px;display:flex;align-items:center}
.brand img{display:block;width:100%;height:auto}
.counter{position:absolute;z-index:8;right:64px;top:66px;font-size:22px;color:#d9e0dd}
.media{position:absolute;left:0;right:0;top:0;height:690px;overflow:hidden;background:#101412}
.media img{width:100%;height:100%;object-fit:cover;object-position:center}
.media:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.18),transparent 38%,rgba(0,0,0,.34))}
.copy{position:absolute;left:64px;right:64px;top:720px;bottom:64px}
.label{display:inline-block;background:#101512;color:#27d6a7;padding:10px 14px;font-size:23px;font-weight:800;margin-bottom:20px}
h1{margin:0;max-width:940px;font-size:69px;line-height:1.13;font-weight:800;word-break:keep-all;overflow-wrap:normal}
h1 strong{color:#27d6a7}
.body{margin-top:24px;max-width:900px;color:#d6ddda;font-size:29px;line-height:1.48;font-weight:500;word-break:keep-all}
.source{position:absolute;left:0;right:0;bottom:0;padding-top:16px;border-top:1px solid rgba(255,255,255,.16);font-size:18px;color:#7f8c87;display:flex;justify-content:space-between}
.cover .media{height:1350px}.cover .media:after{background:linear-gradient(180deg,rgba(0,0,0,.16) 18%,rgba(0,0,0,.08) 42%,rgba(0,0,0,.88) 78%,#050706 100%)}
.cover .copy{z-index:4;top:auto;bottom:68px}.cover .label{margin-bottom:18px}.cover h1{font-size:84px;line-height:1.1;max-width:950px}.cover .body{font-size:27px;max-width:850px;margin-top:20px}.cover .source{position:relative;margin-top:28px}
`;

function htmlFor(topic, copy, mediaCard, number) {
  const body = Array.isArray(copy.body) ? copy.body.join(' ') : copy.body;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css}</style></head><body><main class="card ${number === 1 ? 'cover' : ''}">
    <div class="brand"><img src="${wordmarkUrl}"></div><div class="counter">${String(number).padStart(2, '0')} / 07</div>
    <section class="media"><img src="${dataUrl(mediaCard.file)}"></section>
    <section class="copy"><div class="label">${esc(copy.label)}</div><h1>${highlightedLines(copy.headline, copy.accent)}</h1><div class="body">${esc(body)}</div>
    <div class="source"><span>${esc(topic.player)}</span><span>REFERENCE ONLY</span></div></section>
  </main></body></html>`;
}

function makeContactSheet(outputDir) {
  const inputs = Array.from({ length: 7 }, (_, index) => ['-i', path.join(outputDir, `card-${String(index + 1).padStart(2, '0')}.png`)]).flat();
  const scales = Array.from({ length: 7 }, (_, index) => `[${index}:v]scale=270:338[s${index}]`).join(';');
  const stackInputs = Array.from({ length: 7 }, (_, index) => `[s${index}]`).join('');
  const filter = `${scales};color=c=#050706:s=270x338[blank];${stackInputs}[blank]xstack=inputs=8:layout=0_0|270_0|540_0|810_0|0_338|270_338|540_338|810_338[out]`;
  const result = spawnSync('ffmpeg', ['-y', ...inputs, '-filter_complex', filter, '-map', '[out]', '-frames:v', '1', '-update', '1', path.join(outputDir, 'contact-sheet.jpg')], { stdio: 'ignore', timeout: 60000 });
  if (result.status !== 0) throw new Error(`Contact sheet failed: ${outputDir}`);
}

const browser = await puppeteer.launch({ headless: true, protocolTimeout: 120000, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
const results = [];

try {
  for (const [topicIndex, topic] of topics.entries()) {
    if (topic.copy?.cards?.length !== 7) throw new Error(`Expected seven copy cards: ${topic.id}`);
    const projectDir = path.join(options.output, topic.id);
    const outputDir = path.join(projectDir, 'output');
    fs.mkdirSync(outputDir, { recursive: true });
    const mediaAudit = [];

    for (let number = 1; number <= 5; number += 1) {
      const mediaCard = resolveCardMedia({ mediaIndex, topicId: topic.id, cardNumber: number, root: ROOT, strictMedia: options.strictMedia });
      if (!mediaCard) throw new Error(`No media available: ${topic.id} card ${number}`);
      await page.setContent(htmlFor(topic, topic.copy.cards[number - 1], mediaCard, number), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
      const layout = await page.evaluate(() => {
        const rect = (selector) => {
          const value = document.querySelector(selector).getBoundingClientRect();
          return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
        };
        return {
          card: rect('.card'), headline: rect('h1'), body: rect('.body'), source: rect('.source'),
          documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight,
        };
      });
      if (layout.documentWidth > 1080 || layout.documentHeight > 1350 || layout.headline.right > 1016 || layout.body.right > 1016 || layout.body.bottom + 12 > layout.source.top) {
        throw new Error(`Layout overflow: ${topic.id} card ${number} ${JSON.stringify(layout)}`);
      }
      const outputFile = path.join(outputDir, `card-${String(number).padStart(2, '0')}.png`);
      await page.screenshot({ path: outputFile });
      cache.delete(mediaCard.file);
      mediaAudit.push({ card: number, path: mediaCard.path, sha256: mediaCard.sha256, visualReview: mediaCard.visualReview, sourceUrl: mediaCard.sourceUrl, layout });
    }

    fs.copyFileSync(cta06, path.join(outputDir, 'card-06.png'));
    fs.copyFileSync(cta07, path.join(outputDir, 'card-07.png'));
    makeContactSheet(outputDir);
    const audit = { topicId: topic.id, strictMedia: options.strictMedia, cards: 7, width: 1080, height: 1350, mediaAudit };
    fs.writeFileSync(path.join(projectDir, 'render-audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
    results.push({ topicId: topic.id, output: path.relative(ROOT, outputDir).replaceAll('\\', '/') });
    console.log(`${topicIndex + 1}/${topics.length} ${topic.id}`);
  }
} finally {
  await browser.close();
}

const completeResults = bank.topics.filter((topic) => fs.existsSync(path.join(options.output, topic.id, 'output/card-07.png'))).map((topic) => ({
  topicId: topic.id,
  output: path.relative(ROOT, path.join(options.output, topic.id, 'output')).replaceAll('\\', '/'),
}));
fs.writeFileSync(path.join(options.output, 'index.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  bank: path.relative(ROOT, options.bank).replaceAll('\\', '/'),
  media: path.relative(ROOT, options.media).replaceAll('\\', '/'),
  strictMedia: options.strictMedia,
  results: completeResults,
}, null, 2)}\n`);
