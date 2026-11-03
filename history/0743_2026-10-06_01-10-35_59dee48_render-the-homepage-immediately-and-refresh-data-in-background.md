# Commit 0743 — 59dee48

| Field | Value |
|-------|-------|
| **Commit Number** | 0743 |
| **Commit Hash** | 59dee48fcddf9ed1e29a137be324b1a30b7f112e |
| **Parent Hash** | 492dfd117e92261ea4b36b18a8629aca00bfb3f5 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-06 01:10:35 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 3 |
| **Deletions** | 11 |
| **Net Change** | -8 |
| **Merge Commit** | No |

## Render the Homepage Immediately and Refresh Data in Background

Removes the full-page loader gated on `/system/home`; the hero renders from static fallbacks and API numbers patch in later.

Original commit message: “perf: homepage renders instantly, API refreshes in background”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/pages/TexHub.jsx` | Modified | 3 | 11 | +3/-11 |

### What changed per file

- **`src/pages/TexHub.jsx`** — modified page. +3/-11 lines.

## Detailed Diff Analysis

- **Areas touched:** page (1 file, +3/-11).
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

LCP was about 19 s on a cold backend because nothing painted until the API answered.

## Was It Useful

Useful. Large perceived-performance win.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0742 — Add Bot-Aware SEO Metadata and Buyer-Intent Titles.
- **Precedes:** 0744 — Paint the Hero on Mount with a Faster Headline Stagger.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
