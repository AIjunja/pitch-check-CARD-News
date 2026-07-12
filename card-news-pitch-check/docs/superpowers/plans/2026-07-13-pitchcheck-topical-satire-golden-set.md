# PitchCheck Topical Satire Golden Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, source, render, and visually verify ten 7-card PitchCheck carousels whose first five cards form a complete football story and end in a fact-checked topical satire punchline.

**Architecture:** Keep the approved ten stories in a separate overlay bank until the user approves the tone. A dedicated validator enforces the editorial fields and SCORE copy contract, the existing social-video pipeline supplies candidate footage, and the batch renderer gains an explicit bank input plus strict-media mode so missing or repeated assets block output instead of falling back silently.

**Tech Stack:** Node.js ESM, `node:assert/strict`, yt-dlp, ffmpeg/ffprobe, Puppeteer, JSON/Markdown source ledgers, existing GmarketSans HTML/CSS renderer.

---

## File Map

- Create `samples/pitchcheck/topical-satire-golden-set-10.json`: isolated ten-story editorial overlay.
- Create `scripts/pitchcheck/lib/topical-story-validation.mjs`: SCORE schema and punchline validation.
- Create `scripts/pitchcheck/test-topical-golden-set.mjs`: focused contract tests.
- Create `docs/research/topical-satire-golden-set-10/source-ledger.md`: current-fact and social-reference ledger.
- Create `assets/reference/web/topical-satire-golden-set-10-media.json`: selected video/image slots with timestamps and rights.
- Create `scripts/pitchcheck/build-topical-golden-set-media.mjs`: materialize selected media for cards 1-5.
- Modify `scripts/pitchcheck/extract-story-video-frames.mjs`: support explicit bank and topic-list inputs.
- Modify `scripts/pitchcheck/render-video-first-batch.mjs`: support explicit bank/media index and strict media.
- Create `scripts/pitchcheck/audit-topical-golden-set.mjs`: structural, duplicate-media, freshness, and output audit.
- Modify `package.json`: add focused research, test, render, and audit commands.

## Golden Set IDs

The overlay must contain exactly these existing verified event IDs:

```js
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
```

### Task 1: Add the Topical Story Contract

**Files:**
- Create: `scripts/pitchcheck/lib/topical-story-validation.mjs`
- Create: `scripts/pitchcheck/test-topical-golden-set.mjs`

- [ ] **Step 1: Write failing validator tests**

Create fixtures with the complete contract and assert failures for every missing editorial field, a non-question/non-gap hook, a fifth card without a topical target, stale high-risk copy, early PitchCheck CTA, and duplicate visual paths.

```js
import assert from 'node:assert/strict';
import { validateTopicalGoldenSet } from './lib/topical-story-validation.mjs';

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
  id: 'hwang-001-portugal-stoppage-time-winner',
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

const bank = { sourceRefs: { fifa_kor_por_2022: 'https://www.fifa.com/' }, socialRefs: { youtube_fifa_hwang_portugal: 'https://www.youtube.com/' }, topics: [validTopic] };
assert.deepEqual(validateTopicalGoldenSet(bank, { expectedCount: 1, asOf: '2026-07-13' }), { topics: 1, highExpiry: 1 });

for (const field of ['editorialThesis', 'topicalTarget', 'topicalAsOf', 'punchlineType', 'expiryRisk', 'visualNeed']) {
  const topic = structuredClone(validTopic);
  delete topic[field];
  assert.throws(() => validateTopicalGoldenSet({ ...bank, topics: [topic] }), new RegExp(field));
}

const noPunchline = structuredClone(validTopic);
noPunchline.copy.cards[4].body = '한국은 조 2위로 16강에 진출했습니다.';
assert.throws(() => validateTopicalGoldenSet({ ...bank, topics: [noPunchline] }), /card 5 must mention topical target or editorial contrast/);
```

- [ ] **Step 2: Run the tests and confirm the failure**

Run:

```powershell
node scripts/pitchcheck/test-topical-golden-set.mjs
```

Expected: `ERR_MODULE_NOT_FOUND` for `topical-story-validation.mjs`.

- [ ] **Step 3: Implement the minimal validator**

The validator must flatten string/object cards, require exactly ten unique topics when requested, enforce the allowed enums, require cards 1-5 as structured objects, reject early CTA terms, require at least one curiosity marker in card 1, and require card 5 to contain a contrast marker or the topical subject.

