# Commit 0738 — 35eae53

| Field | Value |
|-------|-------|
| **Commit Number** | 0738 |
| **Commit Hash** | 35eae53102922035ea65f3cf6467e517844d9341 |
| **Parent Hash** | 35b35fa6f1bf767d4236bbc4eb7aa0a60fe1fe73 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-05 14:34:30 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 27 |
| **Deletions** | 18 |
| **Net Change** | +9 |
| **Merge Commit** | No |

## Return 403 Instead of 500 for Premium Chatbot Settings

Routes `ensureEntitlement` failures in the chatbot settings controllers through `handleControllerError`, so free-plan users get a clean 403 with the Premium message.

Original commit message: “fix: return 403 not 500 for chatbot premium entitlement”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/controllers/chatbotController.js` | Modified | 27 | 18 | +27/-18 |

### What changed per file

- **`server/controllers/chatbotController.js`** — modified API controller. +27/-18 lines.

## Detailed Diff Analysis

- **Areas touched:** API controller (1 file, +27/-18).
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Free users saw 'Internal server error' for an expected entitlement check.

## Was It Useful

Useful. Correct status codes and clearer errors.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0737 — Call the Fallback-Cover Hook Before Early Returns.
- **Precedes:** 0739 — Build the HyperCache Offline Twin and Fix the PWA Manifest.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
