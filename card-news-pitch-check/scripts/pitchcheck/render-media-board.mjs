#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const manifest = args[0] || "assets/reference/pitchcheck-local/media-manifest.json";
  const outIndex = args.indexOf("--out");
  return {
    manifestPath: path.resolve(ROOT, manifest),
    outPath: outIndex >= 0 ? path.resolve(ROOT, args[outIndex + 1]) : null,
  };
}

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function html(manifest, items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.type)) groups.set(item.type, []);
    groups.get(item.type).push(item);
  }

  const sections = [...groups.entries()]
    .map(([type, groupItems]) => {
      const cards = groupItems
        .map((item) => {
          const src = pathToFileURL(item.file).href;
          const ratio = item.height && item.width ? item.height / item.width : 1.33;
          const fit = ratio > 1.45 ? "contain" : "cover";
          return `<figure>
  <div class="thumb"><img src="${src}" style="object-fit:${fit}" /></div>
  <figcaption><b>${esc(item.id)}</b><span>${esc(item.usage || "")}</span></figcaption>
</figure>`;
        })
        .join("");
      return `<section><h2>${esc(type)} <span>${groupItems.length}</span></h2><div class="grid">${cards}</div></section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>PitchCheck Local Media Board</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;padding:36px;background:#101214;color:#fff;font-family:Arial,"Malgun Gothic",sans-serif}
    header{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;margin-bottom:28px}
    h1{margin:0;font-size:34px;letter-spacing:0}
    p{margin:8px 0 0;color:rgba(255,255,255,.62);font-size:15px}
    .counts{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
    .counts span{padding:8px 11px;border-radius:999px;background:#20252a;color:#cde;font-size:13px}
    section{margin-top:34px}
    h2{margin:0 0 14px;font-size:22px}
    h2 span{color:#31d7a3}
    .grid{display:grid;grid-template-columns:repeat(6,180px);gap:18px}
    figure{margin:0;border:1px solid rgba(255,255,255,.1);border-radius:12px;overflow:hidden;background:#181b1f}
    .thumb{width:180px;height:238px;background:#050607;display:grid;place-items:center}
    img{width:100%;height:100%;display:block}
    figcaption{display:flex;flex-direction:column;gap:4px;padding:9px 10px 11px;min-height:64px}
    figcaption b{font-size:12px;color:#fff}
    figcaption span{font-size:11px;line-height:1.28;color:rgba(255,255,255,.58)}
  </style>
</head>
<body>
  <header>
    <div>
      <h1>PitchCheck Local Media Board</h1>
      <p>${esc(manifest.generatedAt || "")}</p>
    </div>
    <div class="counts">${Object.entries(manifest.counts || {})
      .map(([key, value]) => `<span>${esc(key)} ${esc(value)}</span>`)
      .join("")}</div>
  </header>
  ${sections}
</body>
</html>`;
}

async function main() {
  const options = parseArgs();
  if (!existsSync(options.manifestPath)) {
    throw new Error(`Missing media manifest: ${options.manifestPath}`);
  }

  const manifest = JSON.parse(readFileSync(options.manifestPath, "utf8").replace(/^\uFEFF/, ""));
  const items = (manifest.items || []).filter((item) => item.file && existsSync(item.file));
  const boardDir = path.dirname(options.manifestPath);
  const htmlPath = path.join(boardDir, "media-board.html");
  const outPath = options.outPath || path.join(boardDir, "media-board.png");
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(htmlPath, html(manifest, items), "utf8");

  const { default: puppeteer } = await import("puppeteer");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--allow-file-access-from-files", "--disable-web-security", "--no-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1248, height: 1600, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle0", timeout: 30000 });
    await page.screenshot({ path: outPath, type: "png", fullPage: true });
    console.log(`rendered media board: ${outPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
