#!/usr/bin/env node

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const bank = JSON.parse(fs.readFileSync(path.join(ROOT, "samples/pitchcheck/real-player-story-bank-grounded-170.json"), "utf8"));
const sourceAssets = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/reference/web/real-player-grounded-assets-170.json"), "utf8"));
const outputDir = path.join(ROOT, "assets/reference/web/real-player-video-first-170");
const reportPath = path.join(ROOT, "assets/reference/web/real-player-video-first-manifest-170.json");
const ledgerPath = path.join(ROOT, "assets/reference/web/real-player-video-first-ledger-170.md");
fs.mkdirSync(outputDir, { recursive: true });

const existing = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, "utf8")) : { items: [] };
const cache = new Map(existing.items.map((item) => [item.topicId, item]));
const fallbackByTopic = new Map(sourceAssets.items.map((item) => [item.topicId, item]));
const officialWords = /official|fifa|uefa|premier league|la liga|bundesliga|tottenham|liverpool|manchester|barcelona|real madrid|chelsea|arsenal|psg|bayern|inter miami|kfa|afc|olympics/i;
const junkWords = /reaction|gameplay|efootball|fc 2[4-9]|compilation|edit|shorts|podcast/i;

const tokenize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9가-힣 ]/g, " ").split(/\s+/).filter((word) => word.length > 2);
const genericTokens = new Set(tokenize("official highlights interview football soccer player match action moment story goal celebration record source confirmed event frame archive family childhood life impact injury comeback second emotional documentary champions league premier world cup career club korea fair training"));
const actionWords = new Set(tokenize("teacher reunion trial signing contract presentation debut final injury hospital retirement farewell transfer penalty hat-trick hattrick trophy medal airport record captain award refugee warzone childhood"));
const finalizeOnly = process.argv.includes("--finalize-only");
const safe = (value) => String(value).toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);

function queryFor(topic) {
  const sceneQuery = topic.visualNeed
    || topic.visualPlan?.queries?.[0]
    || topic.assetSearch?.queries?.[3]
    || topic.assetSearch?.queries?.[0]
    || `${topic.player} ${topic.category || "football story"}`;
  return `${sceneQuery} official highlights interview`.replace(/\s+/g, " ").trim();
}

function score(entry, topic) {
  const text = `${entry.title || ""} ${entry.channel || ""} ${entry.description || ""}`;
  const titleTokens = new Set(tokenize(text));
  const wanted = tokenize(`${topic.player} ${topic.hook} ${topic.fact}`);
  let value = wanted.reduce((sum, token) => sum + (titleTokens.has(token) ? 4 : 0), 0);
  if (entry.channel_is_verified) value += 25;
  if (officialWords.test(entry.channel || "")) value += 24;
  if (officialWords.test(entry.title || "")) value += 8;
  if (junkWords.test(text)) value -= 35;
  if ((entry.duration || 0) >= 20 && (entry.duration || 0) <= 900) value += 8;
  return value;
}

function isRelevantCandidate(candidate, topic, query) {
  const playerTokens = tokenize(topic.player);
  const haystack = tokenize(`${candidate.title || ""} ${candidate.description || ""}`);
  const queryTokens = tokenize(query);
  const hasPlayer = playerTokens.some((token) => haystack.includes(token));
  const requiredNumbers = queryTokens.filter((token) => /\d/.test(token));
  const requiredActions = queryTokens.filter((token) => actionWords.has(token));
  const numbersMatch = requiredNumbers.every((token) => haystack.includes(token));
  const actionMatch = !requiredActions.length || requiredActions.some((token) => haystack.includes(token));
  const meaningfulOverlap = (candidate.eventOverlap || []).filter((token) => !genericTokens.has(token));
  return hasPlayer && numbersMatch && actionMatch && meaningfulOverlap.length > 0 && candidate.score >= 20;
}

