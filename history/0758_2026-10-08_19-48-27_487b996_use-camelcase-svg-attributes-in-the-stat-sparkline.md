# Commit 0758 — 487b996

| Field | Value |
|-------|-------|
| **Commit Number** | 0758 |
| **Commit Hash** | 487b9964c714e2e8e9fd416b3eeed15a64956c27 |
| **Parent Hash** | 38a40d00a561b72a4c62d9420e23e4de554a08ad |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-08 19:48:27 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 3 |
| **Deletions** | 3 |
| **Net Change** | +0 |
| **Merge Commit** | No |

## Use camelCase SVG Attributes in the Stat Sparkline

Fixes SVG attribute names in JSX (e.g. `strokeWidth`).

Original commit message: “fix(a11y): camelCase SVG attrs in stat sparkline”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/pages/TexHub.jsx` | Modified | 3 | 3 | +3/-3 |

### What changed per file

- **`src/pages/TexHub.jsx`** — modified page. +3/-3 lines.

## Detailed Diff Analysis

- **Areas touched:** page (1 file, +3/-3).
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

React warnings / attributes ignored.

## Was It Useful

Useful. Small correctness fix.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0757 — Rebalance Landing Stat Cards with Status Pills and Sparklines.
- **Precedes:** 0759 — Enlarge Landing Stat and Feature Cards.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
