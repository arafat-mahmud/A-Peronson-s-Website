# Commit 0744 — 0404cf8

| Field | Value |
|-------|-------|
| **Commit Number** | 0744 |
| **Commit Hash** | 0404cf884ea75c5cac2ff08ab13368a31e5306af |
| **Parent Hash** | 59dee48fcddf9ed1e29a137be324b1a30b7f112e |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-06 01:21:10 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 3 |
| **Deletions** | 4 |
| **Net Change** | -1 |
| **Merge Commit** | No |

## Paint the Hero on Mount with a Faster Headline Stagger

The hero stagger uses `animate` on mount instead of `whileInView`, and the per-character headline animation is shortened (0.012 s → 0.005 s stagger, 0.8 s → 0.45 s duration).

Original commit message: “perf: hero paints on mount, faster headline stagger”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/pages/TexHub.jsx` | Modified | 3 | 4 | +3/-4 |

### What changed per file

- **`src/pages/TexHub.jsx`** — modified page. +3/-4 lines.

## Detailed Diff Analysis

- **Areas touched:** page (1 file, +3/-4).
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

The full H1 took about 1.9 s to appear.

## Was It Useful

Useful. Faster first meaningful paint of the headline.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0743 — Render the Homepage Immediately and Refresh Data in Background.
- **Precedes:** 0745 — Self-Host Inter and Wire It Into Tailwind v4.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
