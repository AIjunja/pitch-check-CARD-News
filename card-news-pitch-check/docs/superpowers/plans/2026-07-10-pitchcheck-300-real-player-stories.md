# 피치체크 실제 선수 스토리 300개 구현 계획

> **작업 에이전트 필수:** 이 계획은 `subagent-driven-development`(추천) 또는 `executing-plans` 스킬로 체크박스 순서대로 실행한다.

**목표:** 기존 실제 사건 50개와 새로 검증한 실제 사건 250개를 합쳐, 중복 없는 7장짜리 피치체크 캐러셀 기획안 300개를 만든다.

**구조:** 출처와 실제 사건을 JSON 데이터로 분리하고, 검증기와 생성기가 이를 합쳐 최종 뱅크를 만든다. Gemini는 검증된 사실을 바꿀 수 없고 카피만 다듬으며, 이미지 검색기는 사용 권리 상태가 기록된 검색 장부를 생성한다.

**기술:** Node.js ESM, JSON, 기존 Puppeteer 렌더러, Gemini HTTP API, Scrapling 출처 팩, Wikimedia Commons 검색기

---

## 파일 구성

- 생성: `scripts/pitchcheck/lib/real-story-validation.mjs` - 사건, 출처, 7장 카피, 중복, CTA를 검사한다.
- 생성: `scripts/pitchcheck/test-real-player-story-bank.mjs` - 회귀 테스트를 한 명령으로 실행한다.
- 생성: `scripts/pitchcheck/migrate-real-player-story-bank.mjs` - 기존 60개에서 실제 사건 50개만 옮긴다.
- 생성: `scripts/pitchcheck/generate-real-player-story-bank-300.mjs` - 사건 데이터와 출처 카탈로그를 최종 뱅크로 합친다.
- 생성: `samples/pitchcheck/real-player-story-migrated-50.json` - 기존 뱅크에서 승계한 실제 사건이다.
- 생성: `samples/pitchcheck/real-player-story-seeds-global.json` - 글로벌 레전드와 슈퍼스타 사건이다.
- 생성: `samples/pitchcheck/real-player-story-seeds-active.json` - 현역 스타 사건이다.
- 생성: `samples/pitchcheck/real-player-story-seeds-asia.json` - 한국 및 아시아 선수 사건이다.
- 생성: `samples/pitchcheck/real-player-story-seeds-women.json` - 여자축구 선수 사건이다.
- 생성: `samples/pitchcheck/real-player-story-seeds-cult.json` - 하부리그, 페어플레이, 컬트 히어로 사건이다.
- 생성: `samples/pitchcheck/real-player-roster-300.json` - 선수별 목표와 포트폴리오 집계를 관리한다.
- 생성: `samples/pitchcheck/real-player-source-catalog-300.json` - 모든 출처 URL과 검증 정보를 관리한다.
- 생성: `samples/pitchcheck/real-player-story-bank-300.json` - 최종 300개 기획안이다.
- 생성: `docs/research/real-player-stories/` - 선수 묶음별 Scrapling 출처 팩을 저장한다.
- 생성: `docs/pitchcheck-real-player-story-audit-300.md` - 개수, 출처, 중복, 카피, 이미지 상태를 보고한다.
- 수정: `scripts/pitchcheck/gemini-build-carousel.mjs:17` - 기본 뱅크를 300개 버전으로 바꾼다.
- 수정: `scripts/pitchcheck/gemini-build-carousel.mjs:598` - 고정 카피와 Gemini 카피를 동일한 검증기로 검사한다.
- 수정: `scripts/pitchcheck/fetch-story-bank-images.mjs:9` - 300개 이미지 장부를 기본값으로 사용한다.
- 수정: `package.json:9` - 마이그레이션, 생성, 검사, 이미지 검색 명령을 추가한다.
- 수정: `docs/pitchcheck-automation.md` - 300개 생성·검증·선택 렌더링 방법을 한국어로 설명한다.

### 작업 1: 사건·출처·카피 검증기

**파일:**

- 생성: `scripts/pitchcheck/lib/real-story-validation.mjs`
- 생성: `scripts/pitchcheck/test-real-player-story-bank.mjs`

- [ ] **1단계: 중복 사건과 잘못된 카드가 실패하는 테스트 작성**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateStoryBank } from "./lib/real-story-validation.mjs";

