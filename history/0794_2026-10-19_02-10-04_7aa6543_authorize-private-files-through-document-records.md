# Commit 0794 — 7aa6543

| Field | Value |
|-------|-------|
| **Commit Number** | 0794 |
| **Commit Hash** | 7aa65435cf4507d008a343ff1fb7817e61ccc383 |
| **Parent Hash** | 7724218ad079d5fbaf80ad9378af8feb3693ced9 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-19 02:10:04 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 399 |
| **Deletions** | 0 |
| **Net Change** | +399 |
| **Merge Commit** | No |

## Authorize Private Files Through Document Records

`fileAccessService` decides access from the Document's `entity_type`, delegating contracts to `canAccessContract`; unknown types fail closed; chat/call files require the message or session to reference the file; tests.

Original commit message: “feat(uploads): authorize private files via Document.entity_type”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/server-file-access.test.js` | Added | 239 | 0 | +239/-0 |
| `server/services/fileAccessService.js` | Added | 160 | 0 | +160/-0 |

### What changed per file

- **`tests/unit/server-file-access.test.js`** — added test. function added: `chatDoc`; function added: `chatMessage`; function added: `callDoc`; test case added: `recognises admin roles`; test case added: `allows the contract buyer`; test case added: `allows the contract factory` ….
- **`server/services/fileAccessService.js`** — added server service. function added: `idList`; function added: `docFilename`; function added: `attachmentFilenames`; function added: `matchesId`; function added: `toIdSet`; function added: `isAdminRole` ….

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +239/-0), server service (1 file, +160/-0).
- **Function added** (11): `idList`, `docFilename`, `attachmentFilenames`, `matchesId`, `toIdSet`, `isAdminRole`, `canUserAccessDocument`, `authorizeFilePath`, `chatDoc`, `chatMessage` …
- **Test case added** (22): `recognises admin roles`, `allows the contract buyer`, `allows the contract factory`, `allows an owner or admin over any document`, `denies an unrelated user the contract`, `denies a system-owned orphan contract to everyone but an admin`, `allows a chat sender`, `allows a chat participant who is not the sender`, `denies a third party to a chat attachment`, `denies a chat attachment when no message claims the file` …
- **Tests:** 1 test file(s) changed: `tests/unit/server-file-access.test.js`

## Why This Change Was Needed

A single, testable authorization point for private files.

## Was It Useful

Useful. Security.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0793 — Close Fail-Open Paths in the Signed-URL Core.
- **Precedes:** 0795 — Stop Forged Document Rows from Granting File Access.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
