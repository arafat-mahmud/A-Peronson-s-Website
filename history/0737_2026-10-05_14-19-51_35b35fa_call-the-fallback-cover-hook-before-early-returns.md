# Commit 0737 — 35b35fa

| Field | Value |
|-------|-------|
| **Commit Number** | 0737 |
| **Commit Hash** | 35b35fa6f1bf767d4236bbc4eb7aa0a60fe1fe73 |
| **Parent Hash** | 1d4a4a65ade1740269a5cf0d37dcfc003616b9d2 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-05 14:19:51 |
| **Branch** | main |
| **Files Changed** | 3 |
| **Additions** | 4 |
| **Deletions** | 3 |
| **Net Change** | +1 |
| **Merge Commit** | No |

## Call the Fallback-Cover Hook Before Early Returns

Moves `useFallbackCover` above the loading/error/no-user early returns on the three profile pages, so hooks run in the same order on every render.

Original commit message: “fix: move useFallbackCover above early returns (React error 310)”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/pages/BuyingHouseProfile.jsx` | Modified | 2 | 1 | +2/-1 |
| `src/pages/BuyerProfile.jsx` | Modified | 1 | 1 | +1/-1 |
| `src/pages/FactoryProfile.jsx` | Modified | 1 | 1 | +1/-1 |

### What changed per file

- **`src/pages/BuyingHouseProfile.jsx`** — modified page. +2/-1 lines.
- **`src/pages/BuyerProfile.jsx`** — modified page. +1/-1 lines.
- **`src/pages/FactoryProfile.jsx`** — modified page. +1/-1 lines.

## Detailed Diff Analysis

- **Areas touched:** page (3 files, +4/-3).
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

React error 310: the hook ran on later renders but not the first, crashing profile pages.

## Was It Useful

Useful. Fixes a crash introduced by the previous commit.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0736 — Render Uploaded Profile Covers with Random Wallpaper Fallback.
- **Precedes:** 0738 — Return 403 Instead of 500 for Premium Chatbot Settings.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
