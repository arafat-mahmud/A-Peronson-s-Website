# Commit 0745 — 9e5e680

| Field | Value |
|-------|-------|
| **Commit Number** | 0745 |
| **Commit Hash** | 9e5e6803d751a2ea51080ef561bbea75687e22e2 |
| **Parent Hash** | 0404cf884ea75c5cac2ff08ab13368a31e5306af |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-06 01:37:17 |
| **Branch** | main |
| **Files Changed** | 3 |
| **Additions** | 16 |
| **Deletions** | 17 |
| **Net Change** | -1 |
| **Merge Commit** | No |

## Self-Host Inter and Wire It Into Tailwind v4

Adds `@font-face` for a same-origin Inter woff2, sets `--font-sans`, preloads the font and removes the Google Fonts request chain.

Original commit message: “perf: self-host Inter, wire Tailwind v4 font-sans, drop Google Fonts”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `index.html` | Modified | 5 | 17 | +5/-17 |
| `src/tailwind.css` | Modified | 11 | 0 | +11/-0 |
| `public/fonts/inter-latin.woff2` | Added | - | - | binary |

### What changed per file

- **`index.html`** — modified other. +5/-17 lines.
- **`src/tailwind.css`** — modified styling/theme. +11/-0 lines.
- **`public/fonts/inter-latin.woff2`** — added static asset. binary content (not diffable).

## Detailed Diff Analysis

- **Areas touched:** other (1 file, +5/-17), styling/theme (1 file, +11/-0), static asset (1 file, +0/-0).
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

`tailwind.config.js` is ignored by Tailwind v4 without `@config`, so Inter never applied; Google Fonts also added a render-blocking hop.

## Was It Useful

Useful. Correct typography and one fewer third-party dependency.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0744 — Paint the Hero on Mount with a Faster Headline Stagger.
- **Precedes:** 0746 — Precache Only the App Shell in the Service Worker.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: `public/fonts/inter-latin.woff2`.
- Build output (`dist/`) files: 0.
