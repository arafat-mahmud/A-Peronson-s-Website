# Commit 0855 — 457f373

| Field | Value |
|-------|-------|
| **Commit Number** | 0855 |
| **Commit Hash** | 457f37377241b21de533f584afac82ab72abb1a4 |
| **Parent Hash** | c3e0cb87f4bb09f187ad84e0d58bc8a94eb4be1d, fac05f2884d0bb9bda1b2ff752bbf278a99442dc |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 03:00:57 |
| **Branch** | main |
| **Files Changed** | 13 |
| **Additions** | 877 |
| **Deletions** | 17 |
| **Net Change** | +860 |
| **Merge Commit** | Yes |

## Merge the Support Case API Review Fixes

Merge commit with the WS1 review fixes (SSE stream, upload ownership, namespace guard, rollout note).

Original commit message: “merge: WS1 review fixes (SSE stream, upload ownership, namespace guard, rollout note)”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/integration/support-case-api.test.js` | Modified | 178 | 0 | +178/-0 |
| `docs/rollout/2026-10-20-support-attachment-migration.md` | Added | 155 | 0 | +155/-0 |
| `server/controllers/caseController.js` | Modified | 141 | 0 | +141/-0 |
| `tests/integration/support-evidence-access.test.js` | Modified | 118 | 2 | +118/-2 |
| `scripts/db/migrate-support-attachments.mjs` | Modified | 61 | 10 | +61/-10 |
| `server/controllers/documentController.js` | Modified | 69 | 0 | +69/-0 |
| `tests/unit/server-case-service.test.js` | Modified | 46 | 0 | +46/-0 |
| `server/services/caseService.js` | Modified | 38 | 3 | +38/-3 |
| `server/services/fileAccessService.js` | Modified | 24 | 1 | +24/-1 |
| `tests/unit/server-file-access.test.js` | Modified | 21 | 0 | +21/-0 |
| `server/services/documentService.js` | Modified | 17 | 1 | +17/-1 |
| `server/routes/caseRoutes.js` | Modified | 5 | 0 | +5/-0 |
| `server/server.js` | Modified | 4 | 0 | +4/-0 |

### What changed per file

- **`tests/integration/support-case-api.test.js`** — modified test. function added: `openStream`; function added: `frameOf`; test case added: `a stranger is refused with a 403`; test case added: `an unknown case is a 404`; test case added: `the owner gets an event stream with the retry hint on it`; test case added: `an event arrives as a frame whose envelope carries the case id` ….
- **`docs/rollout/2026-10-20-support-attachment-migration.md`** — added documentation. +155/-0 lines.
- **`server/controllers/caseController.js`** — modified API controller. function added: `streamCaseController`.
- **`tests/integration/support-evidence-access.test.js`** — modified test. function removed: `uploadReq`; function added: `uploadReq`; test case added: `a stranger cannot attach evidence to somebody else`; test case added: `an entity_id that names nothing is refused`; test case added: `an upload with no entity_id at all is refused`; test case added: `the legacy ticket branch still lets the ticket`.
- **`scripts/db/migrate-support-attachments.mjs`** — modified tooling script. function removed: `processRow`; function added: `processRow`; function removed: `run`; function added: `run`.
- **`server/controllers/documentController.js`** — modified API controller. function added: `resolveSupportEvidenceOwner`.
- **`tests/unit/server-case-service.test.js`** — modified test. test case added: `returns an empty list for a case that is not there`; test case added: `returns an empty list when the case was deleted concurrently`; test case added: `reads and deletes inside one transaction`.
- **`server/services/caseService.js`** — modified server service. +38/-3 lines.
- **`server/services/fileAccessService.js`** — modified server service. function added: `canAccessSupportEvidence`.
- **`tests/unit/server-file-access.test.js`** — modified test. test case added: `denies a support attachment whose bytes are not under /uploads/support`; test case added: `denies a legacy support row whose bytes are still in the uploads root`.
- **`server/services/documentService.js`** — modified server service. +17/-1 lines.
- **`server/routes/caseRoutes.js`** — modified API route. route added: `GET /:caseId/stream`.

## Detailed Diff Analysis

- **Areas touched:** test (4 files, +363/-2), API controller (2 files, +210/-0), documentation (1 file, +155/-0), server service (3 files, +79/-5), tooling script (1 file, +61/-10), API route (1 file, +5/-0), server (1 file, +4/-0).
- **Route added** (1): `GET /:caseId/stream`
- **Function added** (8): `processRow`, `run`, `streamCaseController`, `resolveSupportEvidenceOwner`, `canAccessSupportEvidence`, `openStream`, `frameOf`, `uploadReq`
- **Function removed** (3): `processRow`, `run`, `uploadReq`
- **Test case added** (15): `a stranger is refused with a 403`, `an unknown case is a 404`, `the owner gets an event stream with the retry hint on it`, `an event arrives as a frame whose envelope carries the case id`, `an event for another case is not forwarded`, `the stream stops listening when the client hangs up`, `a stranger cannot attach evidence to somebody else`, `an entity_id that names nothing is refused`, `an upload with no entity_id at all is refused`, `the legacy ticket branch still lets the ticket` …
- **Tests:** 4 test file(s) changed: `tests/integration/support-case-api.test.js`, `tests/integration/support-evidence-access.test.js`, `tests/unit/server-case-service.test.js`, `tests/unit/server-file-access.test.js`
- **Merge:** diff shown against the first parent; the content was authored in the merged branch's commits.

## Why This Change Was Needed

Integrate review fixes.

## Was It Useful

Neutral. Merge.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. As a merge, its effect equals that of the merged branch commits.

## Relationship to Surrounding Commits

- **Follows:** 0854 — Single-Source the Clarification Round Cap.
- **Precedes:** 0856 — Merge the Report and Email Delivery Workstream.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
