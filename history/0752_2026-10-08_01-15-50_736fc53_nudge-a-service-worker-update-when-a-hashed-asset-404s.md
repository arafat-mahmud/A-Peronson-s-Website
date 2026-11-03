# Commit 0752 — 736fc53

| Field | Value |
|-------|-------|
| **Commit Number** | 0752 |
| **Commit Hash** | 736fc53d2c5db16ef64d3809f3ef13f5f77c793a |
| **Parent Hash** | f107dd5f548986d18d6a30b1fc014154b63cf1a6 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-08 01:15:50 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 50 |
| **Deletions** | 3 |
| **Net Change** | +47 |
| **Merge Commit** | No |

## Nudge a Service-Worker Update When a Hashed Asset 404s

The service worker detects 404s for hashed assets (stale shell after a deploy) and triggers an update.

Original commit message: “fix(pwa): nudge SW update when a hashed asset 404s (stale shell)”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/sw.js` | Modified | 50 | 3 | +50/-3 |

### What changed per file

- **`src/sw.js`** — modified other. function added: `noteStaleShell`.

## Detailed Diff Analysis

- **Areas touched:** other (1 file, +50/-3).
- **Function added** (1): `noteStaleShell`
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

After a redeploy, old shells requested chunk names that no longer existed.

## Was It Useful

Useful, partial. The full fix (network-first navigations + chunk retry) came in 1879ed8b.

## Impact Analysis

Limited, localized impact.

## Relationship to Surrounding Commits

- **Follows:** 0751 — Let the Theme Switcher List Scroll on Its Own (Completed).
- **Precedes:** 0753 — Give Each Theme Its Own Ambient Background Wash.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
