# PitchCheck Card News Automation

## Goal

This workflow turns one topic JSON file into a ready-to-review PitchCheck carousel package.

The human/LLM should spend tokens on:

- finding or choosing the football story angle;
- writing the hook and short Korean copy;
- checking facts and CTA wording.

The code handles:

- fixed 1080x1350 layout;
- GmarketSans font loading;
- copying local/direct media into a project folder;
- rendering HTML cards to PNG;
- creating contact and Instagram 1:1 thumbnail sheets;
- writing source, storyboard, caption, and motion-plan files.

## Content Rule

Default PitchCheck structure is now football-first viral content, not a direct
app ad.

1. Cards 1-5: pure football story, curiosity gap, ranking/comparison, or fandom engagement.
2. Card 6: soft team-operation bridge based on a real amateur-football pain.
3. Card 7: final profile-link/comment-keyword CTA.

Hard guardrail: cards 1-5 must not mention PitchCheck, app install, profile
link, download, usage video, or CTA wording. The Gemini builder replaces early
ad-smell cards with deterministic fallback copy when needed.

The renderer validates that the last two cards are `pitchcheck` and `cta` by
default.

## Usage

```powershell
npm install
npm run sample:pitchcheck
```

Local PitchCheck media CTA flow:

```powershell
npm run collect:pitchcheck-local
npm run board:pitchcheck-local
npm run assets:pitchcheck-plan
npm run media:pitchcheck-diverse
npm run sample:pitchcheck-real-cta
```

This pulls local user-provided PitchCheck assets from `C:\Users\letgo\Downloads`, including:

- `chuk9__check_*.zip`
- `chuk9__check_*.jpg`
- `*pitchcheck*.png`
- `피치체크 사용 영상.mp4`

The collector writes a manifest and extracted video frames under:

```text
assets/reference/pitchcheck-local/
  media-manifest.json
  media-board.png
  pitchcheck-video/frames/
```

`npm run media:pitchcheck-diverse` reads that manifest plus `assets/images/**/*`,
filters known off-topic frames such as pet/animal shots, adds missing media entries
to the topic JSON, and refreshes card 6/7 galleries with a wider mix of:

- team photo upload screens;
- match/location screens;
- attendance/check-in screens;
- calendar and team-management screens;
- existing PitchCheck promo screenshots.

The selection report is written to:

```text
assets/reference/pitchcheck-local/diverse-media-selection.json
```

`npm run assets:pitchcheck-plan` runs the per-card asset resolver before the
CTA gallery pass. It classifies every card into a visual job first, then scores
topic media, local manifest media, and `assets/images/**/*` against that job.
It writes:

```text
assets/reference/pitchcheck-local/story-asset-plan.json
assets/reference/pitchcheck-local/story-asset-ledger.md
```

The resolver adds `cards[].assetPlan` so a future production run can see:

- what visual each card needs;
- which local/repository asset was selected;
- confidence score;
- web/official-source search queries to use if local media is weak.

Custom topic:

```powershell
node scripts/pitchcheck/render-carousel.mjs samples/pitchcheck/lampard-fines.json
```

Dry run without rendering:

```powershell
node scripts/pitchcheck/render-carousel.mjs samples/pitchcheck/lampard-fines.json --dry-run
```

## Topic JSON

See:

- `schemas/pitchcheck-topic.schema.json`
- `samples/pitchcheck/lampard-fines.json`
- `samples/pitchcheck/lampard-fines-real-cta.json`

Important fields:

- `project.slug`: output project folder name.
- `media[]`: local image path or direct URL.
- `cards[]`: card copy and media mapping.
- `cards[].mediaGallery`: optional array of media IDs for proof grids, phone stacks, and CTA mosaics.
- `cards[].assetPlan`: per-card visual job, selected asset, confidence, and unresolved external search queries.
- `cards[-2].type`: should be `pitchcheck`.
- `cards[-1].type`: should be `cta`.

## Media Search Pattern

Use `search[]` to store search intent. The renderer does not scrape random social images automatically because usage rights and source accuracy matter.

## Football Viral Story Bank

The current low-token planning bank lives at:

```text
samples/pitchcheck/viral-story-bank-60.json
```

It contains 60 football-card ideas built for viral Instagram carousel direction:

- legend/player backstory;
- curiosity-gap titles;
- ranking/comparison topics;
- fandom engagement and friend-tag prompts;
- sourced facts, share triggers, PitchCheck bridge lines;
- per-topic image search criteria and motion ideas.

The default topic is `viral-001`, the Messi napkin contract story. It opens as
a football-history curiosity gap and only bridges to PitchCheck on cards 6-7.

The legacy rule/record bank is still kept at:

```text
samples/pitchcheck/story-bank-60.json
```

Use it only when intentionally making rulebook-style content.

To fetch image candidates for all 60 topics:

```powershell
npm run images:pitchcheck-story-bank
```

This calls Wikimedia Commons search for each topic's `imageQueries` and
`assetSearch.queries`, scores candidates for dynamic football visuals, downloads
the top candidate per topic, and writes:

