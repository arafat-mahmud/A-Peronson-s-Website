# Commit 0785 — c1f5bbd

| Field | Value |
|-------|-------|
| **Commit Number** | 0785 |
| **Commit Hash** | c1f5bbda769ba85930ac1e7489140e9bd50228b7 |
| **Parent Hash** | 42a10979a5653f829042b3e93de3a34682a5659f |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-11 20:52:18 |
| **Branch** | main |
| **Files Changed** | 10 |
| **Additions** | 38 |
| **Deletions** | 30 |
| **Net Change** | +8 |
| **Merge Commit** | No |

## Rename Org Settings to Settings with a Redirect

Renames `OrgSettings.jsx` to `Settings.jsx`, routes `/org-settings` to `/settings` with a redirect, updates links.

Original commit message: “refactor(settings): rename org-settings to settings with redirect”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/pages/Settings.jsx` | Renamed from `src/pages/OrgSettings.jsx` | 7 | 8 | +7/-8 |
| `src/App.jsx` | Modified | 10 | 4 | +10/-4 |
| `src/pages/OwnerDashboard.jsx` | Modified | 7 | 7 | +7/-7 |
| `src/components/NavBar.jsx` | Modified | 4 | 4 | +4/-4 |
| `src/tasks.json` | Modified | 3 | 3 | +3/-3 |
| `src/pages/BuyerProfile.jsx` | Modified | 2 | 2 | +2/-2 |
| `src/components/OfflineStorageSection.jsx` | Modified | 1 | 1 | +1/-1 |
| `src/lib/routeHealthCheck.js` | Modified | 2 | 0 | +2/-0 |
| `src/pages/FactoryProfile.jsx` | Modified | 1 | 1 | +1/-1 |
| `src/lib/routes.js` | Modified | 1 | 0 | +1/-0 |

### What changed per file

- **`src/pages/Settings.jsx`** — renamed page. function removed: `OrgSettings`; function added: `Settings`.
- **`src/App.jsx`** — modified other. function added: `OrgSettingsRedirect`.
- **`src/pages/OwnerDashboard.jsx`** — modified page. +7/-7 lines.
- **`src/components/NavBar.jsx`** — modified component. +4/-4 lines.
- **`src/tasks.json`** — modified other. +3/-3 lines.
- **`src/pages/BuyerProfile.jsx`** — modified page. +2/-2 lines.
- **`src/components/OfflineStorageSection.jsx`** — modified component. +1/-1 lines.
- **`src/lib/routeHealthCheck.js`** — modified frontend library. +2/-0 lines.
- **`src/pages/FactoryProfile.jsx`** — modified page. +1/-1 lines.
- **`src/lib/routes.js`** — modified frontend library. +1/-0 lines.

## Detailed Diff Analysis

- **Areas touched:** page (4 files, +17/-18), other (2 files, +13/-7), component (2 files, +5/-5), frontend library (2 files, +3/-0).
- **Function added** (2): `OrgSettingsRedirect`, `Settings`
- **Function removed** (1): `OrgSettings`
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Name matched the client's wording; old links keep working.

## Was It Useful

Useful. Clean rename.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0784 — Move View Profile into the Feed Card Menu.
- **Precedes:** 0786 — Fix Feed Author Links, Verified Badges and Public Lookup Privacy; Untrack .env.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: `src/pages/Settings.jsx` (Renamed from `src/pages/OrgSettings.jsx`).
- Binary files: none.
- Build output (`dist/`) files: 0.
