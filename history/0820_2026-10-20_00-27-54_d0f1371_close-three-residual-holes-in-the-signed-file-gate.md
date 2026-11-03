# Commit 0820 — d0f1371

| Field | Value |
|-------|-------|
| **Commit Number** | 0820 |
| **Commit Hash** | d0f1371cda3d0c1faf9c62f053bfc4b468dd188d |
| **Parent Hash** | 3676315cc62cd2e5421616acd050b78c0d96fd70 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-20 00:27:54 |
| **Branch** | main |
| **Files Changed** | 15 |
| **Additions** | 944 |
| **Deletions** | 78 |
| **Net Change** | +866 |
| **Merge Commit** | No |

## Close Three Residual Holes in the Signed-File Gate

Fixes SignedMedia class handling, adds a client sign rate limit and other gaps; tests.

Original commit message: “fix(uploads): close the three residual holes in the signed-file gate”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/lib/signedFile.js` | Modified | 202 | 14 | +202/-14 |
| `tests/unit/frontend-signed-media.test.js` | Added | 145 | 0 | +145/-0 |
| `tests/unit/frontend-sign-rate-limit.test.js` | Added | 128 | 0 | +128/-0 |
| `server/middleware/rateLimiter.js` | Modified | 90 | 0 | +90/-0 |
| `src/hooks/useSignedSrc.js` | Modified | 72 | 10 | +72/-10 |
| `src/components/chat/AttachmentPreviewModal.jsx` | Modified | 51 | 16 | +51/-16 |
| `tests/unit/server-uploads-registry.test.js` | Modified | 57 | 0 | +57/-0 |
| `tests/integration/file-access-http.test.js` | Modified | 49 | 5 | +49/-5 |
| `server/services/uploadsService.js` | Modified | 35 | 12 | +35/-12 |
| `src/components/chat/SignedMedia.jsx` | Modified | 36 | 7 | +36/-7 |
| `server/routes/fileAccessRoutes.js` | Modified | 40 | 2 | +40/-2 |
| `AGENTS.md` | Modified | 17 | 0 | +17/-0 |
| `src/components/chat/FileAttachmentCard.jsx` | Modified | 9 | 7 | +9/-7 |
| `tests/unit/frontend-signed-file.test.js` | Modified | 11 | 3 | +11/-3 |
| `tests/unit/frontend-jsx-bindings.test.js` | Modified | 2 | 2 | +2/-2 |

### What changed per file

- **`src/lib/signedFile.js`** — modified frontend library. function added: `signRateLimitWaitMs`; function added: `scheduleFlush`; function added: `signEntry`; function added: `flushPendingSigns`; function added: `describeSignFailure`; function added: `signAndDownloadWithReason`.
- **`tests/unit/frontend-signed-media.test.js`** — added test. function added: `classAttributesOf`; function added: `recordAttributeWrites`; test case added: `the caller`; test case added: `the class attribute is written once, not twice`; test case added: `the video carries the caller`.
- **`tests/unit/frontend-sign-rate-limit.test.js`** — added test. function added: `rateLimitError`; test case added: `signs many paths in ONE request`; test case added: `never sends more paths than the server accepts in one request`; test case added: `the same path asked for twice in one turn is sent once`; test case added: `reports the rate limit instead of a silent miss`; test case added: `still fails closed: no url, and never the raw path` ….
- **`server/middleware/rateLimiter.js`** — modified server middleware. function added: `createUnitBudget`; function added: `createMemoryUnitBudget`; function added: `createRedisUnitBudget`.
- **`src/hooks/useSignedSrc.js`** — modified frontend library. function removed: `useSignedSrc`; function added: `useSignedSrcState`; function added: `useSignedSrc`.
- **`src/components/chat/AttachmentPreviewModal.jsx`** — modified component. +51/-16 lines.
- **`tests/unit/server-uploads-registry.test.js`** — modified test. function added: `createdRowAt`; test case added: `recognises a row written with a different spelling of the same path`; test case added: `adopts the file in each directory under its OWN path`; test case added: `a row for one directory does not suppress the same name in another`.
- **`tests/integration/file-access-http.test.js`** — modified test. test case added: `answers 429 once a user has spent the /sign REQUEST budget`; test case added: `answers 429 once a user has spent the /sign PATH budget`.
- **`server/services/uploadsService.js`** — modified server service. function removed: `baseNameOf`; function added: `knownKeyOf`.
- **`src/components/chat/SignedMedia.jsx`** — modified component. function added: `SignFailure`.
- **`server/routes/fileAccessRoutes.js`** — modified API route. +40/-2 lines.
- **`AGENTS.md`** — modified documentation. +17/-0 lines.

## Detailed Diff Analysis

- **Areas touched:** test (6 files, +392/-10), frontend library (2 files, +274/-24), component (3 files, +96/-30), server middleware (1 file, +90/-0), server service (1 file, +35/-12), API route (1 file, +40/-2), documentation (1 file, +17/-0).
- **Function added** (17): `createUnitBudget`, `createMemoryUnitBudget`, `createRedisUnitBudget`, `knownKeyOf`, `SignFailure`, `useSignedSrcState`, `useSignedSrc`, `signRateLimitWaitMs`, `scheduleFlush`, `signEntry` …
- **Function removed** (2): `baseNameOf`, `useSignedSrc`
- **Test case added** (16): `answers 429 once a user has spent the /sign REQUEST budget`, `answers 429 once a user has spent the /sign PATH budget`, `signs many paths in ONE request`, `never sends more paths than the server accepts in one request`, `the same path asked for twice in one turn is sent once`, `reports the rate limit instead of a silent miss`, `still fails closed: no url, and never the raw path`, `backs off before the next request`, `the surface can say WHY the preview did not load`, `reports the rate limit so a surface can show it` …
- **Tests:** 6 test file(s) changed: `tests/integration/file-access-http.test.js`, `tests/unit/frontend-jsx-bindings.test.js`, `tests/unit/frontend-sign-rate-limit.test.js`, `tests/unit/frontend-signed-file.test.js`, `tests/unit/frontend-signed-media.test.js` …

## Why This Change Was Needed

Review found remaining issues after the main wave.

## Was It Useful

Useful. Security and UX.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths. API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0819 — Publish the Upload Fix-Wave Report.
- **Precedes:** 0821 — Keep Sign Failures in the Server's Error Shape.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
