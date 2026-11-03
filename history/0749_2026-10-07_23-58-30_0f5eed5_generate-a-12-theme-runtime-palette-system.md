# Commit 0749 — 0f5eed5

| Field | Value |
|-------|-------|
| **Commit Number** | 0749 |
| **Commit Hash** | 0f5eed5bfcfc5fd55101c39898ead01dccc46048 |
| **Parent Hash** | 26d8d84d6acaf41d3693f341451ee18dd9a70073 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-07 23:58:30 |
| **Branch** | main |
| **Files Changed** | 69 |
| **Additions** | 50023 |
| **Deletions** | 2529 |
| **Net Change** | +47494 |
| **Merge Commit** | No |

## Generate a 12-Theme Runtime Palette System

A generator maps the blue template's 838 tokens to theme roles and emits twelve theme stylesheets plus authored overlays; Tailwind utilities resolve through `var(--theme-…)` for runtime re-skinning.

Original commit message: “12-theme runtime palette system with authored overlays for all themes”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/theme/themes/tokens.json` | Added | 11339 | 0 | +11339/-0 |
| `src/theme/themes/solaris.css` | Added | 2596 | 0 | +2596/-0 |
| `src/theme/themes/arctic.css` | Added | 2491 | 0 | +2491/-0 |
| `src/theme/themes/blurple.css` | Added | 2463 | 0 | +2463/-0 |
| `src/theme/themes/mono.css` | Added | 2240 | 0 | +2240/-0 |
| `src/theme/themes/violet.css` | Added | 2117 | 0 | +2117/-0 |
| `src/theme/themes/plasma.css` | Added | 2051 | 0 | +2051/-0 |
| `src/theme/themes/sapphire.css` | Added | 1987 | 0 | +1987/-0 |
| `src/theme/themes/crimson.css` | Added | 1851 | 0 | +1851/-0 |
| `src/theme/themes/aurora.css` | Added | 1717 | 0 | +1717/-0 |
| `src/theme/themes/emerald.css` | Added | 1543 | 0 | +1543/-0 |
| `scripts/solaris-overlay.css` | Added | 1464 | 0 | +1464/-0 |
| `src/theme/themes/forest.css` | Added | 1439 | 0 | +1439/-0 |
| `scripts/arctic-overlay.css` | Added | 1359 | 0 | +1359/-0 |
| `scripts/blurple-overlay.css` | Added | 1331 | 0 | +1331/-0 |
| `scripts/mono-overlay.css` | Added | 1108 | 0 | +1108/-0 |
| `src/pages/admin/sections/AdminPlatformSection.jsx` | Modified | 518 | 501 | +518/-501 |
| `scripts/violet-overlay.css` | Added | 985 | 0 | +985/-0 |
| `scripts/plasma-overlay.css` | Added | 919 | 0 | +919/-0 |
| `src/theme/themes/blue-overlay.css` | Added | 880 | 0 | +880/-0 |
| `scripts/blue-overlay.css` | Added | 879 | 0 | +879/-0 |
| `scripts/sapphire-overlay.css` | Added | 855 | 0 | +855/-0 |
| `scripts/crimson-overlay.css` | Added | 719 | 0 | +719/-0 |
| `src/pages/BuyerRequestManagement.jsx` | Modified | 307 | 318 | +307/-318 |
| `scripts/aurora-overlay.css` | Added | 585 | 0 | +585/-0 |
| `scripts/generate-themes.py` | Added | 482 | 0 | +482/-0 |
| `src/pages/TexHub.jsx` | Modified | 234 | 240 | +234/-240 |
| `scripts/emerald-overlay.css` | Added | 411 | 0 | +411/-0 |
| `tests/unit/themeRegression.test.js` | Modified | 326 | 18 | +326/-18 |
| `src/pages/Pricing.jsx` | Modified | 174 | 157 | +174/-157 |
| `src/pages/OrderManagement.jsx` | Modified | 227 | 90 | +227/-90 |
| `scripts/forest-overlay.css` | Added | 311 | 0 | +311/-0 |
| `scripts/theme_specs.py` | Added | 282 | 0 | +282/-0 |
| `src/pages/NotificationsCenter.jsx` | Modified | 130 | 128 | +130/-128 |
| `src/pages/About.jsx` | Modified | 119 | 119 | +119/-119 |
| `src/components/profile/CrmSummaryPanel.jsx` | Modified | 97 | 97 | +97/-97 |
| `src/pages/auth/Login.jsx` | Modified | 97 | 97 | +97/-97 |
| `src/pages/auth/Signup.jsx` | Modified | 98 | 95 | +98/-95 |
| `src/components/chat/AttachmentPreviewModal.jsx` | Modified | 90 | 92 | +90/-92 |
| `src/pages/auth/OnboardingPage.jsx` | Modified | 88 | 88 | +88/-88 |
| … 29 more files | — | 1114 | 489 | (smaller changes) |

### What changed per file

- **`src/theme/themes/tokens.json`** — added styling/theme. +11339/-0 lines.
- **`src/theme/themes/solaris.css`** — added styling/theme. +2596/-0 lines.
- **`src/theme/themes/arctic.css`** — added styling/theme. +2491/-0 lines.
- **`src/theme/themes/blurple.css`** — added styling/theme. +2463/-0 lines.
- **`src/theme/themes/mono.css`** — added styling/theme. +2240/-0 lines.
- **`src/theme/themes/violet.css`** — added styling/theme. +2117/-0 lines.
- **`src/theme/themes/plasma.css`** — added styling/theme. +2051/-0 lines.
- **`src/theme/themes/sapphire.css`** — added styling/theme. +1987/-0 lines.
- **`src/theme/themes/crimson.css`** — added styling/theme. +1851/-0 lines.
- **`src/theme/themes/aurora.css`** — added styling/theme. +1717/-0 lines.
- **`src/theme/themes/emerald.css`** — added styling/theme. +1543/-0 lines.
- **`scripts/solaris-overlay.css`** — added styling/theme. +1464/-0 lines.

## Detailed Diff Analysis

- **Areas touched:** styling/theme (29 files, +45823/-1), page (20 files, +2275/-2109), tooling script (4 files, +890/-0), component (9 files, +509/-370), test (1 file, +326/-18), frontend library (3 files, +92/-27), documentation (1 file, +97/-0), other (2 files, +11/-4).
- **Function added** (12): `openThemeSwitcher`, `ThemeSwitcher`, `onKey`, `onOpen`, `onEsc`, `trackThemeHotkey`, `createThemeHotkeyState`, `getInitialThemeName`, `applyThemeToDOM`, `setThemeNameBySlug` …
- **Function removed** (2): `applyThemeToDOM`, `setThemeName`
- **Test case added** (22): `runtime sets data-theme + data-mode (slice, provider, boot script)`, `registry lists all 12 themes with blue as default`, `every non-blue theme ships a complete scoped file`, `blue personality is preserved byte-for-byte as the reference`, `aurora authored overlay wins over generated approximations`, `violet authored overlay: true violet brand, scoped, no leaks`, `blue authored overlay: scoped file, base file untouched`, `sapphire/arctic/emerald/blurple authored overlays win`, `mono authored overlay: obsidian neutrals + whisper system`, `plasma authored overlay: four distinct neon roles` …
- **Tests:** 1 test file(s) changed: `tests/unit/themeRegression.test.js`

## Why This Change Was Needed

Offer selectable colour themes without per-component code (inference).

## Was It Useful

Mixed. Works, but every theme shipped in the main CSS (≈1.1 MB raw) until commit 6c0b27b2 split non-active themes out.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0748 — Consolidate the UI on One Deep Sky Blue Token Palette.
- **Precedes:** 0750 — Let the Theme Switcher List Scroll on Its Own (Attempt 1).

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
