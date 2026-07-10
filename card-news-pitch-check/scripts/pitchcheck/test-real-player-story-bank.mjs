#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateStoryBank } from "./lib/real-story-validation.mjs";
import { migrateStoryBank } from "./migrate-real-player-story-bank.mjs";
import { buildGlobalLegendBank } from "./build-global-legend-bank.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG_PATH = path.join(ROOT, "samples/pitchcheck/real-player-source-catalog-300.json");
const MESSI_SEEDS_PATH = path.join(ROOT, "samples/pitchcheck/real-player-story-seeds-messi.json");
const RONALDO_SEEDS_PATH = path.join(ROOT, "samples/pitchcheck/real-player-story-seeds-ronaldo.json");
const MBAPPE_HAALAND_SEEDS_PATH = path.join(ROOT, "samples/pitchcheck/real-player-story-seeds-mbappe-haaland.json");
const SON_SALAH_SEEDS_PATH = path.join(ROOT, "samples/pitchcheck/real-player-story-seeds-son-salah.json");
const WOMEN_SEEDS_PATH = path.join(ROOT, "samples/pitchcheck/real-player-story-seeds-women.json");
const GLOBAL_SEEDS_PATH = path.join(ROOT, "samples/pitchcheck/real-player-story-seeds-global.json");
const GLOBAL_BANK_GENERATOR_PATH = path.join(ROOT, "scripts/pitchcheck/build-global-legend-bank.mjs");
const CATALOG_GENERATED_AT = "2026-07-10T00:00:00.000Z";
const BBC_YOUTUBE_VIDEO_ID = "6caCqn_nD6o";
const REFERENCE_ONLY_RIGHTS_NOTE = "Media candidates are reference-only until rights are verified.";

const publisherByHostname = new Map([
  ["www.theplayerstribune.com", { publisher: "The Players' Tribune", tier: "primary" }],
  ["theplayerstribune.com", { publisher: "The Players' Tribune", tier: "primary" }],
  ["www.fifa.com", { publisher: "FIFA", tier: "official" }],
  ["fifa.com", { publisher: "FIFA", tier: "official" }],
  ["inside.fifa.com", { publisher: "FIFA", tier: "official" }],
  ["www.olympics.com", { publisher: "Olympics.com", tier: "official" }],
  ["olympics.com", { publisher: "Olympics.com", tier: "official" }],
  ["www.fcbarcelona.com", { publisher: "FC Barcelona", tier: "official" }],
  ["fcbarcelona.com", { publisher: "FC Barcelona", tier: "official" }],
  ["www.bundesliga.com", { publisher: "Bundesliga", tier: "official" }],
  ["bundesliga.com", { publisher: "Bundesliga", tier: "official" }],
  ["www.good.is", { publisher: "GOOD", tier: "reputable-secondary" }],
  ["good.is", { publisher: "GOOD", tier: "reputable-secondary" }],
  ["www.theguardian.com", { publisher: "The Guardian", tier: "reputable-secondary" }],
  ["theguardian.com", { publisher: "The Guardian", tier: "reputable-secondary" }],
  ["www.espn.com", { publisher: "ESPN", tier: "reputable-secondary" }],
  ["espn.com", { publisher: "ESPN", tier: "reputable-secondary" }],
  ["apnews.com", { publisher: "Associated Press", tier: "reputable-secondary" }],
  ["www.apnews.com", { publisher: "Associated Press", tier: "reputable-secondary" }],
  ["www.bbc.com", { publisher: "BBC Sport", tier: "reputable-secondary" }],
  ["bbc.com", { publisher: "BBC Sport", tier: "reputable-secondary" }],
  ["www.bonhams.com", { publisher: "Bonhams", tier: "primary" }],
  ["bonhams.com", { publisher: "Bonhams", tier: "primary" }],
  ["www.guinnessworldrecords.com", { publisher: "Guinness World Records", tier: "official" }],
  ["guinnessworldrecords.com", { publisher: "Guinness World Records", tier: "official" }],
  ["www.uefa.com", { publisher: "UEFA", tier: "official" }],
  ["uefa.com", { publisher: "UEFA", tier: "official" }],
  ["www.intermiamicf.com", { publisher: "Inter Miami CF", tier: "official" }],
  ["intermiamicf.com", { publisher: "Inter Miami CF", tier: "official" }],
  ["www.fcbarcelona.com", { publisher: "FC Barcelona", tier: "official" }],
  ["fcbarcelona.com", { publisher: "FC Barcelona", tier: "official" }],
  ["www.leaguescup.com", { publisher: "Leagues Cup", tier: "official" }],
  ["leaguescup.com", { publisher: "Leagues Cup", tier: "official" }],
  ["www.manutd.com", { publisher: "Manchester United", tier: "official" }],
  ["manutd.com", { publisher: "Manchester United", tier: "official" }],
  ["www.realmadrid.com", { publisher: "Real Madrid", tier: "official" }],
  ["realmadrid.com", { publisher: "Real Madrid", tier: "official" }],
  ["www.skysports.com", { publisher: "Sky Sports", tier: "reputable-secondary" }],
  ["skysports.com", { publisher: "Sky Sports", tier: "reputable-secondary" }],
  ["www.transfermarkt.us", { publisher: "Transfermarkt", tier: "reputable-secondary" }],
  ["transfermarkt.us", { publisher: "Transfermarkt", tier: "reputable-secondary" }],
  ["www.premierleague.com", { publisher: "Premier League", tier: "official" }],
  ["premierleague.com", { publisher: "Premier League", tier: "official" }],
  ["www.mancity.com", { publisher: "Manchester City", tier: "official" }],
  ["mancity.com", { publisher: "Manchester City", tier: "official" }],
  ["www.tottenhamhotspur.com", { publisher: "Tottenham Hotspur", tier: "official" }],
  ["tottenhamhotspur.com", { publisher: "Tottenham Hotspur", tier: "official" }],
  ["www.liverpoolfc.com", { publisher: "Liverpool FC", tier: "official" }],
  ["liverpoolfc.com", { publisher: "Liverpool FC", tier: "official" }],
  ["www.chelseafc.com", { publisher: "Chelsea FC", tier: "official" }],
  ["chelseafc.com", { publisher: "Chelsea FC", tier: "official" }],
  ["www.kfa.or.kr", { publisher: "Korea Football Association", tier: "official" }],
  ["kfa.or.kr", { publisher: "Korea Football Association", tier: "official" }],
  ["news.canadasoccer.com", { publisher: "Canada Soccer", tier: "official" }],
  ["canadasoccer.com", { publisher: "Canada Soccer", tier: "official" }],
]);

