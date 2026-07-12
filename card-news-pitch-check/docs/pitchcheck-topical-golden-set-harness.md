# 피치체크 시의성 풍자 골든셋 하네스

## 결과물

- 실제 선수 사건 10개
- 스토리당 7장, 총 70장
- 카드 1~5: 사건 영상에서 직접 고른 서로 다른 프레임
- 카드 6: 운영자 공감과 피치체크 사용 맥락
- 카드 7: 프로필 링크 설치와 댓글 `[피치체크]` CTA
- 인스타그램 캐러셀 규격: 1080x1350, 4:5 PNG

최종 이미지는 `projects/topical-satire-golden-set-10/<story-id>/output/`에 있다.

## 한 번에 검증하기

```powershell
npm run check:pitchcheck-topical
```

이 명령은 카피 계약 검사, strict-media 렌더, 70장 감사를 순서대로 실행한다.

## 입력 계약

카피 입력은 `samples/pitchcheck/topical-satire-golden-set-10.json`이다. AI 제공자는 이 JSON 계약만 지키면 된다. Gemini Flash를 사용해도 아래 필드는 바뀌지 않는다.

- 카드 1: 질문 또는 미완성 정보로 궁금증 생성
- 카드 2: 사건 상황
- 카드 3: 결정적 행동
- 카드 4: 결과와 의미
- 카드 5: 현재 축구판과 직접 충돌하는 결말
- 카드 6~7: 승인된 피치체크 CTA 이미지

레이아웃, 지마켓 산스, 실제 워드마크, CTA, 해상도, 겹침 검사는 결정론적 코드가 담당한다.

## 에셋 수집

후보 영상을 다시 받으려면 다음을 실행한다.

```powershell
npm run media:pitchcheck-topical:prepare
npm run media:pitchcheck-topical:extract
```

수집 기준은 다음과 같다.

1. `video-source-plan.json`에 사건 영상과 현재 풍자 영상을 분리한다.
2. 영상별 20구간 콘택트시트로 장면을 확인한다.
3. `curated-media-plan.json`에 카드별 타임코드와 선택 이유를 기록한다.
4. `visual-review.json`에서 사람이 확인한 카드만 `pass` 처리한다.
5. `--strict-media` 렌더는 `pass`가 아니거나 파일이 없으면 즉시 실패한다.

영상과 이미지는 출처 확인 및 레퍼런스용이다. 실제 상업 게시 전에는 각 소스의 사용 권한을 별도로 확인해야 한다.

## 주요 파일

- 카피: `samples/pitchcheck/topical-satire-golden-set-10.json`
- 출처 원장: `docs/research/topical-satire-golden-set-10/source-ledger.md`
- 에셋 원장: `assets/reference/web/topical-satire-golden-set-10/curated-media.json`
- 렌더러: `scripts/pitchcheck/render-topical-golden-set.mjs`
- 감사기: `scripts/pitchcheck/audit-topical-golden-set.mjs`
- 감사 결과: `docs/pitchcheck-topical-golden-set-audit.md`

## 인스타그램 업로드

릴스 영상으로 합치지 않고 일반 게시물에서 여러 장을 선택해 캐러셀로 올린다. 카드 순서는 `card-01.png`부터 `card-07.png`까지다. 게시 단계에서 음악을 추가하면 음악이 붙은 사진 캐러셀 형태로 운영할 수 있다.
