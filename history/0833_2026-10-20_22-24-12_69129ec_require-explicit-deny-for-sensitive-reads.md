# Commit 0833 — 69129ec

| Field | Value |
|-------|-------|
| **Commit Number** | 0833 |
| **Commit Hash** | 69129ec82c0c4748ffba74e214975a0a6c6e7096 |
| **Parent Hash** | 0acfd91c65be272bc0d3fe52611b111d90165933 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-20 22:24:12 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 46 |
| **Deletions** | 15 |
| **Net Change** | +31 |
| **Merge Commit** | No |

## Require Explicit Deny for Sensitive Reads

Tests require 'deny' (not just 'not allow') for sensitive files.

Original commit message: “fix(investigation): require deny, not merely not-allow, for sensitive reads”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/server-investigation-runtime-config.test.js` | Modified | 46 | 15 | +46/-15 |

### What changed per file

- **`tests/unit/server-investigation-runtime-config.test.js`** — modified test. function removed: `expectDeniedReadsNotWidened`; function added: `expectSensitiveReadsStillDenied`; test case added: `the investigator`.

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +46/-15).
- **Function added** (1): `expectSensitiveReadsStillDenied`
- **Function removed** (1): `expectDeniedReadsNotWidened`
- **Test case added** (1): `the investigator`
- **Tests:** 1 test file(s) changed: `tests/unit/server-investigation-runtime-config.test.js`

## Why This Change Was Needed

Defaults could change.

## Was It Useful

Useful. Security test.

## Impact Analysis

No runtime behaviour change.

## Relationship to Surrounding Commits

- **Follows:** 0832 — Assert the Composed Agent Permission Set.
- **Precedes:** 0834 — Persist Support Cases and Keep Their Evidence Private.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