function parseSourcePack(sourcePack, sourcePackPath) {
  const sourceMarkers = sourcePack.match(/^## Source\b.*$/gm) ?? [];
  const headings = [...sourcePack.matchAll(/^## Source (\d+):[ \t]*(.*)$/gm)];
  if (headings.length === 0 || headings.length !== sourceMarkers.length) {
    throw new Error(`${sourcePackPath}: missing Source heading structure`);
  }

  const records = new Map();

  for (let index = 0; index < headings.length; index += 1) {
    const sectionStart = headings[index].index + headings[index][0].length;
    const sectionEnd = headings[index + 1]?.index ?? sourcePack.length;
    const section = sourcePack.slice(sectionStart, sectionEnd);
    const sourceNumber = headings[index][1];
    const title = headings[index][2].trim();
    if (!title) {
      throw new Error(`${sourcePackPath}: Source ${sourceNumber}: missing title`);
    }
    const url = section.match(/^- URL: (https:\/\/\S+)$/m)?.[1];
    if (!url) {
      throw new Error(`${sourcePackPath}: Source ${sourceNumber}: missing URL`);
    }
    const existing = records.get(url);
    if (existing) {
      throw new Error(
        `${sourcePackPath}: duplicate source URL ${url} in Source ${existing.sourceNumber} and Source ${sourceNumber}`,
      );
    }

    const mediaBlock = section.match(/### Media Candidates\r?\n([\s\S]*?)(?=\r?\n### |\r?\n## |$)/)?.[1] ?? "";
    const mediaCandidates = [...mediaBlock.matchAll(/^- (https:\/\/\S+)$/gm)].map((match) => match[1]);
    records.set(url, {
      sourceNumber,
      title,
      status: section.match(/^- Status: (.+)$/m)?.[1] ?? null,
      mediaCandidates: [...new Set(mediaCandidates)],
      sourcePack: sourcePackPath,
    });
  }

  return records;
}

function parseMessiKoreanIndex(sourcePack, sourcePackPath) {
  const heading = "## 한국어 사건 인덱스와 근거 메모";
  const headingIndex = sourcePack.indexOf(heading);
  assert.notEqual(headingIndex, -1, `${sourcePackPath}: missing Korean Messi index`);
  assert.equal(
    sourcePack.slice(headingIndex + heading.length).trimStart().startsWith("### "),
    true,
    `${sourcePackPath}: Korean Messi index must contain entries`,
  );

  const section = sourcePack.slice(headingIndex + heading.length).trim();
  const entries = [...section.matchAll(
    /^### (\d+)\. (.+)\r?\n- eventKey: `([^`]+)`\r?\n- source IDs: ([^\r\n]+)\r?\n- evidence: ([^\r\n]+)\r?\n- scope: ([^\r\n]+)$/gm,
  )].map((match) => ({
    number: Number(match[1]),
    title: match[2].trim(),
    eventKey: match[3].trim(),
    sourceIds: match[4].split(",").map((sourceId) => sourceId.trim()).filter(Boolean),
    evidence: match[5].trim(),
    scope: match[6].trim(),
  }));

  assert.equal(entries.length, 20, `${sourcePackPath}: Korean Messi index must contain exactly 20 entries`);
  assert.deepEqual(
    entries.map((entry) => entry.number),
    Array.from({ length: 20 }, (_, index) => index + 1),
    `${sourcePackPath}: Korean Messi index entries must be numbered 1-20`,
  );
  for (const entry of entries) {
    assert.ok(entry.title, `${entry.eventKey}: missing Korean event title`);
    assert.ok(entry.sourceIds.length > 0, `${entry.eventKey}: missing source IDs`);
    assert.ok(entry.evidence, `${entry.eventKey}: missing Korean evidence`);
    assert.ok(entry.scope, `${entry.eventKey}: missing Korean scope`);
  }
  return entries;
}

function parseRonaldoKoreanIndex(sourcePack, sourcePackPath) {
  const heading = "## 한국어 이벤트 인덱스: 근거 메모";
  const headingIndex = sourcePack.indexOf(heading);
  assert.notEqual(headingIndex, -1, `${sourcePackPath}: missing Korean Ronaldo index`);
  const section = sourcePack.slice(headingIndex + heading.length).trim();
  const entries = [...section.matchAll(
    /^### (\d+)\. (.+)\r?\n- eventKey: `([^`]+)`\r?\n- source IDs: ([^\r\n]+)\r?\n- evidence: ([^\r\n]+)\r?\n- scope: ([^\r\n]+)$/gm,
  )].map((match) => ({
    number: Number(match[1]),
    title: match[2].trim(),
    eventKey: match[3].trim(),
    sourceIds: match[4].split(",").map((sourceId) => sourceId.trim()).filter(Boolean),
    evidence: match[5].trim(),
    scope: match[6].trim(),
  }));

  assert.equal(entries.length, 20, `${sourcePackPath}: Korean Ronaldo index must contain exactly 20 entries`);
  assert.deepEqual(
    entries.map((entry) => entry.number),
    Array.from({ length: 20 }, (_, index) => index + 1),
    `${sourcePackPath}: Korean Ronaldo index entries must be numbered 1-20`,
  );
  for (const entry of entries) {
    assert.ok(entry.title, `${entry.eventKey}: missing Korean event title`);
    assert.ok(entry.sourceIds.length > 0, `${entry.eventKey}: missing source IDs`);
    assert.ok(entry.evidence, `${entry.eventKey}: missing Korean evidence`);
    assert.ok(entry.scope, `${entry.eventKey}: missing Korean scope`);
  }
  return entries;
}

function parseMbappeHaalandKoreanIndex(sourcePack, sourcePackPath) {
  const heading = "## 한국어 이벤트 인덱스: 근거 메모";
  const headingIndex = sourcePack.indexOf(heading);
  assert.notEqual(headingIndex, -1, `${sourcePackPath}: missing Mbappe/Haaland Korean index`);
  const section = sourcePack.slice(headingIndex + heading.length).trim();
  const entries = [...section.matchAll(
    /^### (\d+)\. (.+)\r?\n- eventKey: `([^`]+)`\r?\n- source IDs: ([^\r\n]+)\r?\n- evidence: ([^\r\n]+)\r?\n- scope: ([^\r\n]+)$/gm,
  )].map((match) => ({
    number: Number(match[1]),
    title: match[2].trim(),
    eventKey: match[3].trim(),
    sourceIds: match[4].split(",").map((sourceId) => sourceId.trim()).filter(Boolean),
    evidence: match[5].trim(),
    scope: match[6].trim(),
  }));

  assert.equal(entries.length, 20, `${sourcePackPath}: Mbappe/Haaland Korean index must contain exactly 20 entries`);
  assert.deepEqual(
    entries.map((entry) => entry.number),
    Array.from({ length: 20 }, (_, index) => index + 1),
    `${sourcePackPath}: Mbappe/Haaland Korean index entries must be numbered 1-20`,
  );
  for (const entry of entries) {
    assert.ok(entry.title, `${entry.eventKey}: missing Korean event title`);
    assert.ok(entry.sourceIds.length > 0, `${entry.eventKey}: missing source IDs`);
    assert.ok(entry.evidence, `${entry.eventKey}: missing Korean evidence`);
    assert.ok(entry.scope, `${entry.eventKey}: missing Korean scope`);
  }
  return entries;
}

function parseCurrentStarKoreanIndex(sourcePack, sourcePackPath, label) {
  const heading = "## 한국어 이벤트 인덱스: 근거 메모";
  const headingIndex = sourcePack.indexOf(heading);
  assert.notEqual(headingIndex, -1, `${sourcePackPath}: missing Korean ${label} index`);
  const section = sourcePack.slice(headingIndex + heading.length).trim();
  const entries = [...section.matchAll(
    /^### (\d+)\. (.+)\r?\n- eventKey: `([^`]+)`\r?\n- source IDs: ([^\r\n]+)\r?\n- evidence: ([^\r\n]+)\r?\n- scope: ([^\r\n]+)$/gm,
  )].map((match) => ({
    number: Number(match[1]),
    title: match[2].trim(),
    eventKey: match[3].trim(),
    sourceIds: match[4].split(",").map((sourceId) => sourceId.trim()).filter(Boolean),
    evidence: match[5].trim(),
    scope: match[6].trim(),
  }));

  assert.equal(entries.length, 20, `${sourcePackPath}: Korean ${label} index must contain exactly 20 entries`);
  assert.deepEqual(
    entries.map((entry) => entry.number),
    Array.from({ length: 20 }, (_, index) => index + 1),
    `${sourcePackPath}: Korean ${label} index entries must be numbered 1-20`,
  );
  for (const entry of entries) {
    assert.ok(entry.title, `${entry.eventKey}: missing Korean event title`);
    assert.ok(entry.sourceIds.length > 0, `${entry.eventKey}: missing source IDs`);
    assert.ok(entry.evidence, `${entry.eventKey}: missing Korean evidence`);
    assert.ok(entry.scope, `${entry.eventKey}: missing Korean scope`);
  }
  return entries;
}

function isCanonicalBbcYouTubeUrl(parsedUrl) {
  if (["www.youtube.com", "youtube.com"].includes(parsedUrl.hostname)) {
    return parsedUrl.pathname === "/watch" && parsedUrl.searchParams.get("v") === BBC_YOUTUBE_VIDEO_ID;
  }
  return parsedUrl.hostname === "youtu.be" && parsedUrl.pathname === `/${BBC_YOUTUBE_VIDEO_ID}`;
}

function getPublisherAndTier(sourceId, url) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`${sourceId}: unknown or malformed source URL: ${url}`);
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error(`${sourceId}: unknown or malformed source URL: ${url}`);
  }

  if (sourceId === "ian_teacher_bbc") {
    if (isCanonicalBbcYouTubeUrl(parsedUrl)) {
      return { publisher: "BBC via YouTube", tier: "primary" };
    }
    throw new Error(`${sourceId}: unknown or malformed source URL: ${url}`);
  }

  const publisher = publisherByHostname.get(parsedUrl.hostname);
  if (!publisher) {
    throw new Error(`${sourceId}: unknown or malformed source URL: ${url}`);
  }
  return publisher;
}

export function buildCatalog(sourceRefs, sourcePackInputs, generatedAt = CATALOG_GENERATED_AT) {
  if (!sourceRefs || typeof sourceRefs !== "object" || Array.isArray(sourceRefs)) {
    throw new Error("sourceRefs must be a non-null object");
  }

  const packRecords = new Map();
  for (const [sourcePackPath, sourcePack] of Object.entries(sourcePackInputs ?? {})) {
    for (const [url, record] of parseSourcePack(sourcePack, sourcePackPath)) {
      const existing = packRecords.get(url);
      if (existing) {
        throw new Error(`duplicate source URL ${url} in ${existing.sourcePack} and ${sourcePackPath}`);
      }
      packRecords.set(url, record);
    }
  }

  const sources = Object.entries(sourceRefs).map(([sourceId, url]) => {
    if (typeof url !== "string" || !url.trim()) {
      throw new Error(`${sourceId}: unknown or malformed source URL: ${url}`);
    }
    const publisher = getPublisherAndTier(sourceId, url);
    const collected = packRecords.get(url);
    if (!collected) {
      throw new Error(`${sourceId}: missing source-pack record for ${url}`);
    }

    return {
      sourceId,
      url,
      publisher: publisher.publisher,
      title: collected.title,
      publishedAt: null,
      status: collected.status,
      tier: publisher.tier,
      sourcePack: collected.sourcePack,
      mediaCandidates: collected.mediaCandidates,
      rightsNote: REFERENCE_ONLY_RIGHTS_NOTE,
      useStatus: "reference-only",
    };
  });

  return { version: "2026-07-10-real-player-source-catalog", generatedAt, sources };
}
const legacyBank = JSON.parse(
  fs.readFileSync(path.join(ROOT, "samples/pitchcheck/real-player-story-bank-60.json"), "utf8"),
);
const migratedBank = JSON.parse(
  fs.readFileSync(path.join(ROOT, "samples/pitchcheck/real-player-story-migrated-50.json"), "utf8"),
);
assert.ok(
  fs.existsSync(MESSI_SEEDS_PATH),
  "samples/pitchcheck/real-player-story-seeds-messi.json must exist",
);
assert.ok(
  fs.existsSync(RONALDO_SEEDS_PATH),
  "samples/pitchcheck/real-player-story-seeds-ronaldo.json must exist",
);
const messiSeeds = JSON.parse(fs.readFileSync(MESSI_SEEDS_PATH, "utf8"));
const ronaldoSeeds = JSON.parse(fs.readFileSync(RONALDO_SEEDS_PATH, "utf8"));
assert.ok(
  fs.existsSync(MBAPPE_HAALAND_SEEDS_PATH),
  "samples/pitchcheck/real-player-story-seeds-mbappe-haaland.json must exist",
);
const mbappeHaalandSeeds = JSON.parse(fs.readFileSync(MBAPPE_HAALAND_SEEDS_PATH, "utf8"));
assert.ok(
  fs.existsSync(SON_SALAH_SEEDS_PATH),
  "samples/pitchcheck/real-player-story-seeds-son-salah.json must exist",
);
const sonSalahSeeds = JSON.parse(fs.readFileSync(SON_SALAH_SEEDS_PATH, "utf8"));
const builtGlobalSeeds = buildGlobalLegendBank(messiSeeds, ronaldoSeeds);
assert.ok(
  fs.existsSync(GLOBAL_SEEDS_PATH),
  "samples/pitchcheck/real-player-story-seeds-global.json must exist",
);
const globalSeeds = JSON.parse(fs.readFileSync(GLOBAL_SEEDS_PATH, "utf8"));
assert.deepEqual(globalSeeds, builtGlobalSeeds, "global seeds must be reproducible from Messi and Ronaldo seeds");
assert.deepEqual(builtGlobalSeeds.topics.slice(0, 20), messiSeeds.topics);
assert.deepEqual(builtGlobalSeeds.topics.slice(20), ronaldoSeeds.topics);
assert.deepEqual(validateStoryBank(globalSeeds, { expectedCount: 40 }), { topics: 40, uniqueEvents: 40 });
assert.deepEqual(
  Object.fromEntries(
    [...new Set(globalSeeds.topics.map((topic) => topic.player))].map((player) => [
      player,
      globalSeeds.topics.filter((topic) => topic.player === player).length,
    ]),
  ),
  { "Lionel Messi": 20, "Cristiano Ronaldo": 20 },
);
assert.equal(new Set(globalSeeds.topics.map((topic) => topic.fact)).size, 40);
assert.ok(globalSeeds.topics.every((topic) => topic.portfolio === "global_legend"));
assert.doesNotMatch(JSON.stringify(globalSeeds), /alternate-hook/i);

const generatorTempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "pitchcheck-global-bank-"));
const generatorOutputPath = path.join(generatorTempDirectory, "global.json");
try {
  assert.doesNotThrow(() => {
    execFileSync(process.execPath, [GLOBAL_BANK_GENERATOR_PATH, "--output", generatorOutputPath], {
      cwd: ROOT,
      stdio: "pipe",
    });
  }, "global bank generator must exit cleanly");
  assert.deepEqual(
    JSON.parse(fs.readFileSync(generatorOutputPath, "utf8")),
    globalSeeds,
    "generator output must match committed global seeds",
  );
} finally {
  fs.rmSync(generatorTempDirectory, { recursive: true, force: true });
}
const roster = JSON.parse(
  fs.readFileSync(path.join(ROOT, "samples/pitchcheck/real-player-roster-300.json"), "utf8"),
);
const rosterContract = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests/fixtures/real-player-roster-300.contract.json"), "utf8"),
);
const sourcePackInputs = {
  "docs/real-player-story-scrapling-source-pack.md": fs.readFileSync(
    path.join(ROOT, "docs/real-player-story-scrapling-source-pack.md"),
    "utf8",
  ),
  "docs/ian-wright-teacher-source-pack.md": fs.readFileSync(
    path.join(ROOT, "docs/ian-wright-teacher-source-pack.md"),
    "utf8",
  ),
  "docs/research/real-player-stories/source-pack-02-messi.md": fs.readFileSync(
    path.join(ROOT, "docs/research/real-player-stories/source-pack-02-messi.md"),
    "utf8",
  ),
  "docs/research/real-player-stories/source-pack-03-ronaldo.md": fs.readFileSync(
    path.join(ROOT, "docs/research/real-player-stories/source-pack-03-ronaldo.md"),
    "utf8",
  ),
  "docs/research/real-player-stories/source-pack-04-mbappe-haaland.md": fs.readFileSync(
    path.join(ROOT, "docs/research/real-player-stories/source-pack-04-mbappe-haaland.md"),
    "utf8",
  ),
  "docs/research/real-player-stories/source-pack-05-son-salah.md": fs.readFileSync(
    path.join(ROOT, "docs/research/real-player-stories/source-pack-05-son-salah.md"),
    "utf8",
  ),
  "docs/research/real-player-stories/source-pack-06-women.md": fs.readFileSync(
    path.join(ROOT, "docs/research/real-player-stories/source-pack-06-women.md"),
    "utf8",
  ),
};
const messiKoreanIndex = parseMessiKoreanIndex(
  sourcePackInputs["docs/research/real-player-stories/source-pack-02-messi.md"],
  "docs/research/real-player-stories/source-pack-02-messi.md",
);
const ronaldoKoreanIndex = parseRonaldoKoreanIndex(
  sourcePackInputs["docs/research/real-player-stories/source-pack-03-ronaldo.md"],
  "docs/research/real-player-stories/source-pack-03-ronaldo.md",
);
const mbappeHaalandKoreanIndex = parseMbappeHaalandKoreanIndex(
  sourcePackInputs["docs/research/real-player-stories/source-pack-04-mbappe-haaland.md"],
  "docs/research/real-player-stories/source-pack-04-mbappe-haaland.md",
);
const sonSalahKoreanIndex = parseCurrentStarKoreanIndex(
  sourcePackInputs["docs/research/real-player-stories/source-pack-05-son-salah.md"],
  "docs/research/real-player-stories/source-pack-05-son-salah.md",
  "Son/Salah",
);
const womenSeeds = JSON.parse(fs.readFileSync(WOMEN_SEEDS_PATH, "utf8"));
const womenKoreanIndex = parseCurrentStarKoreanIndex(
  sourcePackInputs["docs/research/real-player-stories/source-pack-06-women.md"],
  "docs/research/real-player-stories/source-pack-06-women.md",
  "women",
);

