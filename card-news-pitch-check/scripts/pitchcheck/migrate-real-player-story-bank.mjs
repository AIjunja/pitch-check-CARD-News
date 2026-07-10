#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const INPUT_FILE = path.join(ROOT, "samples/pitchcheck/real-player-story-bank-60.json");
const OUTPUT_FILE = path.join(ROOT, "samples/pitchcheck/real-player-story-migrated-50.json");
const SENSITIVE_CATEGORY = /family-loss|war-childhood|second-chance/;

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sourceTier(sourceId, sourceUrl) {
  const id = sourceId.toLowerCase();
  const url = sourceUrl.toLowerCase();
  if (id.includes("tpt") || id.includes("bbc") || url.includes("playerstribune.com")) {
    return "primary";
  }
  if (
    url.includes("fifa.com") ||
    url.includes("olympics.com") ||
    url.includes("bundesliga.com")
  ) {
    return "official";
  }
  if (
    url.includes("theguardian.com") ||
    url.includes("espn.com") ||
    url.includes("good.is")
  ) {
    return "reputable-secondary";
  }
  throw new Error(`Unknown source tier for ${sourceId}: ${sourceUrl}`);
}

function topicSourceTier(topic, sourceRefs) {
  const tiers = topic.sourceRefs.map((sourceId) => {
    const source = sourceRefs[sourceId];
    const sourceUrl = typeof source === "string" ? source : source?.url;
    if (typeof sourceUrl !== "string") {
      throw new Error(`${topic.id}: missing source URL for ${sourceId}`);
    }
    return sourceTier(sourceId, sourceUrl);
  });
  if (tiers.includes("primary")) return "primary";
  if (tiers.includes("official")) return "official";
  return "reputable-secondary";
}

function migrateTopic(topic, sourceRefs) {
  const player = topic.assetSearch?.mustHave?.[0];
  if (typeof player !== "string" || !player.trim()) {
    throw new Error(`${topic.id}: assetSearch.mustHave[0] must be a non-empty player`);
  }
  const canonicalEventSlug = topic.id.replace(/^real-\d{3}-/, "");
  if (canonicalEventSlug === topic.id) {
    throw new Error(`${topic.id}: expected real-NNN- prefix`);
  }
  const verification = {
    status: "verified",
    sourceTier: topicSourceTier(topic, sourceRefs),
    caveat: SENSITIVE_CATEGORY.test(topic.category)
      ? "민감한 사건이므로 원문 맥락을 유지하고 선정적으로 확대하지 않는다."
      : null,
  };

  return {
    ...topic,
    player,
    eventKey: `${slugify(player)}|legacy-sourced|${canonicalEventSlug}`,
    origin: "migrated-60-bank",
    verification,
  };
}

const legacyBank = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
const canonicalTopics = legacyBank.topics.filter(
  (topic) => !topic.category.endsWith("alternate-hook"),
);
const migrated = canonicalTopics.map((topic) => migrateTopic(topic, legacyBank.sourceRefs));
const eventKeys = new Set(migrated.map((topic) => topic.eventKey));
const facts = new Set(migrated.map((topic) => topic.fact));

if (migrated.length !== 50) {
  throw new Error(`Expected 50 migrated topics, got ${migrated.length}`);
}
if (eventKeys.size !== 50) {
  throw new Error(`Expected 50 unique eventKey values, got ${eventKeys.size}`);
}
if (facts.size !== 50) {
  throw new Error(`Expected 50 unique fact values, got ${facts.size}`);
}

fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify({ topics: migrated }, null, 2)}\n`, "utf8");
console.log("Migrated 50 unique stories from 60 rows");
