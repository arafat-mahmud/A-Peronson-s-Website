# Commit 0821 — 6c7fae3

| Field | Value |
|-------|-------|
| **Commit Number** | 0821 |
| **Commit Hash** | 6c7fae37a78de3dc23339112cf20af2aa6330737 |
| **Parent Hash** | d0f1371cda3d0c1faf9c62f053bfc4b468dd188d |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-20 01:23:03 |
| **Branch** | main |
| **Files Changed** | 5 |
| **Additions** | 94 |
| **Deletions** | 12 |
| **Net Change** | +82 |
| **Merge Commit** | No |

## Keep Sign Failures in the Server's Error Shape

Hook-driven surfaces now read the server's `error` field, so rate-limit reasons show.

Original commit message: “fix(uploads): keep the sign failure in the server's shape”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/frontend-sign-rate-limit.test.js` | Modified | 55 | 2 | +55/-2 |
| `src/hooks/useSignedSrc.js` | Modified | 24 | 4 | +24/-4 |
| `src/lib/signedFile.js` | Modified | 10 | 2 | +10/-2 |
| `AGENTS.md` | Modified | 3 | 2 | +3/-2 |
| `src/components/chat/SignedMedia.jsx` | Modified | 2 | 2 | +2/-2 |

### What changed per file

- **`tests/unit/frontend-sign-rate-limit.test.js`** — modified test. test case added: `a failure with no reported reason is still a failure`; test case added: `a rate-limited sign says the server is rate limiting`; test case added: `a refused sign says the file is not accessible, and says something DIFFERENT`.
- **`src/hooks/useSignedSrc.js`** — modified frontend library. +24/-4 lines.
- **`src/lib/signedFile.js`** — modified frontend library. +10/-2 lines.
- **`AGENTS.md`** — modified documentation. +3/-2 lines.
- **`src/components/chat/SignedMedia.jsx`** — modified component. +2/-2 lines.

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +55/-2), frontend library (2 files, +34/-6), documentation (1 file, +3/-2), component (1 file, +2/-2).
- **Test case added** (3): `a failure with no reported reason is still a failure`, `a rate-limited sign says the server is rate limiting`, `a refused sign says the file is not accessible, and says something DIFFERENT`
- **Tests:** 1 test file(s) changed: `tests/unit/frontend-sign-rate-limit.test.js`

## Why This Change Was Needed

Users saw a generic error instead of the real reason.

## Was It Useful

Useful. Small fix.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0820 — Close Three Residual Holes in the Signed-File Gate.
- **Precedes:** 0822 — Record the Final Upload Ruling and Implementer Corrections.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
