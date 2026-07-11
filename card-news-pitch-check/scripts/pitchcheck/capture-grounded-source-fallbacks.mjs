#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const reportPath = path.join(ROOT, "assets/reference/web/real-player-grounded-assets-170.json");
const ledgerPath = path.join(ROOT, "assets/reference/web/real-player-grounded-assets-170.md");
const outputDir = path.join(ROOT, "assets/reference/web/real-player-grounded-170-source-pages");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
fs.mkdirSync(outputDir, { recursive: true });

const safe = (value) => String(value).toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
const pending = report.items.filter((item) => !item.localPath && item.sourcePages[0]?.url);
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });

async function capture(item) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1600, deviceScaleFactor: 1 });
  try {
    await page.goto(item.sourcePages[0].url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const file = path.join(outputDir, `${safe(item.topicId)}.png`);
    await page.screenshot({ path: file, type: "png", fullPage: false });
    item.localPath = path.relative(ROOT, file).replace(/\\/g, "/");
    item.status = "source-page-proof-captured";
    item.fallbackOnly = true;
    delete item.error;
  } catch (error) {
    item.captureError = error.message;
    item.status = "manual-official-media-search";
  } finally {
    await page.close();
  }
}

for (let index = 0; index < pending.length; index += 3) {
  await Promise.all(pending.slice(index, index + 3).map(capture));
}
await browser.close();

report.totals.downloaded = report.items.filter((item) => item.localPath && !item.fallbackOnly).length;
report.totals.sourcePageCaptured = report.items.filter((item) => item.fallbackOnly).length;
report.totals.withLocalAsset = report.items.filter((item) => item.localPath).length;
report.totals.manualSearch = report.items.filter((item) => !item.localPath).length;
report.totals.downloadFailed = report.items.filter((item) => item.error).length;
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

const lines = [
  "# 실제 사건 170개 이미지 에셋 보고서",
  "",
  `- 사건: ${report.totals.topics}개`,
  `- 원문 이미지 발견: ${report.totals.sourceMediaFound}개`,
  `- 원문 이미지 다운로드: ${report.totals.downloaded}개`,
  `- 원문 페이지 증거 캡처: ${report.totals.sourcePageCaptured}개`,
  `- 로컬 에셋 보유: ${report.totals.withLocalAsset}개`,
  `- 여전히 수동 확인 필요: ${report.totals.manualSearch}개`,
  "",
  "원문 페이지 캡처는 증거·검색 출발점일 뿐 현장 사진 대체물이 아니다. 외부 이미지는 모두 reference-only이며 발행 전 사용권 확인이 필요하다.",
  "",
  "| ID | 선수 | 상태 | 로컬 에셋 | 다음에 찾을 현장 장면 |",
  "|---|---|---|---|---|",
  ...report.items.map((item) => `| ${item.topicId} | ${item.player} | ${item.status} | ${item.localPath ? item.localPath : "없음"} | ${item.cardPlan[1]?.need || "맥락 장면"} |`),
];
fs.writeFileSync(ledgerPath, `${lines.join("\n")}\n`);
console.log(JSON.stringify(report.totals, null, 2));
