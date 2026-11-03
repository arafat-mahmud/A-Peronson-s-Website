# Commit 0792 — 9941cf0

| Field | Value |
|-------|-------|
| **Commit Number** | 0792 |
| **Commit Hash** | 9941cf0f359d692c3014bee901d8095c68f725f9 |
| **Parent Hash** | 0f8db85309ac1bb01ccd71ea7f80494ce16adda8 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-18 23:44:46 |
| **Branch** | main |
| **Files Changed** | 3 |
| **Additions** | 235 |
| **Deletions** | 0 |
| **Net Change** | +235 |
| **Merge Commit** | No |

## Add the HMAC Signed-URL Core for Private Files

Path containment, signing (path + user + expiry) and timing-safe verification; fails closed without a secret; tests.

Original commit message: “feat(uploads): HMAC-signed url core for private files”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/server-signed-file-url.test.js` | Added | 136 | 0 | +136/-0 |
| `server/utils/signedFileUrl.js` | Added | 92 | 0 | +92/-0 |
| `.env.example` | Modified | 7 | 0 | +7/-0 |

### What changed per file

- **`tests/unit/server-signed-file-url.test.js`** — added test. test case added: `classifies gated and public prefixes`; test case added: `resolves paths inside the uploads root`; test case added: `refuses to escape the uploads root`; test case added: `signs a path into a verifiable url`; test case added: `accepts a freshly minted signature`; test case added: `rejects a tampered user id` ….
- **`server/utils/signedFileUrl.js`** — added server. function added: `uploadsRoot`; function added: `readSecret`; function added: `isGatedPath`; function added: `resolveWithinUploads`; function added: `toPublicPath`; function added: `canonical` ….
- **`.env.example`** — modified configuration. +7/-0 lines.

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +136/-0), server (1 file, +92/-0), configuration (1 file, +7/-0).
- **Function added** (8): `uploadsRoot`, `readSecret`, `isGatedPath`, `resolveWithinUploads`, `toPublicPath`, `canonical`, `signFileUrl`, `verifySignedFile`
- **Test case added** (11): `classifies gated and public prefixes`, `resolves paths inside the uploads root`, `refuses to escape the uploads root`, `signs a path into a verifiable url`, `accepts a freshly minted signature`, `rejects a tampered user id`, `rejects a swapped path`, `rejects an expired url`, `rejects a truncated signature without throwing`, `fails closed when the secret is unset` …
- **Tests:** 1 test file(s) changed: `tests/unit/server-signed-file-url.test.js`

## Why This Change Was Needed

Foundation for serving private files only through signed URLs.

## Was It Useful

Useful. Security.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. Build/deploy or tooling configuration changes.

## Relationship to Surrounding Commits

- **Follows:** 0791 — Skip Biome in the Hook When No Staged File Matches.
- **Precedes:** 0793 — Close Fail-Open Paths in the Signed-URL Core.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
