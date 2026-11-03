# Commit 0840 — 771879c

| Field | Value |
|-------|-------|
| **Commit Number** | 0840 |
| **Commit Hash** | 771879cef09034c2df7ffddf2881230bef17c704 |
| **Parent Hash** | ea0b63d096bc36a2fd5dda4c5f3ab22219306bff |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 01:16:52 |
| **Branch** | main |
| **Files Changed** | 5 |
| **Additions** | 1094 |
| **Deletions** | 1 |
| **Net Change** | +1093 |
| **Merge Commit** | No |

## Add the Clarification Answerer, Case Events and API Mount

A timeout-bounded clarification service, realtime case events and the `/api/support/cases` mount; integration tests.

Original commit message: “feat(support): clarification answerer, case events and the case API mount”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/integration/support-case-api.test.js` | Added | 566 | 0 | +566/-0 |
| `server/services/caseConversationService.js` | Added | 461 | 0 | +461/-0 |
| `server/realtime/realtimeBus.js` | Modified | 50 | 0 | +50/-0 |
| `server/services/caseService.js` | Modified | 13 | 1 | +13/-1 |
| `server/server.js` | Modified | 4 | 0 | +4/-0 |

### What changed per file

- **`tests/integration/support-case-api.test.js`** — added test. function added: `matches`; function added: `sortRows`; function added: `project`; function added: `collection`; function added: `buildApp`; function added: `expectSuccess` ….
- **`server/services/caseConversationService.js`** — added server service. function added: `text`; function added: `countClientTurns`; function added: `formatHistory`; function added: `buildClarificationPrompt`; function added: `lastClientContent`; function added: `normalizeOptions` ….
- **`server/realtime/realtimeBus.js`** — modified server. function added: `emitCaseEvent`.
- **`server/services/caseService.js`** — modified server service. +13/-1 lines.
- **`server/server.js`** — modified server. +4/-0 lines.

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +566/-0), server service (2 files, +474/-1), server (2 files, +54/-0).
- **Function added** (29): `emitCaseEvent`, `text`, `countClientTurns`, `formatHistory`, `buildClarificationPrompt`, `lastClientContent`, `normalizeOptions`, `resolveClarificationProvider`, `providerSettings`, `openrouterSettings` …
- **Test case added** (16): `a second user gets 403 on the case and on its messages`, `the owner can read the case and post to it`, `the owner sees only their own cases in the list`, `ready is true after 6 client messages`, `confirming the summary moves the case to investigating`, `an owner/admin may read another client`, `a posted message produces a support.case.message event`, `a case that starts being investigated fires a support.case.status event`, `emitCaseEvent publishes each of the five fixed event types`, `emitCaseEvent ignores a missing case or type` …
- **Tests:** 1 test file(s) changed: `tests/integration/support-case-api.test.js`

## Why This Change Was Needed

Workstream 1 part 3C.

## Was It Useful

Useful.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0839 — Add the Support Case API with Ownership Checks.
- **Precedes:** 0841 — Run Investigation Agents from a Bounded Queue.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
