# Commit 0774 — 31af281

| Field | Value |
|-------|-------|
| **Commit Number** | 0774 |
| **Commit Hash** | 31af281989fec99b967497e7d92b62e29156d91b |
| **Parent Hash** | 25be8f9acaef00134ce7fcf3842d6d8e8b3f925f |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-09 02:03:26 |
| **Branch** | main |
| **Files Changed** | 4 |
| **Additions** | 6 |
| **Deletions** | 6 |
| **Net Change** | +0 |
| **Merge Commit** | No |

## Make Dashboards Fill the Viewport

Dashboards use `flex-1` and `dvh` units to close a dead gap at the bottom.

Original commit message: “fix(dashboard): fill viewport with flex-1 + dvh, close dead gap”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/pages/OwnerDashboard.jsx` | Modified | 3 | 3 | +3/-3 |
| `src/pages/AdminGovernance.jsx` | Modified | 1 | 1 | +1/-1 |
| `src/pages/AdminPanel.jsx` | Modified | 1 | 1 | +1/-1 |
| `src/pages/AgentDashboard.jsx` | Modified | 1 | 1 | +1/-1 |

### What changed per file

- **`src/pages/OwnerDashboard.jsx`** — modified page. +3/-3 lines.
- **`src/pages/AdminGovernance.jsx`** — modified page. +1/-1 lines.
- **`src/pages/AdminPanel.jsx`** — modified page. +1/-1 lines.
- **`src/pages/AgentDashboard.jsx`** — modified page. +1/-1 lines.

## Detailed Diff Analysis

- **Areas touched:** page (4 files, +6/-6).
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Empty band under dashboards after the chrome changes.

## Was It Useful

Useful. Layout fix.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0773 — Add Nav and Footer Toggles to the Admin Matrix.
- **Precedes:** 0775 — Pin Owner Drawer Header Actions and Scroll the Nav Internally.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