if (process.argv.includes("--write-catalog")) {
  fs.writeFileSync(
    CATALOG_PATH,
    `${JSON.stringify(
      buildCatalog(
        { ...legacyBank.sourceRefs, ...messiSeeds.sourceRefs, ...ronaldoSeeds.sourceRefs, ...mbappeHaalandSeeds.sourceRefs, ...sonSalahSeeds.sourceRefs, ...womenSeeds.sourceRefs },
        sourcePackInputs,
      ),
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(`wrote ${path.relative(ROOT, CATALOG_PATH)}`);
}

const portfolioTargets = {
  global_legend: 130,
  current_star: 80,
  korea_asia: 40,
  women: 30,
  cult_unusual: 20,
};
const allowedPortfolios = new Set(Object.keys(portfolioTargets));
const allowedSourceFamilies = new Set(["FIFA"]);

const allSourceRefs = {
  ...legacyBank.sourceRefs,
  ...messiSeeds.sourceRefs,
  ...ronaldoSeeds.sourceRefs,
  ...mbappeHaalandSeeds.sourceRefs,
  ...sonSalahSeeds.sourceRefs,
  ...womenSeeds.sourceRefs,
};
const sourceCatalog = buildCatalog(allSourceRefs, sourcePackInputs, "2026-07-10T00:00:00.000Z");
const persistedSourceCatalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
const expectedSourceIds = Object.keys(allSourceRefs).sort();
const expectedAsiaSourceIds = Array.from({ length: 17 }, (_, index) =>
  `asia07_source_${String(index + 1).padStart(2, "0")}`,
);

assert.equal(sourceCatalog.sources.length, 114);
assert.equal(persistedSourceCatalog.sources.length, 131);
assert.deepEqual(persistedSourceCatalog.sources.slice(0, 114), sourceCatalog.sources);
assert.deepEqual(
  buildCatalog(allSourceRefs, sourcePackInputs).sources,
  persistedSourceCatalog.sources.slice(0, 114),
  "rebuilding the previous inputs must preserve every existing catalog field",
);
assert.deepEqual(
  sourceCatalog.sources.map((source) => source.sourceId).sort(),
  expectedSourceIds,
);
assert.deepEqual(
  persistedSourceCatalog.sources.slice(114).map((source) => source.sourceId),
  expectedAsiaSourceIds,
  "new Asia records must append after existing catalog records",
);
for (const source of sourceCatalog.sources) {
  for (const field of [
    "sourceId",
    "url",
    "publisher",
    "title",
    "publishedAt",
    "status",
    "tier",
    "sourcePack",
    "mediaCandidates",
    "rightsNote",
    "useStatus",
  ]) {
    assert.ok(Object.hasOwn(source, field), `${source.sourceId}: missing ${field}`);
  }
  assert.match(source.url, /^https:\/\//, `${source.sourceId}: URL must use HTTPS`);
  assert.ok(source.publisher.trim(), `${source.sourceId}: missing publisher`);
  assert.ok(source.title.trim(), `${source.sourceId}: missing title`);
  assert.ok(source.publishedAt === null || typeof source.publishedAt === "string");
  assert.ok(source.status === null || typeof source.status === "string");
  assert.ok(
    ["primary", "official", "reputable-secondary"].includes(source.tier),
    `${source.sourceId}: unexpected tier`,
  );
  assert.ok(
    Object.hasOwn(sourcePackInputs, source.sourcePack),
    `${source.sourceId}: unexpected source pack`,
  );
  assert.ok(Array.isArray(source.mediaCandidates), `${source.sourceId}: media candidates must be an array`);
  assert.match(source.rightsNote, /reference-only.*rights/i, `${source.sourceId}: missing rights note`);
  assert.equal(source.useStatus, "reference-only");
}

for (const topic of migratedBank.topics) {
  for (const sourceId of topic.sourceRefs) {
    assert.ok(
      sourceCatalog.sources.some((source) => source.sourceId === sourceId),
      `${topic.id}: missing catalog source ${sourceId}`,
    );
  }
}

const sourceCatalogById = new Map(sourceCatalog.sources.map((source) => [source.sourceId, source]));
assert.equal(Object.keys(globalSeeds.sourceRefs).length, 40);
for (const sourceRef of Object.keys(globalSeeds.sourceRefs)) {
  assert.ok(sourceCatalogById.has(sourceRef), `global sourceRef ${sourceRef} missing from catalog`);
}
for (const topic of globalSeeds.topics) {
  assert.equal(topic.copy.cards.length, 7, `${topic.id}: global copy.cards must have 7 entries`);
  assert.equal(topic.visualPlan.cardPlan.length, 7, `${topic.id}: global visualPlan.cardPlan must have 7 entries`);
  if (topic.visualPlan.cards !== undefined) {
    assert.equal(topic.visualPlan.cards.length, 7, `${topic.id}: global visualPlan.cards must have 7 entries`);
  }
  for (const sourceRef of topic.sourceRefs) {
    assert.ok(sourceCatalogById.has(sourceRef), `${topic.id}: global sourceRef ${sourceRef} missing from catalog`);
  }
  for (const packRef of topic.sourcePackRefs) {
    assert.ok(Object.hasOwn(sourcePackInputs, packRef), `${topic.id}: global sourcePackRef ${packRef} missing`);
  }
}
const migratedEventKeys = new Set(migratedBank.topics.map((topic) => topic.eventKey));
const messiEventKeys = new Set();
const messiFacts = new Set();
const forbiddenEarlyMessiCta =
  /피치체크|프로필\s*링크|프로필|설치|다운로드|사용\s*영상|\[피치체크\]|PitchCheck/i;
const directCta = /프로필\s*링크|설치|다운로드|\[피치체크\]|사용\s*영상/i;
const cardRoleCtaTerms =
  /피치체크|PitchCheck|프로필\s*링크|설치|다운로드|앱|구독|팔로우|좋아요|사용\s*영상|댓글/i;
const softBridgeForbiddenCta = cardRoleCtaTerms;
const pitchCheckCtaTerms = /피치체크|PitchCheck|프로필\s*링크|댓글/i;
const unrelatedCtaTerms = /설치|다운로드|앱|구독|팔로우|좋아요|사용\s*영상|웹사이트|뉴스레터|구매|신청|가입/i;

assert.deepEqual(
  validateStoryBank(messiSeeds, { expectedCount: 20 }),
  { topics: 20, uniqueEvents: 20 },
);
assert.equal(Object.keys(messiSeeds.sourceRefs).length, 20);
assert.equal(new Set(Object.keys(messiSeeds.sourceRefs)).size, 20);
assert.ok(Object.keys(messiSeeds.sourceRefs).every((sourceId) => /^messi_source_\d{2}$/.test(sourceId)));

const messiSeedByEventKey = new Map();
for (const topic of messiSeeds.topics) {
  assert.ok(typeof topic.evidence === "string" && topic.evidence.trim(), `${topic.id}: seed evidence must be non-empty`);
  assert.equal(messiSeedByEventKey.has(topic.eventKey), false, `${topic.id}: duplicate seed eventKey`);
  messiSeedByEventKey.set(topic.eventKey, topic);
}
assert.equal(new Set(messiKoreanIndex.map((entry) => entry.eventKey)).size, 20);
for (const entry of messiKoreanIndex) {
  const topic = messiSeedByEventKey.get(entry.eventKey);
  assert.ok(topic, `${entry.eventKey}: Korean index eventKey missing from Messi seeds`);
  assert.deepEqual(entry.sourceIds, topic.sourceRefs, `${entry.eventKey}: Korean index source IDs changed`);
}
for (const topic of messiSeeds.topics) {
  assert.equal(
    messiKoreanIndex.filter((entry) => entry.eventKey === topic.eventKey).length,
    1,
    `${topic.eventKey}: Korean index must contain the seed eventKey exactly once`,
  );
}

for (const sourceId of Object.keys(messiSeeds.sourceRefs)) {
  const source = sourceCatalogById.get(sourceId);
  assert.ok(source, `${sourceId}: missing persisted catalog record`);
  assert.match(source.url, /^https:\/\//, `${sourceId}: URL must use HTTPS`);
  assert.ok(["primary", "official", "reputable-secondary"].includes(source.tier), `${sourceId}: unexpected tier`);
  assert.equal(source.useStatus, "reference-only", `${sourceId}: useStatus must be reference-only`);
  assert.equal(source.sourcePack, "docs/research/real-player-stories/source-pack-02-messi.md");
}

for (const topic of messiSeeds.topics) {
  assert.ok(!migratedEventKeys.has(topic.eventKey), `${topic.id}: eventKey duplicates migrated topic`);
  assert.match(topic.eventKey, /^lionel-messi\|[^|]+\|[a-z0-9]+(?:-[a-z0-9]+)*$/, `${topic.id}: invalid eventKey`);
  assert.ok(!messiEventKeys.has(topic.eventKey), `${topic.id}: duplicate Messi eventKey`);
  assert.ok(!messiFacts.has(topic.fact), `${topic.id}: duplicate Messi fact`);
  messiEventKeys.add(topic.eventKey);
  messiFacts.add(topic.fact);

  assert.equal(topic.player, "Lionel Messi", `${topic.id}: player must be Lionel Messi`);
  assert.equal(topic.portfolio, "global_legend", `${topic.id}: portfolio must be global_legend`);
  assert.ok(typeof topic.category === "string" && topic.category.trim(), `${topic.id}: missing category`);
  assert.doesNotMatch(topic.category, /alternate-hook/i, `${topic.id}: alternate hooks are not allowed`);
  assert.ok(topic.eventDate === null || /^\d{4}-\d{2}-\d{2}$/.test(topic.eventDate), `${topic.id}: invalid eventDate`);
  for (const field of ["hook", "fact", "context", "whyFun", "shareTrigger", "evidence"]) {
    assert.ok(typeof topic[field] === "string" && topic[field].trim(), `${topic.id}: missing ${field}`);
  }
  assert.equal(topic.verification?.status, "verified", `${topic.id}: verification.status must be verified`);
  assert.ok(
    ["primary", "official", "reputable-secondary"].includes(topic.verification?.sourceTier),
    `${topic.id}: invalid sourceTier`,
  );
  assert.ok(Array.isArray(topic.sourceRefs) && topic.sourceRefs.length > 0, `${topic.id}: missing sourceRefs`);
  assert.ok(Array.isArray(topic.sourcePackRefs) && topic.sourcePackRefs.length > 0, `${topic.id}: missing sourcePackRefs`);
  for (const sourceRef of topic.sourceRefs) {
    assert.ok(sourceCatalogById.has(sourceRef), `${topic.id}: sourceRef ${sourceRef} missing from catalog`);
    assert.ok(Object.hasOwn(messiSeeds.sourceRefs, sourceRef), `${topic.id}: sourceRef ${sourceRef} must be Messi-specific`);
  }
  for (const packRef of topic.sourcePackRefs) {
    assert.ok(Object.hasOwn(sourcePackInputs, packRef), `${topic.id}: missing source pack ${packRef}`);
    assert.equal(packRef, "docs/research/real-player-stories/source-pack-02-messi.md");
  }
  assert.ok(Array.isArray(topic.visualPlan?.queries), `${topic.id}: visualPlan.queries must be an array`);
  assert.ok(topic.visualPlan.queries.length >= 5, `${topic.id}: visualPlan.queries must have at least 5 entries`);
  assert.equal(topic.visualPlan?.usageStatus, "reference-only", `${topic.id}: visualPlan usageStatus`);
  assert.ok(Array.isArray(topic.visualPlan?.cardPlan), `${topic.id}: visualPlan.cardPlan must be an array`);
  assert.equal(topic.visualPlan.cardPlan.length, 7, `${topic.id}: visualPlan.cardPlan must have 7 entries`);
  assert.equal(topic.copy.cards.length, 7, `${topic.id}: copy.cards must have 7 entries`);
  for (const [index, card] of topic.copy.cards.entries()) {
    const text = JSON.stringify(card);
    if (index < 5) {
      assert.doesNotMatch(text, forbiddenEarlyMessiCta, `${topic.id}: card ${index + 1} has early CTA`);
    }
    if (index === 5) {
      assert.doesNotMatch(text, directCta, `${topic.id}: card 6 has direct CTA`);
    }
  }
  for (const [index, card] of topic.copy.cards.entries()) {
    const text = JSON.stringify(card);
    if (index <= 4) {
      assert.doesNotMatch(text, cardRoleCtaTerms, `${topic.id}: cards 0-4 must not contain CTA terms`);
    } else if (index === 5) {
      assert.doesNotMatch(text, softBridgeForbiddenCta, `${topic.id}: card 5 must remain a soft bridge`);
    } else {
      assert.match(text, pitchCheckCtaTerms, `${topic.id}: card 6 must contain the PitchCheck CTA`);
      assert.match(text, /프로필\s*링크/, `${topic.id}: card 6 must contain the profile-link bridge`);
      assert.match(text, /\[피치체크\]/, `${topic.id}: card 6 must contain the comment keyword`);
      const nonPitchCheckCtaText = text.replace(/피치체크|PitchCheck|프로필\s*링크|댓글/gi, "");
      assert.doesNotMatch(
        nonPitchCheckCtaText,
        unrelatedCtaTerms,
        `${topic.id}: card 6 has an unrelated CTA`,
      );
    }
  }
  assert.match(JSON.stringify(topic.copy.cards[6]), /프로필\s*링크/, `${topic.id}: card 7 missing profile link`);
  assert.match(JSON.stringify(topic.copy.cards[6]), /\[피치체크\]/, `${topic.id}: card 7 missing comment keyword`);
}

const messi005 = messiSeedByEventKey.get("lionel-messi|2003|porto-friendly-debut");
const messi012 = messiSeeds.topics.find((topic) => topic.id === "messi-012-inter-miami-most-trophies-record");
const messiRetirement = messiSeeds.topics.find(
  (topic) => topic.id === "messi-013-international-retirement-announcement",
);
assert.deepEqual(messi005?.sourceRefs, ["messi_source_05"]);
assert.match(messi005?.copy.cards[3] ?? "", /(?:^|[^0-9])71분(?:[^0-9]|$)/);
assert.doesNotMatch(messi005?.copy.cards[3] ?? "", /다음 해|공식 데뷔/);
assert.deepEqual(messi012?.sourceRefs, ["messi_source_20"]);
assert.equal(messi012?.eventKey, "lionel-messi|2023|inter-miami-most-trophies-record");
assert.deepEqual(messiRetirement?.sourceRefs, ["messi_source_13"]);
assert.doesNotMatch(JSON.stringify(messiRetirement), /이후의 복귀|나중의 코파 우승|월드컵 우승|훗날의 반전/);
assert.deepEqual(
  messiKoreanIndex.find((entry) => entry.eventKey === messi012?.eventKey)?.sourceIds,
  ["messi_source_20"],
);
assert.deepEqual(
  messiKoreanIndex.find((entry) => entry.eventKey === messi005?.eventKey)?.sourceIds,
  ["messi_source_05"],
);
assert.deepEqual(
  messiKoreanIndex.find((entry) => entry.eventKey === messiRetirement?.eventKey)?.sourceIds,
  ["messi_source_13"],
);

assert.equal(messiEventKeys.size, 20);
assert.equal(messiFacts.size, 20);
assert.equal(
  messiSeeds.topics.find((topic) => topic.id === "messi-003-napkin-contract")?.eventKey,
  "lionel-messi|2000|napkin-contract",
);
assert.equal(sourceCatalogById.get("messi_source_03")?.tier, "primary");

const ronaldoEventKeys = new Set();
const ronaldoFacts = new Set();
const ronaldoSeedByEventKey = new Map();
const ronaldoCtaTerms = /PitchCheck|피치체크|프로필 링크|다운로드|설치|\[피치체크\]/i;
const ronaldoUnrelatedCtaTerms = /구독|구매|신청|뉴스레터|알림|설치|다운로드/i;

assert.deepEqual(
  validateStoryBank(ronaldoSeeds, { expectedCount: 20 }),
  { topics: 20, uniqueEvents: 20 },
);
assert.equal(Object.keys(ronaldoSeeds.sourceRefs).length, 20);
assert.ok(Object.keys(ronaldoSeeds.sourceRefs).every((sourceId) => /^ronaldo_source_\d{2}$/.test(sourceId)));
assert.equal(new Set(ronaldoKoreanIndex.map((entry) => entry.eventKey)).size, 20);

for (const entry of ronaldoKoreanIndex) {
  const topic = ronaldoSeeds.topics.find((candidate) => candidate.eventKey === entry.eventKey);
  assert.ok(topic, `${entry.eventKey}: Korean index eventKey missing from Ronaldo seeds`);
  assert.deepEqual(entry.sourceIds, topic.sourceRefs, `${entry.eventKey}: Korean index source IDs changed`);
}
for (const topic of ronaldoSeeds.topics) {
  assert.equal(
    ronaldoKoreanIndex.filter((entry) => entry.eventKey === topic.eventKey).length,
    1,
    `${topic.eventKey}: Korean index must contain the seed eventKey exactly once`,
  );
}

for (const sourceId of Object.keys(ronaldoSeeds.sourceRefs)) {
  const source = sourceCatalogById.get(sourceId);
  assert.ok(source, `${sourceId}: missing persisted catalog record`);
  assert.match(source.url, /^https:\/\//, `${sourceId}: URL must use HTTPS`);
  assert.ok(["primary", "official", "reputable-secondary"].includes(source.tier), `${sourceId}: unexpected tier`);
  assert.equal(source.useStatus, "reference-only", `${sourceId}: useStatus must be reference-only`);
  assert.equal(source.sourcePack, "docs/research/real-player-stories/source-pack-03-ronaldo.md");
}

for (const topic of ronaldoSeeds.topics) {
  assert.match(topic.eventKey, /^cristiano-ronaldo\|[^|]+\|[a-z0-9]+(?:-[a-z0-9]+)*$/, `${topic.id}: invalid eventKey`);
  assert.equal(ronaldoEventKeys.has(topic.eventKey), false, `${topic.id}: duplicate Ronaldo eventKey`);
  assert.equal(ronaldoFacts.has(topic.fact), false, `${topic.id}: duplicate Ronaldo fact`);
  ronaldoEventKeys.add(topic.eventKey);
  ronaldoFacts.add(topic.fact);
  ronaldoSeedByEventKey.set(topic.eventKey, topic);

  assert.equal(topic.player, "Cristiano Ronaldo", `${topic.id}: player must be Cristiano Ronaldo`);
  assert.equal(topic.portfolio, "global_legend", `${topic.id}: portfolio must be global_legend`);
  assert.ok(typeof topic.category === "string" && topic.category.trim(), `${topic.id}: missing category`);
  assert.ok(topic.eventDate === null || /^\d{4}-\d{2}-\d{2}$/.test(topic.eventDate), `${topic.id}: invalid eventDate`);
  for (const field of ["hook", "fact", "context", "whyFun", "shareTrigger", "evidence"]) {
    assert.ok(typeof topic[field] === "string" && topic[field].trim(), `${topic.id}: missing ${field}`);
  }
  assert.equal(topic.verification?.status, "verified", `${topic.id}: verification.status must be verified`);
  assert.ok(
    ["primary", "official", "reputable-secondary"].includes(topic.verification?.sourceTier),
    `${topic.id}: invalid sourceTier`,
  );
  assert.ok(Array.isArray(topic.sourceRefs) && topic.sourceRefs.length > 0, `${topic.id}: missing sourceRefs`);
  assert.ok(Array.isArray(topic.sourcePackRefs) && topic.sourcePackRefs.length > 0, `${topic.id}: missing sourcePackRefs`);
  for (const sourceRef of topic.sourceRefs) {
    assert.ok(sourceCatalogById.has(sourceRef), `${topic.id}: sourceRef ${sourceRef} missing from catalog`);
    assert.ok(Object.hasOwn(ronaldoSeeds.sourceRefs, sourceRef), `${topic.id}: sourceRef ${sourceRef} must be Ronaldo-specific`);
  }
  for (const packRef of topic.sourcePackRefs) {
    assert.ok(Object.hasOwn(sourcePackInputs, packRef), `${topic.id}: missing source pack ${packRef}`);
    assert.equal(packRef, "docs/research/real-player-stories/source-pack-03-ronaldo.md");
  }
  assert.ok(Array.isArray(topic.visualPlan?.queries), `${topic.id}: visualPlan.queries must be an array`);
  assert.ok(topic.visualPlan.queries.length >= 5, `${topic.id}: visualPlan.queries must have at least 5 entries`);
  assert.equal(topic.visualPlan?.usageStatus, "reference-only", `${topic.id}: visualPlan usageStatus`);
  assert.ok(Array.isArray(topic.visualPlan?.cardPlan), `${topic.id}: visualPlan.cardPlan must be an array`);
  assert.equal(topic.visualPlan.cardPlan.length, 7, `${topic.id}: visualPlan.cardPlan must have 7 entries`);
  assert.ok(Array.isArray(topic.visualPlan?.cards), `${topic.id}: visualPlan.cards must be an array`);
  assert.equal(topic.visualPlan.cards.length, 7, `${topic.id}: visualPlan.cards must have 7 entries`);
  for (const [index, visualCard] of topic.visualPlan.cards.entries()) {
    assert.equal(visualCard.card, index + 1, `${topic.id}: visualPlan.cards[${index}].card must match its position`);
    assert.ok(typeof visualCard.crop === "string" && visualCard.crop.trim(), `${topic.id}: card ${index + 1} missing crop`);
    assert.ok(
      typeof visualCard.subject === "string" && visualCard.subject.trim(),
      `${topic.id}: card ${index + 1} missing primary subject`,
    );
    assert.ok(
      typeof visualCard.prompt === "string" && visualCard.prompt.trim(),
      `${topic.id}: card ${index + 1} missing reproducible image prompt`,
    );
    assert.match(visualCard.prompt, /reference-only/i, `${topic.id}: card ${index + 1} prompt must be reference-only`);
    assert.equal(
      visualCard.usageStatus,
      "reference-only",
      `${topic.id}: card ${index + 1} usageStatus must be reference-only`,
    );
  }
  assert.equal(topic.copy.cards.length, 7, `${topic.id}: copy.cards must have 7 entries`);
  for (const [index, card] of topic.copy.cards.entries()) {
    const text = JSON.stringify(card);
    if (index < 5) {
      assert.doesNotMatch(text, ronaldoCtaTerms, `${topic.id}: cards 1-5 must remain sourced story`);
    } else if (index === 5) {
      assert.doesNotMatch(text, ronaldoCtaTerms, `${topic.id}: card 6 must remain a soft amateur-team bridge`);
    } else {
      assert.match(text, /PitchCheck|피치체크/i, `${topic.id}: card 7 must contain the PitchCheck CTA`);
      assert.match(text, /프로필 링크/i, `${topic.id}: card 7 must contain the profile link`);
      assert.match(text, /\[피치체크\]/, `${topic.id}: card 7 must contain the comment keyword`);
      const ctaOnlyText = text.replace(/PitchCheck|피치체크|프로필 링크|\[피치체크\]/gi, "");
      assert.doesNotMatch(ctaOnlyText, ronaldoUnrelatedCtaTerms, `${topic.id}: card 7 has an unrelated CTA`);
    }
  }
}

assert.deepEqual(
  ronaldoSeedByEventKey.get("cristiano-ronaldo|2003|manchester-united-debut")?.sourceRefs,
  ["ronaldo_source_05"],
);
assert.match(
  ronaldoSeedByEventKey.get("cristiano-ronaldo|2008|champions-league-final-penalty")?.copy.cards[2] ?? "",
  /승부차기|penalty/i,
);
assert.deepEqual(
  ronaldoSeedByEventKey.get("cristiano-ronaldo|2013|sweden-playoff-hat-trick")?.sourceRefs,
  ["ronaldo_source_09"],
);
assert.match(
  ronaldoSeedByEventKey.get("cristiano-ronaldo|2022|seven-hundredth-club-goal")?.fact ?? "",
  /700/,
);
assert.equal(sourceCatalogById.get("ronaldo_source_01")?.tier, "official");

assert.deepEqual(
  validateStoryBank(mbappeHaalandSeeds, { expectedCount: 20 }),
  { topics: 20, uniqueEvents: 20 },
);
for (const player of ["Kylian Mbappe", "Erling Haaland"]) {
  assert.ok(
    roster.some((subject) => subject.displayName === player && subject.portfolio === "current_star"),
    `${player}: batch player must exist in the current_star roster`,
  );
}
assert.equal(Object.keys(mbappeHaalandSeeds.sourceRefs).length, 12);
assert.equal(new Set(mbappeHaalandKoreanIndex.map((entry) => entry.eventKey)).size, 20);
assert.deepEqual(
  Object.fromEntries(
    [...new Set(mbappeHaalandSeeds.topics.map((topic) => topic.player))].map((player) => [
      player,
      mbappeHaalandSeeds.topics.filter((topic) => topic.player === player).length,
    ]),
  ),
  { "Kylian Mbappe": 10, "Erling Haaland": 10 },
);

const mbappeHaalandByEventKey = new Map(
  mbappeHaalandSeeds.topics.map((topic) => [topic.eventKey, topic]),
);
const mbappeHaalandActiveSourceIds = new Set(Object.keys(mbappeHaalandSeeds.sourceRefs));
const mbappeHaalandTopicSourceIds = new Set(mbappeHaalandSeeds.topics.flatMap((topic) => topic.sourceRefs));
assert.deepEqual(
  [...mbappeHaalandActiveSourceIds].sort(),
  [...mbappeHaalandTopicSourceIds].sort(),
  "Mbappe/Haaland active source IDs must equal the union of topic sourceRefs",
);
const mbappeHaalandCatalogSourceIds = new Set(
  sourceCatalog.sources
    .filter((source) => source.sourcePack === "docs/research/real-player-stories/source-pack-04-mbappe-haaland.md")
    .map((source) => source.sourceId),
);
assert.deepEqual(
  [...mbappeHaalandCatalogSourceIds].sort(),
  [...mbappeHaalandActiveSourceIds].sort(),
  "Mbappe/Haaland catalog must not contain unused batch source records",
);
const mbappeHaalandNoneFoundSourceIds = new Set([
  "mbappe_source_01",
  "mbappe_source_02",
  "mbappe_source_03",
  "mbappe_source_04",
  "haaland_source_01",
  "haaland_source_02",
  "haaland_source_10",
]);
const mbappeHaalandExpectedGrounding = new Map([
  ["mbappe-004-monaco-manchester-city-two-leg-scoring", ["mbappe_source_05"]],
  ["mbappe-005-five-champions-league-goals-at-eighteen", ["mbappe_source_07"]],
  ["mbappe-007-uefa-competition-debut-before-sixteen", ["mbappe_source_10"]],
  ["mbappe-010-france-all-time-top-scorer", ["mbappe_source_10"]],
  ["haaland-001-youngest-champions-league-first-half-hat-trick", ["haaland_source_03"]],
  ["haaland-002-eight-goals-in-first-five-champions-league-appearances", ["haaland_source_05"]],
  ["haaland-009-fastest-fifty-champions-league-goals", ["haaland_source_05"]],
]);
function mbappeHaalandSourceSnippets(sourceRef) {
  const match = /^(mbappe|haaland)_source_(\d+)$/.exec(sourceRef);
  assert.ok(match, `${sourceRef}: malformed Mbappe/Haaland source ID`);
  const sourceNumber = Number(match[2]) + (match[1] === "haaland" ? 10 : 0);
  const pack = sourcePackInputs["docs/research/real-player-stories/source-pack-04-mbappe-haaland.md"];
  const section = pack
    .split(/^## Source /m)
    .find((candidate) => candidate.startsWith(`${sourceNumber}:`));
  assert.ok(section, `${sourceRef}: missing source section in the batch source pack`);
  const snippets = section.match(/### Useful Text Snippets\s*\n([\s\S]*?)(?=\n### |\n## |$)/);
  assert.ok(snippets, `${sourceRef}: missing Useful Text Snippets block`);
  return snippets[1];
}
for (const topic of mbappeHaalandSeeds.topics) {
  for (const sourceRef of topic.sourceRefs) {
    assert.equal(
      mbappeHaalandNoneFoundSourceIds.has(sourceRef),
      false,
      `${topic.id}: batch must not use a source whose Useful Text Snippets are _None found._`,
    );
    assert.doesNotMatch(
      mbappeHaalandSourceSnippets(sourceRef),
      /^_None found\._\s*$/,
      `${topic.id}: ${sourceRef} has no explicit Scrapling Useful Text Snippets`,
    );
  }
}
for (const [topicId, expectedSourceRefs] of mbappeHaalandExpectedGrounding) {
  const topic = mbappeHaalandSeeds.topics.find((candidate) => candidate.id === topicId);
  assert.ok(topic, `${topicId}: targeted grounded replacement topic is missing`);
  assert.deepEqual(topic.sourceRefs, expectedSourceRefs, `${topicId}: targeted source mapping changed`);
}
for (const entry of mbappeHaalandKoreanIndex) {
  const topic = mbappeHaalandByEventKey.get(entry.eventKey);
  assert.ok(topic, `${entry.eventKey}: Korean index eventKey missing from Mbappe/Haaland seeds`);
  assert.deepEqual(entry.sourceIds, topic.sourceRefs, `${entry.eventKey}: Korean index source IDs changed`);
}
for (const topic of mbappeHaalandSeeds.topics) {
  assert.equal(
    mbappeHaalandKoreanIndex.filter((entry) => entry.eventKey === topic.eventKey).length,
    1,
    `${topic.eventKey}: Korean index must contain the seed eventKey exactly once`,
  );
  assert.equal(topic.portfolio, "current_star", `${topic.id}: portfolio must be current_star`);
  assert.ok(typeof topic.evidence === "string" && topic.evidence.trim(), `${topic.id}: missing evidence`);
  assert.ok(topic.eventDate === null || /^\d{4}-\d{2}-\d{2}$/.test(topic.eventDate), `${topic.id}: invalid eventDate`);
  assert.ok(Array.isArray(topic.sourceRefs) && topic.sourceRefs.length > 0, `${topic.id}: missing sourceRefs`);
  assert.ok(Array.isArray(topic.sourcePackRefs) && topic.sourcePackRefs.length === 1, `${topic.id}: sourcePackRefs shape`);
  assert.equal(
    topic.sourcePackRefs[0],
    "docs/research/real-player-stories/source-pack-04-mbappe-haaland.md",
    `${topic.id}: wrong source pack`,
  );
  for (const sourceRef of topic.sourceRefs) {
    assert.ok(Object.hasOwn(mbappeHaalandSeeds.sourceRefs, sourceRef), `${topic.id}: sourceRef must be batch-specific`);
    assert.equal(sourceCatalogById.get(sourceRef)?.sourcePack, "docs/research/real-player-stories/source-pack-04-mbappe-haaland.md");
  }
  assert.equal(topic.copy.cards.length, 7, `${topic.id}: copy.cards must have 7 entries`);
  assert.ok(Array.isArray(topic.visualPlan?.queries) && topic.visualPlan.queries.length >= 5, `${topic.id}: visual queries`);
  assert.equal(topic.visualPlan?.usageStatus, "reference-only", `${topic.id}: visual usageStatus`);
  assert.equal(topic.visualPlan?.cardPlan?.length, 7, `${topic.id}: visual cardPlan`);
  assert.equal(topic.visualPlan?.cards?.length, 7, `${topic.id}: visual cards`);
  for (const [index, visualCard] of topic.visualPlan.cards.entries()) {
    assert.equal(visualCard.card, index + 1, `${topic.id}: visual card numbering`);
    for (const field of ["crop", "subject", "prompt", "usageStatus"]) {
      assert.ok(typeof visualCard[field] === "string" && visualCard[field].trim(), `${topic.id}: card ${index + 1} missing ${field}`);
    }
    assert.match(visualCard.prompt, /reference-only/i, `${topic.id}: visual prompt must be reference-only`);
    assert.equal(visualCard.usageStatus, "reference-only", `${topic.id}: visual card usageStatus`);
  }
  for (const [index, card] of topic.copy.cards.entries()) {
    const text = JSON.stringify(card);
    if (index < 6) {
      assert.doesNotMatch(text, /PitchCheck|피치체크|\[피치체크\]/i, `${topic.id}: early card CTA`);
    } else {
      assert.match(text, /피치체크|PitchCheck/i, `${topic.id}: final card CTA`);
      assert.match(text, /\[피치체크\]/, `${topic.id}: final card comment keyword`);
    }
  }
}
for (const sourceRef of Object.keys(mbappeHaalandSeeds.sourceRefs)) {
  const source = sourceCatalogById.get(sourceRef);
  assert.ok(source, `${sourceRef}: missing persisted catalog record`);
  assert.equal(source.useStatus, "reference-only", `${sourceRef}: useStatus must be reference-only`);
  assert.equal(source.sourcePack, "docs/research/real-player-stories/source-pack-04-mbappe-haaland.md");
}

assert.deepEqual(
  validateStoryBank(sonSalahSeeds, { expectedCount: 20 }),
  { topics: 20, uniqueEvents: 20 },
);
assert.equal(Object.keys(sonSalahSeeds.sourceRefs).length, 20);
assert.ok(Object.keys(sonSalahSeeds.sourceRefs).every((sourceId) => /^(son|salah)_source_\d{2}$/.test(sourceId)));
assert.deepEqual(
  Object.fromEntries(
    [...new Set(sonSalahSeeds.topics.map((topic) => topic.player))].map((player) => [
      player,
      sonSalahSeeds.topics.filter((topic) => topic.player === player).length,
    ]),
  ),
  { "Son Heung-min": 12, "Mohamed Salah": 8 },
);
const sonSalahByEventKey = new Map(sonSalahSeeds.topics.map((topic) => [topic.eventKey, topic]));
const sonSalahFacts = new Set();
const sonSalahActiveSourceIds = new Set(Object.keys(sonSalahSeeds.sourceRefs));
const sonSalahTopicSourceIds = new Set(sonSalahSeeds.topics.flatMap((topic) => topic.sourceRefs));
assert.deepEqual(
  [...sonSalahActiveSourceIds].sort(),
  [...sonSalahTopicSourceIds].sort(),
  "Son/Salah active source IDs must equal the union of topic sourceRefs",
);
const sonSalahCatalogSourceIds = new Set(
  sourceCatalog.sources
    .filter((source) => source.sourcePack === "docs/research/real-player-stories/source-pack-05-son-salah.md")
    .map((source) => source.sourceId),
);
assert.deepEqual(
  [...sonSalahCatalogSourceIds].sort(),
  [...sonSalahActiveSourceIds].sort(),
  "Son/Salah catalog must not contain unused batch source records",
);
function sonSalahSourceSnippets(sourceRef) {
  const match = /^(son|salah)_source_(\d+)$/.exec(sourceRef);
  assert.ok(match, `${sourceRef}: malformed Son/Salah source ID`);
  const sourceNumber = Number(match[2]) + (match[1] === "salah" ? 12 : 0);
  const pack = sourcePackInputs["docs/research/real-player-stories/source-pack-05-son-salah.md"];
  const section = pack
    .split(/^## Source /m)
    .find((candidate) => candidate.startsWith(`${sourceNumber}:`));
  assert.ok(section, `${sourceRef}: missing source section in the Son/Salah source pack`);
  const snippets = section.match(/### Useful Text Snippets\s*\n([\s\S]*?)(?=\n### |\n## |$)/);
  assert.ok(snippets, `${sourceRef}: missing Useful Text Snippets block`);
  return snippets[1];
}
for (const topic of sonSalahSeeds.topics) {
  assert.match(topic.eventKey, /^(son-heung-min|mohamed-salah)\|[^|]+\|[a-z0-9]+(?:-[a-z0-9]+)*$/, `${topic.id}: invalid eventKey`);
  assert.equal(sonSalahFacts.has(topic.fact), false, `${topic.id}: duplicate fact`);
  sonSalahFacts.add(topic.fact);
  assert.equal(topic.verification?.status, "verified", `${topic.id}: verification.status must be verified`);
  assert.equal(topic.verification?.sourceTier, "official", `${topic.id}: sourceTier must be official`);
  assert.equal(
    topic.portfolio,
    topic.player === "Son Heung-min" ? "korea_asia" : "current_star",
    `${topic.id}: wrong portfolio`,
  );
  assert.ok(Array.isArray(topic.sourceRefs) && topic.sourceRefs.length > 0, `${topic.id}: missing sourceRefs`);
  assert.deepEqual(topic.sourcePackRefs, ["docs/research/real-player-stories/source-pack-05-son-salah.md"]);
  for (const sourceRef of topic.sourceRefs) {
    assert.ok(Object.hasOwn(sonSalahSeeds.sourceRefs, sourceRef), `${topic.id}: sourceRef must be batch-specific`);
    assert.equal(sourceCatalogById.get(sourceRef)?.sourcePack, "docs/research/real-player-stories/source-pack-05-son-salah.md");
    assert.equal(sourceCatalogById.get(sourceRef)?.useStatus, "reference-only");
    assert.doesNotMatch(sonSalahSourceSnippets(sourceRef), /^_None found\._\s*$/, `${topic.id}: ${sourceRef} has no usable snippet`);
  }
  assert.equal(topic.copy?.framework, "AIDA", `${topic.id}: copy framework must be AIDA`);
  assert.deepEqual(
    topic.copy?.cardStages,
    ["attention", "interest", "desire", "proof", "action", "bridge", "cta"],
    `${topic.id}: AIDA card stages changed`,
  );
  assert.equal(topic.copy.cards.length, 7, `${topic.id}: copy.cards must have 7 entries`);
  assert.ok(Array.isArray(topic.visualPlan?.queries) && topic.visualPlan.queries.length >= 5, `${topic.id}: visual queries`);
  assert.equal(topic.visualPlan?.usageStatus, "reference-only", `${topic.id}: visual usageStatus`);
  assert.equal(topic.visualPlan?.cardPlan?.length, 7, `${topic.id}: visual cardPlan`);
  assert.equal(topic.visualPlan?.cards?.length, 7, `${topic.id}: visual cards`);
  for (const [index, visualCard] of topic.visualPlan.cards.entries()) {
    assert.equal(visualCard.card, index + 1, `${topic.id}: visual card numbering`);
    for (const field of ["crop", "subject", "prompt", "usageStatus"]) {
      assert.ok(typeof visualCard[field] === "string" && visualCard[field].trim(), `${topic.id}: card ${index + 1} missing ${field}`);
    }
    assert.match(visualCard.prompt, /reference-only/i, `${topic.id}: visual prompt must be reference-only`);
    assert.equal(visualCard.usageStatus, "reference-only", `${topic.id}: visual card usageStatus`);
  }
  for (const [index, card] of topic.copy.cards.entries()) {
    const text = JSON.stringify(card);
    if (index < 6) {
      assert.doesNotMatch(text, /PitchCheck|피치체크|프로필 링크|\[피치체크\]/i, `${topic.id}: early card CTA`);
    } else {
      assert.match(text, /PitchCheck|피치체크/i, `${topic.id}: final card CTA`);
      assert.match(text, /프로필 링크/i, `${topic.id}: final card profile link`);
      assert.match(text, /\[피치체크\]/, `${topic.id}: final card comment keyword`);
    }
  }
}
for (const entry of sonSalahKoreanIndex) {
  const topic = sonSalahByEventKey.get(entry.eventKey);
  assert.ok(topic, `${entry.eventKey}: Korean index eventKey missing from Son/Salah seeds`);
  assert.deepEqual(entry.sourceIds, topic.sourceRefs, `${entry.eventKey}: Korean index source IDs changed`);
}
assert.equal(new Set(sonSalahKoreanIndex.map((entry) => entry.eventKey)).size, 20);
assert.equal(sonSalahFacts.size, 20);

assert.deepEqual(
  validateStoryBank(womenSeeds, { expectedCount: 20 }),
  { topics: 20, uniqueEvents: 20 },
);
assert.equal(Object.keys(womenSeeds.sourceRefs).length, 20);
assert.ok(Object.keys(womenSeeds.sourceRefs).every((sourceId) => /^(marta|alexia|aitana|sam|christine|ji)_source_\d{2}$/.test(sourceId)));
assert.deepEqual(
  Object.fromEntries(
    [...new Set(womenSeeds.topics.map((topic) => topic.player))].map((player) => [
      player,
      womenSeeds.topics.filter((topic) => topic.player === player).length,
    ]),
  ),
  { Marta: 5, "Alexia Putellas": 4, "Aitana Bonmati": 4, "Sam Kerr": 3, "Christine Sinclair": 3, "Ji So-yun": 1 },
);
const womenPackPath = "docs/research/real-player-stories/source-pack-06-women.md";
const womenPack = sourcePackInputs[womenPackPath];
assert.equal((womenPack.match(/^## Source /gm) ?? []).length, 20, "women source pack must contain 20 sources");
assert.doesNotMatch(womenPack, /None found/i, "women source pack must not contain empty Scrapling sections");
const womenActiveSourceIds = new Set(Object.keys(womenSeeds.sourceRefs));
const womenTopicSourceIds = new Set(womenSeeds.topics.flatMap((topic) => topic.sourceRefs));
assert.deepEqual(
  [...womenActiveSourceIds].sort(),
  [...womenTopicSourceIds].sort(),
  "women active source IDs must equal the union of topic sourceRefs",
);
const womenCatalogSourceIds = new Set(
  sourceCatalog.sources.filter((source) => source.sourcePack === womenPackPath).map((source) => source.sourceId),
);
assert.deepEqual(
  [...womenCatalogSourceIds].sort(),
  [...womenActiveSourceIds].sort(),
  "women catalog must contain only active batch source records",
);
function womenSourceSnippets(sourceRef) {
  const url = womenSeeds.sourceRefs[sourceRef];
  assert.ok(url, `${sourceRef}: missing women source URL`);
  const section = womenPack.split(/^## Source /m).find((candidate) => candidate.includes(`- URL: ${url}`));
  assert.ok(section, `${sourceRef}: missing source section in women source pack`);
  const snippets = section.match(/### Useful Text Snippets\s*\n([\s\S]*?)(?=\n### |\n## |$)/);
  assert.ok(snippets, `${sourceRef}: missing Useful Text Snippets block`);
  assert.doesNotMatch(snippets[1], /^_None found\._\s*$/m, `${sourceRef}: source has no usable snippet`);
  return snippets[1];
}
const womenFacts = new Set();
const womenTopicsByEventKey = new Map(womenSeeds.topics.map((topic) => [topic.eventKey, topic]));
for (const topic of womenSeeds.topics) {
  assert.equal(topic.portfolio, "women", `${topic.id}: wrong women portfolio`);
  assert.equal(topic.verification?.status, "verified", `${topic.id}: verification.status must be verified`);
  assert.equal(topic.verification?.sourceTier, "official", `${topic.id}: sourceTier must be official`);
  assert.equal(womenFacts.has(topic.fact), false, `${topic.id}: duplicate women fact`);
  womenFacts.add(topic.fact);
  assert.deepEqual(topic.sourcePackRefs, [womenPackPath]);
  assert.ok(Array.isArray(topic.sourceRefs) && topic.sourceRefs.length > 0, `${topic.id}: missing sourceRefs`);
  for (const sourceRef of topic.sourceRefs) {
    assert.ok(Object.hasOwn(womenSeeds.sourceRefs, sourceRef), `${topic.id}: sourceRef must be batch-specific`);
    assert.equal(sourceCatalogById.get(sourceRef)?.sourcePack, womenPackPath);
    assert.equal(sourceCatalogById.get(sourceRef)?.useStatus, "reference-only");
    womenSourceSnippets(sourceRef);
  }
  assert.equal(topic.copy?.framework, "AIDA", `${topic.id}: copy framework must be AIDA`);
  assert.deepEqual(topic.copy?.cardStages, ["attention", "interest", "desire", "proof", "action", "bridge", "cta"]);
  assert.equal(topic.copy.cards.length, 7, `${topic.id}: copy.cards must have 7 entries`);
  assert.equal(topic.visualPlan?.aspectRatio, "4:5", `${topic.id}: visual aspect ratio`);
  assert.equal(topic.visualPlan?.usageStatus, "reference-only", `${topic.id}: visual usageStatus`);
  assert.ok(Array.isArray(topic.visualPlan?.queries) && topic.visualPlan.queries.length >= 3, `${topic.id}: visual queries`);
  assert.equal(topic.visualPlan?.cards?.length, 7, `${topic.id}: visual cards`);
  for (const [index, visualCard] of topic.visualPlan.cards.entries()) {
    assert.equal(visualCard.card, index + 1, `${topic.id}: visual card numbering`);
    for (const field of ["crop", "subject", "prompt", "usageStatus"]) {
      assert.ok(typeof visualCard[field] === "string" && visualCard[field].trim(), `${topic.id}: card ${index + 1} missing ${field}`);
    }
    assert.match(visualCard.prompt, /reference-only/i, `${topic.id}: visual prompt must be reference-only`);
    assert.equal(visualCard.usageStatus, "reference-only", `${topic.id}: visual card usageStatus`);
  }
  for (const [index, card] of topic.copy.cards.entries()) {
    const text = JSON.stringify(card);
    if (index < 6) {
      assert.doesNotMatch(text, /피치체크|프로필 링크|\[피치체크\]/i, `${topic.id}: early card CTA`);
    } else {
      assert.match(text, /피치체크/i, `${topic.id}: final card CTA`);
      assert.match(text, /프로필 링크/i, `${topic.id}: final card profile link`);
      assert.match(text, /\[피치체크\]/, `${topic.id}: final card comment keyword`);
    }
  }
}
for (const entry of womenKoreanIndex) {
  const topic = womenTopicsByEventKey.get(entry.eventKey);
  assert.ok(topic, `${entry.eventKey}: Korean women index eventKey missing from seeds`);
  assert.deepEqual(entry.sourceIds, topic.sourceRefs, `${entry.eventKey}: Korean women index source IDs changed`);
}
assert.equal(new Set(womenKoreanIndex.map((entry) => entry.eventKey)).size, 20);
assert.equal(womenFacts.size, 20);

function assertGroundedTarget(topicId, sourceRef, claimPatterns, evidencePatterns) {
  const topic = sonSalahSeeds.topics.find((candidate) => candidate.id === topicId);
  assert.ok(topic, `${topicId}: targeted grounding topic missing`);
  assert.ok(topic.sourceRefs.includes(sourceRef), `${topicId}: expected source ID ${sourceRef}`);
  const topicClaims = [topic.hook, topic.fact, topic.context, ...topic.copy.cards.slice(0, 5)].join("\n");
  const sourceEvidence = sonSalahSourceSnippets(sourceRef);
  for (const pattern of claimPatterns) {
    assert.match(topicClaims, pattern, `${topicId}: key claim missing from hook/fact/context/copy`);
  }
  for (const pattern of evidencePatterns) {
    assert.match(sourceEvidence, pattern, `${topicId}: source evidence missing ${pattern}`);
  }
  assert.doesNotMatch(sourceEvidence, /(?:against|joined|star is|short of the|goals and)\s*$/m, `${topicId}: source evidence is truncated`);
}

assertGroundedTarget(
  "son-005-first-asian-premier-league-century",
  "son_source_05",
  [/브라이턴/, /100호 골/, /첫 아시아 선수/],
  [/Published 08 Apr 2023\./, /By scoring the opener against Brighton & Hove Albion, Son Heung-min joined/, /first Asian player to reach the milestone/],
);
assertGroundedTarget(
  "son-006-shared-golden-boot-23",
  "son_source_06",
  [/노리치전/, /23골/, /살라/],
  [/Son Heung-min shared the Castrol Golden Boot award with Salah, scoring twice in a 5-0 win over Norwich while Salah scored once against Wolves\. Both finished on 23 goals\./],
);
assertGroundedTarget(
  "son-010-47-premier-league-appearances",
  "son_source_10",
  [/2022\/23/, /47경기/, /해리 케인\(49\)/],
  [/2022\/23 season came to a close/, /Heung-Min Son \(47\) and Ivan Perisic \(44\) complete the top three/],
);
assertGroundedTarget(
  "son-011-asian-champions-league-scoring-leader",
  "son_source_11",
  [/19골/, /메흐디 타레미/, /막심 샤츠키흐/],
  [/19: Heung-Min Son \(KOR – Leverkusen, Tottenham\)/, /13: Mehdi Taremi/, /11: Maksim Shatskikh/],
);
assertGroundedTarget(
  "salah-004-fifty-seven-goal-involvements",
  "salah_source_04",
  [/52경기/, /34골/, /23도움/, /47개/],
  [/34 strikes and 23 assists from his 52 outings/, /Those 34 strikes and 23 assists total 57 goal involvements/, /47 - came in the Premier League on the way to lifting the title/],
);

assert.throws(
  () => buildCatalog({ ian_wright_tpt: "https://notplayerstribune.com/example" }, sourcePackInputs),
  /ian_wright_tpt: unknown or malformed source URL/,
);
assert.throws(
  () => buildCatalog({ unknown: "https://example.com/story" }, sourcePackInputs),
  /unknown: unknown or malformed source URL/,
);

const canonicalBbcYouTubeUrl = "https://www.youtube.com/watch?v=6caCqn_nD6o";
const singleSourcePack = (title, url = canonicalBbcYouTubeUrl) => `## Source 1: ${title}

- URL: ${url}
- Status: 200

### Media Candidates
- https://example.com/media.jpg
`;

assert.equal(legacyBank.sourceRefs.ian_teacher_bbc, canonicalBbcYouTubeUrl);
assert.deepEqual(
  buildCatalog(
    { ian_teacher_bbc: "https://youtu.be/6caCqn_nD6o" },
    { "fixture.md": singleSourcePack("BBC video", "https://youtu.be/6caCqn_nD6o") },
  ).sources[0].tier,
  "primary",
);
assert.throws(
  () => buildCatalog(
    { ian_teacher_bbc: "https://www.youtube.com/watch?v=another-video" },
    { "fixture.md": singleSourcePack("Different BBC video", "https://www.youtube.com/watch?v=another-video") },
  ),
  /ian_teacher_bbc: unknown or malformed source URL/,
);
assert.throws(
  () => buildCatalog(
    { ian_teacher_bbc: canonicalBbcYouTubeUrl },
    { "missing-url.md": "## Source 1: BBC video\n\n- Status: 200\n" },
  ),
  /missing-url\.md: Source 1: missing URL/,
);
assert.throws(
  () => buildCatalog(
    { ian_teacher_bbc: canonicalBbcYouTubeUrl },
    { "missing-title.md": singleSourcePack("   ") },
  ),
  /missing-title\.md: Source 1: missing title/,
);
assert.throws(
  () => buildCatalog(
    { ian_teacher_bbc: canonicalBbcYouTubeUrl },
    { "missing-heading.md": `- URL: ${canonicalBbcYouTubeUrl}\n- Status: 200\n` },
  ),
  /missing-heading\.md: missing Source heading structure/,
);
assert.throws(
  () => buildCatalog(
    { ian_teacher_bbc: canonicalBbcYouTubeUrl },
    {
      "first.md": singleSourcePack("First copy"),
      "second.md": singleSourcePack("Second copy"),
    },
  ),
  /duplicate source URL .*first\.md.*second\.md/,
);
assert.throws(
  () => buildCatalog(
    { ian_teacher_bbc: canonicalBbcYouTubeUrl },
    {
      "same-pack.md": `${singleSourcePack("First copy")}
## Source 2: Second copy

- URL: ${canonicalBbcYouTubeUrl}
- Status: 200
`,
    },
  ),
  /same-pack\.md: duplicate source URL .*Source 1.*Source 2/,
);

function sevenCards() {
  return Array.from({ length: 7 }, (_, index) => ({
    label: `card-${index + 1}`,
    headline: ["검증용 제목"],
    body: "검증용 본문",
  }));
}

function fixture(overrides = {}) {
  return {
    id: "real-fixture",
    eventKey: "fixture|2026|event",
    sourceRefs: ["source_a"],
    copy: { cards: sevenCards() },
    ...overrides,
  };
}

function bankWith(topics = [fixture()]) {
  return {
    sourceRefs: { source_a: { url: "https://example.com/a" } },
    topics,
  };
}

function copyWithTerm(term, cardIndex = 0) {
  const cards = sevenCards();
  cards[cardIndex] = { ...cards[cardIndex], body: `본문 ${term}` };
  return { cards };
}

function migrationBank(overrides = {}) {
  return {
    sourceRefs: {
      source_a: "https://www.theplayerstribune.com/articles/example",
    },
    topics: [
      {
        id: "real-001-example-event",
        category: "example",
        sourceRefs: ["source_a"],
        assetSearch: { mustHave: ["Incorrect Player"] },
      },
    ],
    ...overrides,
  };
}

function assertRosterSubjectShape(subject) {
  const name = subject.displayName;
  assert.match(subject.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${name}: id must be a lowercase slug`);
  assert.ok(allowedPortfolios.has(subject.portfolio), `${name}: invalid portfolio`);
  assert.ok(Number.isInteger(subject.target) && subject.target > 0, `${name}: invalid target`);
  assert.ok(["player", "coach"].includes(subject.subjectType), `${name}: invalid subjectType`);
  assert.ok(name.trim(), `${name}: missing displayName`);
  assert.ok(Array.isArray(subject.searchNames), `${name}: searchNames must be an array`);
  assert.ok(subject.searchNames.length >= 2, `${name}: searchNames must have at least two entries`);
  assert.ok(
    subject.searchNames.every((query) => typeof query === "string" && query.trim().length > 0),
    `${name}: searchNames must contain non-empty trimmed strings`,
  );
  assert.ok(subject.searchNames.includes(name), `${name}: displayName missing from searchNames`);
  assert.ok(Array.isArray(subject.prioritySources), `${name}: prioritySources must be an array`);
  assert.ok(subject.prioritySources.length > 0, `${name}: prioritySources must not be empty`);
  assert.ok(
    subject.prioritySources.every((source) => typeof source === "string" && allowedSourceFamilies.has(source)),
    `${name}: prioritySources contains an unknown source family`,
  );
}

