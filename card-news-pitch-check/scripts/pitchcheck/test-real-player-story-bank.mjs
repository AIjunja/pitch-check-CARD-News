#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateStoryBank } from "./lib/real-story-validation.mjs";
import { migrateStoryBank } from "./migrate-real-player-story-bank.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const legacyBank = JSON.parse(
  fs.readFileSync(path.join(ROOT, "samples/pitchcheck/real-player-story-bank-60.json"), "utf8"),
);
const migratedBank = JSON.parse(
  fs.readFileSync(path.join(ROOT, "samples/pitchcheck/real-player-story-migrated-50.json"), "utf8"),
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
