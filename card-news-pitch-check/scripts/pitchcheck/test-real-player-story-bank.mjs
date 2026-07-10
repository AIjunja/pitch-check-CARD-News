#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateStoryBank } from "./lib/real-story-validation.mjs";
import { migrateStoryBank } from "./migrate-real-player-story-bank.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG_PATH = path.join(ROOT, "samples/pitchcheck/real-player-source-catalog-300.json");
const MESSI_SEEDS_PATH = path.join(ROOT, "samples/pitchcheck/real-player-story-seeds-messi.json");
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
const messiSeeds = JSON.parse(fs.readFileSync(MESSI_SEEDS_PATH, "utf8"));
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
};

if (process.argv.includes("--write-catalog")) {
  fs.writeFileSync(
    CATALOG_PATH,
    `${JSON.stringify(buildCatalog({ ...legacyBank.sourceRefs, ...messiSeeds.sourceRefs }, sourcePackInputs), null, 2)}\n`,
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

const allSourceRefs = { ...legacyBank.sourceRefs, ...messiSeeds.sourceRefs };
const sourceCatalog = buildCatalog(allSourceRefs, sourcePackInputs, "2026-07-10T00:00:00.000Z");
const persistedSourceCatalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
const expectedSourceIds = Object.keys(allSourceRefs).sort();

assert.equal(sourceCatalog.sources.length, 42);
assert.equal(persistedSourceCatalog.sources.length, 42);
assert.deepEqual(persistedSourceCatalog.sources, sourceCatalog.sources);
assert.deepEqual(
  buildCatalog(allSourceRefs, sourcePackInputs),
  persistedSourceCatalog,
  "rebuilding with the same inputs must preserve generatedAt and every catalog field",
);
assert.deepEqual(
  sourceCatalog.sources.map((source) => source.sourceId).sort(),
  expectedSourceIds,
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
const migratedEventKeys = new Set(migratedBank.topics.map((topic) => topic.eventKey));
const messiEventKeys = new Set();
const messiFacts = new Set();
const forbiddenEarlyMessiCta =
  /피치체크|프로필\s*링크|프로필|설치|다운로드|사용\s*영상|\[피치체크\]|PitchCheck/i;
const directCta = /프로필\s*링크|설치|다운로드|\[피치체크\]|사용\s*영상/i;

assert.deepEqual(
  validateStoryBank(messiSeeds, { expectedCount: 20 }),
  { topics: 20, uniqueEvents: 20 },
);
assert.equal(Object.keys(messiSeeds.sourceRefs).length, 20);
assert.equal(new Set(Object.keys(messiSeeds.sourceRefs)).size, 20);
assert.ok(Object.keys(messiSeeds.sourceRefs).every((sourceId) => /^messi_source_\d{2}$/.test(sourceId)));

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
  assert.match(JSON.stringify(topic.copy.cards[6]), /프로필\s*링크/, `${topic.id}: card 7 missing profile link`);
  assert.match(JSON.stringify(topic.copy.cards[6]), /\[피치체크\]/, `${topic.id}: card 7 missing comment keyword`);
}

assert.equal(messiEventKeys.size, 20);
assert.equal(messiFacts.size, 20);
assert.equal(
  messiSeeds.topics.find((topic) => topic.id === "messi-003-napkin-contract")?.eventKey,
  "lionel-messi|2000|napkin-contract",
);
assert.equal(sourceCatalogById.get("messi_source_03")?.tier, "primary");

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
