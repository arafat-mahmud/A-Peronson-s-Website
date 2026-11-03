# Commit 0854 — c3e0cb8

| Field | Value |
|-------|-------|
| **Commit Number** | 0854 |
| **Commit Hash** | c3e0cb87f4bb09f187ad84e0d58bc8a94eb4be1d |
| **Parent Hash** | f22a92fe0b78b34905a5ffccadbae0b1648c869e |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 03:00:55 |
| **Branch** | main |
| **Files Changed** | 4 |
| **Additions** | 25 |
| **Deletions** | 4 |
| **Net Change** | +21 |
| **Merge Commit** | No |

## Single-Source the Clarification Round Cap

One definition of `MAX_CLARIFICATION_ROUNDS`; legacy 'user' rows counted.

Original commit message: “fix(support): one source for the round cap, and count legacy 'user' rows”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `docs/plans/2026-10-20-ai-support-investigation-portal.md` | Modified | 14 | 0 | +14/-0 |
| `tests/unit/server-case-ownership.test.js` | Modified | 5 | 2 | +5/-2 |
| `server/services/caseService.js` | Modified | 5 | 1 | +5/-1 |
| `server/controllers/caseController.js` | Modified | 1 | 1 | +1/-1 |

### What changed per file

- **`docs/plans/2026-10-20-ai-support-investigation-portal.md`** — modified documentation. +14/-0 lines.
- **`tests/unit/server-case-ownership.test.js`** — modified test. test case added: `counts the client`.
- **`server/services/caseService.js`** — modified server service. +5/-1 lines.
- **`server/controllers/caseController.js`** — modified API controller. +1/-1 lines.

## Detailed Diff Analysis

- **Areas touched:** documentation (1 file, +14/-0), test (1 file, +5/-2), server service (1 file, +5/-1), API controller (1 file, +1/-1).
- **Test case added** (1): `counts the client`
- **Tests:** 1 test file(s) changed: `tests/unit/server-case-ownership.test.js`

## Why This Change Was Needed

Two copies diverged; old rows were not counted.

## Was It Useful

Useful. Small fix.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0853 — Add the Case Stream Endpoint and Evidence Ownership Checks.
- **Precedes:** 0855 — Merge the Support Case API Review Fixes.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
