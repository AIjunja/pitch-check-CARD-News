# PitchCheck 300 Real Player Stories Design

Date: 2026-07-10

## Goal

Build a production-ready bank of 300 Korean Instagram carousel plans based on 300 distinct, verifiable football events. A player may have multiple episodes, but the same event cannot be counted twice through alternate hooks or wording changes.

The bank must work deterministically without an LLM and preserve the same structure when Gemini Flash rewrites copy. Cards 1-5 deliver the football story, card 6 creates a natural amateur-team connection, and card 7 is the only direct PitchCheck CTA.

## Existing Bank Reuse

The current 60-row bank contains 50 distinct event facts and 10 alternate-hook rows.

- Reuse the 50 distinct sourced events.
- Exclude all 10 alternate-hook rows from the 300-event count.
- Preserve useful source references, image queries, and event facts from the 50 rows.
- Assign a stable `eventKey` to every reused event so future hook variants cannot be counted as new stories.
- Rewrite weak scaffold copy such as meta commentary, generic motivational sentences, and forced PitchCheck bridges.

The final count is therefore:

- 50 migrated distinct events
- 250 newly researched distinct events
- 300 total distinct events

## Editorial Portfolio

Use a hybrid portfolio so recognisable names carry reach while less familiar stories create freshness.

| Portfolio | Target |
| --- | ---: |
| Global superstars and legends | 130 |
| Current active stars | 80 |
| Korean and Asian players | 40 |
| Women's football | 30 |
| Cult heroes, lower-league stories, and unusual fair-play events | 20 |
| Total | 300 |

Portfolio labels are exclusive accounting buckets even when a player could fit multiple groups. Lionel Messi and Cristiano Ronaldo should each receive roughly 18-20 distinct events. Son Heung-min should receive roughly 10-12. Neymar, Zlatan Ibrahimovic, Ronaldinho, David Beckham, Wayne Rooney, Thierry Henry, Kylian Mbappe, Mohamed Salah, Luka Modric, Kevin De Bruyne, and comparable anchors should receive 5-10 when enough strong sourced events exist.

Do not force a quota when the available stories are weak. Reallocate unused slots to another player with stronger evidence and visuals.

## Event Eligibility

An event is eligible only when all conditions are met:

1. It concerns a real football player and a concrete action, scene, decision, conflict, object, quote, or consequence.
2. It has one direct or primary source, or two independent reputable secondary sources.
3. It can be explained without inventing dialogue, motives, dates, numbers, or causality.
4. It is distinct from every existing `eventKey`.
5. It supports a curiosity-driven cover without withholding information dishonestly.
6. It has a concrete visual route such as an official image, match frame, interview frame, archival scene, or safe reconstruction.
7. It provides a natural reason to save, share, tag, or comment.

Reject unsourced social-media anecdotes, Wikipedia-only claims, quote-card websites, duplicated events, generic career summaries, transfer rumours presented as facts, and tragedy used only as clickbait.

## Source Standard

Use this order of preference:

1. Player-authored articles, autobiographical excerpts, direct interviews, official documentaries, and verified player or club statements.
2. FIFA, UEFA, confederations, leagues, clubs, national teams, and tournament archives.
3. Reuters, AP, BBC, ESPN, The Guardian, major newspapers, and established football publications.
4. Credible specialist reporting when a stronger source is unavailable.

Scrapling is a URL reader, not the discovery engine. Discover candidate URLs through targeted search, then pass a conservative curated list through Scrapling. Split research into source packs of approximately 25-40 URLs to keep review manageable.

Sensitive allegations, disciplinary cases, crime, family deaths, medical claims, and disputed transfers require either a primary source or two reputable sources. Every row stores source tier, verification status, and any caveat.

## Story Categories

Maintain variety across the bank. Categories include:

- unknown childhood scenes and objects
- rejection, late breakthroughs, and second chances
- transfer, contract, and dressing-room backstories
- tactical adaptations and signature-skill origins
- injuries, recoveries, and hidden match context
- family sacrifice, mentors, and teammate relationships
- rivalry, pressure, and misunderstood public images
- fair play, honesty, leadership, and unusual decisions
- national-team and tournament stories
- community impact and social action
- funny routines, superstitions, pranks, and culture shock
- records with surprising context rather than bare ranking lists

No single category may exceed 20 percent of the bank. Poverty, war, bereavement, and family tragedy combined should remain below 15 percent so the channel does not become exploitative or emotionally one-note.

## Data Model

Move source facts out of the large JavaScript generator and into validated JSON data.

Each story record contains:

```json
{
  "id": "real-001-player-event",
  "eventKey": "player|year-or-era|canonical-event",
  "player": "Player Name",
  "portfolio": "global-legend",
  "category": "transfer-backstory",
  "eventDate": "YYYY-MM-DD or documented era",
  "hook": "Korean curiosity hook",
  "fact": "Verified event summary",
  "context": "Information needed to understand the scene",
  "whyFun": "Why a football fan cares",
  "shareTrigger": "Natural save, share, or comment reason",
  "sourceRefs": ["source-id"],
  "verification": {
    "status": "verified",
    "sourceTier": "primary",
    "caveat": null
  },
  "visualPlan": {},
  "copy": { "cards": [] }
}
```

Maintain a separate source catalog keyed by `source-id`, containing URL, publisher, title, publication date, source tier, media candidates, rights note, retrieval status, and local source-pack path.

