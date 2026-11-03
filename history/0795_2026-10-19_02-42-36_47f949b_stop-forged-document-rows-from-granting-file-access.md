# Commit 0795 — 47f949b

| Field | Value |
|-------|-------|
| **Commit Number** | 0795 |
| **Commit Hash** | 47f949ba23108859a6548ff287b16f16dd1ed806 |
| **Parent Hash** | 7aa65435cf4507d008a343ff1fb7817e61ccc383 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-19 02:42:36 |
| **Branch** | main |
| **Files Changed** | 4 |
| **Additions** | 311 |
| **Deletions** | 193 |
| **Net Change** | +118 |
| **Merge Commit** | No |

## Stop Forged Document Rows from Granting File Access

`POST /documents/url` becomes privileged and the resolver no longer trusts rows any user could mint pointing at gated files.

Original commit message: “fix(uploads): stop forged document rows from granting file access”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/server-file-access.test.js` | Modified | 176 | 113 | +176/-113 |
| `server/services/fileAccessService.js` | Modified | 125 | 74 | +125/-74 |
| `server/routes/documentRoutes.js` | Modified | 6 | 5 | +6/-5 |
| `server/utils/signedFileUrl.js` | Modified | 4 | 1 | +4/-1 |

### What changed per file

- **`tests/unit/server-file-access.test.js`** — modified test. function removed: `chatDoc`; function removed: `chatMessage`; function removed: `callDoc`; test case added: `accepts a friend-match id list returned as a Set`; test case added: `denies a member of thread X a file that only exists in thread Y`; test case added: `constrains the chat message query to the caller` ….
- **`server/services/fileAccessService.js`** — modified server service. function added: `text`; function added: `hasPartyClaim`; function added: `artifactPdfPath`; function added: `rowAnchorsPath`; function added: `canAccessChatAttachment`; function added: `canAccessCallRecording`.
- **`server/routes/documentRoutes.js`** — modified API route. route modified: `POST /url`.
- **`server/utils/signedFileUrl.js`** — modified server. function removed: `toPublicPath`; function added: `toPublicPath`.

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +176/-113), server service (1 file, +125/-74), API route (1 file, +6/-5), server (1 file, +4/-1).
- **Route modified (middleware/handler changed)** (1): `POST /url`
- **Function added** (7): `text`, `hasPartyClaim`, `artifactPdfPath`, `rowAnchorsPath`, `canAccessChatAttachment`, `canAccessCallRecording`, `toPublicPath`
- **Function removed** (4): `toPublicPath`, `chatDoc`, `chatMessage`, `callDoc`
- **Test case added** (13): `accepts a friend-match id list returned as a Set`, `denies a member of thread X a file that only exists in thread Y`, `constrains the chat message query to the caller`, `allows a call recording participant`, `constrains the call query to the recorded filename`, `denies an unknown entity type to its own claimed uploader`, `denies a party-less contract row to its claimed uploader`, `authorizes a contract resolved through artifact.pdf_path`, `resolves the lookup key from the resolved path, not the raw request`, `denies a forged document row the attacker registered for a gated file` …
- **Tests:** 1 test file(s) changed: `tests/unit/server-file-access.test.js`

## Why This Change Was Needed

Any user could create a Document row for someone else's file and then read it.

## Was It Useful

Useful. Closes an access-control hole.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0794 — Authorize Private Files Through Document Records.
- **Precedes:** 0796 — Restore Creator Access to Blank-Party Contracts.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
