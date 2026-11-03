# Commit 0734 — 73248f9

| Field | Value |
|-------|-------|
| **Commit Number** | 0734 |
| **Commit Hash** | 73248f946f200d792303f44eeed9579dcde51896 |
| **Parent Hash** | 285a6545e07ef93dd859197c79eec6a42051f8e4 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-03 19:57:39 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 4 |
| **Deletions** | 2 |
| **Net Change** | +2 |
| **Merge Commit** | No |

## Fix CSP-Blocked Font Loader and NavBar Temporal-Dead-Zone Crash

Replaces the font stylesheet's inline `onload` attribute (blocked by helmet's `script-src-attr 'none'`) with a small head script, and moves the NavBar `userId` declaration above the memo that read it, which threw a ReferenceError on every render.

Original commit message: “fix: remove CSP-blocking inline onload handler; fix NavBar userId TDZ crash”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `index.html` | Modified | 3 | 1 | +3/-1 |
| `src/components/NavBar.jsx` | Modified | 1 | 1 | +1/-1 |

### What changed per file

- **`index.html`** — modified other. +3/-1 lines.
- **`src/components/NavBar.jsx`** — modified component. +1/-1 lines.

## Detailed Diff Analysis

- **Areas touched:** other (1 file, +3/-1), component (1 file, +1/-1).
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Two production errors: fonts never switched to `media=all` under the CSP, and the NavBar crashed.

## Was It Useful

Useful. Small, targeted fixes for real runtime failures.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0733 — Apply Buyer Final Directives to Settings, Owner Console and Boosts.
- **Precedes:** 0735 — Polish Profiles, Tabs and KPI Grids from the Video Audit.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
