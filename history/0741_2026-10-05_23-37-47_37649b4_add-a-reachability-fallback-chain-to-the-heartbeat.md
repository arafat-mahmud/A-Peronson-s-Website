# Commit 0741 — 37649b4

| Field | Value |
|-------|-------|
| **Commit Number** | 0741 |
| **Commit Hash** | 37649b43b7d4ccd57f67016a734de291e1e149fc |
| **Parent Hash** | 84f0790efe4c1cf4e47186fa4f9023224cb24e08 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-05 23:37:47 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 38 |
| **Deletions** | 23 |
| **Net Change** | +15 |
| **Merge Commit** | No |

## Add a Reachability Fallback Chain to the Heartbeat

When signed out, connectivity probes `/health`, then `/favicon.ico`, then `/manifest.json`; any HTTP response counts as reachable.

Original commit message: “fix: heartbeat fallback chain (adblockers block /health)”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/offline/connectivity.js` | Modified | 38 | 23 | +38/-23 |

### What changed per file

- **`src/offline/connectivity.js`** — modified frontend library. +38/-23 lines.

## Detailed Diff Analysis

- **Areas touched:** frontend library (1 file, +38/-23).
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Ad blockers block `/health`, which produced a false offline banner and a dead Retry button.

## Was It Useful

Useful. Fewer false 'offline' states.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0740 — Stop Sync Heartbeat 401 Noise for Signed-Out Users.
- **Precedes:** 0742 — Add Bot-Aware SEO Metadata and Buyer-Intent Titles.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
