# Commit 0828 — 6ea0a45

| Field | Value |
|-------|-------|
| **Commit Number** | 0828 |
| **Commit Hash** | 6ea0a457f05ef8e8eaa1f893c3bd8755dd8a6e61 |
| **Parent Hash** | 7e9096ba3f04c81d966df21d0ab5ffd16905e0fa |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-20 13:14:11 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 32 |
| **Deletions** | 1 |
| **Net Change** | +31 |
| **Merge Commit** | No |

## Make the Portal Spike Gate Opt-In

Live spike tests run only with `INVESTIGATION_SPIKE=1`.

Original commit message: “docs(plan): make the spike gate opt-in so the commit hook stays fast”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `docs/plans/2026-10-20-ai-support-investigation-portal.md` | Modified | 32 | 1 | +32/-1 |

### What changed per file

- **`docs/plans/2026-10-20-ai-support-investigation-portal.md`** — modified documentation. +32/-1 lines.

## Detailed Diff Analysis

- **Areas touched:** documentation (1 file, +32/-1).
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

They would make every commit take 25+ minutes.

## Was It Useful

Useful. Keeps the hook usable.

## Impact Analysis

No runtime behaviour change.

## Relationship to Surrounding Commits

- **Follows:** 0827 — Close Three Pre-Flight Conflicts in the Portal Plan.
- **Precedes:** 0829 — Add a Read-Only opencode Runtime for Investigations.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
