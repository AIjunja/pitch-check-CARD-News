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

Default PitchCheck structure:

1. Cards 1-5: football story, fan curiosity, or amateur-football pain.
2. Card 6: PitchCheck feature CTA.
3. Card 7: final comment/download CTA.

The renderer validates that the last two cards are `pitchcheck` and `cta` by default.

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

## Football Fun Story Bank

The new low-token planning bank lives at:

```text
samples/pitchcheck/story-bank-60.json
```

It contains 60 football-card ideas built for a fun/info/AIDA direction:

- stronger curiosity hooks;
- rule quirks and record facts football people may not know;
- why the fact is fun;
- a PitchCheck bridge line;
- visual needs, image search queries, and motion ideas;
- fact source references.

To fetch image candidates for all 60 topics:

```powershell
npm run images:pitchcheck-story-bank
```

This calls Wikimedia Commons search for each topic's `imageQueries`, scores candidates for dynamic football visuals, downloads the top candidate per topic, and writes:

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
npm run gemini:pitchcheck -- --topic fun-001
```

One command does:

1. read `samples/pitchcheck/story-bank-60.json`;
2. ask Gemini only for bounded Korean copy;
3. normalize the response into the fixed renderer schema;
4. attach the selected football image candidate and real PitchCheck local app media;
5. render 7 fixed-layout cards;
6. create an upload package;
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
projects/gemini-fun-001/
```

Upload packages are written to:

```text
dist/uploads/gemini-fun-001/
  cards/
  docs/
  upload-manifest.json
  upload-dry-run.log
```

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
