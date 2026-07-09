# PitchCheck Card News Automation

## Goal

Turn sourced football player stories into fixed-layout Instagram carousel packages.

The human or LLM spends tokens on:

- choosing the player story angle
- polishing Korean copy
- checking source/fact quality

The code handles:

- 60-topic real player story bank generation
- no-ad guardrails for cards 1~5
- Gemini Flash prompt contract
- image candidate search and ledger
- fixed 1080x1350 layout
- GmarketSans font loading
- local PitchCheck CTA media for cards 6~7
- HTML to PNG rendering
- Instagram carousel upload package

## Core Commands

```powershell
npm install
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

Choose a topic:

```powershell
node scripts/pitchcheck/gemini-build-carousel.mjs --topic real-048-son-four-hour-keepy --no-gemini --render --package --upload
```

## Default Bank

```text
samples/pitchcheck/real-player-story-bank-60.json
```

This file is generated from:

```text
scripts/pitchcheck/generate-real-player-story-bank.mjs
```

Default topic:

```text
real-001-ian-wright-teacher-reunion
```

## Source Packs

```text
docs/real-player-story-scrapling-source-pack.md
docs/ian-wright-teacher-source-pack.md
```

The source packs are raw research notes. They are not public copy. Use them to verify the story seed, then rewrite in Korean.

## Card Rules

1. Card 1: curiosity hook
2. Card 2: tension
3. Card 3: sourced reveal
4. Card 4: why this changes how the player feels
5. Card 5: save, share, or friend-tag prompt
6. Card 6: soft bridge to team operation pain
7. Card 7: PitchCheck CTA

Cards 1~5 must not mention:

- PitchCheck
- app
- install
- profile link
- usage video
- download
- CTA

Card 7 must include:

- profile link reference
- comment keyword `[피치체크]`
- usage video offer

## Image Pipeline

```powershell
npm run images:pitchcheck-story-bank
```

Writes:

```text
assets/reference/web/real-player-story-images.json
assets/reference/web/real-player-story-image-ledger.md
assets/reference/web/real-player-story-bank/
```

Search order:

1. broad player query, such as `Ian Wright football`
2. story-specific query, such as `Ian Wright Sydney Pigden Highbury teacher reunion football`
3. local football fallback

Every web image candidate keeps:

- source page
- license
- artist
- downloaded local path

Rows marked `origin: local-fallback` are draft candidates. Replace them with official, licensed, or source-owned media before final publishing when exact player photos matter.

## Local PitchCheck CTA Media

Collect local PitchCheck screenshots and video frames:

```powershell
npm run collect:pitchcheck-local
npm run board:pitchcheck-local
```

The collector reads local user-provided assets from `C:\Users\letgo\Downloads`, including:

- `chuk9__check_*.zip`
- `chuk9__check_*.jpg`
- `*pitchcheck*.png`
- PitchCheck usage videos

It writes:

```text
assets/reference/pitchcheck-local/
  media-manifest.json
  media-board.png
  pitchcheck-video/frames/
```

The Gemini builder only uses these PitchCheck product visuals on cards 6~7.

## Renderer Output

For the default topic:

```text
projects/gemini-real-001-ian-wright-teacher-reunion/
  cards/
  output/
    card-01.png
    ...
    card-07.png
    contact-sheet.png
    thumbnail-sheet.png
  caption.md
  index.html
```

Generated renderer JSON:

```text
samples/pitchcheck/generated/real-001-ian-wright-teacher-reunion-pitchcheck-card.json
```

## Upload Package

```text
dist/uploads/gemini-real-001-ian-wright-teacher-reunion/
  cards/
  docs/
  carousel-upload-checklist.md
  upload-manifest.json
  upload-dry-run.log
```

The upload harness checks:

- 2~20 rendered images
- PNG/JPEG
- 1080x1350
- exact 4:5 ratio
- caption exists
- upload intent is `instagram-carousel`

## Instagram Upload Method

This is a feed carousel package, not a Reel MP4.

Manual flow:

1. Open Instagram.
2. Choose Post, not Reel.
3. Select the rendered card images in order.
4. Add music during the post upload flow if available.
5. Add caption, tags, collaborator, and publish as carousel.

Instagram may recommend music-enabled carousels in a Reels-like full-screen surface, but this cannot be forced from local code.

## Real Uploader Hook

The repo does not store platform tokens.

Set `PITCHCHECK_UPLOAD_COMMAND` to connect an uploader:

```powershell
$env:PITCHCHECK_UPLOAD_COMMAND='node ../tools/publish/publish-instagram.mjs --manifest "{manifest}"'
node scripts/pitchcheck/upload-package.mjs dist/uploads/gemini-real-001-ian-wright-teacher-reunion/upload-manifest.json --real
```

Tokens available to the command:

- `{manifest}`
- `{packageDir}`
- `{captionFile}`
- `{cards}`

Without that env var, upload stays in dry-run mode.
