import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const project = path.dirname(fileURLToPath(import.meta.url));
const cards = path.join(project, 'cards');
const output = path.join(project, 'output');
fs.mkdirSync(output, { recursive: true });

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });

for (let card = 1; card <= 5; card += 1) {
  const id = String(card).padStart(2, '0');
  await page.goto(pathToFileURL(path.join(cards, `card-${id}.html`)).href, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(output, `card-${id}.png`), type: 'png' });
}

fs.copyFileSync(path.join(project, 'assets/pitchcheck/approved-cta/card-06-approved.png'), path.join(output, 'card-06.png'));
fs.copyFileSync(path.join(project, 'assets/pitchcheck/approved-cta/card-07-approved.png'), path.join(output, 'card-07.png'));
await browser.close();

const inputs = Array.from({ length: 7 }, (_, index) => path.join(output, `card-${String(index + 1).padStart(2, '0')}.png`));
const ffmpegArgs = inputs.flatMap((input) => ['-i', input]);
const buildSheet = (name, filter) => {
  const result = spawnSync('ffmpeg', [
    '-y', ...ffmpegArgs,
    '-f', 'lavfi', '-i', 'color=c=#070908:s=1080x1350',
    '-filter_complex', filter,
    '-map', '[out]',
    '-frames:v', '1', path.join(output, name),
  ], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Failed to create ${name}`);
};

const grid = 'xstack=inputs=8:layout=0_0|270_0|540_0|810_0|0_338|270_338|540_338|810_338';
buildSheet('contact-sheet.jpg', `${Array.from({ length: 8 }, (_, i) => `[${i}:v]scale=270:338[s${i}]`).join(';')};${Array.from({ length: 8 }, (_, i) => `[s${i}]`).join('')}${grid}[out]`);
buildSheet('thumbnail-sheet.jpg', `${Array.from({ length: 8 }, (_, i) => `[${i}:v]crop=1080:1080:0:135,scale=270:270[t${i}]`).join(';')};${Array.from({ length: 8 }, (_, i) => `[t${i}]`).join('')}xstack=inputs=8:layout=0_0|270_0|540_0|810_0|0_270|270_270|540_270|810_270[out]`);