## Seven-Card Storyboard

Every one of the 300 records includes complete copy and a visual job for each card.

1. Attention: a concrete mystery, contradiction, object, number, or decision. Do not reveal the answer prematurely.
2. Interest: establish time, place, stakes, and the visible scene without filler.
3. Reveal: state the sourced event clearly and precisely.
4. Meaning: show the consequence, reversal, football significance, or human emotion.
5. Social response: invite a specific opinion, comparison, friend tag, or save reason tied to the event.
6. Soft bridge: connect the event to one of four amateur-team situations: gathering players, assigning roles, communicating changes, or preserving team records. Do not mention installation, profile links, or app features here.
7. Action: show real PitchCheck brand/product evidence and use the fixed action pair: profile link plus the `[피치체크]` comment keyword.

Card 6 must be selected from a bridge taxonomy rather than generated from a generic motivational sentence. If no natural bridge exists, use a brief football-fan reflection and let card 7 make the product transition.

## Copy Rules

- Use short, spoken Korean with one idea per card.
- Prefer visible actions and objects over abstract adjectives.
- Never use meta copy such as "정답을 바로 말하면 재미없어요".
- Do not write generic lessons such as "포기하지 않으면 성공한다".
- Preserve factual uncertainty with phrases such as "인터뷰에서 말했다" or "보도에 따르면".
- Do not manufacture direct quotations.
- Store semantic text blocks; let HTML/CSS perform wrapping. Manual line breaks must follow phrase boundaries and cannot strand one- or two-character fragments.
- Cards 1-5 cannot contain PitchCheck, app, install, download, profile-link, or usage-video language.
- Run Korean humanization and line-break QA on deterministic and Gemini-generated copy.

## Visual Planning

Every story includes:

- one cover query focused on the player and the event;
- one context query for the club, tournament, childhood, interview, or location;
- one proof query tied to the source or match;
- one reaction or consequence query;
- one fallback reconstruction prompt;
- per-card crop and subject guidance;
- `direct-use`, `licensed`, `reference-only`, or `recreate` usage status.

Research stores candidate metadata first. The system downloads only assets with acceptable rights or explicitly permitted local media. Reference-only editorial images may guide cropping and reconstruction but cannot silently become publishable assets.

Cards 6-7 use the verified local PitchCheck logo, real team/product captures, and approved CTA media. Generic gallery screens, pets, unrelated football stock, and AI portraits are rejected.

## Pipeline

1. Migrate 50 distinct existing events and assign `eventKey` values.
2. Build a roster and quota manifest for the remaining 250 events.
3. Discover high-quality candidate sources in manageable player batches.
4. Produce Scrapling source packs from selected URLs.
5. Extract atomic event candidates with evidence snippets and media candidates.
6. Deduplicate by player, canonical event, date/era, and semantic fact similarity.
7. Score and reject weak candidates.
8. Write complete deterministic Korean storyboards and visual plans.
9. Validate all records against the schema and editorial rules.
10. Let Gemini Flash rewrite only inside the verified fact boundary.
11. Generate the final 300-story bank, source catalog, audit report, and image-query ledger.

## Quality Scoring

Score every candidate out of 100:

| Dimension | Points |
| --- | ---: |
| Source confidence | 25 |
| Specificity of the scene | 20 |
| Hook strength | 15 |
| Freshness to Korean football fans | 15 |
| Visual potential | 15 |
| Save, share, or comment potential | 10 |

The default publishing threshold is 75. Source confidence below 15 is an automatic rejection regardless of total score.

Automated checks must fail when:

- total rows are not exactly 300;
- unique `eventKey` count is not exactly 300;
- any story lacks seven cards;
- any source reference is missing from the catalog;
- cards 1-5 contain forbidden PitchCheck CTA terms;
- a card lacks a visual job;
- the same event is reused as an alternate hook;
- a required verification caveat is absent.

## Gemini Boundary

Gemini Flash may improve Korean hooks, rhythm, and captions, but it cannot change `eventKey`, player, date, factual claim, source references, verification status, card count, CTA position, or visual rights status.

When Gemini output fails validation, the deterministic version remains the usable fallback. This keeps output quality and structure independent of model availability.

## Deliverables

- `samples/pitchcheck/real-player-story-bank-300.json`
- `samples/pitchcheck/real-player-source-catalog-300.json`
- `samples/pitchcheck/real-player-roster-300.json`
- `assets/reference/web/real-player-story-images-300.json`
- `assets/reference/web/real-player-story-image-ledger-300.md`
- batched source packs under `docs/research/real-player-stories/`
- `docs/pitchcheck-real-player-story-audit-300.md`
- generator, migration, validation, deduplication, and image-query scripts
- updated Gemini, render, package, and npm defaults

## Verification

Verification includes schema parsing, exact-count and unique-event tests, source-catalog integrity, forbidden-copy checks, seven-card checks, duplicate-fact similarity review, image-ledger completeness, deterministic render of representative topics, Gemini dry-run compatibility, and the existing test suite.

Representative render QA must include at least Lionel Messi, Cristiano Ronaldo, Son Heung-min, one women's football story, one lesser-known player, and one migrated event from the original bank.

## Scope Boundary

This phase creates the 300 complete plans and the automation required to reproduce them. It does not automatically publish 300 posts or download unlicensed editorial photography. Rendering and publishing remain selectable downstream steps after topic and media approval.
