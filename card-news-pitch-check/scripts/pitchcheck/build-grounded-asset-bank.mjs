#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SAMPLE = path.join(ROOT, "samples", "pitchcheck");
const OUTPUT = path.join(SAMPLE, "real-player-story-bank-grounded-170.json");
const AUDIT = path.join(ROOT, "docs", "pitchcheck-grounded-asset-audit-170.md");

const seedFiles = [
  "real-player-story-migrated-50.json",
  "real-player-story-seeds-messi.json",
  "real-player-story-seeds-ronaldo.json",
  "real-player-story-seeds-mbappe-haaland.json",
  "real-player-story-seeds-son-salah.json",
  "real-player-story-seeds-women.json",
  "real-player-story-seeds-asia.json",
];

const read = (file) => JSON.parse(fs.readFileSync(path.join(SAMPLE, file), "utf8"));
const uniq = (values) => [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];

function playerName(topic) {
  if (topic.player) return topic.player;
  const specific = topic.assetSearch?.mustHave?.find((value) => !/football|player|match|emotion/i.test(value));
  if (specific) return specific;
  return topic.imageQueries?.[0]?.replace(/\s+(football|soccer).*$/i, "") || topic.id;
}

function sceneVocabulary(topic) {
  const text = `${topic.category || ""} ${topic.hook || ""} ${topic.fact || ""} ${topic.context || ""}`.toLowerCase();
  const scenes = [];
  const add = (test, values) => { if (test.test(text)) scenes.push(...values); };
  add(/goal|골|슛|penalty|프리킥/, ["shooting moment", "ball flight goalmouth", "goal celebration teammates"]);
  add(/transfer|이적|contract|계약|sign/, ["transfer announcement", "contract signing press conference", "new club presentation"]);
  add(/injur|부상|수술|병원|hospital|treatment/, ["injury moment", "medical treatment interview", "return to training"]);
  add(/child|소년|어린|가족|family|school|학교|academy|유소년/, ["childhood archive", "youth academy training", "family documentary"]);
  add(/coach|감독|teacher|선생|mentor|은사/, ["coach player interaction", "documentary reunion", "emotional close-up"]);
  add(/record|기록|100|award|수상|trophy|우승|final|결승/, ["record milestone match", "trophy ceremony", "team celebration crowd"]);
  add(/red card|퇴장|fight|충돌|controvers|논란|racis/, ["match confrontation", "referee decision reaction", "crowd reaction"]);
  add(/interview|인터뷰|말했다|발언|letter|편지/, ["official interview close-up", "press conference", "source article portrait"]);
  add(/poverty|가난|refugee|난민|war|전쟁|food|급식/, ["early life location", "community documentary", "present day player portrait"]);
  if (!scenes.length) scenes.push("match action", "teammate interaction", "post-match reaction");
  return uniq(scenes).slice(0, 5);
}

function groundedTopic(topic) {
  const player = playerName(topic);
  const scenes = sceneVocabulary(topic);
  const baseQueries = topic.visualPlan?.queries || topic.assetSearch?.queries || topic.imageQueries || [];
  const exact = `${player} ${topic.eventDate || ""} ${topic.category || ""}`.trim();
  const queries = uniq([
    `${exact} ${scenes[0]}`,
    `${player} ${scenes[1] || scenes[0]} official`,
    `${player} ${scenes[2] || "match reaction"} ${topic.eventDate || ""}`,
    ...baseQueries,
  ]).slice(0, 8);
  const cardPlan = [
    { card: 1, role: "hook", need: scenes[0], query: queries[0] },
    { card: 2, role: "context", need: scenes[1] || "event context", query: queries[1] },
    { card: 3, role: "proof", need: "source-confirmed event frame", query: `${exact} official` },
    { card: 4, role: "result", need: scenes[2] || "event result", query: queries[2] },
    { card: 5, role: "emotion", need: scenes[3] || "teammate or crowd reaction", query: `${player} ${scenes[3] || "crowd reaction"}` },
    { card: 6, role: "bridge", need: "approved PitchCheck real-team CTA", query: null },
    { card: 7, role: "cta", need: "approved PitchCheck install CTA", query: null },
  ];
  return {
    ...topic,
    player,
    imageQueries: queries,
    assetSearch: {
      queries,
      mustHave: uniq([player, "football", ...(topic.assetSearch?.mustHave || [])]),
      avoid: uniq(["logo only", "pet", "animal", "generic portrait", "unrelated match", ...(topic.assetSearch?.avoid || [])]),
      sceneVocabulary: scenes,
      cardPlan,
      rightsDefault: "reference-only",
    },
  };
}

