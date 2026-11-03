# Commit 0747 — 15db15b

| Field | Value |
|-------|-------|
| **Commit Number** | 0747 |
| **Commit Hash** | 15db15b65cceb12507510d182592d810db95c4c1 |
| **Parent Hash** | 2b2849658b2b578099a98eba57f8e88b7689061a |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-06 09:46:17 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 6 |
| **Deletions** | 8 |
| **Net Change** | -2 |
| **Merge Commit** | No |

## Fix Lighthouse Accessibility Findings on the Homepage

The theme toggle's aria-label now contains its visible text, redundant CTA aria-labels are removed, and the step badge keeps passing contrast colours.

Original commit message: “fix: Lighthouse a11y — label mismatch + step badge contrast”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/pages/TexHub.jsx` | Modified | 5 | 7 | +5/-7 |
| `src/components/NavBar.jsx` | Modified | 1 | 1 | +1/-1 |

### What changed per file

- **`src/pages/TexHub.jsx`** — modified page. +5/-7 lines.
- **`src/components/NavBar.jsx`** — modified component. +1/-1 lines.

## Detailed Diff Analysis

- **Areas touched:** page (1 file, +5/-7), component (1 file, +1/-1).
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Lighthouse accessibility failures (label-in-name and contrast).

## Was It Useful

Useful. Small accessibility gains.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0746 — Precache Only the App Shell in the Service Worker.
- **Precedes:** 0748 — Consolidate the UI on One Deep Sky Blue Token Palette.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