```js
const PUNCHLINES = new Set(['current-satire', 'irony', 'fan-self-deprecation', 'debate']);
const RISKS = new Set(['low', 'medium', 'high']);
const EARLY_CTA = /피치체크|프로필\s*링크|설치|다운로드|사용\s*영상/;
const CURIOSITY = /\?|기억|왜|무슨|어떻게|진짜 이유|그날|이 장면/;
const CONTRAST = /그때|지금|요즘|반면|하지만|였는데|기다렸|결국|아직도|보다/;

function text(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(text).join(' ');
  return '';
}

export function validateTopicalGoldenSet(bank, { expectedCount, asOf = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [];
  const topics = Array.isArray(bank?.topics) ? bank.topics : [];
  const ids = new Set();
  let highExpiry = 0;
  for (const topic of topics) {
    const id = topic?.id || 'unknown';
    if (ids.has(id)) errors.push(`${id}: duplicate id`);
    ids.add(id);
    for (const field of ['editorialThesis', 'topicalTarget', 'topicalAsOf', 'punchlineType', 'expiryRisk', 'visualNeed']) {
      if (!topic?.[field]) errors.push(`${id}: missing ${field}`);
    }
    if (!PUNCHLINES.has(topic?.punchlineType)) errors.push(`${id}: invalid punchlineType`);
    if (!RISKS.has(topic?.expiryRisk)) errors.push(`${id}: invalid expiryRisk`);
    if (topic?.expiryRisk === 'high') highExpiry += 1;
    const cards = topic?.copy?.cards;
    if (!Array.isArray(cards) || cards.length !== 7) errors.push(`${id}: expected exactly 7 cards`);
    for (const [index, card] of (cards || []).slice(0, 5).entries()) {
      if (!card || typeof card !== 'object' || Array.isArray(card)) errors.push(`${id}: card ${index + 1} must be structured`);
      if (EARLY_CTA.test(text(card))) errors.push(`${id}: forbidden early CTA`);
    }
    if (!CURIOSITY.test(text(cards?.[0]))) errors.push(`${id}: card 1 needs curiosity gap`);
    const target = text(topic?.topicalTarget?.subject);
    if (!CONTRAST.test(text(cards?.[4])) && (!target || !text(cards?.[4]).toLowerCase().includes(target.toLowerCase()))) {
      errors.push(`${id}: card 5 must mention topical target or editorial contrast`);
    }
    if (!Array.isArray(topic?.visualNeed) || topic.visualNeed.length !== 5) errors.push(`${id}: visualNeed must contain five cards`);
    if (topic?.expiryRisk === 'high' && Math.abs(Date.parse(asOf) - Date.parse(topic.topicalAsOf)) > 14 * 86400000) errors.push(`${id}: stale high-risk topical copy`);
  }
  if (expectedCount !== undefined && topics.length !== expectedCount) errors.push(`expected ${expectedCount} topics, got ${topics.length}`);
  if (errors.length) throw new Error(errors.join('\n'));
  return { topics: topics.length, highExpiry };
}
```

- [ ] **Step 4: Run the focused tests**

Run: `node scripts/pitchcheck/test-topical-golden-set.mjs`

Expected: `topical golden set validation tests passed`.

- [ ] **Step 5: Commit the validator**

```powershell
git add scripts/pitchcheck/lib/topical-story-validation.mjs scripts/pitchcheck/test-topical-golden-set.mjs
git commit -m "Add topical carousel story contract"
```

### Task 2: Build the Current-Fact Source Ledger

**Files:**
- Create: `docs/research/topical-satire-golden-set-10/source-ledger.md`

- [ ] **Step 1: Research the ten event claims from primary sources**

For each exact topic ID, record the official event source already referenced by the 170-story bank. Add one dated source for the current satire target. Current sources must be an association, club, league, competition organizer, direct interview, or a reputable report quoting the public statement.

The ledger row schema is fixed:

```markdown
| topicId | event claim | event source | current claim | current source | checkedAt | safe tense |
|---|---|---|---|---|---|---|
| hwang-001-portugal-stoppage-time-winner | 황희찬이 90+1분 포르투갈전 결승골을 기록했다 | FIFA match report URL | 홍명보 감독은 2026 월드컵 조별리그 탈락 후 사임했다 | AFC resignation URL | 2026-07-13 | 명보호 때는 |
```

- [ ] **Step 2: Add social hook references separately**

For each story, add a `Social hook` subsection containing the Reddit/YouTube/Instagram/TikTok post URL, visible engagement when available, original rights holder, and the original match/broadcast URL to which it was traced. Do not treat community commentary as fact evidence.

- [ ] **Step 3: Verify all twenty required source classes**

Run:

