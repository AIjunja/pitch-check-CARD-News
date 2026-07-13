#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { findWorkspaceRoot, parseArgs, readJson, writeJson } from "./lib/social-publish-utils.mjs";

const options = parseArgs();
const workspaceRoot = findWorkspaceRoot();
const queuePath = path.resolve(options.queue ?? path.join(workspaceRoot, "carousel-workspace", "pitchcheck-publish-queue.json"));
const cdnPublic = path.resolve(options.cdn_public ?? path.join(workspaceRoot, "ai-jjun-cdn", "public"));
const reportPath = path.resolve(options.out ?? path.join(workspaceRoot, "carousel-workspace", "pitchcheck-publish-audit.json"));
const expectedCount = Number(options.expected_count ?? 170);
const queue = readJson(queuePath);
const problems = [];
const seenIds = new Set();
const seenSchedules = new Set();

if (queue.items.length !== expectedCount) add("queue_count", `스토리 ${queue.items.length}개, 기대값 ${expectedCount}개`);
for (const item of queue.items) {
  if (seenIds.has(item.id)) add("duplicate_id", item.id);
  seenIds.add(item.id);
  if (seenSchedules.has(item.scheduledAt)) add("duplicate_schedule", item.scheduledAt);
  seenSchedules.add(item.scheduledAt);
  if (!queue.slots.includes(item.scheduledAt.slice(11, 16))) add("invalid_slot", `${item.id}: ${item.scheduledAt}`);
  if (item.publicCards.length !== 7) add("card_count", `${item.id}: ${item.publicCards.length}`);
  if (item.captions.instagram.length > 2200) add("instagram_caption", `${item.id}: ${item.captions.instagram.length}`);
  if (item.captions.threads.length > 500) add("threads_caption", `${item.id}: ${item.captions.threads.length}`);

  for (const publicPath of item.publicCards) {
    const filePath = path.join(cdnPublic, publicPath.replace(/^\//, ""));
    if (!fs.existsSync(filePath)) {
      add("missing_card", filePath);
      continue;
    }
    const metadata = await sharp(filePath).metadata();
    if (metadata.format !== "jpeg") add("card_format", `${item.id}: ${metadata.format}`);
    if (metadata.width !== 1080 || metadata.height !== 1350) add("card_dimensions", `${item.id}: ${metadata.width}x${metadata.height}`);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  status: problems.length ? "blocked" : "ready",
  summary: {
    stories: queue.items.length,
    cards: queue.items.reduce((sum, item) => sum + item.publicCards.length, 0),
    scheduleDays: new Set(queue.items.map((item) => item.scheduledAt.slice(0, 10))).size,
    first: queue.items[0]?.scheduledAt ?? null,
    last: queue.items.at(-1)?.scheduledAt ?? null,
    problems: problems.length,
  },
  problems,
};
writeJson(reportPath, report);
console.log(JSON.stringify({ reportPath, ...report }, null, 2));
if (problems.length) process.exit(1);

function add(code, message) {
  problems.push({ code, message });
}
