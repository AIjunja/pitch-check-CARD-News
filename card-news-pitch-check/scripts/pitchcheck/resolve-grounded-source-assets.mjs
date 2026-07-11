#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const bank = JSON.parse(fs.readFileSync(path.join(ROOT, "samples/pitchcheck/real-player-story-bank-grounded-170.json"), "utf8"));
const catalogPath = path.join(ROOT, "samples/pitchcheck/real-player-source-catalog-300.json");
const catalogDoc = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const sources = new Map(catalogDoc.sources.map((source) => [source.sourceId, source]));
const outputDir = path.join(ROOT, "assets/reference/web/real-player-grounded-170");
const reportPath = path.join(ROOT, "assets/reference/web/real-player-grounded-assets-170.json");
const ledgerPath = path.join(ROOT, "assets/reference/web/real-player-grounded-assets-170.md");
fs.mkdirSync(outputDir, { recursive: true });

const bad = /logo|icon|badge|banner|sprite|avatar|tracking|pixel|\.svg(?:\?|$)/i;
const imageLike = /\.(?:jpe?g|png|webp)(?:\?|$)/i;
const uniq = (items) => [...new Set(items.filter(Boolean))];
const safe = (value) => String(value).toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);

function chooseMedia(source) {
  return uniq(source.mediaCandidates || [])
    .filter((url) => /^https?:/i.test(url) && imageLike.test(url) && !bad.test(url))
    .sort((a, b) => Number(/thumbnail|width=\d{1,3}(?:\D|$)/i.test(a)) - Number(/thumbnail|width=\d{1,3}(?:\D|$)/i.test(b)));
}

function meta(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1].replace(/&amp;/g, "&");
  }
  return null;
}

async function enrichSource(source) {
  if (chooseMedia(source).length) return;
  try {
    const response = await fetch(source.url, { headers: { "User-Agent": "Mozilla/5.0 PitchCheck editorial research" }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) return;
    const html = await response.text();
    const candidates = uniq([meta(html, "og:image"), meta(html, "twitter:image"), meta(html, "twitter:image:src")]);
    source.mediaCandidates = uniq([...(source.mediaCandidates || []), ...candidates]);
    if (candidates.length) source.mediaDiscovery = "page-meta-refresh";
  } catch (error) {
    source.mediaRefreshError = error.message;
  }
}

const noMediaSources = [...sources.values()].filter((source) => !chooseMedia(source).length);
for (let index = 0; index < noMediaSources.length; index += 6) {
  await Promise.all(noMediaSources.slice(index, index + 6).map(enrichSource));
}
const urlDownloads = new Map();
async function download(url, topicId) {
  if (urlDownloads.has(url)) return urlDownloads.get(url);
  const promise = (async () => {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 PitchCheck editorial research" }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) return { error: `HTTP ${response.status}` };
      const type = response.headers.get("content-type") || "";
      if (!type.startsWith("image/")) return { error: `not image: ${type}` };
      const ext = type.includes("png") ? ".png" : type.includes("webp") ? ".webp" : ".jpg";
      const file = path.join(outputDir, `${safe(topicId)}${ext}`);
      fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
      return { localPath: path.relative(ROOT, file).replace(/\\/g, "/") };
    } catch (error) {
      return { error: error.message };
    }
  })();
  urlDownloads.set(url, promise);
  return promise;
}

const items = [];
for (const topic of bank.topics) {
  const linked = (topic.sourceRefs || []).map((id) => sources.get(id)).filter(Boolean);
  const candidates = uniq(linked.flatMap(chooseMedia));
  const selectedUrl = candidates[0] || null;
  items.push({
    topicId: topic.id,
    player: topic.player,
    hook: topic.hook,
    eventKey: topic.eventKey || null,
    sourceRefs: topic.sourceRefs || [],
    sourcePages: linked.map((source) => ({ sourceId: source.sourceId, publisher: source.publisher, url: source.url })),
    selectedUrl,
    candidateUrls: candidates.slice(0, 8),
    rights: "reference-only",
    cardPlan: topic.assetSearch.cardPlan,
    status: selectedUrl ? "source-media-found" : "manual-official-media-search",
  });
}

for (let index = 0; index < items.length; index += 6) {
  await Promise.all(items.slice(index, index + 6).map(async (item) => {
    if (!item.selectedUrl) return;
    Object.assign(item, await download(item.selectedUrl, item.topicId));
    if (item.error) item.status = "source-media-download-failed";
  }));
}

const totals = {
  topics: items.length,
  sourceMediaFound: items.filter((item) => item.selectedUrl).length,
  downloaded: items.filter((item) => item.localPath).length,
  manualSearch: items.filter((item) => !item.selectedUrl).length,
  downloadFailed: items.filter((item) => item.error).length,
};
fs.writeFileSync(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), totals, items }, null, 2)}\n`);

const lines = [
  "# 실제 사건 170개 이미지 에셋 보고서",
  "",
  `- 사건: ${totals.topics}개`,
  `- 원문 이미지 발견: ${totals.sourceMediaFound}개`,
  `- 로컬 다운로드 성공: ${totals.downloaded}개`,
  `- 공식 미디어 추가 검색 필요: ${totals.manualSearch}개`,
  `- 다운로드 실패: ${totals.downloadFailed}개`,
  "",
  "외부 이미지는 모두 reference-only이며 발행 전 사용권 확인이 필요하다.",
  "",
  "| ID | 선수 | 상태 | 원문 이미지 | 부족한 다음 장면 |",
  "|---|---|---|---|---|",
  ...items.map((item) => `| ${item.topicId} | ${item.player} | ${item.status} | ${item.selectedUrl ? `[보기](${item.selectedUrl})` : "없음"} | ${item.cardPlan[1]?.need || "맥락 장면"} |`),
];
fs.writeFileSync(ledgerPath, `${lines.join("\n")}\n`);
console.log(JSON.stringify(totals, null, 2));
