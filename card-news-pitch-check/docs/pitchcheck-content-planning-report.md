# PitchCheck Content Planning Report

## 방향 전환

이제 PitchCheck 카드뉴스 자동화는 "앱 광고"가 아니라 "축구 바이럴 캐러셀"이 기본이다.

핵심 흐름:

1. 유명 선수/레전드/기록/룰 비하인드로 멈추게 한다.
2. 답을 바로 말하지 않고 다음 장을 넘기게 만든다.
3. 친구 태그, 저장, 댓글을 만들 수 있는 소재로 구성한다.
4. 6장부터 팀 운영 공감으로 부드럽게 연결한다.
5. 7장에서만 피치체크 CTA를 넣는다.

## 적용한 외부 레퍼런스

- Gogumafarm thumbnail planning: 첫 장은 답이 아니라 궁금증을 만든다.
- Prompt Core Lab SNS prompt guide: 모두가 아니라 한 명의 독자, 하나의 상황, 하나의 행동을 지정한다.
- Cheil copy collection: 카피는 담백하지만 기억에 걸리는 표현 패턴을 축적한다.

정리하면, "피치체크 설치하세요"가 아니라 "이거 친구한테 보내고 싶다"가 먼저다.

## 소재 은행

새 기본 소재 파일:

```text
samples/pitchcheck/viral-story-bank-60.json
```

60개 소재는 네 가지 기둥으로 구성했다.

- `legend_backstory`: 메시 냅킨 계약, 네이마르 이적료, 호날두 17골 시즌 같은 비하인드/기록형.
- `curiosity_gap`: "킥오프 슛이 바로 들어가면 골일까?"처럼 답을 숨기는 질문형.
- `ranking_comparison`: 이적료, 최단골, 최다골, A/B 비교처럼 저장하기 쉬운 리스트형.
- `fandom_engagement`: "메시 팬이면 알아야 함", "주장 해본 사람만 아는 경기 전 2시간" 같은 태그/댓글형.

기본 샘플은 `viral-001` 메시 냅킨 계약서 소재다.

## Gemini 제어 방식

Gemini Flash는 카피만 쓴다.

코드가 고정하는 것:

- 7장 구조;
- 1~5장 광고 단어 금지;
- 6장 soft bridge;
- 7장 profile link + 댓글 `[피치체크]` CTA;
- GmarketSans/HTML/CSS 레이아웃;
- 실제 PitchCheck 로고와 로컬 앱 화면;
- Instagram carousel upload harness.

Gemini가 1~5장에 `피치체크`, `설치`, `앱`, `프로필 링크`, `댓글 [피치체크]` 같은 단어를 넣으면 normalize 단계에서 해당 카드를 fallback 카피로 교체한다.

## 이미지 검색 기준

이미지는 주제별로만 찾지 않고, 카드별 시각 역할로 분류한다.

- 1장: 멈추게 하는 선수/경기 순간/큰 숫자/의외의 물건.
- 2장: 궁금증을 키우는 맥락 이미지.
- 3장: fact를 믿게 만드는 증거성 이미지.
- 4장: 공유하고 싶게 만드는 팬덤/비교/세리머니 이미지.
- 5장: 친구 태그나 댓글을 부르는 장면.
- 6~7장: 실제 PitchCheck 로컬 화면과 사용 영상 프레임.

차단:

- 로고만 있는 이미지;
- 가짜 명언 카드;
- AI 선수 얼굴;
- 반려동물;
- 앱 UI가 1~5장에 들어가는 것;
- 읽어야만 이해되는 표/도표.

## 캐러셀 업로드 조건

카드뉴스를 릴스 MP4로 만들지 않는다.

목표는 Instagram Post carousel이다. 음악은 업로드 화면에서 추가할 수 있는 경우 수동으로 붙인다.

`prepare-upload-package.mjs`가 추가로 검사하는 조건:

- 카드 2~20장;
- PNG/JPEG;
- 1080x1350;
- 4:5;
- caption 존재;
- upload intent가 `instagram-carousel`;
- 업로드 체크리스트 생성.

출력:

```text
dist/uploads/<slug>/
  cards/
  docs/
  carousel-upload-checklist.md
  upload-manifest.json
  upload-dry-run.log
```

## 남은 품질 기준

- 렌더 후 `contact-sheet.png`와 `thumbnail-sheet.png`를 눈으로 확인한다.
- 첫 장이 답을 공개하면 실패다.
- 1~5장이 광고처럼 보이면 실패다.
- 6장이 기능 소개처럼 보이면 실패다.
- 7장에 프로필 링크 참고와 댓글 `[피치체크]` 사용 영상 CTA가 모두 있어야 한다.
- 캐러셀 업로드 하네스가 `ready`여야 업로드 후보로 본다.
