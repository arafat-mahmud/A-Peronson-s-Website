# Commit 0870 — 4dc1964

| Field | Value |
|-------|-------|
| **Commit Number** | 0870 |
| **Commit Hash** | 4dc196470dafc8f131f5d47489fcdf83b4af186b |
| **Parent Hash** | ce1101a6eaf698b9dd1cbd6fe0f34481d6cf0611 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 14:47:17 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 165 |
| **Deletions** | 33 |
| **Net Change** | +132 |
| **Merge Commit** | No |

## Nudge a Model That Answered in Prose for Its JSON

One extra turn asks for only the JSON object when a model replied with prose.

Original commit message: “fix(investigation): nudge a model that answered with prose for its JSON”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/services/investigationQueue.js` | Modified | 107 | 32 | +107/-32 |
| `tests/integration/investigation-queue.test.js` | Modified | 58 | 1 | +58/-1 |

### What changed per file

- **`server/services/investigationQueue.js`** — modified server service. function added: `finishRoleWithFindings`; function added: `nudgeForJson`.
- **`tests/integration/investigation-queue.test.js`** — modified test. function added: `isNudge`; test case added: `a model that answered with prose is NUDGED for JSON in the same session`.

## Detailed Diff Analysis

- **Areas touched:** server service (1 file, +107/-32), test (1 file, +58/-1).
- **Function added** (3): `finishRoleWithFindings`, `nudgeForJson`, `isNudge`
- **Test case added** (1): `a model that answered with prose is NUDGED for JSON in the same session`
- **Tests:** 1 test file(s) changed: `tests/integration/investigation-queue.test.js`

## Why This Change Was Needed

The work was usually done but unformatted.

## Was It Useful

Useful.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0869 — Record the Model-Chain Fallback Lessons.
- **Precedes:** 0871 — Record the JSON Nudge in AGENTS.md.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
