# Commit 0799 — 672b86a

| Field | Value |
|-------|-------|
| **Commit Number** | 0799 |
| **Commit Hash** | 672b86a0c1f8bae2e400c25e761593629e3b1a41 |
| **Parent Hash** | 6914bc56e74ee8aba4b77261aaecbdf9a2cd56fc |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-19 12:31:05 |
| **Branch** | main |
| **Files Changed** | 5 |
| **Additions** | 350 |
| **Deletions** | 36 |
| **Net Change** | +314 |
| **Merge Commit** | No |

## Close the Decode-Then-Normalize Bypass in the Uploads Guard

The guard now evaluates the same decoded, normalized path that `send` serves; new `gatedStaticGuard` with tests.

Original commit message: “fix(uploads): close the decode-then-normalize bypass in the uploads guard”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/integration/file-access-http.test.js` | Modified | 118 | 11 | +118/-11 |
| `tests/integration/gated-static.test.js` | Added | 113 | 0 | +113/-0 |
| `server/utils/gatedStaticGuard.js` | Added | 74 | 0 | +74/-0 |
| `server/routes/fileAccessRoutes.js` | Modified | 38 | 14 | +38/-14 |
| `server/server.js` | Modified | 7 | 11 | +7/-11 |

### What changed per file

- **`tests/integration/file-access-http.test.js`** — modified test. function added: `bodyText`; test case added: `does not let a caller-supplied key reach Object.prototype`; test case added: `serves a legitimate in-root file, and marks it private`; test case added: `records exactly one DocumentView per human view`; function added: `plantInRootFile`.
- **`tests/integration/gated-static.test.js`** — added test. function added: `bodyText`; function added: `shapeVariants`; test case added: `404 /uploads/${folder} via ${shape.name}`; test case added: `404 the gated directory itself`; test case added: `404 a traversal that escapes the uploads root`; test case added: `200 a public feed file` ….
- **`server/utils/gatedStaticGuard.js`** — added server. function added: `createGatedStaticGuard`.
- **`server/routes/fileAccessRoutes.js`** — modified API route. +38/-14 lines.
- **`server/server.js`** — modified server. +7/-11 lines.

## Detailed Diff Analysis

- **Areas touched:** test (2 files, +231/-11), server (2 files, +81/-11), API route (1 file, +38/-14).
- **Function added** (4): `createGatedStaticGuard`, `bodyText`, `plantInRootFile`, `shapeVariants`
- **Test case added** (9): `does not let a caller-supplied key reach Object.prototype`, `serves a legitimate in-root file, and marks it private`, `records exactly one DocumentView per human view`, `404 /uploads/${folder} via ${shape.name}`, `404 the gated directory itself`, `404 a traversal that escapes the uploads root`, `200 a public feed file`, `200 a public root-level asset`, `200 a public file reached through ./ and %XX shapes`
- **Tests:** 2 test file(s) changed: `tests/integration/file-access-http.test.js`, `tests/integration/gated-static.test.js`

## Why This Change Was Needed

Percent-encoded paths bypassed the deny check.

## Was It Useful

Useful. Security.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0798 — Serve Private Files Only Through Signed URLs.
- **Precedes:** 0800 — Remove a Duplicated Comment in File Routes.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
