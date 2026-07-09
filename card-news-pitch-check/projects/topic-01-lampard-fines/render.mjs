import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

const CARD_W = 1080;
const CARD_H = 1350;

async function renderCards() {
  console.log("Starting HTML to PNG card renderer...");
  
  const projectDir = path.resolve();
  const cardsDir = path.join(projectDir, "projects", "topic-01-lampard-fines", "cards");
  const outputDir = path.join(projectDir, "projects", "topic-01-lampard-fines", "output");
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Launch Puppeteer headless browser
  console.log("Launching headless browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({
    width: CARD_W,
    height: CARD_H,
    deviceScaleFactor: 2 // Higher scale factor for crisp premium PNG output
  });
  
  // Render cards 1 to 7
  for (let i = 1; i <= 7; i++) {
    const filename = `card-0${i}.html`;
    const htmlPath = path.join(cardsDir, filename);
    
    if (!fs.existsSync(htmlPath)) {
      console.warn(`Warning: ${filename} does not exist. Skipping.`);
      continue;
    }
    
    console.log(`Rendering ${filename}...`);
    const fileUrl = pathToFileURL(htmlPath).href;
    
    // Navigate and wait until network is completely idle to ensure fonts are fully loaded
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });
    
    // Minor delay to ensure all animations (e.g. pulse) are in an initial stable state or loaded
    await new Promise(r => setTimeout(r, 800));
    
    const outputPath = path.join(outputDir, `card-0${i}.png`);
    await page.screenshot({
      path: outputPath,
      type: 'png'
    });
    
    console.log(`Saved: ${path.relative(projectDir, outputPath)}`);
  }
  
  await browser.close();
  console.log("\nAll cards rendered successfully!");
}

renderCards().catch(err => {
  console.error("Critical rendering error:", err);
  process.exit(1);
});