const migratedFresh = migrateStoryBank(legacyBank);
assert.deepEqual(migratedFresh, migratedBank);

const migrationById = new Map(migratedFresh.topics.map((topic) => [topic.id, topic]));
assert.equal(
  migrationById.get("real-001-ian-wright-teacher-reunion").eventKey,
  "ian-wright|legacy-sourced|ian-wright-teacher-reunion",
);
assert.equal(
  migrationById.get("real-002-ian-wright-brighton-train").verification.sourceTier,
  "primary",
);
assert.equal(
  migrationById.get("real-023-mane-match-interrupted").verification.sourceTier,
  "official",
);
assert.equal(
  migrationById.get("real-031-rashford-mum-three-jobs").verification.sourceTier,
  "reputable-secondary",
);
assert.equal(
  migrationById.get("real-046-bielsa-let-villa-score").eventKey,
  "marcelo-bielsa|legacy-sourced|bielsa-let-villa-score",
);

assert.throws(() => migrateStoryBank(null), /bank must be a non-null object/);
assert.throws(() => migrateStoryBank({ sourceRefs: {} }), /bank\.topics must be an array/);
assert.throws(
  () => migrateStoryBank({ topics: [], sourceRefs: [] }),
  /bank\.sourceRefs must be a non-null plain object/,
);
assert.throws(
  () => migrateStoryBank({ sourceRefs: {}, topics: [null] }),
  /topic 0: must be a non-null object/,
);
assert.throws(
  () => migrateStoryBank(migrationBank({ topics: [{}] })),
  /topic 0: id must be a non-empty string/,
);
assert.throws(
  () => migrateStoryBank(migrationBank({ topics: [{ id: "real-001-example-event" }] })),
  /real-001-example-event: category must be a non-empty string/,
);
assert.throws(
  () => migrateStoryBank(migrationBank({ topics: [{ id: "real-001-example-event", category: "example" }] })),
  /real-001-example-event: sourceRefs must be an array/,
);
assert.throws(
  () => migrateStoryBank(migrationBank({ sourceRefs: {}, topics: [{ id: "real-001-example-event", category: "example", sourceRefs: ["source_a"] }] })),
  /real-001-example-event: missing canonical player mapping for source_a/,
);
assert.throws(
  () => migrateStoryBank({
    sourceRefs: { ian_wright_tpt: "https://notplayerstribune.com/example" },
    topics: [{ id: "real-001-example-event", category: "example", sourceRefs: ["ian_wright_tpt"] }],
  }),
  /real-001-example-event: unknown source tier for ian_wright_tpt: https:\/\/notplayerstribune\.com\/example/,
);
assert.throws(
  () => migrateStoryBank({
    sourceRefs: { rashford_guardian: "https://fakeguardian.com/example" },
    topics: [{ id: "real-001-example-event", category: "example", sourceRefs: ["rashford_guardian"] }],
  }),
  /real-001-example-event: unknown source tier for rashford_guardian: https:\/\/fakeguardian\.com\/example/,
);
assert.throws(
  () => migrateStoryBank({
    sourceRefs: { ian_wright_tpt: "https://notplayerstribune.com/example" },
    topics: [{ id: "real-001-example-event", category: "example-alternate-hook", sourceRefs: ["ian_wright_tpt"] }],
  }),
  /real-001-example-event: unknown source tier for ian_wright_tpt: https:\/\/notplayerstribune\.com\/example/,
);

