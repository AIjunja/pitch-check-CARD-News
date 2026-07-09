# PitchCheck Viral Carousel Strategy

This file now points to the real-player-story strategy. The old generic viral topic bank is no longer the default.

## Default

- Bank: `samples/pitchcheck/real-player-story-bank-60.json`
- Generator: `scripts/pitchcheck/generate-real-player-story-bank.mjs`
- Source packs:
  - `docs/real-player-story-scrapling-source-pack.md`
  - `docs/ian-wright-teacher-source-pack.md`
- Full strategy: `docs/pitchcheck-real-player-story-strategy.md`

## Principle

Cards 1~5 must feel like football content worth saving, not an app ad.

Use real player micro-stories:

- Ian Wright meeting the teacher he thought had died
- Romelu Lukaku realizing his mother mixed water into milk
- Son Heung-min doing four hours of keepy-uppies as a child
- Sadio Mane connecting his father's death to the need for a hospital
- Paolo Di Canio refusing an empty-net goal because the goalkeeper was injured

## AIDA

1. Attention: open a curiosity gap.
2. Interest: make the viewer want the answer.
3. Reveal: disclose the sourced fact.
4. Desire: make the player feel different after the fact.
5. Engagement: invite save, share, or friend tag.
6. Soft bridge: connect to real team gathering pain.
7. CTA: only here, mention PitchCheck, profile link, and `[피치체크]` comment keyword.

## No-Ad Guardrail

Do not mention PitchCheck, install, profile link, usage video, download, app, or CTA in cards 1~5.

## Image Rule

Image search starts broad:

```text
<player name> football
```

Then it narrows to story-specific cues. Every selected web image is logged with license/source metadata in:

```text
assets/reference/web/real-player-story-image-ledger.md
```

Local fallback images are allowed for drafts only and are marked clearly in the ledger.