```powershell
$ledger = Get-Content docs/research/topical-satire-golden-set-10/source-ledger.md -Raw
@('hwang-001','messi-011','ronaldo-011','son-007','park-001','lee-001','real-034','real-044','real-046','real-038') | ForEach-Object { if ($ledger -notmatch [regex]::Escape($_)) { throw "missing $_" } }
```

Expected: exit code `0` with no output.

- [ ] **Step 4: Commit the source ledger**

```powershell
git add docs/research/topical-satire-golden-set-10/source-ledger.md
git commit -m "Research topical golden set sources"
```

### Task 3: Author the Ten-Story Editorial Overlay

**Files:**
- Create: `samples/pitchcheck/topical-satire-golden-set-10.json`
- Modify: `scripts/pitchcheck/test-topical-golden-set.mjs`

- [ ] **Step 1: Add a test that loads the real overlay**

```js
const golden = JSON.parse(fs.readFileSync('samples/pitchcheck/topical-satire-golden-set-10.json', 'utf8'));
assert.deepEqual(golden.topics.map((topic) => topic.id), GOLDEN_TOPIC_IDS);
assert.deepEqual(validateTopicalGoldenSet(golden, { expectedCount: 10, asOf: '2026-07-13' }), {
  topics: 10,
  highExpiry: golden.topics.filter((topic) => topic.expiryRisk === 'high').length,
});
```

- [ ] **Step 2: Run the test and confirm the missing-file failure**

Run: `node scripts/pitchcheck/test-topical-golden-set.mjs`

Expected: `ENOENT` for `topical-satire-golden-set-10.json`.

- [ ] **Step 3: Create the overlay with the full contract**

Each topic must copy its immutable `eventKey`, `player`, and official `sourceRefs` from `real-player-story-bank-grounded-170.json`, then add the approved editorial fields. Cards 1-5 must follow SCORE; cards 6-7 must use the approved PitchCheck copy.

The root schema is:

```json
{
  "project": "PitchCheck topical satire golden set",
  "generatedAt": "2026-07-13",
  "sourceRefs": {},
  "socialRefs": {},
  "topics": []
}
```

For every story, write card 5 before cards 1-4. The fixed editorial theses are:

1. `hwang-001`: 2022년의 추가시간은 희망이었지만 홍명보호 시기의 추가시간은 팬의 인내를 시험했다.
2. `messi-011`: 메시가 기록을 목표로 삼지 않았다고 말한 시대를 지금은 숫자로만 소비한다.
3. `ronaldo-011`: 부상으로 빠진 주장도 터치라인에서 경기의 중심이 되는 호날두식 자기 서사였다.
4. `son-007`: 대표팀이 개인 해결과 희생에 기대는 구조는 금메달 장면에서도 드러났다.
5. `park-001`: 압박과 침투로 기억되는 2002년 중원은 현재 대표팀 중원 논쟁의 비교 기준이 됐다.
6. `lee-001`: 골든볼 한 명에게 모든 창의성을 맡기는 순간 기대는 전술을 대신한다.
7. `real-034`: 비싼 육성 시스템이 놓친 바디를 8부리그 현장이 증명했다.
8. `real-044`: VAR이 없어도 선수가 스스로 멈출 수 있었던 장면은 판정 책임의 본질을 보여준다.
9. `real-046`: 비엘사는 승점보다 원칙을 택했지만 현대 축구는 몇 초를 아끼려고 몇 분을 눕는다.
10. `real-038`: 전쟁을 견딘 모드리치의 삶과 모든 부진을 멘탈 탓으로 부르는 팬 문화는 같은 단어가 아니다.

- [ ] **Step 4: Run validation and inspect line breaks**

Run:

```powershell
node scripts/pitchcheck/test-topical-golden-set.mjs
node -e "const b=require('./samples/pitchcheck/topical-satire-golden-set-10.json');for(const t of b.topics)for(const [i,c] of t.copy.cards.entries())if(i<5&&c.headline.some(x=>x.length>18))throw Error(t.id+' card '+(i+1)+' long line')"
```

Expected: tests pass and the line-length command exits `0`.

- [ ] **Step 5: Commit the editorial overlay**

```powershell
git add samples/pitchcheck/topical-satire-golden-set-10.json scripts/pitchcheck/test-topical-golden-set.mjs
git commit -m "Author topical satire golden set"
```

### Task 4: Select and Materialize Card-Specific Media

**Files:**
- Create: `assets/reference/web/topical-satire-golden-set-10-media.json`
- Create: `scripts/pitchcheck/build-topical-golden-set-media.mjs`
- Modify: `scripts/pitchcheck/extract-story-video-frames.mjs`

- [ ] **Step 1: Add CLI input tests for the frame extractor**