for (const bank of [null, undefined, 42, "story bank", true]) {
  assert.throws(
    () => validateStoryBank(bank),
    /bank must be a non-null object/,
  );
}

assert.throws(() => validateStoryBank({}), /bank\.topics must be an array/);
assert.throws(
  () => validateStoryBank({}),
  /bank\.sourceRefs must be a non-null plain object/,
);

for (const topics of [undefined, null, 42, "topics"]) {
  assert.throws(
    () => validateStoryBank({ topics, sourceRefs: {} }),
    /bank\.topics must be an array/,
  );
}

for (const sourceRefs of [null, [], "source refs", 42, true, new Date(0), new Map()]) {
  assert.throws(
    () => validateStoryBank({ topics: [fixture()], sourceRefs }),
    /bank\.sourceRefs must be a non-null plain object/,
  );
}

const duplicate = bankWith([
  fixture({ id: "real-001", eventKey: "messi|2007|getafe-goal" }),
  fixture({ id: "real-002", eventKey: "messi|2007|getafe-goal" }),
]);

assert.throws(() => validateStoryBank(duplicate), /duplicate eventKey/);

for (const cardCount of [6, 8]) {
  const cards = sevenCards();
  cards.length = cardCount;
  if (cardCount === 8) {
    cards[7] = { label: "card-8", headline: ["검증용 제목"], body: "검증용 본문" };
  }
  assert.throws(
    () => validateStoryBank(bankWith([fixture({ copy: { cards } })])),
    /exactly 7 cards/,
  );
}
assert.throws(
  () => validateStoryBank(bankWith([fixture({ copy: {} })])),
  /exactly 7 cards/,
);
assert.throws(
  () => validateStoryBank(bankWith([fixture({ copy: { cards: { length: 7 } } })])),
  /exactly 7 cards/,
);

