# Commit 0787 — 1f8d7bb

| Field | Value |
|-------|-------|
| **Commit Number** | 0787 |
| **Commit Hash** | 1f8d7bb73d7b1b6f5119f59c303178297313e5b2 |
| **Parent Hash** | 7adec7d4b933f1562ad8c9f1cf2b76ed23f701b1 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-17 23:16:54 |
| **Branch** | main |
| **Files Changed** | 13 |
| **Additions** | 152 |
| **Deletions** | 68 |
| **Net Change** | +84 |
| **Merge Commit** | No |

## Free the Member Permission Matrix and Cap Free Seats at Three

Removes Premium locks on the permission matrix and per-member editing, caps free plans at three seats, fixes owner/admin entitlements, adds a backfill script and tests; adjusts the pre-commit hook.

Original commit message: “fix(members): permission matrix free on every plan, seat cap 3, owner/admin entitlements”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/services/entitlementService.js` | Modified | 34 | 27 | +34/-27 |
| `scripts/db/backfill-free-agent-limit.mjs` | Added | 44 | 0 | +44/-0 |
| `server/controllers/memberController.js` | Modified | 3 | 20 | +3/-20 |
| `tests/unit/server-member-limits.test.js` | Added | 21 | 0 | +21/-0 |
| `src/pages/MemberManagement.jsx` | Modified | 10 | 7 | +10/-7 |
| `.husky/pre-commit` | Modified | 7 | 8 | +7/-8 |
| `AGENTS.md` | Modified | 15 | 0 | +15/-0 |
| `tests/unit/server-entitlements.test.js` | Modified | 11 | 0 | +11/-0 |
| `src/pages/Pricing.jsx` | Modified | 3 | 3 | +3/-3 |
| `docs/server/Member.md` | Modified | 1 | 1 | +1/-1 |
| `server/services/adminConfigService.js` | Modified | 1 | 1 | +1/-1 |
| `server/services/memberService.js` | Modified | 1 | 1 | +1/-1 |
| `package.json` | Modified | 1 | 0 | +1/-0 |

### What changed per file

- **`server/services/entitlementService.js`** — modified server service. +34/-27 lines.
- **`scripts/db/backfill-free-agent-limit.mjs`** — added tooling script. function added: `run`.
- **`server/controllers/memberController.js`** — modified API controller. +3/-20 lines.
- **`tests/unit/server-member-limits.test.js`** — added test. test case added: `free member limit defaults to 3 when no admin config is stored`.
- **`src/pages/MemberManagement.jsx`** — modified page. +10/-7 lines.
- **`.husky/pre-commit`** — modified configuration. +7/-8 lines.
- **`AGENTS.md`** — modified documentation. +15/-0 lines.
- **`tests/unit/server-entitlements.test.js`** — modified test. test case added: `owner and admin on premium get team_access_management`.
- **`src/pages/Pricing.jsx`** — modified page. +3/-3 lines.
- **`docs/server/Member.md`** — modified documentation. +1/-1 lines.
- **`server/services/adminConfigService.js`** — modified server service. +1/-1 lines.
- **`server/services/memberService.js`** — modified server service. +1/-1 lines.

## Detailed Diff Analysis

- **Areas touched:** server service (3 files, +36/-29), tooling script (1 file, +44/-0), test (2 files, +32/-0), API controller (1 file, +3/-20), page (2 files, +13/-10), documentation (2 files, +16/-1), configuration (1 file, +7/-8), dependencies (1 file, +1/-0).
- **Function added** (1): `run`
- **Test case added** (2): `owner and admin on premium get team_access_management`, `free member limit defaults to 3 when no admin config is stored`
- **Tests:** 2 test file(s) changed: `tests/unit/server-entitlements.test.js`, `tests/unit/server-member-limits.test.js`

## Why This Change Was Needed

Gating the matrix only blocked teams already bounded by the seat cap.

## Was It Useful

Useful. Clearer plan rules.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths. API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. Build/deploy or tooling configuration changes. Dependency set changes; a fresh install is required.

## Relationship to Surrounding Commits

- **Follows:** 0786 — Fix Feed Author Links, Verified Badges and Public Lookup Privacy; Untrack .env.
- **Precedes:** 0788 — Refresh the Codebase Atlas.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
