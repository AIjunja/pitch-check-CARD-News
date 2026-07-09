# PitchCheck Content Planning Report

## What Changed

The default planning direction is now real player stories, not generic football trivia or direct RAG-style content.

The content should feel like:

1. "I did not know this player story."
2. "This is specific enough to save."
3. "My football friend would react to this."
4. "Our team operation pain also needs a cleaner tool."
5. "I can check PitchCheck through the profile link or comment keyword."

## Researched Source Base

Scrapling source packs were generated from public pages and videos.

- `docs/real-player-story-scrapling-source-pack.md`
- `docs/ian-wright-teacher-source-pack.md`

The researched sources include The Players' Tribune, Guardian, Bundesliga, FIFA, Olympics.com, ESPN, GOOD, and BBC/YouTube public metadata.

## 60-Topic Bank

Generated file:

```text
samples/pitchcheck/real-player-story-bank-60.json
```

Generator:

```text
scripts/pitchcheck/generate-real-player-story-bank.mjs
```

Default topic:

```text
real-001-ian-wright-teacher-reunion
```

Default story:

Ian Wright thought his former teacher Sydney Pigden had died. During a documentary shoot at Highbury, he met Pigden again, took off his cap, and cried.

## Strong Story Examples

- Ian Wright: teacher reunion at Highbury
- Romelu Lukaku: realizing his mother mixed water into milk
- Kevin De Bruyne: judging Raheem Sterling through tabloid framing before meeting him
- Kylian Mbappe: Bondy handshake rule
- Ronaldinho: hearing about his father's death at age eight
- Pele: making a ball from socks and newspaper
- Angel Di Maria: taking an injection on the morning of the 2014 World Cup final
- Nani: growing up in a one-bedroom house with holes in the floor
- Sadio Mane: father died after the family lacked hospital access nearby
- Alphonso Davies: refugee camp to Bayern/Canada story
- Lee Kang-in: reality TV kid to FIFA U-20 wonder kid
- Marcus Rashford: childhood food insecurity to free school meals campaign
- Jamie Vardy: non-league and curfew/tag years before England
- Luka Modric: war childhood and burnt family home
- Riyad Mahrez: skinny player doubted by coaches
- Paolo Di Canio: catching the ball instead of scoring into an empty net
- Aaron Hunt: asking the referee to cancel his own penalty
- Marcelo Bielsa: instructing Leeds to let Aston Villa score
- Son Heung-min: four-hour keepy-uppies as a child

## Copywriting Standard

The copy follows a Toss-like UX principle: short, concrete, and action-clear.

Weak:

```text
He overcame adversity and became a legend.
```

Better:

```text
우유에 물을 타고 있었다
```

Weak:

```text
Son trained very hard as a child.
```

Better:

```text
4시간 동안 공을 안 떨어뜨림
```

## AIDA Structure

1. Card 1: curiosity hook
2. Card 2: tension or missing context
3. Card 3: sourced reveal
4. Card 4: why the player looks different after knowing it
5. Card 5: save, share, or friend-tag prompt
6. Card 6: team-gathering soft bridge
7. Card 7: PitchCheck CTA

Cards 1~5 must not mention PitchCheck.

## Image Asset Report

Image search report:

```text
assets/reference/web/real-player-story-images.json
assets/reference/web/real-player-story-image-ledger.md
```

Current behavior:

- Start with broad player query, for example `Ian Wright football`.
- Download licensed Commons candidates when available.
- Fall back to local football references when Commons returns no usable result or rate-limits.
- Keep source page, license, artist, and selected local path in the ledger.

Current result after the first complete run:

- 60/60 topics have a selected image candidate.
- 27/60 use downloaded web candidates.
- 33/60 are marked local fallback because Commons rate-limited or returned no exact candidate.

Local fallback rows are draft-safe only. Replace them with official/source-owned or licensed images before final public posting when exact player likeness is required.

## Gemini Flash Contract

Gemini Flash may write or polish card copy. It must not control:

- facts
- source list
- topic count
- card count
- cards 1~5 no-ad rule
- card 6 soft bridge rule
- card 7 CTA wording
- image selection order
- upload package rules

The prompt for `real_player_story` topics is embedded in:

```text
scripts/pitchcheck/gemini-build-carousel.mjs
```

## Upload Target

The output is for Instagram feed carousel upload.

Use:

```text
Instagram Post -> multiple images -> add music if available -> publish carousel
```

This can appear in Reels-style full-screen recommendations, but the local code cannot force Instagram placement.
