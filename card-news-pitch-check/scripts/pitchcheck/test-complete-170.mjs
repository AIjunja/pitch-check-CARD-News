#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';

const bank = JSON.parse(fs.readFileSync('samples/pitchcheck/complete-story-bank-170.json', 'utf8'));
const golden = JSON.parse(fs.readFileSync('samples/pitchcheck/topical-satire-golden-set-10.json', 'utf8'));
assert.equal(bank.topics.length, 170);
assert.equal(new Set(bank.topics.map((topic) => topic.id)).size, 170);
assert.equal(bank.topics.filter((topic) => topic.productionTier === 'approved-golden-set').length, 10);
for (const topic of bank.topics) {
  assert.equal(topic.copy.cards.length, 7, `${topic.id}: seven cards`);
  assert.equal(/피치체크|프로필 링크|설치/.test(JSON.stringify(topic.copy.cards.slice(0, 5))), false, `${topic.id}: early ad copy`);
  for (const card of topic.copy.cards.slice(0, 5)) {
    assert.ok(card.headline.length >= 1 && card.headline.length <= 3, `${topic.id}: headline lines`);
    assert.ok(card.headline.join('').length <= 54, `${topic.id}: headline length`);
  }
}
for (const topic of golden.topics) {
  const merged = bank.topics.find((candidate) => candidate.id === topic.id);
  assert.deepEqual(merged.copy, topic.copy, `${topic.id}: approved copy changed`);
}
console.log('complete 170 story bank tests passed');
