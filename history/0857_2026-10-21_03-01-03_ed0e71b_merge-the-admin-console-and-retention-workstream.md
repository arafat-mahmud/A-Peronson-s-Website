# Commit 0857 — ed0e71b

| Field | Value |
|-------|-------|
| **Commit Number** | 0857 |
| **Commit Hash** | ed0e71b9923fe9c7f3e31d652b3f7fcba225a0a6 |
| **Parent Hash** | 51e43437eb24b83f3245a51f1acf67c5a3d24065, 91723062246393c790fad6e587452ccd7ae29d71 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 03:01:03 |
| **Branch** | main |
| **Files Changed** | 5 |
| **Additions** | 2354 |
| **Deletions** | 1 |
| **Net Change** | +2353 |
| **Merge Commit** | Yes |

## Merge the Admin Console and Retention Workstream

Merge commit bringing WS5 (admin console, retention, isolation tests).

Original commit message: “merge: WS5 admin console and retention (feat/ws5-admin-retention)”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/integration/support-case-isolation.test.js` | Added | 916 | 0 | +916/-0 |
| `server/workers/caseRetentionWorker.js` | Added | 441 | 0 | +441/-0 |
| `src/pages/admin/sections/AdminPlatformSection.jsx` | Modified | 409 | 1 | +409/-1 |
| `tests/unit/server-case-retention.test.js` | Added | 402 | 0 | +402/-0 |
| `server/routes/adminRoutes.js` | Modified | 186 | 0 | +186/-0 |

### What changed per file

- **`tests/integration/support-case-isolation.test.js`** — added test. function added: `equalsValue`; function added: `matchesOperator`; function added: `matchField`; function added: `matchesWhere`; function added: `sortRows`; function added: `project` ….
- **`server/workers/caseRetentionWorker.js`** — added server. function added: `retentionDays`; function added: `retentionIntervalMs`; function added: `normalizeNow`; function added: `isLiveStatus`; function added: `isRetained`; function added: `shouldSweep` ….
- **`src/pages/admin/sections/AdminPlatformSection.jsx`** — modified page. function added: `pickSupportCaseReport`; function added: `collectSupportCaseToolLog`.
- **`tests/unit/server-case-retention.test.js`** — added test. function added: `daysAgo`; function added: `caseRow`; function added: `writeProbe`; function added: `stillThere`; test case added: `defaults to 90 days`; test case added: `honours CASE_RETENTION_DAYS` ….
- **`server/routes/adminRoutes.js`** — modified API route. function added: `listSupportCasesHandler`; function added: `getSupportCaseHandler`; function added: `escalateSupportCaseHandler`; function added: `rerunSupportCaseHandler`; function added: `loadInvestigationEnqueuer`.

## Detailed Diff Analysis

- **Areas touched:** test (2 files, +1318/-0), server (1 file, +441/-0), page (1 file, +409/-1), API route (1 file, +186/-0).
- **Function added** (35): `listSupportCasesHandler`, `getSupportCaseHandler`, `escalateSupportCaseHandler`, `rerunSupportCaseHandler`, `loadInvestigationEnqueuer`, `retentionDays`, `retentionIntervalMs`, `normalizeNow`, `isLiveStatus`, `isRetained` …
- **Test case added** (42): `client A cannot read client B`, `client A`, `client A cannot post to client B`, `client A cannot delete client B`, `the owner of the case can read it - the 403 above is about the caller`, `the owner can open a case and post to it - 201`, `none of client B`, `client A cannot sign client B`, `client A cannot attach client B`, `client A cannot fetch client B` …
- **Tests:** 2 test file(s) changed: `tests/integration/support-case-isolation.test.js`, `tests/unit/server-case-retention.test.js`
- **Merge:** diff shown against the first parent; the content was authored in the merged branch's commits.

## Why This Change Was Needed

Integrate parallel branch.

## Was It Useful

Neutral. Merge.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths. API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. As a merge, its effect equals that of the merged branch commits.

## Relationship to Surrounding Commits

- **Follows:** 0856 — Merge the Report and Email Delivery Workstream.
- **Precedes:** 0858 — Merge the Support Client Chat UI Workstream.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