async function searchTopic(topic) {
  const query = queryFor(topic);
  try {
    const { stdout } = await run("yt-dlp", [`ytsearch5:${query}`, "--flat-playlist", "--dump-single-json", "--no-warnings"], { maxBuffer: 8 * 1024 * 1024, timeout: 45000 });
    const data = JSON.parse(stdout);
    const playerTokens = new Set(tokenize(topic.player));
    const eventTokens = tokenize(query).filter((token) => !playerTokens.has(token) && !genericTokens.has(token));
    const candidates = (data.entries || []).map((entry) => ({
      id: entry.id,
      url: entry.url,
      title: entry.title,
      description: entry.description,
      duration: entry.duration,
      channel: entry.channel,
      channelUrl: entry.channel_url,
      verified: Boolean(entry.channel_is_verified),
      thumbnail: entry.thumbnails?.at(-1)?.url || `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
      score: score(entry, topic),
      eventOverlap: eventTokens.filter((token) => tokenize(`${entry.title || ""} ${entry.description || ""}`).includes(token)),
    })).sort((a, b) => b.score - a.score);
    const selected = candidates.find((candidate) => isRelevantCandidate(candidate, topic, query)) || null;
    const fallback = fallbackByTopic.get(topic.id);
    const duration = selected?.duration || 60;
    const ratios = [0.12, 0.3, 0.48, 0.7, 0.86];
    return {
      topicId: topic.id,
      player: topic.player,
      hook: topic.hook,
      query,
      video: selected,
      candidates,
      slots: topic.assetSearch.cardPlan.slice(0, 5).map((plan, index) => ({
        card: plan.card,
        role: plan.role,
        need: plan.need,
        preferredType: "video-clip",
        videoUrl: selected?.url || null,
        startSeconds: selected ? Math.max(0, Math.round(duration * ratios[index]) - 2) : null,
        durationSeconds: 4,
        imageFallback: fallback?.localPath || null,
        status: selected ? "video-candidate-found" : "image-fallback-only",
        humanTimestampReview: true,
      })),
      rights: "reference-only",
      confidence: selected ? (selected.score >= 45 ? "high" : selected.score >= 25 ? "medium" : "low") : "none",
    };
  } catch (error) {
    const fallback = fallbackByTopic.get(topic.id);
    return {
      topicId: topic.id,
      player: topic.player,
      hook: topic.hook,
      query,
      video: null,
      candidates: [],
      slots: topic.assetSearch.cardPlan.slice(0, 5).map((plan) => ({ ...plan, preferredType: "image", imageFallback: fallback?.localPath || null, status: "image-fallback-only", humanTimestampReview: false })),
      rights: "reference-only",
      confidence: "none",
      error: error.message,
    };
  }
}

for (const topic of bank.topics) {
  const cached = cache.get(topic.id);
  if (!cached?.video) continue;
  if (!isRelevantCandidate(cached.video, topic, cached.query || queryFor(topic))) {
    cached.video = null;
    cached.confidence = "none";
    cached.slots = cached.slots.map((slot) => ({ ...slot, videoUrl: null, startSeconds: null, status: "image-fallback-only", humanTimestampReview: false }));
  }
}
const pending = finalizeOnly ? [] : bank.topics.filter((topic) => !cache.get(topic.id)?.video);
for (let index = 0; index < pending.length; index += 3) {
  const results = await Promise.all(pending.slice(index, index + 3).map(searchTopic));
  for (const result of results) cache.set(result.topicId, result);
  const items = bank.topics.map((topic) => cache.get(topic.id)).filter(Boolean);
  fs.writeFileSync(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 2)}\n`);
  console.log(`${items.length}/${bank.topics.length}`);
}

const items = bank.topics.map((topic) => cache.get(topic.id));
for (const item of items) {
  if (!item.video) continue;
  const haystack = tokenize(`${item.video.title || ""} ${item.video.description || ""}`);
  const eventOverlap = (item.video.eventOverlap || []).filter((token) => !genericTokens.has(token));
  const queryActions = tokenize(item.query).filter((token) => actionWords.has(token));
  const actionMatch = queryActions.some((token) => haystack.includes(token));
  item.slots = item.slots.map((slot) => {
    const needTokens = tokenize(slot.need).filter((token) => !genericTokens.has(token));
    const needMatch = needTokens.some((token) => haystack.includes(token));
    const useVideo = slot.card === 1
      ? eventOverlap.length > 0 && (needMatch || actionMatch)
      : slot.card === 3
        ? eventOverlap.length >= 2
        : needMatch;
    return useVideo
      ? { ...slot, status: "video-candidate-found", humanTimestampReview: true }
      : { ...slot, videoUrl: null, startSeconds: null, status: "image-fallback-only", humanTimestampReview: false };
  });
}
for (const item of items) {
  if (!item.video?.thumbnail) continue;
  try {
    const response = await fetch(item.video.thumbnail, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) continue;
    const file = path.join(outputDir, `${safe(item.topicId)}.jpg`);
    fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
    item.video.thumbnailLocalPath = path.relative(ROOT, file).replace(/\\/g, "/");
  } catch {}
}

const totals = {
  stories: items.length,
  slots: items.reduce((sum, item) => sum + item.slots.length, 0),
  withVideo: items.filter((item) => item.video).length,
  highConfidence: items.filter((item) => item.confidence === "high").length,
  mediumConfidence: items.filter((item) => item.confidence === "medium").length,
  lowConfidence: items.filter((item) => item.confidence === "low").length,
  imageFallbackOnly: items.filter((item) => !item.video).length,
  timestampReviewRequired: items.filter((item) => item.video).length,
  videoBackedSlots: items.reduce((sum, item) => sum + item.slots.filter((slot) => slot.videoUrl).length, 0),
};
fs.writeFileSync(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), totals, items }, null, 2)}\n`);
const lines = [
  "# 실제 선수 썰 170개 영상 우선 에셋 현황",
  "",
  `- 스토리: ${totals.stories}개`,
  `- 카드 1~5 슬롯: ${totals.slots}개`,
  `- 영상 후보 확보: ${totals.withVideo}개`,
  `- 영상 없음·이미지 fallback: ${totals.imageFallbackOnly}개`,
  `- 영상 연결 카드 슬롯: ${totals.videoBackedSlots}개`,
  `- 높은 신뢰도: ${totals.highConfidence}개`,
  `- 중간 신뢰도: ${totals.mediumConfidence}개`,
  `- 낮은 신뢰도: ${totals.lowConfidence}개`,
  "",
  "영상은 reference-only다. 자동 타임코드는 탐색 시작점이며 카드 렌더 전 실제 장면 검수가 필요하다.",
  "",
  "| ID | 선수 | 영상 | 채널 | 신뢰도 | 1~5장 상태 |",
  "|---|---|---|---|---|---|",
  ...items.map((item) => `| ${item.topicId} | ${item.player} | ${item.video ? `[보기](${item.video.url})` : "없음"} | ${item.video?.channel || "-"} | ${item.confidence} | ${item.slots.map((slot) => `${slot.card}:${slot.status}`).join(", ")} |`),
];
fs.writeFileSync(ledgerPath, `${lines.join("\n")}\n`);
console.log(JSON.stringify(totals, null, 2));