function fixture(overrides = {}) {
  return {
    id: "real-fixture",
    eventKey: "fixture|2026|event",
    sourceRefs: ["source_a"],
    copy: {
      cards: Array.from({ length: 7 }, (_, index) => ({
        label: `card-${index + 1}`,
        headline: ["검증용 제목"],
        body: "검증용 본문",
      })),
    },
    ...overrides,
  };
}

const duplicate = {
  sourceRefs: { source_a: { url: "https://example.com/a" } },
  topics: [
    fixture({ id: "real-001", eventKey: "messi|2007|getafe-goal" }),
    fixture({ id: "real-002", eventKey: "messi|2007|getafe-goal" }),
  ],
};

assert.throws(() => validateStoryBank(duplicate), /duplicate eventKey/);
assert.throws(
  () => validateStoryBank({ ...duplicate, topics: [fixture({ copy: { cards: [] } })] }),
  /exactly 7 cards/,
);
```

- [ ] **2단계: 테스트가 검증기 미구현으로 실패하는지 확인**

실행: `node scripts/pitchcheck/test-real-player-story-bank.mjs`

예상: `ERR_MODULE_NOT_FOUND` 또는 `validateStoryBank is not defined`로 실패한다.

- [ ] **3단계: 최소 검증기 구현**

```js
const FORBIDDEN_EARLY = /피치체크|프로필\s*링크|설치|다운로드|사용\s*영상|앱/;

