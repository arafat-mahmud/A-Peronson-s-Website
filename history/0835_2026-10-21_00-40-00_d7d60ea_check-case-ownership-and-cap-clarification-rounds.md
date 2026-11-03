# Commit 0835 — d7d60ea

| Field | Value |
|-------|-------|
| **Commit Number** | 0835 |
| **Commit Hash** | d7d60ea3bc896809b5d9efb6f6c18b21b97aa00a |
| **Parent Hash** | f36444ec1a889efd081e3468ddb56e26273c8b79 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 00:40:00 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 166 |
| **Deletions** | 0 |
| **Net Change** | +166 |
| **Merge Commit** | No |

## Check Case Ownership and Cap Clarification Rounds

`canReadCase` and a client-message counter for the clarification cap; tests.

Original commit message: “feat(support): case ownership check and the clarification round cap”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/server-case-ownership.test.js` | Added | 99 | 0 | +99/-0 |
| `server/services/caseService.js` | Modified | 67 | 0 | +67/-0 |

### What changed per file

- **`tests/unit/server-case-ownership.test.js`** — added test. test case added: `is false for a case that does not exist`; test case added: `is true for the client who opened the case`; test case added: `is false for a stranger`; test case added: `is true for an owner or an admin`; test case added: `is false for the other staff roles`; test case added: `is false for a caller with no identity` ….
- **`server/services/caseService.js`** — modified server service. function added: `canReadCase`; function added: `countClientMessages`.

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +99/-0), server service (1 file, +67/-0).
- **Function added** (2): `canReadCase`, `countClientMessages`
- **Test case added** (10): `is false for a case that does not exist`, `is true for the client who opened the case`, `is false for a stranger`, `is true for an owner or an admin`, `is false for the other staff roles`, `is false for a caller with no identity`, `counts only the client`, `returns the number the database reports`, `returns zero when the case has no messages`, `is six`
- **Tests:** 1 test file(s) changed: `tests/unit/server-case-ownership.test.js`

## Why This Change Was Needed

Clients must only see their own cases; conversations need a bound.

## Was It Useful

Useful.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0834 — Persist Support Cases and Keep Their Evidence Private.
- **Precedes:** 0836 — Compare Case Owner Ids as Text.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
