# PitchCheck Viral Carousel Strategy

## Direction

This project is not a direct app ad. It is a football-first Instagram carousel system.

The viewer should feel:

1. "이거 몰랐는데?"
2. "친구한테 보내야겠다."
3. "우리 팀 얘기네."
4. "그럼 피치체크 한 번 봐도 되겠다."

## Viral Topic Pillars

Use one of these four pillars for every topic:

- `legend_backstory`: famous player, club, transfer, or football-history backstory.
- `curiosity_gap`: first card asks a rule/record question and withholds the answer.
- `ranking_comparison`: TOP lists, A/B comparisons, money/record/time rankings.
- `fandom_engagement`: friend-tag, comment-bait, "팬이면 알아야 함", team-relatable prompts.

The default bank is:

```text
samples/pitchcheck/viral-story-bank-60.json
```

## AIDA Card Flow

1. Attention: curiosity title. Do not reveal the answer.
2. Interest: make the question feel worth swiping.
3. Reveal: show the sourced fact.
4. Desire: explain why the fact is fun, shareable, or surprising.
5. Engagement: friend tag, comment, save, or fandom prompt.
6. Soft bridge: amateur-team or group-chat pain. No feature list.
7. CTA: profile link plus comment keyword `[피치체크]` for usage video.

## Hard Copy Rules

- Cards 1-5 must not mention PitchCheck, app install, profile link, CTA, usage video, or download.
- Card 1 must be a curiosity gap, not a summary.
- Card 6 should sound like a real team moment: "몇 시였지?", "오늘 누가 와?", "어디로 가?"
- Card 7 can sell, but softly.
- Use one reader, one situation, one action.
- Avoid stiff marketing phrases such as "운영 효율", "서비스를 통해", "솔루션".
- Do not split Korean particles or 2-3 character leftovers onto their own headline line.

## Image Search Criteria

Classify assets per story, not only per topic.

- Cover: player face, dramatic match moment, surprising object, or big number.
- Reveal: source-proof feeling, record moment, trophy, scoreboard, or contract cue.
- Share: fan reaction, celebration, rivalry, comparison visual.
- Engagement: friend-tag mood, debate visual, team huddle, group chat-like scene.
- Bridge/CTA: local PitchCheck screenshots and app usage frames only on cards 6-7.

Prefer:

- official club, league, tournament, or auction pages;
- Wikimedia Commons with metadata;
- licensed editorial-looking match photos;
- dynamic action, celebration, crowd, huddle, scoreboard, or close-up details.

Avoid:

- logo-only images;
- fake quote graphics;
- generic AI portraits;
- pet/animal images;
- product UI before card 6;
- charts or tables that need reading before the viewer understands the point.

## Carousel Upload Harness

The package is prepared for Instagram feed carousel upload, not a Reel MP4.

`scripts/pitchcheck/prepare-upload-package.mjs` now writes:

```text
dist/uploads/<slug>/
  upload-manifest.json
  carousel-upload-checklist.md
```

The harness checks:

- 2-20 cards;
- rendered card images;
- PNG/JPEG file type;
- 1080x1350 size;
- 4:5 ratio;
- caption presence;
- upload intent is `instagram-carousel`.

Manual upload target:

1. Choose Instagram Post, not Reel.
2. Select the rendered cards in order.
3. Add music in the post upload flow when available.
4. Add caption, tags, collaborator, and publish as carousel.

There is no guaranteed local switch for Reels-tab placement. The carousel can be prepared as a music-capable carousel candidate, but recommendation placement is controlled by Instagram.

## Gemini Production Rule

Gemini Flash may write copy, but it must not control:

- topic bank structure;
- early-card no-ad guardrail;
- media selection;
- card count;
- CTA position;
- carousel upload readiness;
- final package manifest.

Those are deterministic code paths.
