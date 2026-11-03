# Commit 0831 — 76d4073

| Field | Value |
|-------|-------|
| **Commit Number** | 0831 |
| **Commit Hash** | 76d40734360056cb2a7d31eb5f7e069272652b75 |
| **Parent Hash** | a984ac1f7a2a83ff5de729a6820dc680ca8b767d |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-20 19:14:46 |
| **Branch** | main |
| **Files Changed** | 3 |
| **Additions** | 99 |
| **Deletions** | 71 |
| **Net Change** | +28 |
| **Merge Commit** | No |

## Drop the Unrunnable CI Spike Job and Gate Agent Permissions

Removes a CI workflow that could not run and tightens the permission set.

Original commit message: “fix(investigation): drop the unrunnable CI spike job, gate the agent permission set”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/services/investigation/runtimeConfig.js` | Modified | 48 | 25 | +48/-25 |
| `tests/unit/server-investigation-runtime-config.test.js` | Modified | 51 | 1 | +51/-1 |
| `.github/workflows/investigation-spike.yml` | Deleted | 0 | 45 | +0/-45 |

### What changed per file

- **`server/services/investigation/runtimeConfig.js`** — modified server service. function added: `normalizePermissionSources`.
- **`tests/unit/server-investigation-runtime-config.test.js`** — modified test. test case added: `the investigator`.
- **`.github/workflows/investigation-spike.yml`** — deleted configuration. +0/-45 lines.

## Detailed Diff Analysis

- **Areas touched:** server service (1 file, +48/-25), test (1 file, +51/-1), configuration (1 file, +0/-45).
- **Function added** (1): `normalizePermissionSources`
- **Test case added** (1): `the investigator`
- **Tests:** 1 test file(s) changed: `tests/unit/server-investigation-runtime-config.test.js`

## Why This Change Was Needed

CI lacked the runtime; permissions needed composition rules.

## Was It Useful

Useful.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. Build/deploy or tooling configuration changes.

## Relationship to Surrounding Commits

- **Follows:** 0830 — Close Review Findings on the Read-Only Runtime.
- **Precedes:** 0832 — Assert the Composed Agent Permission Set.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
