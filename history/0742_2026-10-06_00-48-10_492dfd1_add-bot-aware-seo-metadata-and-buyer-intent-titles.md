# Commit 0742 — 492dfd1

| Field | Value |
|-------|-------|
| **Commit Number** | 0742 |
| **Commit Hash** | 492dfd117e92261ea4b36b18a8629aca00bfb3f5 |
| **Parent Hash** | 37649b43b7d4ccd57f67016a734de291e1e149fc |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-06 00:48:10 |
| **Branch** | main |
| **Files Changed** | 18 |
| **Additions** | 298 |
| **Deletions** | 75 |
| **Net Change** | +223 |
| **Merge Commit** | No |

## Add Bot-Aware SEO Metadata and Buyer-Intent Titles

The server injects per-route title/description/OG/canonical tags for crawlers on eight public paths; titles and H1s are keyword-mapped (garment sourcing, Bangladesh); auth and secret pages get noindex; shared posts get dynamic OG; footer/home link to key pages; robots and sitemaps are refreshed.

Original commit message: “feat: SEO next level — bot-aware meta, buyer-intent titles, link equity”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/seo/botMeta.js` | Added | 176 | 0 | +176/-0 |
| `public/sitemaps/pages.xml` | Deleted | 0 | 51 | +0/-51 |
| `public/robots.txt` | Modified | 30 | 0 | +30/-0 |
| `src/pages/TexHub.jsx` | Modified | 20 | 3 | +20/-3 |
| `src/pages/SharedPost.jsx` | Modified | 19 | 0 | +19/-0 |
| `public/pages.xml` | Modified | 8 | 8 | +8/-8 |
| `server/routes/seoRoutes.js` | Modified | 11 | 1 | +11/-1 |
| `src/components/Footer.jsx` | Modified | 10 | 1 | +10/-1 |
| `src/lib/routeHealthCheck.js` | Modified | 6 | 2 | +6/-2 |
| `src/pages/Pricing.jsx` | Modified | 3 | 3 | +3/-3 |
| `src/lib/routes.js` | Modified | 5 | 0 | +5/-0 |
| `src/pages/HelpCenter.jsx` | Modified | 3 | 2 | +3/-2 |
| `src/pages/About.jsx` | Modified | 2 | 2 | +2/-2 |
| `public/sitemap.xml` | Modified | 1 | 1 | +1/-1 |
| `src/pages/auth/SignupUltra.jsx` | Modified | 1 | 1 | +1/-1 |
| `src/pages/AccessDenied.jsx` | Modified | 1 | 0 | +1/-0 |
| `src/pages/auth/Login.jsx` | Modified | 1 | 0 | +1/-0 |
| `src/pages/auth/Signup.jsx` | Modified | 1 | 0 | +1/-0 |

### What changed per file

- **`server/seo/botMeta.js`** — added server. function added: `loadShell`; function added: `escapeAttr`; function added: `replaceFirst`; function added: `injectBotMeta`; function added: `botMetaMiddleware`.
- **`public/sitemaps/pages.xml`** — deleted static asset. +0/-51 lines.
- **`public/robots.txt`** — modified static asset. +30/-0 lines.
- **`src/pages/TexHub.jsx`** — modified page. +20/-3 lines.
- **`src/pages/SharedPost.jsx`** — modified page. +19/-0 lines.
- **`public/pages.xml`** — modified static asset. +8/-8 lines.
- **`server/routes/seoRoutes.js`** — modified API route. +11/-1 lines.
- **`src/components/Footer.jsx`** — modified component. +10/-1 lines.
- **`src/lib/routeHealthCheck.js`** — modified frontend library. +6/-2 lines.
- **`src/pages/Pricing.jsx`** — modified page. +3/-3 lines.
- **`src/lib/routes.js`** — modified frontend library. +5/-0 lines.
- **`src/pages/HelpCenter.jsx`** — modified page. +3/-2 lines.

## Detailed Diff Analysis

- **Areas touched:** server (1 file, +176/-0), static asset (4 files, +39/-60), page (9 files, +51/-11), frontend library (2 files, +11/-2), API route (1 file, +11/-1), component (1 file, +10/-1).
- **Function added** (5): `loadShell`, `escapeAttr`, `replaceFirst`, `injectBotMeta`, `botMetaMiddleware`
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Search visibility for buyer-intent queries (inferred from the commit body).

## Was It Useful

Useful. One gap: the home H1 copy was changed in the client but not in `/api/system/home`, which overwrote it after load until commit 6c0b27b2.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths. API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0741 — Add a Reachability Fallback Chain to the Heartbeat.
- **Precedes:** 0743 — Render the Homepage Immediately and Refresh Data in Background.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