assert.throws(
  () => validateStoryBank(bankWith([fixture({ eventKey: "" })])),
  /missing eventKey/,
);
assert.throws(
  () => validateStoryBank(bankWith([fixture({ eventKey: "   " })])),
  /missing eventKey/,
);

const forbiddenEarlyTerms = [
  "피치체크",
  "프로필링크",
  "프로필 링크",
  "프로필 \n 링크",
  "설치",
  "다운로드",
  "사용영상",
  "사용 영상",
  "사용 \t 영상",
  "앱",
];

for (const term of forbiddenEarlyTerms) {
  assert.throws(
    () => validateStoryBank(bankWith([fixture({ copy: copyWithTerm(term) })])),
    /forbidden early CTA/,
  );
}
assert.throws(
  () => validateStoryBank(bankWith([fixture({ copy: copyWithTerm("피치체크", 4) })])),
  /forbidden early CTA/,
);

const missingSourceRefsTopic = fixture({ id: "real-source-refs-missing" });
delete missingSourceRefsTopic.sourceRefs;

for (const topic of [
  missingSourceRefsTopic,
  fixture({ id: "real-source-refs-null", sourceRefs: null }),
  fixture({ id: "real-source-refs-string", sourceRefs: "source_a" }),
  fixture({ id: "real-source-refs-object", sourceRefs: { source_a: true } }),
]) {
  assert.throws(
    () => validateStoryBank(bankWith([topic])),
    new RegExp(`${topic.id}: sourceRefs must be an array`),
  );
}