Add `--bank`, `--topics-file`, and `--manifest` parsing to a pure exported `parseArgs()` function and test explicit paths resolve beneath `ROOT`.

```js
assert.deepEqual(parseArgs(['--bank', 'samples/pitchcheck/topical-satire-golden-set-10.json', '--topics-file', 'tmp/topics.json']), {
  bank: path.join(ROOT, 'samples/pitchcheck/topical-satire-golden-set-10.json'),
  topicsFile: path.join(ROOT, 'tmp/topics.json'),
  manifest: path.join(ROOT, 'assets/reference/web/real-player-social-hook-videos-170.json'),
});
```

- [ ] **Step 2: Implement explicit input handling**

The extractor must read the chosen social candidate from `real-player-social-hook-videos-170.json`, download no more than the selected reference-only clip, and emit five candidate frames in the order `emotional peak, setup, conflict, action, aftermath`. It must never choose a fallback video whose title lacks the event action or required year.

- [ ] **Step 3: Create the curated media index**

`topical-satire-golden-set-10-media.json` must use this slot shape:

```json
{
  "topicId": "hwang-001-portugal-stoppage-time-winner",
  "cards": [
    {
      "card": 1,
      "copyNeed": "celebration close-up",
      "assetType": "video-frame",
      "localPath": "assets/reference/web/real-player-story-video-frames-170/hwang-001-portugal-stoppage-time-winner/card-01.jpg",
      "sourceUrl": "https://www.youtube.com/watch?v=DVNwiAPuPTY",
      "timestampSeconds": 105,
      "rights": "reference-only",
      "visualReview": "pass"
    }
  ]
}
```

All 50 slots must have unique hashes within their own story. `visualReview` may only be `pass` after opening the frame and checking the named player, event, and action.

- [ ] **Step 4: Materialize media and reject incomplete stories**

Run:

```powershell
node scripts/pitchcheck/build-topical-golden-set-media.mjs --bank samples/pitchcheck/topical-satire-golden-set-10.json --strict
```

Expected: `stories=10 cards=50 missing=0 duplicateWithinStory=0`.

- [ ] **Step 5: Commit media manifests and scripts**

```powershell
git add scripts/pitchcheck/build-topical-golden-set-media.mjs scripts/pitchcheck/extract-story-video-frames.mjs assets/reference/web/topical-satire-golden-set-10-media.json
git commit -m "Select golden set story media"
```

### Task 5: Add Strict Overlay Rendering

**Files:**
- Modify: `scripts/pitchcheck/render-video-first-batch.mjs`
- Create: `scripts/pitchcheck/test-render-video-first-batch.mjs`

- [ ] **Step 1: Write failing renderer input tests**

Extract and export `parseRenderArgs()` and `resolveMediaForCard()`. Assert that `--strict-media` throws when the curated media index lacks a card, and that an explicit `--bank` supplies the overlay copy instead of the 170-bank copy.

