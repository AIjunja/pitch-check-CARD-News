#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/reference/web/real-player-video-first-manifest-170.json"), "utf8"));
const bank = JSON.parse(fs.readFileSync(path.join(ROOT, "samples/pitchcheck/real-player-story-bank-grounded-170.json"), "utf8"));
const topics = new Map(bank.topics.map((topic) => [topic.id, topic]));
const output = path.join(ROOT, "projects/video-first-batch-170");
fs.mkdirSync(output, { recursive: true });

for (const item of manifest.items) {
  const topic = topics.get(item.topicId);
  const dir = path.join(output, item.topicId);
  fs.mkdirSync(dir, { recursive: true });
  const cards = item.slots.map((slot, index) => ({
    card: slot.card,
    copy: Array.isArray(topic.copy?.cards) ? topic.copy.cards[index] : null,
    role: slot.role,
    need: slot.need,
    renderMedia: slot.videoUrl ? "video" : "image",
    video: slot.videoUrl ? {
      url: slot.videoUrl,
      startSeconds: slot.startSeconds,
      durationSeconds: slot.durationSeconds,
      localClip: slot.localClip || null,
      reviewRequired: slot.humanTimestampReview,
    } : null,
    image: slot.imageFallback,
    rights: "reference-only",
  }));
  cards.push(
    {
      card: 6,
      role: "bridge",
      renderMedia: "locked-cta",
      image: "projects/asset-pilot-son-100/assets/pitchcheck/approved-cta/card-06-approved.png",
      rights: "direct-use",
    },
    {
      card: 7,
      role: "cta",
      renderMedia: "locked-cta",
      image: "projects/asset-pilot-son-100/assets/pitchcheck/approved-cta/card-07-approved.png",
      rights: "direct-use",
    },
  );
  const packet = {
    version: 1,
    topicId: item.topicId,
    eventKey: topic.eventKey || null,
    player: item.player,
    hook: item.hook,
    sourceRefs: topic.sourceRefs,
    videoCandidate: item.video,
    confidence: item.confidence,
    cards,
    readyForStaticRender: cards.every((card) => card.image || card.video?.localClip),
    readyForVideoRender: cards.slice(0, 5).every((card) => card.video?.localClip),
  };
  fs.writeFileSync(path.join(dir, "media-manifest.json"), `${JSON.stringify(packet, null, 2)}\n`);
}

const index = manifest.items.map((item) => {
  const packet = JSON.parse(fs.readFileSync(path.join(output, item.topicId, "media-manifest.json"), "utf8"));
  return {
    topicId: item.topicId,
    player: item.player,
    videoSlots: packet.cards.filter((card) => card.renderMedia === "video").length,
    imageSlots: packet.cards.filter((card) => card.renderMedia === "image").length,
    readyForStaticRender: packet.readyForStaticRender,
    readyForVideoRender: packet.readyForVideoRender,
    manifest: path.relative(ROOT, path.join(output, item.topicId, "media-manifest.json")).replace(/\\/g, "/"),
  };
});
fs.writeFileSync(path.join(output, "index.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), stories: index }, null, 2)}\n`);
console.log(JSON.stringify({ stories: index.length, staticReady: index.filter((item) => item.readyForStaticRender).length, videoSlots: index.reduce((sum, item) => sum + item.videoSlots, 0) }, null, 2));