assert.throws(
  () => validateStoryBank(bankWith([fixture({ sourceRefs: ["source_missing"] })])),
  /missing source source_missing/,
);

assert.throws(
  () => validateStoryBank(bankWith(), { expectedCount: 2 }),
  /expected 2 topics, got 1/,
);
assert.throws(
  () => validateStoryBank(bankWith(), { expectedCount: 0 }),
  /expected 0 topics, got 1/,
);

const lateCtaCards = sevenCards();
lateCtaCards[5].body = forbiddenEarlyTerms.join(" / ");
lateCtaCards[6].headline = ["피치체크 앱 다운로드"];

assert.deepEqual(
  validateStoryBank(bankWith([fixture({ copy: { cards: lateCtaCards } })]), { expectedCount: 1 }),
  { topics: 1, uniqueEvents: 1 },
);

assert.equal(migratedBank.topics.length, 50);
assert.equal(new Set(migratedBank.topics.map((topic) => topic.eventKey)).size, 50);
assert.equal(new Set(migratedBank.topics.map((topic) => topic.fact)).size, 50);

assert.deepEqual(
  Object.fromEntries(
    Object.keys(portfolioTargets).map((portfolio) => [
      portfolio,
      roster
        .filter((subject) => subject.portfolio === portfolio)
        .reduce((total, subject) => total + subject.target, 0),
    ]),
  ),
  portfolioTargets,
);

