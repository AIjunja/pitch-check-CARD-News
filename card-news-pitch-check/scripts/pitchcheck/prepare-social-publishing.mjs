#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  findWorkspaceRoot,
  parseArgs,
  readJson,
  writeJson,
} from "./lib/social-publish-utils.mjs";

const options = parseArgs();
const projectRoot = process.cwd();
const workspaceRoot = findWorkspaceRoot();
const bankPath = path.resolve(options.bank ?? path.join(projectRoot, "samples", "pitchcheck", "complete-story-bank-170.json"));
const sourceCatalogPath = path.resolve(options.sources ?? path.join(projectRoot, "samples", "pitchcheck", "real-player-source-catalog-300.json"));
const renderRoot = path.resolve(options.renders ?? path.join(projectRoot, "projects", "complete-story-bank-170"));
const cdnRoot = path.resolve(options.cdn_public ?? path.join(workspaceRoot, "ai-jjun-cdn", "public"));
const queuePath = path.resolve(options.out ?? path.join(workspaceRoot, "carousel-workspace", "pitchcheck-publish-queue.json"));
const slots = String(options.slots ?? "10:00,12:00,14:00,16:00,18:00").split(",").map((value) => value.trim()).filter(Boolean);
const expectedCount = Number(options.expected_count ?? 170);
const quality = Number(options.quality ?? 88);
const concurrency = Math.max(1, Number(options.concurrency ?? 6));

const bank = readJson(bankPath);
const stories = Array.isArray(bank) ? bank : bank.topics ?? bank.stories ?? bank.items ?? [];
if (stories.length !== expectedCount) throw new Error(`스토리 수가 ${stories.length}개입니다. 기대값 ${expectedCount}개와 다릅니다.`);
const catalog = readJson(sourceCatalogPath);
const sources = new Map((catalog.sources ?? []).map((source) => [source.sourceId, source]));
const existingQueue = fs.existsSync(queuePath) ? readJson(queuePath) : null;
const existingById = new Map((existingQueue?.items ?? []).map((item) => [item.id, item]));
const schedule = buildSchedule(stories.length, slots, options.start_date);

const jobs = [];
const items = [];
for (const [index, story] of stories.entries()) {
  const outputDir = path.join(renderRoot, story.id, "output");
  const sourceCards = Array.from({ length: 7 }, (_, cardIndex) => path.join(outputDir, `card-${String(cardIndex + 1).padStart(2, "0")}.png`));
  for (const card of sourceCards) {
    if (!fs.existsSync(card)) throw new Error(`렌더 카드 누락: ${card}`);
  }

  const publicProjectDir = path.join(cdnRoot, "projects", "pitchcheck", story.id);
  const publicOutputDir = path.join(publicProjectDir, "output");
  fs.mkdirSync(publicOutputDir, { recursive: true });
  const publicCards = sourceCards.map((_, cardIndex) => path.join(publicOutputDir, `card-${String(cardIndex + 1).padStart(2, "0")}.jpg`));
  for (let cardIndex = 0; cardIndex < sourceCards.length; cardIndex += 1) {
    jobs.push({ source: sourceCards[cardIndex], target: publicCards[cardIndex] });
  }

  const sourceLinks = [...new Set((story.sourceRefs ?? []).map((sourceRef) => sources.get(sourceRef)?.url).filter(Boolean))];
  const captions = buildCaptions(story, sourceLinks);
  fs.writeFileSync(path.join(publicProjectDir, "caption.md"), `${captions.instagram}\n`, "utf8");
  fs.writeFileSync(path.join(publicProjectDir, "caption.instagram.md"), `${captions.instagram}\n`, "utf8");
  fs.writeFileSync(path.join(publicProjectDir, "caption.threads.md"), `${captions.threads}\n`, "utf8");
  writeJson(path.join(publicProjectDir, "APPROVED_FOR_PUBLISH.json"), {
    status: "approved_for_publish",
    approved: true,
    projectSlug: `pitchcheck/${story.id}`,
    approvedFrom: "user-requested-complete-170-batch",
    generatedAt: new Date().toISOString(),
  });

  const previous = existingById.get(story.id);
  items.push({
    id: story.id,
    order: index + 1,
    slug: `pitchcheck/${story.id}`,
    player: story.player,
    hook: story.hook,
    scheduledAt: previous?.scheduledAt ?? schedule[index],
    sourceLinks,
    localCards: sourceCards,
    publicCards: publicCards.map((file) => `/${path.relative(cdnRoot, file).replaceAll(path.sep, "/")}`),
    captions,
    platforms: {
      instagram: previous?.platforms?.instagram ?? pendingPlatform(),
      threads: previous?.platforms?.threads ?? pendingPlatform(),
    },
  });
}

