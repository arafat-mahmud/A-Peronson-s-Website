# Commit 0746 — 2b28496

| Field | Value |
|-------|-------|
| **Commit Number** | 0746 |
| **Commit Hash** | 2b2849658b2b578099a98eba57f8e88b7689061a |
| **Parent Hash** | 9e5e6803d751a2ea51080ef561bbea75687e22e2 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-06 09:03:06 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 36 |
| **Deletions** | 2 |
| **Net Change** | +34 |
| **Merge Commit** | No |

## Precache Only the App Shell in the Service Worker

Restricts the precache list to about 14 shell files; route chunks are cached on first use with a cap.

Original commit message: “perf: shell-only SW precache (14 files, was 150+)”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/sw.js` | Modified | 20 | 1 | +20/-1 |
| `vite.config.js` | Modified | 16 | 1 | +16/-1 |

### What changed per file

- **`src/sw.js`** — modified other. function added: `eventLoopTrim`.
- **`vite.config.js`** — modified configuration. +16/-1 lines.

## Detailed Diff Analysis

- **Areas touched:** other (1 file, +20/-1), configuration (1 file, +16/-1).
- **Function added** (1): `eventLoopTrim`
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

The SW precached 150+ lazy chunks on first visit, starving the critical path (traces showed 158 requests).

## Was It Useful

Useful. Big first-visit improvement.

## Impact Analysis

Build/deploy or tooling configuration changes.

## Relationship to Surrounding Commits

- **Follows:** 0745 — Self-Host Inter and Wire It Into Tailwind v4.
- **Precedes:** 0747 — Fix Lighthouse Accessibility Findings on the Homepage.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
