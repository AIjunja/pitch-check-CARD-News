#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const readJson = (relativePath) => JSON.parse(
  fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, ""),
);

const seed = readJson("samples/pitchcheck/real-player-story-seeds-asia.json");
const catalog = readJson("samples/pitchcheck/real-player-source-catalog-300.json");
const sourcePack = fs.readFileSync(
  path.join(root, "docs/research/real-player-stories/source-pack-07-asia.md"),
  "utf8",
);

const expectedCounts = {
  "Park Ji-sung": 5,
  "Kim Min-jae": 3,
  "Lee Kang-in": 3,
  "Hwang Hee-chan": 2,
  "Takefusa Kubo": 2,
  "Kaoru Mitoma": 2,
  "Keisuke Honda": 2,
  "Hidetoshi Nakata": 1,
};
const expectedSourceIds = Array.from({ length: 17 }, (_, index) =>
  `asia07_source_${String(index + 1).padStart(2, "0")}`,
);
const expectedStages = ["attention", "interest", "desire", "proof", "action", "bridge", "cta"];

assert.equal(seed.topics.length, 20, "Asia seed batch must contain exactly 20 topics");
assert.equal(seed.index.length, 20, "Korean index must contain exactly 20 entries");
assert.deepEqual(
  Object.fromEntries(
    Object.keys(expectedCounts).map((player) => [
      player,
      seed.topics.filter((topic) => topic.player === player).length,
    ]),
  ),
  expectedCounts,
);
assert.deepEqual(seed.index.map((entry) => entry.rank), Array.from({ length: 20 }, (_, i) => i + 1));
assert.deepEqual(seed.index.map((entry) => entry.id), seed.topics.map((topic) => topic.id));
assert.equal(new Set(seed.index.map((entry) => entry.title)).size, 20, "Korean index titles must be unique");
assert.deepEqual(Object.keys(seed.sourceRefs), expectedSourceIds);

const topicIds = new Set();
const eventKeys = new Set();
const referencedSourceIds = new Set();
for (const topic of seed.topics) {
  assert.ok(!topicIds.has(topic.id), `${topic.id}: duplicate topic id`);
  assert.ok(!eventKeys.has(topic.eventKey), `${topic.id}: duplicate eventKey`);
  topicIds.add(topic.id);
  eventKeys.add(topic.eventKey);
  assert.equal(topic.portfolio, "korea_asia", `${topic.id}: wrong portfolio`);
  assert.equal(topic.copy.framework, "AIDA", `${topic.id}: copy framework must be AIDA`);
  assert.deepEqual(topic.copy.cardStages, expectedStages, `${topic.id}: wrong AIDA stages`);
  assert.equal(topic.copy.cards.length, 7, `${topic.id}: expected exactly 7 copy cards`);
  assert.equal(topic.visualPlan.aspectRatio, "4:5", `${topic.id}: wrong visual aspect ratio`);
  assert.equal(topic.visualPlan.usageStatus, "reference-only", `${topic.id}: media must remain reference-only`);
  assert.equal(topic.visualPlan.cards.length, 7, `${topic.id}: expected exactly 7 visual cards`);
  assert.deepEqual(
    topic.visualPlan.cards.map((card) => card.card),
    [1, 2, 3, 4, 5, 6, 7],
    `${topic.id}: visual cards must be numbered 1-7`,
  );
  for (const card of topic.visualPlan.cards) {
    for (const field of ["crop", "subject", "usageStatus"]) {
      assert.equal(typeof card[field], "string", `${topic.id}: visual card missing ${field}`);
    }
    assert.equal(card.usageStatus, "reference-only", `${topic.id}: card media must be reference-only`);
  }
  assert.equal(topic.sourcePackRefs.length, 1, `${topic.id}: expected one source pack reference`);
  assert.equal(topic.sourcePackRefs[0], "docs/research/real-player-stories/source-pack-07-asia.md");
  assert.ok(topic.sourceRefs.length > 0, `${topic.id}: sourceRefs must not be empty`);
  for (const sourceId of topic.sourceRefs) referencedSourceIds.add(sourceId);
}
assert.deepEqual([...referencedSourceIds].sort(), [...expectedSourceIds].sort(), "all 17 Asia sources must be referenced");

const catalogById = new Map(catalog.sources.map((source) => [source.sourceId, source]));
for (const sourceId of expectedSourceIds) {
  const catalogSource = catalogById.get(sourceId);
  assert.ok(catalogSource, `${sourceId}: missing from active source catalog`);
  assert.equal(catalogSource.url, seed.sourceRefs[sourceId], `${sourceId}: catalog URL mismatch`);
  assert.equal(catalogSource.status, "200", `${sourceId}: source is not active`);
  assert.equal(catalogSource.tier, "official", `${sourceId}: source must be official`);
  assert.equal(catalogSource.sourcePack, "docs/research/real-player-stories/source-pack-07-asia.md");
  assert.equal(catalogSource.useStatus, "reference-only");
}

assert.equal(sourcePack.includes("None found"), false, "source pack must not contain None found");
assert.equal((sourcePack.match(/^## Source /gm) ?? []).length, 17, "source pack must contain 17 sources");
for (const sourceId of expectedSourceIds) {
  const url = seed.sourceRefs[sourceId];
  const section = sourcePack
    .split(/^## Source /m)
    .find((candidate) => candidate.includes(`- URL: ${url}`));
  assert.ok(section, `${sourceId}: missing source-pack section`);
  const usefulText = section.split("### Useful Text Snippets")[1]?.split("### Media Candidates")[0] ?? "";
  assert.match(usefulText, /^- .+/m, `${sourceId}: Useful Text Snippets must be explicit`);
}

console.log("Asia story batch validation tests passed");
