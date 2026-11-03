# Commit 0751 — f107dd5

| Field | Value |
|-------|-------|
| **Commit Number** | 0751 |
| **Commit Hash** | f107dd5f548986d18d6a30b1fc014154b63cf1a6 |
| **Parent Hash** | cdf55ea730ad82885b4ce190f881b4639e6b8cbe |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-08 00:55:42 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 22 |
| **Deletions** | 1 |
| **Net Change** | +21 |
| **Merge Commit** | No |

## Let the Theme Switcher List Scroll on Its Own (Completed)

Completes the independent scrolling for the theme list and adds a regression test.

Original commit message: “fix(theme): theme switcher list scrolls independently of page”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/components/ThemeSwitcher.jsx` | Modified | 13 | 0 | +13/-0 |
| `tests/unit/themeRegression.test.js` | Modified | 9 | 1 | +9/-1 |

### What changed per file

- **`src/components/ThemeSwitcher.jsx`** — modified component. +13/-0 lines.
- **`tests/unit/themeRegression.test.js`** — modified test. test case added: `ThemeSwitcher list is scroll-contained (lenis opt-out + body lock)`.

## Detailed Diff Analysis

- **Areas touched:** component (1 file, +13/-0), test (1 file, +9/-1).
- **Test case added** (1): `ThemeSwitcher list is scroll-contained (lenis opt-out + body lock)`
- **Tests:** 1 test file(s) changed: `tests/unit/themeRegression.test.js`

## Why This Change Was Needed

The first attempt did not fully fix the scroll capture.

## Was It Useful

Useful. Fix plus test.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0750 — Let the Theme Switcher List Scroll on Its Own (Attempt 1).
- **Precedes:** 0752 — Nudge a Service-Worker Update When a Hashed Asset 404s.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