```text
assets/reference/web/football-story-bank-images.json
assets/reference/web/football-story-bank-ledger.md
assets/reference/web/football-story-bank/
```

The image ledger includes local file paths plus Commons source pages, license names, artists, and fact-source links. Treat these as editorial candidates: before final posting, keep attribution with the asset or replace weak candidates with official/source-owned media.

## Gemini Flash Production Flow

Use this when Gemini Flash should create the carousel copy but the output still
needs to match this renderer exactly.

```powershell
$env:GEMINI_API_KEY="..."
$env:GEMINI_MODEL="gemini-3.5-flash"
npm run gemini:pitchcheck
```

Use `--topic viral-001` to force the current default sample, or pass another
topic ID only after checking that the first card creates a curiosity gap and
does not reveal the answer too early.

One command does:

1. read `samples/pitchcheck/viral-story-bank-60.json`;
2. ask Gemini only for bounded Korean copy;
3. normalize the response into the fixed renderer schema and remove early ad-smell copy;
4. attach selected football image candidates and real PitchCheck local app media;
5. render 7 fixed-layout cards;
6. create an Instagram carousel upload package;
7. run the uploader in dry-run mode unless a real uploader command is configured.

No API key test mode:

```powershell
npm run gemini:pitchcheck:dry -- --topic fun-001
```

Generated topic JSON files are written to:

```text
samples/pitchcheck/generated/
```

Rendered projects are written to:

```text
projects/gemini-viral-001/
```

Upload packages are written to:

```text
dist/uploads/gemini-viral-001/
  cards/
  docs/
  carousel-upload-checklist.md
  upload-manifest.json
  upload-dry-run.log
```

## Instagram Carousel Upload Harness

This project packages cards for Instagram feed carousel upload, not as a Reel
MP4. This is intentional: swipeable `1/N` card UI comes from a carousel post.

`prepare-upload-package.mjs` adds `carouselUploadHarness` to
`upload-manifest.json` and writes `carousel-upload-checklist.md`.

It checks:

- 2-20 images;
- rendered PNG/JPEG cards;
- exact 1080x1350 dimensions;
- exact 4:5 ratio;
- caption presence;
- upload intent is `instagram-carousel`.

Manual carousel-with-music flow:

1. Open Instagram and choose Post, not Reel.
2. Select the rendered card images in order.
3. Add music during the post upload flow if available.
4. Add caption, tags, collaborator, and publish as a carousel post.

The local uploader cannot guarantee Reels-tab/full-screen recommendation
placement. It only prepares a music-capable carousel package candidate.

To connect a real uploader, set `PITCHCHECK_UPLOAD_COMMAND`. The command can use
these tokens:

- `{manifest}`: absolute path to `upload-manifest.json`;
- `{packageDir}`: absolute path to the upload package folder;
- `{captionFile}`: absolute path to `caption.md`;
- `{cards}`: space-separated absolute card image paths.

Example:

```powershell
$env:PITCHCHECK_UPLOAD_COMMAND='node ../tools/publish/publish-instagram.mjs --manifest "{manifest}"'
node scripts/pitchcheck/upload-package.mjs dist/uploads/gemini-fun-001/upload-manifest.json --real
```

The repository does not store platform tokens. The upload script intentionally
falls back to dry-run when `PITCHCHECK_UPLOAD_COMMAND` is missing.

For low-token production, run the per-card asset resolver first:

```powershell
node scripts/pitchcheck/resolve-story-assets.mjs samples/pitchcheck/lampard-fines-real-cta.json --write
```

Then run the local diverse-media selector:

```powershell
node scripts/pitchcheck/apply-diverse-media.mjs samples/pitchcheck/lampard-fines-real-cta.json --write
```

These are local/repository asset searches, not random web scrapers. The story
resolver leaves external search queries for unresolved cards, so a later source
scout can fetch official/credible media without spending tokens on manual asset
triage.

Recommended low-token production pattern:

1. Collect or add official/credible media to `assets/images/<topic>/` or the local manifest.
2. Run `npm run assets:pitchcheck-plan` to classify each card's visual need and match story assets.
3. Run `npm run media:pitchcheck-diverse` to expand candidates and assign card 6/7 galleries.
4. Check `story-asset-ledger.md` and `diverse-media-selection.json`.
5. Run the renderer.

Direct media URLs can also be placed in `media[].url`; the renderer downloads them into the project.

## Output

For `auto-lampard-fines`, the renderer writes:

```text
projects/auto-lampard-fines/
  assets/
  cards/
  output/
    card-01.png
    ...
    card-07.png
    contact-sheet.png
    thumbnail-sheet.png
  source-pack.md
  storyboard.md
  motion-plan.md
  caption.md
  index.html
```

## Next Automation Layer

Add a separate source-scout script later:

- input: football topic list or trending source URLs;
- output: candidate JSON with source links and local media candidates;
- human/LLM token use: only hook, bridge, and CTA copy.