const sourceRefs = {};
const topics = [];
for (const file of seedFiles) {
  const bank = read(file);
  Object.assign(sourceRefs, bank.sourceRefs || {});
  for (const topic of bank.topics || []) topics.push(groundedTopic(topic));
}

const byEvent = new Map();
for (const topic of topics) {
  const key = topic.eventKey || topic.id;
  if (byEvent.has(key)) throw new Error(`Duplicate event: ${key}`);
  byEvent.set(key, topic);
}
if (byEvent.size !== 170) throw new Error(`Expected 170 grounded events, got ${byEvent.size}`);

const bank = {
  project: "PitchCheck grounded real-player asset bank",
  generatedAt: new Date().toISOString(),
  scope: { completeEvents: 170, plannedTotal: 300, missingEventResearch: 130 },
  sourceRefs,
  topics: [...byEvent.values()],
};
fs.writeFileSync(OUTPUT, `${JSON.stringify(bank, null, 2)}\n`);

const roster = read("real-player-roster-300.json");
const rosterTarget = roster.reduce((sum, item) => sum + item.target, 0);
const players = new Set(bank.topics.map((topic) => topic.player));
const completedByPlayer = new Map();
for (const topic of bank.topics) completedByPlayer.set(topic.player, (completedByPlayer.get(topic.player) || 0) + 1);
const gaps = roster.map((subject) => ({
  player: subject.displayName,
  portfolio: subject.portfolio,
  target: subject.target,
  complete: completedByPlayer.get(subject.displayName) || 0,
})).map((item) => ({ ...item, missing: Math.max(0, item.target - item.complete) })).filter((item) => item.missing > 0);
const lines = [
  "# PitchCheck 실제 사건 에셋 준비 감사",
  "",
  `- 전체 설계 목표: ${rosterTarget}개`,
  `- 실제 사건 레코드 완성: ${bank.topics.length}개`,
  `- 사건별 장면 검색 계획 완성: ${bank.topics.length}개`,
  `- 포함 선수: ${players.size}명`,
  `- 추가 사건 조사 필요: ${rosterTarget - bank.topics.length}개`,
  "",
  "## 장면 검색 규칙",
  "",
  "각 사건을 훅, 맥락, 증거, 결과, 감정 장면으로 분해한다. 골 사건은 슈팅·골문·세리머니를, 이적 사건은 발표·계약·입단식을, 부상 사건은 충돌·치료·복귀 장면을 별도로 찾는다.",
  "",
  "## 권리 규칙",
  "",
  "외부 경기·기사 이미지는 reference-only로 저장하며 게시 전 라이선스를 확인한다. 6·7장은 승인된 PitchCheck 실제 화면 CTA만 사용한다.",
  "",
  "## 추가 사건 조사 대상",
  "",
  "| 선수 | 포트폴리오 | 목표 | 완료 | 부족 |",
  "|---|---|---:|---:|---:|",
  ...gaps.map((item) => `| ${item.player} | ${item.portfolio} | ${item.target} | ${item.complete} | ${item.missing} |`),
];
fs.writeFileSync(AUDIT, `${lines.join("\n")}\n`);
console.log(`wrote ${path.relative(ROOT, OUTPUT)} (${bank.topics.length} events)`);
console.log(`wrote ${path.relative(ROOT, AUDIT)}`);
