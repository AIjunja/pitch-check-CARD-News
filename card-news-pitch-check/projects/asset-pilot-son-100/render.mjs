import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