let converted = 0;
let skipped = 0;
await runPool(jobs, concurrency, async ({ source, target }) => {
  if (isFresh(target, source)) {
    skipped += 1;
    return;
  }
  await sharp(source, { limitInputPixels: false })
    .flatten({ background: "#000000" })
    .jpeg({ quality, progressive: true, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toFile(target);
  converted += 1;
});

const queue = {
  version: 1,
  channel: "pitchcheck",
  expectedUsername: "pitchcheck_official",
  generatedAt: new Date().toISOString(),
  timezone: "Asia/Seoul",
  slots,
  items,
};
writeJson(queuePath, queue);

const totalBytes = jobs.reduce((sum, job) => sum + fs.statSync(job.target).size, 0);
console.log(JSON.stringify({ queuePath, stories: items.length, cards: jobs.length, converted, skipped, totalBytes, first: items[0].scheduledAt, last: items.at(-1).scheduledAt }, null, 2));

function pendingPlatform() {
  return { status: "pending", publishedAt: null, mediaId: null, lastError: null };
}

function isFresh(target, source) {
  if (!fs.existsSync(target)) return false;
  const sourceStat = fs.statSync(source);
  const targetStat = fs.statSync(target);
  return targetStat.size > 0 && targetStat.mtimeMs >= sourceStat.mtimeMs;
}

async function runPool(values, limit, worker) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      await worker(values[index]);
    }
  });
  await Promise.all(workers);
}

function buildSchedule(count, dailySlots, requestedStartDate) {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const startDate = requestedStartDate ?? kstNow.toISOString().slice(0, 10);
  const candidates = [];
  let dayOffset = 0;
  while (candidates.length < count) {
    const date = addUtcDays(startDate, dayOffset);
    for (const slot of dailySlots) {
      const iso = `${date}T${slot}:00+09:00`;
      if (!requestedStartDate && new Date(iso).getTime() <= now.getTime()) continue;
      candidates.push(iso);
      if (candidates.length >= count) break;
    }
    dayOffset += 1;
  }
  return candidates;
}

function addUtcDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildCaptions(story, sourceLinks) {
  const instagramParts = [
    story.hook,
    story.fact,
    story.whyFun,
    story.shareTrigger,
    "이 장면이 떠오르는 축구 친구에게 보내주세요.",
    "팀 일정과 출석이 단톡방에서 자꾸 묻힌다면, 프로필 링크에서 피치체크를 확인해보세요. 댓글에 [피치체크]를 남기면 사용 영상도 보내드릴게요.",
  ];
  if (sourceLinks.length) instagramParts.push(`출처: ${sourceLinks.join(" · ")}`);
  instagramParts.push("#피치체크 #축구썰 #축구이야기 #축구팬 #풋볼");

  const threadsParts = [
    story.hook,
    story.fact,
    story.whyFun,
    "이 장면, 누구랑 같이 보고 싶나요?",
    "팀 일정과 출석은 프로필 링크의 피치체크에서 정리할 수 있어요.",
  ];
  return {
    instagram: instagramParts.filter(Boolean).join("\n\n").slice(0, 2200),
    threads: threadsParts.filter(Boolean).join("\n\n").slice(0, 500),
  };
}
