# Commit 0815 — bc388b0

| Field | Value |
|-------|-------|
| **Commit Number** | 0815 |
| **Commit Hash** | bc388b01e399ebde5150a9fd90c3778e7408ec96 |
| **Parent Hash** | b123140be922f9c76c50664bc1c60a60297ba86f |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-19 22:09:59 |
| **Branch** | main |
| **Files Changed** | 9 |
| **Additions** | 503 |
| **Deletions** | 110 |
| **Net Change** | +393 |
| **Merge Commit** | No |

## Ask the Server Whether a Document May Leave the Browser

Removes the client's copy of gated prefixes; the server answers whether a file may go to the Office viewer; sign rate limiter; tests.

Original commit message: “fix(uploads): ask the server whether a document may leave the browser”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/frontend-signed-file.test.js` | Modified | 122 | 17 | +122/-17 |
| `tests/integration/file-access-http.test.js` | Modified | 106 | 2 | +106/-2 |
| `src/lib/signedFile.js` | Modified | 65 | 38 | +65/-38 |
| `src/components/chat/AttachmentPreviewModal.jsx` | Modified | 51 | 20 | +51/-20 |
| `tests/unit/server-rate-limiter.test.js` | Added | 52 | 0 | +52/-0 |
| `server/middleware/rateLimiter.js` | Modified | 36 | 14 | +36/-14 |
| `src/hooks/useSignedSrc.js` | Modified | 30 | 11 | +30/-11 |
| `server/routes/fileAccessRoutes.js` | Modified | 33 | 3 | +33/-3 |
| `src/components/chat/SignedMedia.jsx` | Modified | 8 | 5 | +8/-5 |

### What changed per file

- **`tests/unit/frontend-signed-file.test.js`** — modified test. test case added: `reports the server`; test case added: `is false when the server does not answer`; test case added: `is false when the request fails outright`; test case added: `is false for an empty path`; test case added: `the client keeps no copy of the server`; test case added: `the preview modal asks the server instead of deciding locally` ….
- **`tests/integration/file-access-http.test.js`** — modified test. test case added: `a gated path is never safe to hand to a third party`; test case added: `a public path is safe to hand to a third party`; test case added: `a refused path still carries the third-party decision`; test case added: `the response carries the lifetime the server used`; test case added: `answers 429 once a user has spent the /sign budget`; test case added: `another user is not affected by that user`.
- **`src/lib/signedFile.js`** — modified frontend library. function removed: `isGatedAssetPath`; function added: `isThirdPartySafe`; function added: `signOneWithTtl`.
- **`src/components/chat/AttachmentPreviewModal.jsx`** — modified component. function added: `safeDownloadName`.
- **`tests/unit/server-rate-limiter.test.js`** — added test. function added: `buildApp`; test case added: `counts per key when a keyResolver is supplied`; test case added: `falls back to the caller`.
- **`server/middleware/rateLimiter.js`** — modified server middleware. function added: `limiterKey`; function removed: `createMemoryLimiter`; function added: `createMemoryLimiter`; function removed: `createRedisLimiter`; function added: `createRedisLimiter`.
- **`src/hooks/useSignedSrc.js`** — modified frontend library. function removed: `useSignedSrc`; function added: `useSignedSrc`.
- **`server/routes/fileAccessRoutes.js`** — modified API route. route modified: `POST /sign`.
- **`src/components/chat/SignedMedia.jsx`** — modified component. +8/-5 lines.

## Detailed Diff Analysis

- **Areas touched:** test (3 files, +280/-19), frontend library (2 files, +95/-49), component (2 files, +59/-25), server middleware (1 file, +36/-14), API route (1 file, +33/-3).
- **Route modified (middleware/handler changed)** (1): `POST /sign`
- **Function added** (8): `limiterKey`, `createMemoryLimiter`, `createRedisLimiter`, `safeDownloadName`, `useSignedSrc`, `isThirdPartySafe`, `signOneWithTtl`, `buildApp`
- **Function removed** (4): `createMemoryLimiter`, `createRedisLimiter`, `useSignedSrc`, `isGatedAssetPath`
- **Test case added** (18): `a gated path is never safe to hand to a third party`, `a public path is safe to hand to a third party`, `a refused path still carries the third-party decision`, `the response carries the lifetime the server used`, `answers 429 once a user has spent the /sign budget`, `another user is not affected by that user`, `reports the server`, `is false when the server does not answer`, `is false when the request fails outright`, `is false for an empty path` …
- **Tests:** 3 test file(s) changed: `tests/integration/file-access-http.test.js`, `tests/unit/frontend-signed-file.test.js`, `tests/unit/server-rate-limiter.test.js`

## Why This Change Was Needed

Duplicated rules drift; a signed URL is a credential and must not reach third parties.

## Was It Useful

Useful. Security.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths. API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0814 — Require UPLOADS_SIGNING_SECRET at Boot.
- **Precedes:** 0816 — Make the Pre-Commit Test Gate Able to Fail.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
