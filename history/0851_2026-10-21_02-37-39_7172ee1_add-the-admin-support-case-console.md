# Commit 0851 — 7172ee1

| Field | Value |
|-------|-------|
| **Commit Number** | 0851 |
| **Commit Hash** | 7172ee11ad69652640253aa32bfa355c71f9652e |
| **Parent Hash** | ed8b69b30ba9058b60a9078bf712cda836f10b03 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 02:37:39 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 595 |
| **Deletions** | 1 |
| **Net Change** | +594 |
| **Merge Commit** | No |

## Add the Admin Support Case Console

Admin endpoints and a review view for cases.

Original commit message: “feat(support): admin case console endpoints and case review view”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/pages/admin/sections/AdminPlatformSection.jsx` | Modified | 409 | 1 | +409/-1 |
| `server/routes/adminRoutes.js` | Modified | 186 | 0 | +186/-0 |

### What changed per file

- **`src/pages/admin/sections/AdminPlatformSection.jsx`** — modified page. function added: `pickSupportCaseReport`; function added: `collectSupportCaseToolLog`.
- **`server/routes/adminRoutes.js`** — modified API route. function added: `listSupportCasesHandler`; function added: `getSupportCaseHandler`; function added: `escalateSupportCaseHandler`; function added: `rerunSupportCaseHandler`; function added: `loadInvestigationEnqueuer`.

## Detailed Diff Analysis

- **Areas touched:** page (1 file, +409/-1), API route (1 file, +186/-0).
- **Function added** (7): `listSupportCasesHandler`, `getSupportCaseHandler`, `escalateSupportCaseHandler`, `rerunSupportCaseHandler`, `loadInvestigationEnqueuer`, `pickSupportCaseReport`, `collectSupportCaseToolLog`
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Operators need to review cases and reports.

## Was It Useful

Useful.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths. API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0850 — Turn the Support Page into a Chat-First Investigation Flow.
- **Precedes:** 0852 — Prove Clients Cannot Reach Each Other's Cases.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
