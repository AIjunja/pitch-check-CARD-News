# PitchCheck Social Publishing

The publishing harness prepares the 170-story carousel bank for the
`pitchcheck_official` Instagram and Threads accounts.

## Safety boundary

- PitchCheck credentials live in `carousel-workspace/pitchcheck-content.env`.
- Existing `ai_jjuun` credentials are never overwritten.
- Every live run checks both API usernames before publishing.
- A run publishes at most one story. Instagram and Threads success states are
  stored separately so a retry cannot duplicate a platform that already
  succeeded.

## Prepare and audit

```powershell
npm run prepare:pitchcheck-social -- --bank <bank.json> --sources <source-catalog.json> --renders <render-root>
npm run audit:pitchcheck-social
```

Preparation converts the seven 1080x1350 PNG cards for each story into
Meta-friendly JPEG files, writes platform-specific captions, and creates the
five-slots-per-day queue at 10:00, 12:00, 14:00, 16:00, and 18:00 KST.

## One-time account authorization

```powershell
npm run auth:pitchcheck-social -- urls
npm run auth:pitchcheck-social -- exchange-instagram --callback-url "<redirected URL>"
npm run auth:pitchcheck-social -- save-instagram-token --access-token "<dashboard token>"
npm run auth:pitchcheck-social -- exchange-threads --callback-url "<redirected URL>"
npm run auth:pitchcheck-social -- save-threads-token --access-token "<dashboard token>"
npm run auth:pitchcheck-social -- verify
```

## Publish one due story

Dry run:

```powershell
npm run publish:pitchcheck-social
```

Live run:

```powershell
npm run publish:pitchcheck-social -- --execute
```

The live command is intended to be invoked by the Codex recurring automation
at the five daily KST slots. Missed runs do not burst-publish: each invocation
selects only the oldest due story.
