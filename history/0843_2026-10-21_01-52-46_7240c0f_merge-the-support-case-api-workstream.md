# Commit 0843 — 7240c0f

| Field | Value |
|-------|-------|
| **Commit Number** | 0843 |
| **Commit Hash** | 7240c0fa75bc15090f3f14005299e84dbddbeed9 |
| **Parent Hash** | f36444ec1a889efd081e3468ddb56e26273c8b79, 771879cef09034c2df7ffddf2881230bef17c704 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 01:52:46 |
| **Branch** | main |
| **Files Changed** | 8 |
| **Additions** | 1976 |
| **Deletions** | 1 |
| **Net Change** | +1975 |
| **Merge Commit** | Yes |

## Merge the Support Case API Workstream

Merge commit bringing the WS1 case API branch into the main line.

Original commit message: “merge: WS1 case API (feat/ws1-case-api)”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/controllers/caseController.js` | Added | 667 | 0 | +667/-0 |
| `tests/integration/support-case-api.test.js` | Added | 566 | 0 | +566/-0 |
| `server/services/caseConversationService.js` | Added | 461 | 0 | +461/-0 |
| `tests/unit/server-case-ownership.test.js` | Added | 114 | 0 | +114/-0 |
| `server/services/caseService.js` | Modified | 87 | 1 | +87/-1 |
| `server/realtime/realtimeBus.js` | Modified | 50 | 0 | +50/-0 |
| `server/routes/caseRoutes.js` | Added | 27 | 0 | +27/-0 |
| `server/server.js` | Modified | 4 | 0 | +4/-0 |

### What changed per file

- **`server/controllers/caseController.js`** — added API controller. function added: `canReadCase`; function added: `countClientMessages`; function added: `deriveClientMessageKind`; function added: `buildCaseSummary`; function added: `fallbackClarification`; function added: `askClarifyingQuestion` ….
- **`tests/integration/support-case-api.test.js`** — added test. function added: `matches`; function added: `sortRows`; function added: `project`; function added: `collection`; function added: `buildApp`; function added: `expectSuccess` ….
- **`server/services/caseConversationService.js`** — added server service. function added: `text`; function added: `countClientTurns`; function added: `formatHistory`; function added: `buildClarificationPrompt`; function added: `lastClientContent`; function added: `normalizeOptions` ….
- **`tests/unit/server-case-ownership.test.js`** — added test. test case added: `is false for a case that does not exist`; test case added: `is true for the client who opened the case`; test case added: `is false for a stranger`; test case added: `is true for an owner or an admin`; test case added: `is false for the other staff roles`; test case added: `is false for a caller with no identity` ….
- **`server/services/caseService.js`** — modified server service. function added: `canReadCase`; function added: `countClientMessages`.
- **`server/realtime/realtimeBus.js`** — modified server. function added: `emitCaseEvent`.
- **`server/routes/caseRoutes.js`** — added API route. route added: `POST /`; route added: `GET /`; route added: `GET /:caseId`; route added: `POST /:caseId/messages`; route added: `POST /:caseId/confirm`; route added: `DELETE /:caseId`.
- **`server/server.js`** — modified server. +4/-0 lines.

## Detailed Diff Analysis

- **Areas touched:** test (2 files, +680/-0), API controller (1 file, +667/-0), server service (2 files, +548/-1), server (2 files, +54/-0), API route (1 file, +27/-0).
- **Route added** (6): `POST /`, `GET /`, `GET /:caseId`, `POST /:caseId/messages`, `POST /:caseId/confirm`, `DELETE /:caseId`
- **Function added** (48): `canReadCase`, `countClientMessages`, `deriveClientMessageKind`, `buildCaseSummary`, `fallbackClarification`, `askClarifyingQuestion`, `enqueueInvestigation`, `startInvestigation`, `normalizeAttachment`, `validateAttachmentShape` …
- **Test case added** (28): `a second user gets 403 on the case and on its messages`, `the owner can read the case and post to it`, `the owner sees only their own cases in the list`, `ready is true after 6 client messages`, `confirming the summary moves the case to investigating`, `an owner/admin may read another client`, `a posted message produces a support.case.message event`, `a case that starts being investigated fires a support.case.status event`, `emitCaseEvent publishes each of the five fixed event types`, `emitCaseEvent ignores a missing case or type` …
- **Tests:** 2 test file(s) changed: `tests/integration/support-case-api.test.js`, `tests/unit/server-case-ownership.test.js`
- **Merge:** diff shown against the first parent; the content was authored in the merged branch's commits.

## Why This Change Was Needed

Integrate parallel workstream branches.

## Was It Useful

Neutral. Merge; content documented in its source commits.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. As a merge, its effect equals that of the merged branch commits.

## Relationship to Surrounding Commits

- **Follows:** 0842 — Render Support Case Reports as Markdown.
- **Precedes:** 0844 — Merge the Investigation Orchestration Workstream.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
