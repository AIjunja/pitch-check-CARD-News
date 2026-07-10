#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const INPUT_FILE = path.join(ROOT, "samples/pitchcheck/real-player-story-bank-60.json");
const OUTPUT_FILE = path.join(ROOT, "samples/pitchcheck/real-player-story-migrated-50.json");
const SENSITIVE_CATEGORY = /family-loss|war-childhood|second-chance/;

const PLAYER_BY_SOURCE_REF = Object.freeze({
  ian_teacher_good: "Ian Wright",
  ian_teacher_bbc: "Ian Wright",
  ian_wright_tpt: "Ian Wright",
  lukaku_tpt: "Romelu Lukaku",
  de_bruyne_tpt: "Kevin De Bruyne",
  mbappe_tpt: "Kylian Mbappe",
  ronaldinho_tpt: "Ronaldinho",
  pele_tpt: "Pele",
  di_maria_tpt: "Angel Di Maria",
  nani_tpt: "Nani",
  mane_olympics: "Sadio Mane",
  davies_bundesliga: "Alphonso Davies",
  lee_fifa: "Lee Kang-in",
  rashford_guardian: "Marcus Rashford",
  vardy_guardian: "Jamie Vardy",
  modric_guardian: "Luka Modric",
  mahrez_guardian: "Riyad Mahrez",
  di_canio_guardian: "Paolo Di Canio",
  hunt_espn: "Aaron Hunt",
  bielsa_guardian: "Marcelo Bielsa",
  kante_guardian: "N'Golo Kante",
  son_guardian: "Son Heung-min",
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hostMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function sourceUrlFor(topicId, sourceId, source) {
  const sourceUrl = typeof source === "string" ? source : source?.url;
  if (typeof sourceUrl !== "string") {
    throw new Error(`${topicId}: missing source URL for ${sourceId}`);
  }
  return sourceUrl;
}

function sourceTier(topicId, sourceId, source) {
  const sourceUrl = sourceUrlFor(topicId, sourceId, source);
  let hostname;
  try {
    hostname = new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    throw new Error(`${topicId}: malformed source URL for ${sourceId}: ${sourceUrl}`);
  }

  if (
    hostMatches(hostname, "theplayerstribune.com") ||
    (sourceId === "ian_teacher_bbc" && (hostMatches(hostname, "youtube.com") || hostMatches(hostname, "youtu.be")))
  ) {
    return "primary";
  }
  if (
    ["olympics.com", "bundesliga.com", "fifa.com"].some((domain) => hostMatches(hostname, domain))
  ) {
    return "official";
  }
  if (
    ["good.is", "theguardian.com", "espn.com"].some((domain) => hostMatches(hostname, domain))
  ) {
    return "reputable-secondary";
  }
  throw new Error(`${topicId}: unknown source tier for ${sourceId}: ${sourceUrl}`);
}

function validateBank(bank) {
  if (bank === null || typeof bank !== "object" || Array.isArray(bank)) {
    throw new Error("bank must be a non-null object");
  }
  if (!Array.isArray(bank.topics)) {
    throw new Error("bank.topics must be an array");
  }
  if (!isPlainObject(bank.sourceRefs)) {
    throw new Error("bank.sourceRefs must be a non-null plain object");
  }
}

function validateTopic(topic, index) {
  if (topic === null || typeof topic !== "object" || Array.isArray(topic)) {
    throw new Error(`topic ${index}: must be a non-null object`);
  }
  if (typeof topic.id !== "string" || !topic.id.trim()) {
    throw new Error(`topic ${index}: id must be a non-empty string`);
  }
  if (typeof topic.category !== "string" || !topic.category.trim()) {
    throw new Error(`${topic.id}: category must be a non-empty string`);
  }
  if (!Array.isArray(topic.sourceRefs)) {
    throw new Error(`${topic.id}: sourceRefs must be an array`);
  }
}

function canonicalPlayer(topic) {
  const players = new Set();
  for (const sourceId of topic.sourceRefs) {
    if (typeof sourceId !== "string" || !sourceId.trim()) {
      throw new Error(`${topic.id}: sourceRefs must contain non-empty source IDs`);
    }
    const player = PLAYER_BY_SOURCE_REF[sourceId];
    if (!player) {
      throw new Error(`${topic.id}: missing canonical player mapping for ${sourceId}`);
    }
    players.add(player);
  }
  if (players.size === 0) {
    throw new Error(`${topic.id}: missing canonical player mapping`);
  }
  if (players.size !== 1) {
    throw new Error(`${topic.id}: conflicting canonical player mappings`);
  }
  return [...players][0];
}

function topicSourceTier(topic, sourceRefs) {
  const tiers = topic.sourceRefs.map((sourceId) => sourceTier(topic.id, sourceId, sourceRefs[sourceId]));
  if (tiers.includes("primary")) return "primary";
  if (tiers.includes("official")) return "official";
  return "reputable-secondary";
}

function migrateTopic(topic, sourceRefs) {
  const player = canonicalPlayer(topic);
  const playerSlug = slugify(player);
  if (!playerSlug) {
    throw new Error(`${topic.id}: canonical player slug must not be empty`);
  }
  const legacyEventSlug = slugify(topic.id.replace(/^real-\d{3}-/, ""));
  if (!legacyEventSlug) {
    throw new Error(`${topic.id}: legacy event slug must not be empty`);
  }

  return {
    ...topic,
    player,
    eventKey: `${playerSlug}|legacy-sourced|${legacyEventSlug}`,
    origin: "migrated-60-bank",
    verification: {
      status: "verified",
      sourceTier: topicSourceTier(topic, sourceRefs),
      caveat: SENSITIVE_CATEGORY.test(topic.category)
        ? "\ubbfc\uac10\ud55c\u0020\uc0ac\uac74\uc774\ubbc0\ub85c\u0020\uc6d0\ubb38\u0020\ub9e5\ub77d\uc744\u0020\uc720\uc9c0\ud558\uace0\u0020\uc120\uc815\uc801\uc73c\ub85c\u0020\ud655\ub300\ud558\uc9c0\u0020\uc54a\ub294\ub2e4\u002e"
        : null,
    },
  };
}

export function migrateStoryBank(sourceBank) {
  validateBank(sourceBank);
  sourceBank.topics.forEach(validateTopic);
  sourceBank.topics.forEach((topic) => {
    canonicalPlayer(topic);
    topicSourceTier(topic, sourceBank.sourceRefs);
  });

  const canonicalTopics = sourceBank.topics.filter((topic) => !topic.category.endsWith("alternate-hook"));
  const migrated = canonicalTopics.map((topic) => migrateTopic(topic, sourceBank.sourceRefs));
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

  return { topics: migrated };
}

function runCli() {
  const legacyBank = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
  const migrated = migrateStoryBank(legacyBank);
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(migrated, null, 2)}\n`, "utf8");
  console.log("Migrated 50 unique stories from 60 rows");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
