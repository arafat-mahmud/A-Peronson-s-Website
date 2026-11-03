# Commit 0736 — 1d4a4a6

| Field | Value |
|-------|-------|
| **Commit Number** | 0736 |
| **Commit Hash** | 1d4a4a65ade1740269a5cf0d37dcfc003616b9d2 |
| **Parent Hash** | a2d9ca4655fcfabda1f6053bf3afb3a79ab41388 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-05 13:58:13 |
| **Branch** | main |
| **Files Changed** | 4 |
| **Additions** | 52 |
| **Deletions** | 3 |
| **Net Change** | +49 |
| **Merge Commit** | No |

## Render Uploaded Profile Covers with Random Wallpaper Fallback

FactoryProfile now shows the uploaded cover instead of a static gradient. A new `useFallbackCover` hook fetches a random blue wallpaper (Wallhaven) per view when no cover exists, on Factory, Buyer and Buying House profiles.

Original commit message: “feat: banner upload wiring plus Wallhaven random fallback covers”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/lib/fallbackCover.js` | Added | 30 | 0 | +30/-0 |
| `src/pages/FactoryProfile.jsx` | Modified | 9 | 1 | +9/-1 |
| `src/pages/BuyerProfile.jsx` | Modified | 9 | 0 | +9/-0 |
| `src/pages/BuyingHouseProfile.jsx` | Modified | 4 | 2 | +4/-2 |

### What changed per file

- **`src/lib/fallbackCover.js`** — added frontend library. function added: `useFallbackCover`.
- **`src/pages/FactoryProfile.jsx`** — modified page. +9/-1 lines.
- **`src/pages/BuyerProfile.jsx`** — modified page. +9/-0 lines.
- **`src/pages/BuyingHouseProfile.jsx`** — modified page. +4/-2 lines.

## Detailed Diff Analysis

- **Areas touched:** frontend library (1 file, +30/-0), page (3 files, +22/-3).
- **Function added** (1): `useFallbackCover`
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Uploaded covers were ignored on factory profiles, and empty covers looked bare.

## Was It Useful

Mixed. Uploaded covers now work, but the third-party fallback was later found to be CORS-blocked and replaced by a local SVG (commit 1879ed8b).

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0735 — Polish Profiles, Tabs and KPI Grids from the Video Audit.
- **Precedes:** 0737 — Call the Fallback-Cover Hook Before Early Returns.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
