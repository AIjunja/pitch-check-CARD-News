#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const groundedPath = path.join(ROOT, 'samples/pitchcheck/real-player-story-bank-grounded-170.json');
const goldenPath = path.join(ROOT, 'samples/pitchcheck/topical-satire-golden-set-10.json');
const outputPath = path.join(ROOT, 'samples/pitchcheck/complete-story-bank-170.json');
const grounded = JSON.parse(fs.readFileSync(groundedPath, 'utf8'));
const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
const goldenById = new Map(golden.topics.map((topic) => [topic.id, topic]));

const categoryMatches = (topic, pattern) => pattern.test(`${topic.category || ''} ${topic.eventKey || ''}`);

function wrapHeadline(value, maxLine = 18, maxLines = 3) {
  const words = (Array.isArray(value) ? value.join(' ') : String(value || '')).split(/\s+/).filter(Boolean);
  const lines = [];
  for (const word of words) {
    if (!lines.length || `${lines.at(-1)} ${word}`.length > maxLine) lines.push(word);
    else lines[lines.length - 1] += ` ${word}`;
  }
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, maxLine - 1)}…`;
    return kept;
  }
  return lines;
}

function closingHeadline(topic) {
  if (categoryMatches(topic, /fair-play|sportsmanship|empty-net|let-villa-score|dive/)) {
    return ['골보다 오래 남은', '한 번의 선택'];
  }
  if (categoryMatches(topic, /poverty|childhood|family|war|refugee|rejection|late-bloomer|resilience|teacher/)) {
    return ['우리가 본 건 결과', '그가 버틴 건 과정'];
  }
  if (categoryMatches(topic, /transfer|return|exit|signing|club-move|farewell/)) {
    return ['유니폼은 바뀌어도', '이 장면은 안 바뀐다'];
  }
  if (categoryMatches(topic, /record|award|milestone|appearance|goals|scoring|golden|century/)) {
    return ['기록은 숫자인데', '기억은 장면으로 남는다'];
  }
  if (categoryMatches(topic, /goal|match|final|world-cup|champions|olympic|title|trophy/)) {
    return ['스코어는 끝났지만', '이 장면은 아직 안 끝났다'];
  }
  return ['선수를 기억하는 건', '기록보다 이런 장면'];
}

function accentFor(lines) {
  const words = lines.join(' ').split(/\s+/).filter((word) => word.length >= 2);
  return [...new Set(words)].slice(-2);
}

function rebuildCopy(topic) {
  const cover = wrapHeadline(topic.coverHeadline || topic.copy?.cards?.[0]?.headline || [topic.hook]);
  const tease = wrapHeadline(topic.teaseHeadline || topic.copy?.cards?.[1]?.headline || ['대체 무슨 일이', '있었던 걸까']);
  const reveal = wrapHeadline(topic.revealHeadline || topic.copy?.cards?.[2]?.headline || [topic.player, '정답이 드러났다']);
  const closing = closingHeadline(topic);
  return {
    cards: [
      {
        label: '이 장면, 기억나요?',
        headline: cover,
        body: topic.curiosityQuestion || topic.hook,
        accent: accentFor(cover),
      },
      {
        label: '아직 정답은 안 나옴',
        headline: tease,
        body: '이 장면의 주인공과 결말은 다음 장에서 이어집니다.',
        accent: accentFor(tease),
      },
      {
        label: '정답 공개',
        headline: reveal,
        body: topic.fact,
        accent: accentFor(reveal),
      },
      {
        label: '왜 오래 남았냐면',
        headline: wrapHeadline(topic.shareHeadline || ['기록보다 오래 남은', '이 장면의 이유']),
        body: topic.whyFun,
        accent: ['오래 남은', '이유'],
      },
      {
        label: '그래서 이 이야기는',
        headline: closing,
        body: topic.shareTrigger,
        accent: accentFor(closing),
      },
      topic.copy.cards[5],
      topic.copy.cards[6],
    ],
  };
}

const topics = grounded.topics.map((topic) => {
  const approved = goldenById.get(topic.id);
  if (approved) return { ...topic, ...approved, productionTier: 'approved-golden-set' };
  return { ...topic, copy: rebuildCopy(topic), productionTier: 'complete-170-deterministic' };
});

if (topics.length !== 170) throw new Error(`Expected 170 topics, got ${topics.length}`);
if (new Set(topics.map((topic) => topic.id)).size !== 170) throw new Error('Duplicate topic id in complete bank');
for (const topic of topics) {
  if (topic.copy?.cards?.length !== 7) throw new Error(`${topic.id}: expected seven cards`);
  for (const [index, card] of topic.copy.cards.slice(0, 5).entries()) {
    if (!Array.isArray(card.headline) || !card.headline.length) throw new Error(`${topic.id} card ${index + 1}: missing headline`);
  }
}

const sourceRefs = { ...grounded.sourceRefs, ...golden.sourceRefs };
const output = {
  project: 'PitchCheck complete real-player carousel bank',
  generatedAt: new Date().toISOString(),
  scope: {
    topics: topics.length,
    approvedGoldenTopics: golden.topics.length,
    rebuiltTopics: topics.length - golden.topics.length,
  },
  sourceRefs,
  topics,
};
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`complete story bank built: ${topics.length} topics (${golden.topics.length} approved + ${topics.length - golden.topics.length} rebuilt)`);
