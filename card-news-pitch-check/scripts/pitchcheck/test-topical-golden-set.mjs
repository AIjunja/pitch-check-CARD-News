#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateTopicalGoldenSet } from './lib/topical-story-validation.mjs';

export const GOLDEN_TOPIC_IDS = [
  'hwang-001-portugal-stoppage-time-winner',
  'messi-011-calendar-year-scoring-record',
  'ronaldo-011-euro-2016-touchline',
  'son-007-asian-games-gold',
  'park-001-2002-portugal-goal',
  'lee-001-u20-golden-ball',
  'real-034-vardy-eighth-tier',
  'real-044-di-canio-empty-net',
  'real-046-bielsa-let-villa-score',
  'real-038-modric-burnt-house',
];

const cards = [
  { label: '기억나세요?', headline: ['이 경기,', '기억하시나요?'], body: '모두가 같은 계산을 하던 밤이었습니다.', accent: ['기억하시나요?'] },
  { label: '당시 상황', headline: ['한국은 이때', '탈락 직전이었습니다'], body: '승리와 다른 경기 결과가 모두 필요했습니다.', accent: ['탈락 직전'] },
  { label: '결정적 선택', headline: ['90+1분,', '한 번 더 기다렸습니다'], body: '손흥민은 슈팅 대신 침투를 기다렸습니다.', accent: ['90+1분'] },
  { label: '결말', headline: ['패스 한 번이', '16강을 만들었습니다'], body: '황희찬이 수비 사이로 들어와 골을 끝냈습니다.', accent: ['16강'] },
  { label: '팬의 결론', headline: ['그때는 추가시간에', '기적을 기다렸고'], body: '명보호 때는 종료 휘슬을 기다렸습니다.', accent: ['종료 휘슬'] },
  { label: '우리 팀', headline: ['팀 운영이 힘든 건', '축구가 아니라 확인'], body: '출석과 일정부터 한곳에서 정리합니다.', accent: ['확인'] },
  { label: '피치체크', headline: ['팀 운영 막히면', '오늘 바로 설치'], body: ['프로필 링크', '댓글 [피치체크]'], accent: ['설치'] },
];

const validTopic = {
  id: GOLDEN_TOPIC_IDS[0],
  eventKey: 'hwang-hee-chan|2022|portugal-stoppage-time-winner',
  player: 'Hwang Hee-chan',
  editorialThesis: '2022년의 추가시간은 희망이었지만 최근 대표팀의 추가시간은 팬의 인내를 시험했다.',
  topicalTarget: { subject: 'Hong Myung-bo era', evidenceRef: 'afc_hong_resignation_2026' },
  topicalAsOf: '2026-07-13',
  punchlineType: 'current-satire',
  expiryRisk: 'high',
  sourceRefs: ['fifa_kor_por_2022'],
  socialRefs: ['youtube_fifa_hwang_portugal'],
  copy: { cards },
  visualNeed: cards.slice(0, 5).map((_, index) => ({ card: index + 1, need: `verified scene ${index + 1}` })),
};

const bank = {
  sourceRefs: { fifa_kor_por_2022: 'https://www.fifa.com/' },
  socialRefs: { youtube_fifa_hwang_portugal: 'https://www.youtube.com/' },
  topics: [validTopic],
};

assert.deepEqual(validateTopicalGoldenSet(bank, { expectedCount: 1, asOf: '2026-07-13' }), { topics: 1, highExpiry: 1 });

for (const field of ['editorialThesis', 'topicalTarget', 'topicalAsOf', 'punchlineType', 'expiryRisk', 'visualNeed']) {
  const topic = structuredClone(validTopic);
  delete topic[field];
  assert.throws(() => validateTopicalGoldenSet({ ...bank, topics: [topic] }), new RegExp(field));
}

const noQuestion = structuredClone(validTopic);
noQuestion.copy.cards[0] = { label: '경기 결과', headline: ['황희찬이', '결승골을 넣었습니다'], body: '한국은 승리했습니다.', accent: ['결승골'] };
assert.throws(() => validateTopicalGoldenSet({ ...bank, topics: [noQuestion] }), /card 1 needs curiosity gap/);

const noPunchline = structuredClone(validTopic);
noPunchline.copy.cards[4] = { label: '결과', headline: ['한국은', '16강에 진출했습니다'], body: '한국은 조 2위로 16강에 진출했습니다.', accent: ['16강'] };
assert.throws(() => validateTopicalGoldenSet({ ...bank, topics: [noPunchline] }), /card 5 must mention topical target or editorial contrast/);

const earlyCta = structuredClone(validTopic);
earlyCta.copy.cards[2].body = '프로필 링크에서 피치체크를 설치하세요.';
assert.throws(() => validateTopicalGoldenSet({ ...bank, topics: [earlyCta] }), /forbidden early CTA/);

assert.throws(() => validateTopicalGoldenSet(bank, { asOf: '2026-08-01' }), /stale high-risk topical copy/);

const invalidType = structuredClone(validTopic);
invalidType.punchlineType = 'summary';
assert.throws(() => validateTopicalGoldenSet({ ...bank, topics: [invalidType] }), /invalid punchlineType/);

if (fs.existsSync('samples/pitchcheck/topical-satire-golden-set-10.json')) {
  const golden = JSON.parse(fs.readFileSync('samples/pitchcheck/topical-satire-golden-set-10.json', 'utf8'));
  assert.deepEqual(golden.topics.map((topic) => topic.id), GOLDEN_TOPIC_IDS);
  validateTopicalGoldenSet(golden, { expectedCount: 10, asOf: '2026-07-13' });
}

console.log('topical golden set validation tests passed');
