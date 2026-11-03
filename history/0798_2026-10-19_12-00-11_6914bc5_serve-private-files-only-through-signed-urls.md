# Commit 0798 — 6914bc5

| Field | Value |
|-------|-------|
| **Commit Number** | 0798 |
| **Commit Hash** | 6914bc56e74ee8aba4b77261aaecbdf9a2cd56fc |
| **Parent Hash** | 91703a8f93cc01ad351816da8f27426d2daad92f |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-19 12:00:11 |
| **Branch** | main |
| **Files Changed** | 5 |
| **Additions** | 423 |
| **Deletions** | 1 |
| **Net Change** | +422 |
| **Merge Commit** | No |

## Serve Private Files Only Through Signed URLs

Registers `/api/files/sign` and `/api/files/content` before the static mount, makes the static mount 404 gated prefixes, records DocumentView rows; integration tests.

Original commit message: “feat(uploads): serve private files through signed urls only”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/integration/file-access-http.test.js` | Added | 179 | 0 | +179/-0 |
| `server/routes/fileAccessRoutes.js` | Added | 154 | 0 | +154/-0 |
| `server/services/uploadsService.js` | Modified | 63 | 0 | +63/-0 |
| `server/server.js` | Modified | 23 | 0 | +23/-0 |
| `server/utils/signedFileUrl.js` | Modified | 4 | 1 | +4/-1 |

### What changed per file

- **`tests/integration/file-access-http.test.js`** — added test. function added: `buildApp`; test case added: `mints a signed url for an authorized path`; test case added: `uses the longer media ttl only for call recordings`; test case added: `maps a forbidden verdict to 403 instead of minting`; test case added: `maps a not_found verdict to 404`; test case added: `rejects an invalid signature on the content route` ….
- **`server/routes/fileAccessRoutes.js`** — added API route. route added: `POST /sign`; route added: `GET /content`; function added: `recordContractView`.
- **`server/services/uploadsService.js`** — modified server service. function added: `topFolderOf`; function added: `flagUnclaimedPrivateFiles`.
- **`server/server.js`** — modified server. +23/-0 lines.
- **`server/utils/signedFileUrl.js`** — modified server. function removed: `uploadsRoot`; function added: `uploadsRoot`.

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +179/-0), API route (1 file, +154/-0), server service (1 file, +63/-0), server (2 files, +27/-1).
- **Route added** (2): `POST /sign`, `GET /content`
- **Function added** (6): `recordContractView`, `topFolderOf`, `flagUnclaimedPrivateFiles`, `uploadsRoot`, `buildApp`, `createEscapeProbe`
- **Function removed** (1): `uploadsRoot`
- **Test case added** (5): `mints a signed url for an authorized path`, `uses the longer media ttl only for call recordings`, `maps a forbidden verdict to 403 instead of minting`, `maps a not_found verdict to 404`, `rejects an invalid signature on the content route`
- **Tests:** 1 test file(s) changed: `tests/integration/file-access-http.test.js`

## Why This Change Was Needed

The core of the upload access-control fix.

## Was It Useful

Useful. Security.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0797 — Drop the Launderable Artifact Path from Contract Provenance.
- **Precedes:** 0799 — Close the Decode-Then-Normalize Bypass in the Uploads Guard.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
