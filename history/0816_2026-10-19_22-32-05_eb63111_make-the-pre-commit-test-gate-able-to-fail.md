# Commit 0816 — eb63111

| Field | Value |
|-------|-------|
| **Commit Number** | 0816 |
| **Commit Hash** | eb631119a78cc72cad69733f0a853d2af404f90f |
| **Parent Hash** | bc388b01e399ebde5150a9fd90c3778e7408ec96 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-19 22:32:05 |
| **Branch** | main |
| **Files Changed** | 7 |
| **Additions** | 306 |
| **Deletions** | 18 |
| **Net Change** | +288 |
| **Merge Commit** | No |

## Make the Pre-Commit Test Gate Able to Fail

The hook captures npm's exit status instead of grep's; verification script; related test fixes.

Original commit message: “fix(hooks): make the pre-commit test gate able to fail”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/frontend-jsx-bindings.test.js` | Modified | 118 | 9 | +118/-9 |
| `scripts/verify-precommit-gate.sh` | Added | 101 | 0 | +101/-0 |
| `server/services/fileAccessService.js` | Modified | 21 | 3 | +21/-3 |
| `.husky/pre-commit` | Modified | 19 | 2 | +19/-2 |
| `tests/unit/server-file-access.test.js` | Modified | 19 | 0 | +19/-0 |
| `tests/unit/admin-email-test-outcome.test.js` | Modified | 18 | 0 | +18/-0 |
| `src/pages/AdminPanel.helpers.js` | Modified | 10 | 4 | +10/-4 |

### What changed per file

- **`tests/unit/frontend-jsx-bindings.test.js`** — modified test. function added: `findUnboundJsxNamesWithHasBinding`; function added: `globalProbeSource`; test case added: `measures the global-name escape rate`; test case added: `hasBinding alone would let the runtime globals through`.
- **`scripts/verify-precommit-gate.sh`** — added tooling script. +101/-0 lines.
- **`server/services/fileAccessService.js`** — modified server service. +21/-3 lines.
- **`.husky/pre-commit`** — modified configuration. +19/-2 lines.
- **`tests/unit/server-file-access.test.js`** — modified test. test case added: `a row that differs only in case does not anchor the request`; test case added: `the exact stored spelling resolves`.
- **`tests/unit/admin-email-test-outcome.test.js`** — modified test. test case added: `a status on the outer envelope is not a delivery result`; test case added: `a flattened body is accepted only when it is explicitly flagged`.
- **`src/pages/AdminPanel.helpers.js`** — modified page. +10/-4 lines.

## Detailed Diff Analysis

- **Areas touched:** test (3 files, +155/-9), tooling script (1 file, +101/-0), server service (1 file, +21/-3), configuration (1 file, +19/-2), page (1 file, +10/-4).
- **Function added** (2): `findUnboundJsxNamesWithHasBinding`, `globalProbeSource`
- **Test case added** (6): `a status on the outer envelope is not a delivery result`, `a flattened body is accepted only when it is explicitly flagged`, `measures the global-name escape rate`, `hasBinding alone would let the runtime globals through`, `a row that differs only in case does not anchor the request`, `the exact stored spelling resolves`
- **Tests:** 3 test file(s) changed: `tests/unit/admin-email-test-outcome.test.js`, `tests/unit/frontend-jsx-bindings.test.js`, `tests/unit/server-file-access.test.js`

## Why This Change Was Needed

Red test suites passed the hook.

## Was It Useful

Useful. Process integrity.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths. API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. Build/deploy or tooling configuration changes.

## Relationship to Surrounding Commits

- **Follows:** 0815 — Ask the Server Whether a Document May Leave the Browser.
- **Precedes:** 0817 — Publish the Upload Access-Control Decisions and Rollout Notes.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
