# Commit 0780 — da5ff3b

| Field | Value |
|-------|-------|
| **Commit Number** | 0780 |
| **Commit Hash** | da5ff3b5d610d1b8a41caa5cad7a7ccfd1171289 |
| **Parent Hash** | 5b02d25439bf6f624187080324e1815f399461f0 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-09 20:58:00 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 9 |
| **Deletions** | 5 |
| **Net Change** | +4 |
| **Merge Commit** | No |

## Stack Factory Document Rows and Fall Back to Initials

Document rows stack vertically; avatar errors show initials.

Original commit message: “fix(factory): stack doc rows vertically, avatar error fallback to initials”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/pages/FactoryProfile.jsx` | Modified | 6 | 2 | +6/-2 |
| `src/components/profile/VerificationPanel.jsx` | Modified | 3 | 3 | +3/-3 |

### What changed per file

- **`src/pages/FactoryProfile.jsx`** — modified page. +6/-2 lines.
- **`src/components/profile/VerificationPanel.jsx`** — modified component. +3/-3 lines.

## Detailed Diff Analysis

- **Areas touched:** page (1 file, +6/-2), component (1 file, +3/-3).
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Cramped rows and broken avatars on factory profiles.

## Was It Useful

Useful. Small fixes.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0779 — Pin Verification Document Status Badges.
- **Precedes:** 0781 — Add Neon Lab Test Reporting and Reorganise Tests.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
