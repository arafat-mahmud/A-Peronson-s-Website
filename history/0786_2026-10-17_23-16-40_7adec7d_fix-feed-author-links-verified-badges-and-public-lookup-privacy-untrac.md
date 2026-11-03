# Commit 0786 — 7adec7d

| Field | Value |
|-------|-------|
| **Commit Number** | 0786 |
| **Commit Hash** | 7adec7d4b933f1562ad8c9f1cf2b76ed23f701b1 |
| **Parent Hash** | c1f5bbda769ba85930ac1e7489140e9bd50228b7 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-17 23:16:40 |
| **Branch** | main |
| **Files Changed** | 7 |
| **Additions** | 208 |
| **Deletions** | 86 |
| **Net Change** | +122 |
| **Merge Commit** | No |

## Fix Feed Author Links, Verified Badges and Public Lookup Privacy; Untrack .env

Feed author names resolve to real profile routes, all feed tabs request `type=all`, the verified badge shows only for verified accounts, and the public user lookup returns fewer fields; tests added. The commit also deletes the tracked `.env` file from the repository.

Original commit message: “fix(feed,profile): company identity, verified-only badge, public lookup privacy”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/server-user-lookup.test.js` | Added | 84 | 0 | +84/-0 |
| `server/services/userService.js` | Modified | 61 | 0 | +61/-0 |
| `src/pages/ProfilePage.jsx` | Modified | 30 | 31 | +30/-31 |
| `.env` | Deleted | 0 | 43 | +0/-43 |
| `server/services/feedService.js` | Modified | 22 | 2 | +22/-2 |
| `src/pages/MainFeed.jsx` | Modified | 9 | 8 | +9/-8 |
| `server/controllers/userController.js` | Modified | 2 | 2 | +2/-2 |

### What changed per file

- **`tests/unit/server-user-lookup.test.js`** — added test. test case added: `company display name prefers organization_name over personal name`; test case added: `stranger sees company data but no email/username/phone`; test case added: `self, platform admin, and same-org members keep contact fields`; test case added: `lookup attaches capacity for company accounts`; test case added: `owner-declared profile capacity wins over the agent count`.
- **`server/services/userService.js`** — modified server service. function added: `companyDisplayName`; function added: `isSameOrg`; function added: `shapeLookupUser`; function added: `lookupPublicUsers`.
- **`src/pages/ProfilePage.jsx`** — modified page. +30/-31 lines.
- **`.env`** — deleted configuration. +0/-43 lines.
- **`server/services/feedService.js`** — modified server service. +22/-2 lines.
- **`src/pages/MainFeed.jsx`** — modified page. +9/-8 lines.
- **`server/controllers/userController.js`** — modified API controller. +2/-2 lines.

## Detailed Diff Analysis

- **Areas touched:** server service (2 files, +83/-2), test (1 file, +84/-0), page (2 files, +39/-39), configuration (1 file, +0/-43), API controller (1 file, +2/-2).
- **Function added** (4): `companyDisplayName`, `isSameOrg`, `shapeLookupUser`, `lookupPublicUsers`
- **Test case added** (5): `company display name prefers organization_name over personal name`, `stranger sees company data but no email/username/phone`, `self, platform admin, and same-org members keep contact fields`, `lookup attaches capacity for company accounts`, `owner-declared profile capacity wins over the agent count`
- **Tests:** 1 test file(s) changed: `tests/unit/server-user-lookup.test.js`

## Why This Change Was Needed

Dead author links (404), wrong badges and over-exposed lookup data. The `.env` removal stops further tracking, but its contents remain in the (public) git history — see Confidence notes.

## Was It Useful

Useful. Note: removing `.env` from the tree does not remove it from history; credentials it held should be considered exposed.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths. API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. Build/deploy or tooling configuration changes.

## Relationship to Surrounding Commits

- **Follows:** 0785 — Rename Org Settings to Settings with a Redirect.
- **Precedes:** 0787 — Free the Member Permission Matrix and Cap Free Seats at Three.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).
- Contains or removes credential-bearing files; values are deliberately not reproduced here.
## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
