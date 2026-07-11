#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = path.join(ROOT, "assets/reference/web/real-player-video-first-manifest-170.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const args = process.argv.slice(2);
const topicArg = args.indexOf("--topic");
const topicId = topicArg >= 0 ? args[topicArg + 1] : null;
const allowUnreviewed = args.includes("--allow-unreviewed");
const execute = args.includes("--execute");
const selected = manifest.items.filter((item) => (!topicId || item.topicId === topicId) && item.video);

if (!topicId && !args.includes("--all")) throw new Error("Use --topic <id> or --all");
if (!selected.length) throw new Error("No video-backed story matched");

for (const story of selected) {
  const targetDir = path.join(ROOT, "assets/reference/web/real-player-video-clips-170", story.topicId);
  fs.mkdirSync(targetDir, { recursive: true });
  for (const slot of story.slots) {
    if (!slot.videoUrl) continue;
    if (slot.humanTimestampReview && !allowUnreviewed) {
      console.log(`SKIP review-required ${story.topicId} card-${slot.card}`);
      continue;
    }
    const end = slot.startSeconds + slot.durationSeconds;
    const output = path.join(targetDir, `card-${String(slot.card).padStart(2, "0")}.mp4`);
    const command = [
      slot.videoUrl,
      "--download-sections", `*${slot.startSeconds}-${end}`,
      "--force-keyframes-at-cuts",
      "-f", "bv*[height<=720]+ba/b[height<=720]",
      "--merge-output-format", "mp4",
      "--no-playlist",
      "-o", output,
    ];
    console.log(`yt-dlp ${command.map((value) => JSON.stringify(value)).join(" ")}`);
    if (!execute) continue;
    const result = spawnSync("yt-dlp", command, { stdio: "inherit" });
    if (result.status !== 0) throw new Error(`Failed ${story.topicId} card-${slot.card}`);
    slot.localClip = path.relative(ROOT, output).replace(/\\/g, "/");
  }
}

if (execute) fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
