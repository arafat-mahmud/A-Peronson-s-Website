# Commit 0866 — da603b5

| Field | Value |
|-------|-------|
| **Commit Number** | 0866 |
| **Commit Hash** | da603b596790a52208e50e90efeb2225ee36705e |
| **Parent Hash** | 74f9051afb5392fd739f17e7bd1bc88f5b40aec3 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 13:06:49 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 20 |
| **Deletions** | 0 |
| **Net Change** | +20 |
| **Merge Commit** | No |

## Record the Budget, Reader and Process-Kill Lessons

AGENTS.md items 27–28, including identifying processes by parent PID, not name.

Original commit message: “docs(agents): record the budget, the reader, the evidence path, and the process trap”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `AGENTS.md` | Modified | 20 | 0 | +20/-0 |

### What changed per file

- **`AGENTS.md`** — modified documentation. +20/-0 lines.

## Detailed Diff Analysis

- **Areas touched:** documentation (1 file, +20/-0).
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

A cleanup killed the operator's own session.

## Was It Useful

Neutral. Documentation.

## Impact Analysis

No runtime behaviour change.

## Relationship to Surrounding Commits

- **Follows:** 0865 — Add a Tool-Call Budget and a Turn Reader That Waits.
- **Precedes:** 0867 — Treat a Message Without finish as Still Being Written.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
