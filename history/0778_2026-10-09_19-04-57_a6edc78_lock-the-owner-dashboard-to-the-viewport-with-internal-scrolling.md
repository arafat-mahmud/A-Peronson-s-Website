# Commit 0778 — a6edc78

| Field | Value |
|-------|-------|
| **Commit Number** | 0778 |
| **Commit Hash** | a6edc78babffeb4965bd45e054d1c7ce0d48c2d8 |
| **Parent Hash** | a56a736086521c3f557310608136b681e272160d |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-09 19:04:57 |
| **Branch** | main |
| **Files Changed** | 3 |
| **Additions** | 14 |
| **Deletions** | 3 |
| **Net Change** | +11 |
| **Merge Commit** | No |

## Lock the Owner Dashboard to the Viewport with Internal Scrolling

Viewport-locked dashboard with internal scroll regions; AGENTS.md note.

Original commit message: “feat(owner): viewport-locked dashboard, internal scroll regions”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `AGENTS.md` | Modified | 8 | 0 | +8/-0 |
| `src/App.jsx` | Modified | 4 | 1 | +4/-1 |
| `src/pages/OwnerDashboard.jsx` | Modified | 2 | 2 | +2/-2 |

### What changed per file

- **`AGENTS.md`** — modified documentation. +8/-0 lines.
- **`src/App.jsx`** — modified other. +4/-1 lines.
- **`src/pages/OwnerDashboard.jsx`** — modified page. +2/-2 lines.

## Detailed Diff Analysis

- **Areas touched:** documentation (1 file, +8/-0), other (1 file, +4/-1), page (1 file, +2/-2).
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Whole-page scrolling fought with panel scrolling.

## Was It Useful

Useful. Layout model clarified.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0777 — Stretch the Owner Sidebar to Row Height.
- **Precedes:** 0779 — Pin Verification Document Status Badges.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
