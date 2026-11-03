# Commit 0740 — 84f0790

| Field | Value |
|-------|-------|
| **Commit Number** | 0740 |
| **Commit Hash** | 84f0790efe4c1cf4e47186fa4f9023224cb24e08 |
| **Parent Hash** | ed577cbcfa61e641387d84577218cbed65d7ba5b |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-05 23:24:06 |
| **Branch** | main |
| **Files Changed** | 3 |
| **Additions** | 38 |
| **Deletions** | 3 |
| **Net Change** | +35 |
| **Merge Commit** | No |

## Stop Sync Heartbeat 401 Noise for Signed-Out Users

The heartbeat sends the Bearer token only when signed in and pings public `/health` otherwise; sync head/delta treat 401/403 as signed-out; sync is skipped with no token.

Original commit message: “fix: silence /api/sync/head 401 console noise for logged-out users”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/offline/connectivity.js` | Modified | 25 | 3 | +25/-3 |
| `src/offline/syncTransport.js` | Modified | 10 | 0 | +10/-0 |
| `src/offline/syncEngine.js` | Modified | 3 | 0 | +3/-0 |

### What changed per file

- **`src/offline/connectivity.js`** — modified frontend library. function added: `readAuthToken`.
- **`src/offline/syncTransport.js`** — modified frontend library. function added: `isAuthError`.
- **`src/offline/syncEngine.js`** — modified frontend library. +3/-0 lines.

## Detailed Diff Analysis

- **Areas touched:** frontend library (3 files, +38/-3).
- **Function added** (2): `readAuthToken`, `isAuthError`
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Signed-out visitors saw a stream of 401 errors in the console.

## Was It Useful

Useful. Removes noise and pointless requests.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0739 — Build the HyperCache Offline Twin and Fix the PWA Manifest.
- **Precedes:** 0741 — Add a Reachability Fallback Chain to the Heartbeat.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
