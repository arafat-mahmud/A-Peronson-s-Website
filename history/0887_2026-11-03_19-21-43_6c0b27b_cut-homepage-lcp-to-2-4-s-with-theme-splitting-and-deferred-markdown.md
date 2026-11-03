# Commit 0887 — 6c0b27b

| Field | Value |
|-------|-------|
| **Commit Number** | 0887 |
| **Commit Hash** | 6c0b27b2007e5cdfd9b6dcff53fefe49209977b6 |
| **Parent Hash** | 697349bf58f725c4fe71ee775b989e6069f371f5 |
| **Author** | Tokyi |
| **Date/Time** | 2026-11-03 19:21:43 |
| **Branch** | fix/client-feedback-2026-11-03 |
| **Files Changed** | 11 |
| **Additions** | 273 |
| **Deletions** | 33 |
| **Net Change** | +240 |
| **Merge Commit** | No |

## Cut Homepage LCP to 2.4 s with Theme Splitting and Deferred Markdown

Only the active theme's CSS loads; the assistant's markdown/Prism bundle loads on demand; hero text no longer fades from opacity 0; first page skips the route fade; server home headline aligned with the SEO H1; lab tooling added.

Original commit message: “Cut home LCP to 2.4 s: load only the active theme, defer markdown, unblock hero paint”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `scripts/perf/serve-dist.mjs` | Added | 98 | 0 | +98/-0 |
| `scripts/perf/lab-benchmark.mjs` | Added | 79 | 0 | +79/-0 |
| `src/theme/loadThemeStyles.js` | Added | 33 | 0 | +33/-0 |
| `src/pages/TexHub.jsx` | Modified | 20 | 12 | +20/-12 |
| `src/tailwind.css` | Modified | 13 | 11 | +13/-11 |
| `src/components/chat/MarkdownMessage.jsx` | Modified | 9 | 5 | +9/-5 |
| `src/components/FloatingAssistant.jsx` | Modified | 7 | 3 | +7/-3 |
| `src/App.jsx` | Modified | 7 | 1 | +7/-1 |
| `server/controllers/systemController.js` | Modified | 2 | 1 | +2/-1 |
| `src/store/themeSlice.js` | Modified | 3 | 0 | +3/-0 |
| `src/lib/ThemeProvider.jsx` | Modified | 2 | 0 | +2/-0 |

### What changed per file

- **`scripts/perf/serve-dist.mjs`** — added tooling script. +98/-0 lines.
- **`scripts/perf/lab-benchmark.mjs`** — added tooling script. function added: `measure`.
- **`src/theme/loadThemeStyles.js`** — added styling/theme. function added: `ensureThemeStyles`.
- **`src/pages/TexHub.jsx`** — modified page. +20/-12 lines.
- **`src/tailwind.css`** — modified styling/theme. +13/-11 lines.
- **`src/components/chat/MarkdownMessage.jsx`** — modified component. component/const added: `CodeBlock`.
- **`src/components/FloatingAssistant.jsx`** — modified component. component/const added: `MarkdownMessage`.
- **`src/App.jsx`** — modified other. +7/-1 lines.
- **`server/controllers/systemController.js`** — modified API controller. +2/-1 lines.
- **`src/store/themeSlice.js`** — modified frontend library. +3/-0 lines.
- **`src/lib/ThemeProvider.jsx`** — modified frontend library. +2/-0 lines.

## Detailed Diff Analysis

- **Areas touched:** tooling script (2 files, +177/-0), styling/theme (2 files, +46/-11), page (1 file, +20/-12), component (2 files, +16/-8), other (1 file, +7/-1), frontend library (2 files, +5/-0), API controller (1 file, +2/-1).
- **Function added** (2): `measure`, `ensureThemeStyles`
- **Component/const added** (2): `MarkdownMessage`, `CodeBlock`
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Lab LCP 3.5 s on the homepage, above the 2.5 s target.

## Was It Useful

Useful. Measured improvement (before/after in the message).

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths. API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0886 — Add Revocable Sessions and Self-Service Password Reset.
- **Precedes:** 0888 — Close Contract-Signature Forgery and Free Premium Upgrade Holes.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
