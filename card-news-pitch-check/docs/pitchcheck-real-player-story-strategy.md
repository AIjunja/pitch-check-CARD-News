# PitchCheck Real Player Story Carousel Strategy

## Direction

카드 1~5는 실제 선수 스토리만 쓴다. 앱 광고처럼 시작하지 않는다.

핵심 레퍼런스는 이언 라이트가 죽은 줄 알았던 은사 Sydney Pigden을 다시 만나 모자를 벗고 우는 장면이다. 이 결처럼 한 선수의 구체적인 장면 하나를 잡고, 뒤에서 "이 선수 다시 보인다"는 감정을 만든다.

## Source Workflow

1. Scrapling source-pack으로 공개 출처를 먼저 읽는다.
2. 선수별로 "실제 한 장면"만 seed에 넣는다.
3. 60개 소재 뱅크는 코드로 재생성한다.
4. Gemini Flash는 카피를 다듬을 수 있지만 사실, 카드 수, CTA 위치, 이미지 탐색 규칙은 바꾸지 못한다.

Source packs:

- `docs/real-player-story-scrapling-source-pack.md`
- `docs/ian-wright-teacher-source-pack.md`

Generated bank:

- `samples/pitchcheck/real-player-story-bank-60.json`

Generator:

- `scripts/pitchcheck/generate-real-player-story-bank.mjs`

## Topic Types

- teacher reunion: 이언 라이트, 데이비스처럼 은사나 어린 시절 기억이 있는 이야기
- poverty to pro: 루카쿠, 나니, 펠레처럼 생활 장면이 강한 이야기
- refugee or war childhood: 데이비스, 모드리치처럼 배경 자체가 강한 이야기
- family sacrifice: 래시포드, 마레즈, 손흥민처럼 가족의 행동이 중심인 이야기
- fair play: 디 카니오, 아론 헌트, 비엘사처럼 경기 중 선택이 중심인 이야기
- community impact: 마네, 래시포드처럼 개인 기억이 사회적 행동으로 이어지는 이야기

## AIDA Cards

1. Attention: 답을 숨긴 훅. 결론을 바로 말하지 않는다.
2. Interest: 장면이 왜 이상하고 궁금한지 만든다.
3. Reveal: 출처 기반 실제 사실만 공개한다.
4. Desire/Share: 친구에게 보내고 싶게, 선수가 다르게 보이는 이유를 쓴다.
5. Engagement: 댓글, 저장, 친구 태그를 자연스럽게 유도한다.
6. Soft bridge: 우리 팀, 경기날, 사람 모으기 공감으로만 넘어간다.
7. CTA: 프로필 링크 참고 + 댓글에 `[피치체크]` 남기면 사용 영상 안내.

Cards 1~5 must not mention PitchCheck, install, app, profile link, usage video, download, or CTA.

## Copy Rules

- 한 카드에는 한 장면만 넣는다.
- "가난했다"보다 "우유에 물을 탔다"처럼 보이는 행동을 쓴다.
- "엄했다"보다 "4시간 리프팅을 했고 공이 안 떨어졌다"처럼 구체적으로 쓴다.
- 선수 발언, 날짜, 숫자는 출처에 없으면 만들지 않는다.
- 줄바꿈에서 조사나 2글자 단어만 따로 떨어뜨리지 않는다.
- 토스 UX 카피처럼 짧고 바로 이해되게 쓴다.

## Image Search

Image fetch now searches broad player queries first, then story-specific cues.

Default ledger:

- `assets/reference/web/real-player-story-image-ledger.md`
- `assets/reference/web/real-player-story-images.json`

Selection order:

1. Wikimedia Commons broad player query, such as `Ian Wright football`.
2. Wikimedia Commons story query, such as `Ian Wright Sydney Pigden Highbury teacher reunion football`.
3. Local football fallback, only when Commons returns no usable candidate or rate-limits.

Every selected web image keeps:

- `sourcePage`
- `artist`
- `license`
- `localPath`

Local fallback is marked as `origin: local-fallback` and should be replaced before a final post when exact player imagery is required.

## Upload Harness

The output is an Instagram feed carousel package, not a Reel MP4.

Upload target:

1. Instagram Post
2. Multi-select rendered card images
3. Add music in the post flow if available
4. Publish as carousel

The package harness checks:

- 2~20 cards
- PNG/JPEG files
- 1080x1350
- 4:5 ratio
- caption exists
- upload intent is `instagram-carousel`

## Commands

```powershell
npm run bank:pitchcheck-real-stories
npm run images:pitchcheck-story-bank
npm run gemini:pitchcheck:dry
```

With Gemini Flash:

```powershell
$env:GEMINI_API_KEY="..."
$env:GEMINI_MODEL="gemini-3.5-flash"
npm run gemini:pitchcheck
```

The deterministic fallback copy is still usable without Gemini.