export function validateStoryBank(bank, { expectedCount } = {}) {
  const errors = [];
  const eventKeys = new Set();

  for (const topic of bank.topics ?? []) {
    if (!topic.eventKey) errors.push(`${topic.id}: missing eventKey`);
    if (eventKeys.has(topic.eventKey)) errors.push(`${topic.id}: duplicate eventKey`);
    eventKeys.add(topic.eventKey);
    if (topic.copy?.cards?.length !== 7) errors.push(`${topic.id}: expected exactly 7 cards`);
    for (const card of topic.copy?.cards?.slice(0, 5) ?? []) {
      const text = [card.label, ...(card.headline ?? []), card.body].flat().join(" ");
      if (FORBIDDEN_EARLY.test(text)) errors.push(`${topic.id}: forbidden early CTA`);
    }
    for (const sourceRef of topic.sourceRefs ?? []) {
      if (!bank.sourceRefs?.[sourceRef]) errors.push(`${topic.id}: missing source ${sourceRef}`);
    }
  }

  if (expectedCount && bank.topics?.length !== expectedCount) {
    errors.push(`expected ${expectedCount} topics, got ${bank.topics?.length ?? 0}`);
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return { topics: bank.topics.length, uniqueEvents: eventKeys.size };
}
```

- [ ] **4단계: 테스트 통과 확인**

실행: `node scripts/pitchcheck/test-real-player-story-bank.mjs`

예상: `real story validation tests passed`가 출력된다.

- [ ] **5단계: 커밋**

```powershell
git add scripts/pitchcheck/lib/real-story-validation.mjs scripts/pitchcheck/test-real-player-story-bank.mjs
git commit -m "Add real player story validation"
```

### 작업 2: 기존 60개에서 실제 사건 50개 승계

**파일:**

- 생성: `scripts/pitchcheck/migrate-real-player-story-bank.mjs`
- 생성: `samples/pitchcheck/real-player-story-migrated-50.json`
- 테스트: `scripts/pitchcheck/test-real-player-story-bank.mjs`

- [ ] **1단계: 승계 결과가 50개인지 검사하는 테스트 추가**

```js
const migrated = JSON.parse(readFileSync("samples/pitchcheck/real-player-story-migrated-50.json", "utf8"));
assert.equal(migrated.topics.length, 50);
assert.equal(new Set(migrated.topics.map((topic) => topic.eventKey)).size, 50);
assert.equal(migrated.topics.some((topic) => topic.category.endsWith("alternate-hook")), false);
```

- [ ] **2단계: 파일이 없어 테스트가 실패하는지 확인**

실행: `node scripts/pitchcheck/test-real-player-story-bank.mjs`

예상: `ENOENT real-player-story-migrated-50.json`로 실패한다.

- [ ] **3단계: 대체 훅을 제외하고 고유 키를 만드는 마이그레이션 구현**

```js
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const readJson = (relativePath) => JSON.parse(readFileSync(path.join(ROOT, relativePath), "utf8"));

const source = readJson("samples/pitchcheck/real-player-story-bank-60.json");
const canonical = source.topics.filter((topic) => !topic.category.endsWith("alternate-hook"));

const slugify = (value) => String(value)
  .normalize("NFKD")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");
const playerSlug = (topic) => slugify(topic.assetSearch?.mustHave?.[0] ?? topic.visualNeed.split(" ")[0]);
const eventEra = () => "legacy-sourced";
const canonicalEventSlug = (topic) => topic.id.replace(/^real-\d+-/, "");
const sourceTierFor = (refs) => refs.some((ref) => /_tpt$|_bbc$/.test(ref))
  ? "primary"
  : refs.some((ref) => /fifa|olympics|bundesliga/.test(ref))
    ? "official"
    : "reputable-secondary";
const caveatFor = (topic) => /family-loss|war-childhood|second-chance/.test(topic.category)
  ? "민감한 사건이므로 원문 맥락을 유지하고 선정적으로 확대하지 않는다."
  : null;

const migrated = canonical.map((topic) => ({
  ...topic,
  origin: "migrated-60-bank",
  eventKey: `${playerSlug(topic)}|${eventEra(topic)}|${canonicalEventSlug(topic)}`,
  verification: {
    status: "verified",
    sourceTier: sourceTierFor(topic.sourceRefs),
    caveat: caveatFor(topic),
  },
}));

if (migrated.length !== 50) throw new Error(`Expected 50 migrated stories, got ${migrated.length}`);
writeFileSync(
  path.join(ROOT, "samples/pitchcheck/real-player-story-migrated-50.json"),
  `${JSON.stringify({ topics: migrated }, null, 2)}\n`,
  "utf8",
);
console.log("Migrated 50 unique stories from 60 rows");
```

- [ ] **4단계: 마이그레이션과 테스트 실행**

실행: `node scripts/pitchcheck/migrate-real-player-story-bank.mjs`

예상: `Migrated 50 unique stories from 60 rows`가 출력된다.

실행: `node scripts/pitchcheck/test-real-player-story-bank.mjs`

예상: 모든 검사가 통과한다.

- [ ] **5단계: 커밋**

```powershell
git add scripts/pitchcheck/migrate-real-player-story-bank.mjs samples/pitchcheck/real-player-story-migrated-50.json scripts/pitchcheck/test-real-player-story-bank.mjs
git commit -m "Migrate 50 unique sourced player stories"
```

### 작업 3: 선수 명단과 수량표

**파일:**

- 생성: `samples/pitchcheck/real-player-roster-300.json`
- 수정: `scripts/pitchcheck/lib/real-story-validation.mjs`
- 테스트: `scripts/pitchcheck/test-real-player-story-bank.mjs`

- [ ] **1단계: 포트폴리오 총합과 핵심 선수 목표 검사 추가**

```js
assert.deepEqual(roster.portfolioTargets, {
  global_legend: 130,
  current_star: 80,
  korea_asia: 40,
  women: 30,
  cult_unusual: 20,
});
assert.equal(Object.values(roster.portfolioTargets).reduce((a, b) => a + b, 0), 300);
assert.ok(roster.players.find((p) => p.id === "lionel-messi").target >= 18);
assert.ok(roster.players.find((p) => p.id === "cristiano-ronaldo").target >= 18);
assert.ok(roster.players.find((p) => p.id === "son-heung-min").target >= 10);
```

- [ ] **2단계: 선수 명단 작성**

명단에는 최소한 메시, 호날두, 손흥민, 네이마르, 즐라탄, 호나우지뉴, 베컴, 루니, 앙리, 음바페, 살라, 모드리치, 더 브라위너, 캉테, 마르타, 알렉시아 푸테야스, 아다 헤게르베르그, 샘 커, 아이타나 본마티를 포함한다. `target`, `portfolio`, `searchNames`, `prioritySources`를 선수마다 기록한다.

- [ ] **3단계: 포트폴리오 검사 구현 및 실행**

실행: `node scripts/pitchcheck/test-real-player-story-bank.mjs`

예상: `roster targets: 300`과 함께 통과한다.

- [ ] **4단계: 커밋**

```powershell
git add samples/pitchcheck/real-player-roster-300.json scripts/pitchcheck/lib/real-story-validation.mjs scripts/pitchcheck/test-real-player-story-bank.mjs
git commit -m "Define 300 story player portfolio"
```

### 작업 4: 출처 카탈로그와 리서치 폴더

**파일:**

- 생성: `samples/pitchcheck/real-player-source-catalog-300.json`
- 생성: `docs/research/real-player-stories/README.md`
- 생성: `docs/research/real-player-stories/source-pack-01-existing.md`
- 수정: `scripts/pitchcheck/lib/real-story-validation.mjs`

- [ ] **1단계: 출처 레코드 검사 추가**

```js
for (const [id, source] of Object.entries(catalog.sources)) {
  if (!/^https:\/\//.test(source.url)) errors.push(`${id}: invalid URL`);
  if (!source.publisher || !source.title) errors.push(`${id}: incomplete source identity`);
  if (!['primary', 'official', 'reputable-secondary', 'specialist'].includes(source.tier)) {
    errors.push(`${id}: invalid source tier`);
  }
}
```

- [ ] **2단계: 기존 22개 출처를 카탈로그로 옮기기**

각 출처에 `url`, `publisher`, `title`, `publishedAt`, `tier`, `retrievedAt`, `sourcePack`, `mediaCandidates`, `rightsNote`를 기록한다. 선수 본인 글은 `primary`, FIFA·리그·구단은 `official`, BBC·Guardian·ESPN은 `reputable-secondary`로 표시한다.

- [ ] **3단계: 민감한 사건 검증 규칙 테스트**

실행: `node scripts/pitchcheck/test-real-player-story-bank.mjs`

예상: 가족 사망·범죄·의료 사건에 `caveat` 또는 충분한 출처가 없으면 실패하고, 기존 50개는 통과한다.

- [ ] **4단계: 커밋**

```powershell
git add samples/pitchcheck/real-player-source-catalog-300.json docs/research/real-player-stories scripts/pitchcheck/lib/real-story-validation.mjs scripts/pitchcheck/test-real-player-story-bank.mjs
git commit -m "Add real player source catalog"
```

### 작업 5: 메시·호날두 실제 사건 심층 조사

**파일:**

- 생성: `docs/research/real-player-stories/source-pack-02-messi.md`
- 생성: `docs/research/real-player-stories/source-pack-03-ronaldo.md`
- 생성: `docs/research/real-player-stories/source-urls-02-messi.txt`
- 생성: `docs/research/real-player-stories/source-urls-03-ronaldo.txt`
- 수정: `samples/pitchcheck/real-player-story-seeds-global.json`
- 수정: `samples/pitchcheck/real-player-source-catalog-300.json`

- [ ] **1단계: 공식·직접 출처 후보 수집**

메시는 FIFA, FC Barcelona, Inter Miami, Argentina, Olympics, The Players' Tribune 및 직접 인터뷰를 우선한다. 호날두는 FIFA, UEFA, Sporting CP, Manchester United, Real Madrid, Portugal, The Players' Tribune 및 직접 인터뷰를 우선한다. 검토를 통과한 공개 URL을 선수별 `source-urls-*.txt`에 한 줄씩 저장한다.

- [ ] **2단계: 선별 URL을 Scrapling 출처 팩으로 변환**

실행 예시:

```powershell
$messiUrls = Get-Content docs/research/real-player-stories/source-urls-02-messi.txt
python C:\Users\letgo\.codex\skills\scrapling-source-research\scripts\scrapling_source_pack.py @messiUrls -o docs/research/real-player-stories/source-pack-02-messi.md
$ronaldoUrls = Get-Content docs/research/real-player-stories/source-urls-03-ronaldo.txt
python C:\Users\letgo\.codex\skills\scrapling-source-research\scripts\scrapling_source_pack.py @ronaldoUrls -o docs/research/real-player-stories/source-pack-03-ronaldo.md
```

한 팩의 URL은 25~40개 이하로 유지한다. 차단되거나 로그인해야 하는 페이지는 제외한다.

- [ ] **3단계: 서로 다른 사건 각각 18~20개 작성**

각 사건에 `eventKey`, 시기, 실제 장면, 훅, 배경, 재미 이유, 공유 이유, 출처, 주의 문구, 7장 전체 카피, 카드별 이미지 역할, 다섯 가지 이미지 검색 계획을 작성한다. 골 기록만 다른 항목으로 반복하지 않고, 어린 시절·이적·부상·국가대표·동료·루틴·경기 선택·사회 활동으로 분산한다.

- [ ] **4단계: 중복·출처 검사**

실행: `node scripts/pitchcheck/test-real-player-story-bank.mjs --partial samples/pitchcheck/real-player-story-seeds-global.json`

예상: 메시와 호날두의 `eventKey`가 모두 고유하고 모든 `sourceRef`가 카탈로그에 존재한다.

- [ ] **5단계: 커밋**

```powershell
git add docs/research/real-player-stories/source-pack-02-messi.md docs/research/real-player-stories/source-pack-03-ronaldo.md samples/pitchcheck/real-player-story-seeds-global.json samples/pitchcheck/real-player-source-catalog-300.json
git commit -m "Research Messi and Ronaldo story sets"
```

### 작업 6: 글로벌 레전드와 현역 스타 조사

**파일:**

- 생성: `docs/research/real-player-stories/source-pack-04-global-legends-a.md`
- 생성: `docs/research/real-player-stories/source-pack-05-global-legends-b.md`
- 생성: `docs/research/real-player-stories/source-pack-06-current-stars-a.md`
- 생성: `docs/research/real-player-stories/source-pack-07-current-stars-b.md`
- 수정: `samples/pitchcheck/real-player-story-seeds-global.json`
- 수정: `samples/pitchcheck/real-player-story-seeds-active.json`
- 수정: `samples/pitchcheck/real-player-source-catalog-300.json`

- [ ] **1단계: 선수 묶음별 출처 조사**

레전드 묶음에는 펠레, 마라도나, 크루이프, 지단, 호나우두, 호나우지뉴, 앙리, 베컴, 루니, 카카, 이니에스타, 사비, 부폰, 말디니를 포함한다. 현역 묶음에는 음바페, 홀란, 살라, 더 브라위너, 모드리치, 네이마르, 벨링엄, 비니시우스, 레반도프스키, 케인, 반다이크, 그리즈만을 포함한다.

- [ ] **2단계: 포트폴리오 부족분만큼 사건 작성**

`real-player-roster-300.json`의 `target`에서 기존 승계 사건과 메시·호날두 사건을 뺀 부족분만 채운다. 각 사건은 75점 이상이어야 하고 한 카테고리가 전체의 20%를 넘지 않게 한다. 각 레코드에 검증된 사실을 벗어나지 않는 7장 전체 카피와 7장의 이미지 역할을 직접 작성한다.

- [ ] **3단계: 부분 데이터 검사**

실행: `node scripts/pitchcheck/test-real-player-story-bank.mjs --partial samples/pitchcheck/real-player-story-seeds-global.json`

실행: `node scripts/pitchcheck/test-real-player-story-bank.mjs --partial samples/pitchcheck/real-player-story-seeds-active.json`

예상: 모든 사건의 출처, 고유 키, 이미지 계획이 통과한다.

- [ ] **4단계: 커밋**

```powershell
git add docs/research/real-player-stories/source-pack-0*.md samples/pitchcheck/real-player-story-seeds-global.json samples/pitchcheck/real-player-story-seeds-active.json samples/pitchcheck/real-player-source-catalog-300.json
git commit -m "Add global legend and active star stories"
```

### 작업 7: 한국·아시아, 여자축구, 컬트 히어로 조사

**파일:**

- 생성: `docs/research/real-player-stories/source-pack-08-korea-asia.md`
- 생성: `docs/research/real-player-stories/source-pack-09-womens-football.md`
- 생성: `docs/research/real-player-stories/source-pack-10-cult-unusual.md`
- 수정: `samples/pitchcheck/real-player-story-seeds-asia.json`
- 수정: `samples/pitchcheck/real-player-story-seeds-women.json`
- 수정: `samples/pitchcheck/real-player-story-seeds-cult.json`
- 수정: `samples/pitchcheck/real-player-source-catalog-300.json`

- [ ] **1단계: 한국·아시아 40개 구성**

손흥민, 박지성, 차범근, 김민재, 이강인, 황희찬, 구보 다케후사, 미토마 가오루, 혼다 게이스케, 나카타 히데토시, 알리 다에이 등에서 실제 사건을 찾는다. 손흥민은 기존 3개를 포함해 총 10~12개로 맞춘다.

- [ ] **2단계: 여자축구 30개 구성**

마르타, 알렉시아 푸테야스, 아이타나 본마티, 아다 헤게르베르그, 샘 커, 크리스틴 싱클레어, 미아 햄, 애비 웜백, 지소연, 조소현 등을 포함한다. 단순 수상 기록보다 장면, 결정, 갈등, 복귀, 팀 변화가 분명한 사건을 선택한다.

- [ ] **3단계: 컬트·하부리그·페어플레이 20개 구성**

기존 디 카니오, 아론 헌트 같은 사건을 활용하고, 하부리그에서 올라온 선수, 골을 포기한 선택, 심판 판정을 바로잡은 선수, 특이한 루틴과 문화 충격을 추가한다. 감독 사건은 선수 300개 집계에 넣지 않는다.

- [ ] **4단계: 비극 비중과 출처 검사**

실행: `node scripts/pitchcheck/test-real-player-story-bank.mjs --all-seeds`

예상: 가난·전쟁·사별·가족 비극 합계가 45개 미만이고, 모든 민감 사건이 직접 출처 또는 두 개의 보도 출처를 가진다.

- [ ] **5단계: 커밋**

```powershell
git add docs/research/real-player-stories/source-pack-08-korea-asia.md docs/research/real-player-stories/source-pack-09-womens-football.md docs/research/real-player-stories/source-pack-10-cult-unusual.md samples/pitchcheck/real-player-story-seeds-asia.json samples/pitchcheck/real-player-story-seeds-women.json samples/pitchcheck/real-player-story-seeds-cult.json samples/pitchcheck/real-player-source-catalog-300.json
git commit -m "Add Asian women and cult football stories"
```

### 작업 8: 7장 카피와 이미지 계획 생성

**파일:**

- 생성: `scripts/pitchcheck/generate-real-player-story-bank-300.mjs`
- 수정: `scripts/pitchcheck/lib/real-story-validation.mjs`
- 생성: `samples/pitchcheck/real-player-story-bank-300.json`

- [ ] **1단계: 300개·7장·이미지 역할 테스트 작성**

```js
const bank300 = readJson("samples/pitchcheck/real-player-story-bank-300.json");
const result = validateStoryBank(bank300, { expectedCount: 300 });
assert.equal(result.uniqueEvents, 300);
for (const topic of bank300.topics) {
  assert.equal(topic.copy.cards.length, 7);
  assert.equal(topic.assetSearch.cardPlan.length, 7);
}
```

- [ ] **2단계: 생성 전 테스트 실패 확인**

실행: `node scripts/pitchcheck/test-real-player-story-bank.mjs`

예상: `ENOENT real-player-story-bank-300.json`로 실패한다.

- [ ] **3단계: 데이터 병합과 카드 생성 구현**

```js
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateStoryBank } from "./lib/real-story-validation.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const readJson = (relativePath) => JSON.parse(readFileSync(path.join(ROOT, relativePath), "utf8"));
const writeJson = (relativePath, value) => writeFileSync(
  path.join(ROOT, relativePath),
  `${JSON.stringify(value, null, 2)}\n`,
  "utf8",
);
const mergeSeedFiles = (files) => files.flatMap((file) => {
  const value = readJson(path.join("samples/pitchcheck", file));
  return Array.isArray(value) ? value : value.topics;
});
const buildSevenCardTopic = (seed, index) => {
  if (seed.copy?.cards?.length !== 7) throw new Error(`${seed.eventKey}: seven custom cards required`);
  if (seed.visualPlan?.cardPlan?.length !== 7) throw new Error(`${seed.eventKey}: seven visual jobs required`);
  return {
    ...seed,
    id: `real-${String(index + 1).padStart(3, "0")}-${seed.slug}`,
    pillar: "real_player_story",
    assetSearch: {
      queries: seed.visualPlan.queries,
      cardPlan: seed.visualPlan.cardPlan,
      usageStatus: seed.visualPlan.usageStatus,
    },
  };
};
const projectMeta = (topics) => ({
  name: "PitchCheck 300 verified real player stories",
  version: "2026-07-10-300-unique-events",
  defaultTopicId: topics[0].id,
  contentRule: "Cards 1-5 contain sourced football stories; card 6 is a soft bridge; card 7 is the only CTA.",
});

const catalog = readJson("samples/pitchcheck/real-player-source-catalog-300.json");
const topics = mergeSeedFiles([
  "real-player-story-migrated-50.json",
  "real-player-story-seeds-global.json",
  "real-player-story-seeds-active.json",
  "real-player-story-seeds-asia.json",
  "real-player-story-seeds-women.json",
  "real-player-story-seeds-cult.json",
]).map((seed, index) => buildSevenCardTopic(seed, index));

const sourceRefs = Object.fromEntries(Object.entries(catalog.sources).map(([id, source]) => [id, source.url]));
const bank = { project: projectMeta(topics), sourceRefs, topics };
validateStoryBank(bank, { expectedCount: 300 });
writeJson("samples/pitchcheck/real-player-story-bank-300.json", bank);
console.log("Wrote 300 unique real player stories");
```

6번 장은 `gather_players`, `assign_roles`, `communicate_changes`, `preserve_records`, `fan_reflection` 중 사건에 지정된 값을 사용한다. 7번 장은 실제 피치체크 CTA를 고정한다.

- [ ] **4단계: 생성과 검사 실행**

실행: `node scripts/pitchcheck/generate-real-player-story-bank-300.mjs`

예상: `Wrote 300 unique real player stories`가 출력된다.

실행: `node scripts/pitchcheck/test-real-player-story-bank.mjs`

예상: 전체 검사가 통과한다.

- [ ] **5단계: 커밋**

```powershell
git add scripts/pitchcheck/generate-real-player-story-bank-300.mjs scripts/pitchcheck/lib/real-story-validation.mjs samples/pitchcheck/real-player-story-bank-300.json scripts/pitchcheck/test-real-player-story-bank.mjs
git commit -m "Generate 300 verified player storyboards"
```

### 작업 9: Gemini·이미지 검색·npm 기본값 연결

**파일:**

- 수정: `scripts/pitchcheck/gemini-build-carousel.mjs:17`
- 수정: `scripts/pitchcheck/gemini-build-carousel.mjs:872`
- 수정: `scripts/pitchcheck/fetch-story-bank-images.mjs:9`
- 수정: `package.json:9`

- [ ] **1단계: 기본 경로 회귀 테스트 추가**

```js
assert.match(readFileSync("scripts/pitchcheck/gemini-build-carousel.mjs", "utf8"), /real-player-story-bank-300\.json/);
assert.match(readFileSync("scripts/pitchcheck/fetch-story-bank-images.mjs", "utf8"), /real-player-story-images-300\.json/);
```

- [ ] **2단계: 테스트 실패 확인**

실행: `node scripts/pitchcheck/test-real-player-story-bank.mjs`

예상: 기존 `60.json` 경로 때문에 실패한다.

- [ ] **3단계: 기본값과 검증 연결**

`gemini-build-carousel.mjs`는 Gemini 응답을 받은 직후 원본 사실 필드와 카드 수를 비교하고, 실패하면 `fallbackCopy(topic)`을 사용한다. 이미지 검색기는 `real-player-story-images-300.json`, `real-player-story-image-ledger-300.md`, `real-player-story-bank-300/`을 기본 출력으로 사용한다.

`package.json`에는 다음 명령을 추가한다.

```json
{
  "migrate:pitchcheck-real-stories": "node scripts/pitchcheck/migrate-real-player-story-bank.mjs",
  "bank:pitchcheck-real-stories": "node scripts/pitchcheck/generate-real-player-story-bank-300.mjs",
  "test:pitchcheck-real-stories": "node scripts/pitchcheck/test-real-player-story-bank.mjs",
  "images:pitchcheck-story-bank": "node scripts/pitchcheck/fetch-story-bank-images.mjs samples/pitchcheck/real-player-story-bank-300.json --resume --queries-per-topic 3 --per-query 8 --delay-ms 1200"
}
```

기본 이미지 명령은 후보와 권리 메타데이터만 만들며, `--download`는 사용자가 명시적으로 실행할 때만 사용한다.

- [ ] **4단계: 드라이런 검사**

실행: `npm run test:pitchcheck-real-stories`

예상: 통과한다.

실행:

```powershell
$topic = node -e "const b=require('./samples/pitchcheck/real-player-story-bank-300.json'); process.stdout.write(b.topics.find(x=>x.player==='Lionel Messi').id)"
node scripts/pitchcheck/gemini-build-carousel.mjs --topic $topic --no-gemini
```

예상: 7장 프로젝트 JSON이 생성되고 1~5장에는 피치체크 문구가 없다.

- [ ] **5단계: 커밋**

```powershell
git add scripts/pitchcheck/gemini-build-carousel.mjs scripts/pitchcheck/fetch-story-bank-images.mjs package.json
git commit -m "Wire 300 story bank into carousel pipeline"
```

### 작업 10: 감사 보고서와 대표 렌더링 QA

**파일:**

- 생성: `scripts/pitchcheck/audit-real-player-story-bank.mjs`
- 생성: `docs/pitchcheck-real-player-story-audit-300.md`
- 수정: `docs/pitchcheck-automation.md`
- 수정: `docs/pitchcheck-real-player-story-strategy.md`

- [ ] **1단계: 감사 보고서 검사 추가**

```js
assert.match(audit, /총 사건: 300/);
assert.match(audit, /고유 eventKey: 300/);
assert.match(audit, /출처 누락: 0/);
assert.match(audit, /7장 누락: 0/);
assert.match(audit, /초반 CTA 위반: 0/);
```

- [ ] **2단계: 보고서 생성기 구현**

보고서는 선수별 개수, 포트폴리오별 개수, 카테고리 분포, 출처 등급, 민감 사건, 이미지 권리 상태, 로컬 대체 이미지 수를 표로 출력한다. 300개 제목과 출처 ID도 부록에 기록한다.

- [ ] **3단계: 대표 6개 렌더링**

메시, 호날두, 손흥민, 여자축구, 컬트 히어로, 기존 50개 승계 사건에서 각각 한 개를 골라 다음 명령으로 렌더링한다.

```powershell
$ids = node -e "const b=require('./samples/pitchcheck/real-player-story-bank-300.json'); const pick=(fn)=>b.topics.find(fn).id; console.log(JSON.stringify([pick(x=>x.player==='Lionel Messi'),pick(x=>x.player==='Cristiano Ronaldo'),pick(x=>x.player==='Son Heung-min'),pick(x=>x.portfolio==='women'),pick(x=>x.portfolio==='cult_unusual'),pick(x=>x.origin==='migrated-60-bank')]))" | ConvertFrom-Json
foreach ($id in $ids) {
  node scripts/pitchcheck/gemini-build-carousel.mjs --topic $id --no-gemini --render --package
}
```

각 결과는 1080x1350, 7장, 자연스러운 줄바꿈, 서로 겹치지 않는 HTML/CSS 레이아웃, 실제 피치체크 로고와 CTA를 만족해야 한다.

- [ ] **4단계: 전체 테스트 실행**

실행: `npm run bank:pitchcheck-real-stories`

예상: 정확히 300개가 생성된다.

실행: `npm run test:pitchcheck-real-stories`

예상: 모든 신규 검사가 통과한다.

실행: `npm test`

예상: 기존 렌더러 테스트도 통과한다.

- [ ] **5단계: 최종 커밋**

```powershell
git add scripts/pitchcheck/audit-real-player-story-bank.mjs docs/pitchcheck-real-player-story-audit-300.md docs/pitchcheck-automation.md docs/pitchcheck-real-player-story-strategy.md
git commit -m "Document and audit 300 player stories"
```

### 작업 11: 최종 Git 검수와 푸시 준비

**파일:** 없음

- [ ] **1단계: 변경 상태와 커밋 확인**

실행: `git status --short`

예상: 출력이 없어 작업 폴더가 깨끗하다.

실행: `git log --oneline --max-count=12`

예상: 검증기, 마이그레이션, 리서치 묶음, 300개 생성기, 통합, 감사 보고서 커밋이 순서대로 보인다.

- [ ] **2단계: 최종 통계 확인**

실행:

```powershell
node -e "const b=require('./samples/pitchcheck/real-player-story-bank-300.json'); console.log({topics:b.topics.length, events:new Set(b.topics.map(x=>x.eventKey)).size, seven:b.topics.filter(x=>x.copy.cards.length===7).length})"
```

예상: `{ topics: 300, events: 300, seven: 300 }`이 출력된다.

- [ ] **3단계: 사용자 승인 후 원격 저장소에 푸시**

실행:

```powershell
$branch = git branch --show-current
git push origin $branch
```

예상: 원격 브랜치에 모든 커밋이 반영된다.