assert.equal(roster.length, 71, "roster must contain exactly 71 rows");
const rosterByName = new Map(roster.map((subject) => [subject.displayName, subject]));
assert.equal(new Set(roster.map((subject) => subject.displayName)).size, 71, "roster must have exactly 71 display names");
assert.deepEqual(
  Object.fromEntries(
    [...rosterByName].map(([displayName, subject]) => [
      displayName,
      { portfolio: subject.portfolio, target: subject.target },
    ]),
  ),
  rosterContract,
);
assert.equal(rosterByName.get("Lionel Messi").target, 20);
assert.equal(rosterByName.get("Cristiano Ronaldo").target, 20);
assert.equal(rosterByName.get("Son Heung-min").target, 12);
assert.equal(
  roster
    .filter((subject) => subject.portfolio === "women")
    .reduce((total, subject) => total + subject.target, 0),
  30,
);

const migratedCounts = new Map();
for (const topic of migratedBank.topics) {
  migratedCounts.set(topic.player, (migratedCounts.get(topic.player) ?? 0) + 1);
}
for (const [player, count] of migratedCounts) {
  assert.ok(rosterByName.has(player), `${player}: missing from roster`);
  assert.ok(rosterByName.get(player).target >= count, `${player}: target below migrated count`);
}

assert.equal(new Set(roster.map((subject) => subject.id)).size, roster.length);
for (const subject of roster) {
  assertRosterSubjectShape(subject);
}
assert.deepEqual(
  roster.filter((subject) => subject.subjectType === "coach").map((subject) => subject.displayName).sort(),
  ["Marcelo Bielsa"],
);
assert.ok(
  roster
    .filter((subject) => subject.displayName !== "Marcelo Bielsa")
    .every((subject) => subject.subjectType === "player"),
);

const emptySecondaryQuerySubject = {
  ...roster[0],
  searchNames: [roster[0].displayName, "   "],
};
assert.throws(
  () => assertRosterSubjectShape(emptySecondaryQuerySubject),
  /Lionel Messi: searchNames must contain non-empty trimmed strings/,
);

const legacyById = new Map(legacyBank.topics.map((topic) => [topic.id, topic]));
for (const topic of migratedBank.topics) {
  const legacy = legacyById.get(topic.id);
  assert.ok(legacy, `${topic.id}: missing from legacy bank`);
  assert.ok(!topic.category.endsWith("alternate-hook"), `${topic.id}: alternate hook migrated`);
  assert.equal(topic.copy.cards.length, 7, `${topic.id}: expected exactly 7 cards`);
  for (const field of [
    "sourceRefs",
    "assetSearch",
    "hook",
    "fact",
    "whyFun",
    "shareTrigger",
    "copy",
  ]) {
    assert.deepEqual(topic[field], legacy[field], `${topic.id}: changed ${field}`);
  }
  assert.equal(topic.player, topic.assetSearch.mustHave[0]);
  assert.ok(topic.player.trim(), `${topic.id}: missing player`);
  assert.equal(topic.origin, "migrated-60-bank");
  assert.equal(topic.verification.status, "verified");
  assert.ok(["primary", "official", "reputable-secondary"].includes(topic.verification.sourceTier));

  const sensitive = /family-loss|war-childhood|second-chance/.test(topic.category);
  assert.equal(
    topic.verification.caveat,
    sensitive ? "민감한 사건이므로 원문 맥락을 유지하고 선정적으로 확대하지 않는다." : null,
  );
}

console.log("real story validation tests passed");
