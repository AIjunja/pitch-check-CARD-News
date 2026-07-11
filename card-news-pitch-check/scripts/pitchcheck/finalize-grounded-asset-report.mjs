#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const reportPath = path.join(ROOT, "assets/reference/web/real-player-grounded-assets-170.json");
const ledgerPath = path.join(ROOT, "assets/reference/web/real-player-grounded-assets-170.md");
const auditPath = path.join(ROOT, "docs/pitchcheck-grounded-asset-qa-170.md");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const mapping = {
  "real-023-mane-match-interrupted": "assets/reference/web/real-player-grounded-170/manual-sadio-mane-hospital.jpg",
  "real-024-mane-no-hospital": "assets/reference/web/real-player-grounded-170/manual-sadio-mane-hospital.jpg",
  "real-025-mane-father-burial": "assets/reference/web/real-player-grounded-170/manual-sadio-mane-hospital.jpg",
  "messi-009-beijing-olympic-gold": "assets/reference/web/real-player-grounded-170/manual-messi-beijing-2008.jpg",
  "messi-017-copa-america-title": "assets/reference/web/real-player-grounded-170/manual-messi-copa-2021.jpg",
  "ronaldo-002-airport-name": "assets/reference/web/real-player-grounded-170/manual-ronaldo-airport.jpg",
};

for (const item of report.items) {
  if (!mapping[item.topicId]) continue;
  item.localPath = mapping[item.topicId];
  item.status = "manual-source-media-found";
  item.fallbackOnly = false;
  delete item.captureError;
}

const hashGroups = new Map();
for (const item of report.items) {
  const file = item.localPath && path.join(ROOT, item.localPath);
  if (!file || !fs.existsSync(file)) continue;
  const hash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  item.sha256 = hash;
  if (!hashGroups.has(hash)) hashGroups.set(hash, []);
  hashGroups.get(hash).push(item.topicId);
}
const duplicateGroups = [...hashGroups.entries()].filter(([, ids]) => ids.length > 1).map(([sha256, topicIds]) => ({ sha256, topicIds }));
report.totals.withLocalAsset = report.items.filter((item) => item.localPath && fs.existsSync(path.join(ROOT, item.localPath))).length;
report.totals.manualSearch = report.items.length - report.totals.withLocalAsset;
report.totals.sourcePageCaptured = report.items.filter((item) => item.fallbackOnly).length;
report.totals.fieldPhotoReady = report.items.filter((item) => item.localPath && !item.fallbackOnly).length;
report.totals.sourceProofOnly = report.items.filter((item) => item.fallbackOnly).length;
report.duplicateGroups = duplicateGroups;
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

const lines = [
  "# 실제 사건 170개 이미지 에셋 보고서",
  "",
  `- 사건: ${report.totals.topics}개`,
  `- 로컬 에셋 보유: ${report.totals.withLocalAsset}개`,
  `- 현장·인물 원문 사진: ${report.totals.fieldPhotoReady}개`,
  `- 원문 페이지 증거 캡처만 보유: ${report.totals.sourceProofOnly}개`,
  `- 에셋 미확보: ${report.totals.manualSearch}개`,
  `- 동일 파일 공유 그룹: ${duplicateGroups.length}개`,
  "",
  "원문 페이지 캡처는 증거·검색 출발점이며 현장 사진 대체물이 아니다. 외부 이미지는 모두 reference-only이며 발행 전 사용권 확인이 필요하다.",
  "",
  "| ID | 선수 | 상태 | 로컬 에셋 | 다음에 찾을 현장 장면 |",
  "|---|---|---|---|---|",
  ...report.items.map((item) => `| ${item.topicId} | ${item.player} | ${item.status} | ${item.localPath || "없음"} | ${item.cardPlan[1]?.need || "맥락 장면"} |`),
];
fs.writeFileSync(ledgerPath, `${lines.join("\n")}\n`);

const audit = [
  "# 실제 사건 이미지 QA",
  "",
  `- 사건 레코드: ${report.items.length}`,
  `- 로컬 에셋 누락: ${report.totals.manualSearch}`,
  `- 현장 사진 추가 탐색 필요: ${report.totals.sourceProofOnly}`,
  `- 중복 파일 그룹: ${duplicateGroups.length}`,
  "",
  "## 판정",
  "",
  report.totals.manualSearch === 0 ? "모든 실제 사건에 최소 1개 로컬 에셋이 연결됐다." : "로컬 에셋 누락이 남아 있다.",
  "원문 페이지 캡처만 있는 사건은 카드 렌더 전에 카드별 장면 검색을 추가해야 한다.",
  "마네 병원 이야기처럼 같은 사건군이 동일 사진을 공유하는 경우는 의도된 중복으로 처리한다.",
  "",
  "## 동일 파일 그룹",
  "",
  ...duplicateGroups.map((group) => `- ${group.topicIds.join(", ")}`),
];
fs.writeFileSync(auditPath, `${audit.join("\n")}\n`);
console.log(JSON.stringify(report.totals, null, 2));
