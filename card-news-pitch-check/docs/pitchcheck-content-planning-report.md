# PitchCheck Content Planning Report

## 현재 기획 구조

PitchCheck 카드뉴스 자동화는 Gemini가 전체를 마음대로 만드는 구조가 아니다. Gemini는 카피만 쓰고, 기획 순서, CTA 위치, 미디어 선별, 레이아웃, 렌더링은 코드가 고정한다.

1. `samples/pitchcheck/story-bank-60.json`
   - 축구인이 멈출 만한 룰, 기록, 잡지식, 공감형 소재 60개를 저장한다.
   - 각 소재는 `hook`, `fact`, `whyFun`, `pitchCheckBridge`, `visualNeed`, `imageQueries`, `sourceRefs`를 가진다.

2. `scripts/pitchcheck/fetch-story-bank-images.mjs`
   - 소재별 이미지 검색 쿼리를 Wikimedia Commons와 로컬 축구 이미지 에셋에 매핑한다.
   - 다운로드가 막히면 로컬 축구 컷을 fallback으로 배정한다.

3. `scripts/pitchcheck/gemini-build-carousel.mjs`
   - Gemini 3.5 Flash 또는 deterministic fallback으로 7장 카피를 만든다.
   - AIDA는 코드로 고정한다.
   - 1~5번: 축구 꿀잼 정보로 attention/interest/desire를 만든다.
   - 6번: 운영자가 매주 겪는 확인 피로에 공감한다.
   - 7번: 프로필 링크 설치와 댓글 `[피치체크]` 사용 영상 CTA를 넣는다.
   - 기본 소재는 `fun-017` 주장 완장 소재다. 룰북 잡학보다 주장/총무가 바로 아는 단톡방 장면이 강하기 때문이다.

4. `scripts/pitchcheck/render-carousel.mjs`
   - HTML/CSS 고정 레이아웃으로 PNG를 렌더링한다.
   - GmarketSans와 실제 PitchCheck 로고를 사용한다.
   - 카드 6~7은 로컬 PitchCheck 영상 프레임과 앱 화면을 사용한다.

## 이번에 바꾼 카피 원칙

토스 UX Writing 글의 방향을 카드뉴스용으로 옮겼다. 참고 글: https://toss.tech/article/8-writing-principles-of-toss

- 한 카드에는 한 메시지만 둔다.
- 짧게 쓰되 맥락을 지우지 않는다.
- 사용자가 겪는 상황을 먼저 말한다.
- 기능 소개보다 행동 이유를 먼저 말한다.
- 강요하지 않고 제안한다.
- 조사, 짧은 단어, 2~3글자가 한 줄에 고립되지 않게 한다.
- 첫 장은 "정보 제목"이 아니라 "우리 팀에서 본 장면"이어야 한다.

## 이번에 바꾼 소재 기준

기존 `fun-001` 킥오프 직접골 소재는 사실은 맞지만 너무 룰북형이었다. 보는 사람이 "그래서 내 팀이랑 무슨 상관인데?"라고 느끼기 쉽다.

새 기본 소재는 `fun-017` 주장 완장 소재다.

- 룰북 반전: 주장은 특별한 지위나 특권이 없다.
- 공감 장면: 현실에서는 주장/총무에게 출석, 장소, 시간 질문이 몰린다.
- CTA 연결: 반복 확인을 주장 혼자 처리하지 말고 피치체크에 남긴다.

## 이번에 바꾼 에셋 선별 규칙

6번 카드는 더 이상 팀 사진 업로드, 갤러리, 강아지 이미지 화면을 쓰지 않는다.

- 차단: `frame-001`, `frame-002`, `frame-003`, `frame-004`, `frame-016`, `frame-017`
- 6번 우선: 위치 지도, 출석 확인, 일정 캘린더, 시간 선택 화면
- 7번 우선: 6번 화면 + 설치 CTA 배경으로 쓸 수 있는 앱 사용 흐름 화면

현재 6번 카드의 시각 역할은 “실제 화면 설명”이 아니라 “출석, 일정, 위치 확인이 한 곳에 모인다는 감각”이다.

## 현재 남은 품질 기준

- 렌더 후 `contact-sheet.png`와 `thumbnail-sheet.png`를 눈으로 확인한다.
- 헤드라인 안 강조색 때문에 줄바꿈이 깨지지 않는지 확인한다.
- 6번 카드에 갤러리/업로드/강아지 화면이 다시 들어오지 않는지 확인한다.
- 7번 카드에 프로필 링크 설치와 댓글 `[피치체크]` 사용 영상 CTA가 같이 보이는지 확인한다.