```js
assert.throws(
  () => resolveMediaForCard({ topicId: 'messi-011-calendar-year-scoring-record', card: 3, strict: true, mediaItems: [] }),
  /missing strict media: messi-011-calendar-year-scoring-record card 3/,
);
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `node scripts/pitchcheck/test-render-video-first-batch.mjs`

Expected: named export failure.

- [ ] **Step 3: Implement bank/media/strict flags**

Support:

```text
--bank samples/pitchcheck/topical-satire-golden-set-10.json
--media assets/reference/web/topical-satire-golden-set-10-media.json
--output projects/topical-satire-golden-set-10
--strict-media
```

In strict mode, remove every legacy source-page, old slot, and generic fallback branch. Cards 1-5 must come only from the curated media index. Cards 6-7 continue to copy the approved CTA assets.

- [ ] **Step 4: Render all ten carousels**

Run:

```powershell
node scripts/pitchcheck/render-video-first-batch.mjs --bank samples/pitchcheck/topical-satire-golden-set-10.json --media assets/reference/web/topical-satire-golden-set-10-media.json --output projects/topical-satire-golden-set-10 --strict-media
```

Expected: `10/10` stories and 70 PNG cards at 1080 x 1350.

- [ ] **Step 5: Commit strict renderer support**

```powershell
git add scripts/pitchcheck/render-video-first-batch.mjs scripts/pitchcheck/test-render-video-first-batch.mjs
git commit -m "Render strict topical story overlays"
```

### Task 6: Audit Story, Media, Freshness, and Layout

**Files:**
- Create: `scripts/pitchcheck/audit-topical-golden-set.mjs`
- Create: `docs/research/topical-satire-golden-set-10/render-audit.md`

- [ ] **Step 1: Write audit assertions**

The audit must verify:

```js
assert.equal(summary.stories, 10);
assert.equal(summary.cards, 70);
assert.equal(summary.missingCards, 0);
assert.equal(summary.badDimensions, 0);
assert.equal(summary.duplicateMediaWithinStory, 0);
assert.equal(summary.missingEditorialThesis, 0);
assert.equal(summary.missingPunchline, 0);
assert.equal(summary.staleHighRiskCopy, 0);
assert.equal(summary.unreviewedMedia, 0);
```

- [ ] **Step 2: Implement the audit script**

Read PNG dimensions from IHDR bytes, hash cards 1-5 source assets, invoke `validateTopicalGoldenSet`, compare `topicalAsOf` to the supplied `--as-of`, and require every media slot to have `visualReview: pass`.

- [ ] **Step 3: Generate full and square-crop contact sheets**

For each story, create:

- `output/contact-sheet.jpg`: seven full 4:5 cards.
- `output/thumbnail-sheet.jpg`: centered 1:1 Instagram grid crops.

Use ffmpeg with `crop=1080:1080:0:135` before scaling the thumbnail sheet.

- [ ] **Step 4: Visually inspect all twenty sheets**

Open every contact sheet and thumbnail sheet. Record `pass` or exact card numbers under each topic in `render-audit.md`. Fix and rerender any unnatural Korean break, hidden subject, wrong frame, duplicate visual, CTA collision, or stale joke.

- [ ] **Step 5: Run the final audit**

Run:

```powershell
node scripts/pitchcheck/audit-topical-golden-set.mjs --bank samples/pitchcheck/topical-satire-golden-set-10.json --media assets/reference/web/topical-satire-golden-set-10-media.json --render-root projects/topical-satire-golden-set-10 --as-of 2026-07-13
```

Expected:

```text
stories=10 cards=70 missing=0 dimensions=0 duplicateMedia=0 stale=0 unreviewed=0
```

- [ ] **Step 6: Commit the verified golden set**

```powershell
git add scripts/pitchcheck/audit-topical-golden-set.mjs docs/research/topical-satire-golden-set-10/render-audit.md projects/topical-satire-golden-set-10
git commit -m "Verify topical satire golden set"
```

### Task 7: Add Reproducible Commands and Full Regression

**Files:**
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Add focused package commands**

```json
{
  "scripts": {
    "test:pitchcheck-topical": "node scripts/pitchcheck/test-topical-golden-set.mjs && node scripts/pitchcheck/test-render-video-first-batch.mjs",
    "media:pitchcheck-topical": "node scripts/pitchcheck/build-topical-golden-set-media.mjs --bank samples/pitchcheck/topical-satire-golden-set-10.json --strict",
    "render:pitchcheck-topical": "node scripts/pitchcheck/render-video-first-batch.mjs --bank samples/pitchcheck/topical-satire-golden-set-10.json --media assets/reference/web/topical-satire-golden-set-10-media.json --output projects/topical-satire-golden-set-10 --strict-media",
    "audit:pitchcheck-topical": "node scripts/pitchcheck/audit-topical-golden-set.mjs --bank samples/pitchcheck/topical-satire-golden-set-10.json --media assets/reference/web/topical-satire-golden-set-10-media.json --render-root projects/topical-satire-golden-set-10"
  }
}
```

- [ ] **Step 2: Document the exact workflow**

Add a `Topical satire golden set` section to `README.md` with the four commands in order and the rule that high-risk topical copy must be re-researched after fourteen days.

- [ ] **Step 3: Run focused and full tests**

Run:

```powershell
npm run test:pitchcheck-topical
npm test
npm run audit:pitchcheck-topical
```

Expected: all commands exit `0`; the final audit reports ten complete stories and no blocked condition.

- [ ] **Step 4: Review repository changes**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors. Do not stage the existing 170-story render directory or unrelated user changes.

- [ ] **Step 5: Commit reproducible workflow**

```powershell
git add package.json README.md
git commit -m "Document topical carousel workflow"
```

## Plan Self-Review

- Spec coverage: SCORE copy, topical satire, current-fact checks, CTA placement, card-specific assets, strict render blocking, contact sheets, and ten-topic completion each have an implementation task.
- Placeholder scan: the plan contains no TBD, TODO, deferred implementation, or unspecified test step.
- Type consistency: `editorialThesis`, `topicalTarget`, `topicalAsOf`, `punchlineType`, `expiryRisk`, `visualNeed`, and `visualReview` use the same names in schema, tests, renderer inputs, and audit.
- Scope: the plan stops after the ten-story golden set. Applying the result to all 170 stories requires a separate approved rollout plan.
