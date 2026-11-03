# Commit 0818 — 7b81717

| Field | Value |
|-------|-------|
| **Commit Number** | 0818 |
| **Commit Hash** | 7b8171738f2a1e4a8b0fdf172df20aa38443b1d9 |
| **Parent Hash** | 017a4a70ae32f53a2afd7c1bdf41c08fda9f6645 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-19 22:57:55 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 17 |
| **Deletions** | 0 |
| **Net Change** | +17 |
| **Merge Commit** | No |

## Pin the Attachment Modal's Download and Preview Behaviour

Tests for the modal's download (save, not open) and preview `src`.

Original commit message: “test(chat): pin the modal's download and preview-src behaviour”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/frontend-signed-file.test.js` | Modified | 17 | 0 | +17/-0 |

### What changed per file

- **`tests/unit/frontend-signed-file.test.js`** — modified test. test case added: `the preview modal downloads instead of opening a tab`.

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +17/-0).
- **Test case added** (1): `the preview modal downloads instead of opening a tab`
- **Tests:** 1 test file(s) changed: `tests/unit/frontend-signed-file.test.js`

## Why This Change Was Needed

Known defects needed regression coverage.

## Was It Useful

Useful. Tests.

## Impact Analysis

No runtime behaviour change.

## Relationship to Surrounding Commits

- **Follows:** 0817 — Publish the Upload Access-Control Decisions and Rollout Notes.
- **Precedes:** 0819 — Publish the Upload Fix-Wave Report.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
