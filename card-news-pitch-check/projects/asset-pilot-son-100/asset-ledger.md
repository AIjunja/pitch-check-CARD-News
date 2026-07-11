# 손흥민 PL 100골 에셋 수집 파일럿

## 선택한 사건

- topic id: `son-005-first-asian-premier-league-century`
- 사건: 2023년 4월 8일 브라이턴전에서 손흥민이 프리미어리그 100호 골을 기록했다.
- 핵심 검증: 프리미어리그 최초의 아시아 선수 100골.
- 기본 비율: Instagram carousel 4:5, 1080x1350.

## 권리 원칙

- Premier League와 Tottenham 이미지 및 페이지 캡처는 `reference-only`다.
- 실제 게시 전 구단/리그 미디어 사용 조건 또는 별도 라이선스를 확인한다.
- 권리 확인이 끝나지 않으면 원본 경기 사진을 그대로 배포하지 않고, HTML 재현 그래픽이나 사용 허가된 사진으로 교체한다.
- PitchCheck 로고와 앱 화면은 로컬 브랜드 에셋으로 `direct-use` 처리한다.

## 카드별 비주얼 원장

| 카드 | 역할 | 선택 에셋 | 상태 | 사용 방식 |
|---|---|---|---|---|
| 1 | Attention | `assets/official/pl-son-100-hero.jpg` | reference-only | 풀블리드 세리머니. 손흥민을 우측에 두고 좌측 상단을 제목 안전영역으로 사용. |
| 2 | Interest | `assets/official/pl-son-100-hero.jpg` | reference-only | 프리미어리그가 100호 골 기사에 사용한 공식 세리머니 사진. `100호 골 직후`라고 명시한다. |
| 3 | Desire | `assets/official/spurs-source-page.png` | reference-only | 공식 토트넘 페이지의 제목과 첫 문단을 증거 영역으로 크롭한다. 쿠키 팝업 영역은 사용하지 않는다. |
| 4 | Proof | HTML-native 재현 | recreate | 25야드 컬러의 출발점, 슈팅 궤적, 골문 상단 코너를 피치 다이어그램으로 재현한다. |
| 5 | Meaning | `assets/official/spurs-first-pl-goal.jpg` + `pl-son-100-hero.jpg` | reference-only | 2015년 첫 골과 2023년 100호 골을 좌우 비교한다. |
| 6 | Bridge | `assets/pitchcheck/approved-cta/card-06-approved.png` | direct-use | 기존 확정 CTA 6번을 그대로 사용한다. 실제 팀 생성·일정·위치 화면으로 운영자 공감을 만든다. |
| 7 | CTA | `assets/pitchcheck/approved-cta/card-07-approved.png` | direct-use | 기존 확정 CTA 7번을 그대로 사용한다. 프로필 링크와 댓글 `[피치체크]` 안내를 유지한다. |

## 영상 후보

- Tottenham 공식: `https://www.tottenhamhotspur.com/spurs-tv/2023/april/son-on-his-really-special-100th-league-goal-in-win-against-brighton/`
- Tottenham 공식 기사 내 `Sonny's 100th Premier League goal | Son's 100` 영상.
- 영상은 URL과 장면 후보만 기록했다. 다운로드·재배포 권한은 확인되지 않았으므로 `reference-only`다.
- 모션 카드가 필요하면 경기 영상을 복제하지 않고 Card 4의 슈팅 궤적을 HTML/CSS로 애니메이션한다.

## 수집 결과

- 공식 경기/세리머니 이미지: 4개
- 공식 페이지 증거 캡처: 2개
- 확정 PitchCheck CTA 카드: 2개
- CTA 원본 실화면·영상 프레임: 3개
- HTML 재현 예정 장면: 1개
- 영상 후보 링크: 1개

## 고정 CTA 규칙

- 이후 다른 선수 썰을 만들 때도 6·7번은 `approved-cta/card-06-approved.png`, `approved-cta/card-07-approved.png`를 기본 템플릿으로 사용한다.
- 1~5번의 선수 스토리만 사건별로 교체한다.
- 6번은 운영자 공감, 7번은 설치 행동이라는 AIDA 역할을 바꾸지 않는다.
- 새로운 가상 앱 대시보드 이미지를 생성해 6·7번에 넣지 않는다.

## 연관성 검수에서 제외한 후보

- `spurs-brighton-100.jpg`: 같은 브라이턴전 사진이지만 헤딩 장면이라 100호 골 슈팅을 설명하는 Card 2에서는 제외했다.

## 현장 사진 재탐색 반영

- Card 2: 국제뉴스의 실제 100호 골 정면 슈팅 프레임 `shot-02-gukje.png`로 교체했다.
- Card 4: 도식 대신 공이 오른발에 맞는 근접 프레임 `shot-01-gukje.png`를 사용했다.
- 장식 궤적선은 실제 공 위치를 가릴 수 있어 최종 렌더에서 제거했다.
- 두 사진은 게시 검토용 `reference-only`이며 실제 발행 전 사용권 확인이 필요하다.
- 추가 후보와 원문은 `field-source-pack.md`, `field-candidate-pack.md`에 기록했다.
