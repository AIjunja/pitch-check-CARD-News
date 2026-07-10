#!/usr/bin/env node

import assert from "node:assert/strict";
import { validateStoryBank } from "./lib/real-story-validation.mjs";

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

console.log("real story validation tests passed");
