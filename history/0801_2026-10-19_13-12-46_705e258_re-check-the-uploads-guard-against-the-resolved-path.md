# Commit 0801 — 705e258

| Field | Value |
|-------|-------|
| **Commit Number** | 0801 |
| **Commit Hash** | 705e2584b212805a4418ee92e167a395a044a81a |
| **Parent Hash** | f67d49ae1c3bf92861c09c11e95fcd81f265627c |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-19 13:12:46 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 244 |
| **Deletions** | 21 |
| **Net Change** | +223 |
| **Merge Commit** | No |

## Re-check the Uploads Guard Against the Resolved Path

Guards against NTFS 8.3 short names (e.g. `CONTRA~1`) by checking the resolved path; tests.

Original commit message: “fix(uploads): re-check the guard against the resolved path, not the requested name”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/integration/gated-static.test.js` | Modified | 152 | 15 | +152/-15 |
| `server/utils/gatedStaticGuard.js` | Modified | 92 | 6 | +92/-6 |

### What changed per file

- **`tests/integration/gated-static.test.js`** — modified test. test case added: `a missing public file is answered by static, not the guard`; test case added: `a public directory is redirected by static, not 404`; test case added: `the uploads root itself is left to static`; function added: `plantEscapeLink`; function added: `detectShortNameAlias`.
- **`server/utils/gatedStaticGuard.js`** — modified server. function added: `isGatedRelative`; function added: `escapesRoot`; function added: `realRoot`; function added: `resolvedTargetIsPrivate`.

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +152/-15), server (1 file, +92/-6).
- **Function added** (6): `isGatedRelative`, `escapesRoot`, `realRoot`, `resolvedTargetIsPrivate`, `plantEscapeLink`, `detectShortNameAlias`
- **Test case added** (3): `a missing public file is answered by static, not the guard`, `a public directory is redirected by static, not 404`, `the uploads root itself is left to static`
- **Tests:** 1 test file(s) changed: `tests/integration/gated-static.test.js`

## Why This Change Was Needed

Short names reached gated directories under a non-gated string.

## Was It Useful

Useful. Security (Windows hosts).

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0800 — Remove a Duplicated Comment in File Routes.
- **Precedes:** 0802 — Biome-Format ContractVault.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
