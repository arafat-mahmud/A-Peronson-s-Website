# Commit 0839 — ea0b63d

| Field | Value |
|-------|-------|
| **Commit Number** | 0839 |
| **Commit Hash** | ea0b63d096bc36a2fd5dda4c5f3ab22219306bff |
| **Parent Hash** | 04390d5450fde0a86a8bb332ac67f5a65547413b |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 01:01:31 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 694 |
| **Deletions** | 0 |
| **Net Change** | +694 |
| **Merge Commit** | No |

## Add the Support Case API with Ownership Checks

Case controller and routes (open, message, confirm, read).

Original commit message: “feat(support): case API with ownership enforcement”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/controllers/caseController.js` | Added | 667 | 0 | +667/-0 |
| `server/routes/caseRoutes.js` | Added | 27 | 0 | +27/-0 |

### What changed per file

- **`server/controllers/caseController.js`** — added API controller. function added: `canReadCase`; function added: `countClientMessages`; function added: `deriveClientMessageKind`; function added: `buildCaseSummary`; function added: `fallbackClarification`; function added: `askClarifyingQuestion` ….
- **`server/routes/caseRoutes.js`** — added API route. route added: `POST /`; route added: `GET /`; route added: `GET /:caseId`; route added: `POST /:caseId/messages`; route added: `POST /:caseId/confirm`; route added: `DELETE /:caseId`.

## Detailed Diff Analysis

- **Areas touched:** API controller (1 file, +667/-0), API route (1 file, +27/-0).
- **Route added** (6): `POST /`, `GET /`, `GET /:caseId`, `POST /:caseId/messages`, `POST /:caseId/confirm`, `DELETE /:caseId`
- **Function added** (19): `canReadCase`, `countClientMessages`, `deriveClientMessageKind`, `buildCaseSummary`, `fallbackClarification`, `askClarifyingQuestion`, `enqueueInvestigation`, `startInvestigation`, `normalizeAttachment`, `validateAttachmentShape` …
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

API for the portal.

## Was It Useful

Useful.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0838 — Parse, Normalise and Demote Agent Findings.
- **Precedes:** 0840 — Add the Clarification Answerer, Case Events and API Mount.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
