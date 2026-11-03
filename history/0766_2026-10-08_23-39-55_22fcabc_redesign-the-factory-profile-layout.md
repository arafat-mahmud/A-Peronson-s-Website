# Commit 0766 — 22fcabc

| Field | Value |
|-------|-------|
| **Commit Number** | 0766 |
| **Commit Hash** | 22fcabc352d07ee5635015d5e095942e81f732fd |
| **Parent Hash** | 6fa1d0ab2fca738509df22084846af7ae2cb419c |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-08 23:39:55 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 69 |
| **Deletions** | 33 |
| **Net Change** | +36 |
| **Merge Commit** | No |

## Redesign the Factory Profile Layout

Full-width hero, sticky sidebar, merged trust section, stepper and empty states on the factory profile.

Original commit message: “feat(factory): full-width hero, sticky sidebar, trust merge, stepper, empty states”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/pages/FactoryProfile.jsx` | Modified | 69 | 33 | +69/-33 |

### What changed per file

- **`src/pages/FactoryProfile.jsx`** — modified page. function removed: `AvatarFallback`; function added: `AvatarFallback`; function added: `InfoRow`; function added: `EmptyState`.

## Detailed Diff Analysis

- **Areas touched:** page (1 file, +69/-33).
- **Function added** (3): `AvatarFallback`, `InfoRow`, `EmptyState`
- **Function removed** (1): `AvatarFallback`
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Same redesign as the buyer profile for factories.

## Was It Useful

Useful. Consistent profile structure.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0765 — Redesign the Buyer Profile Layout and CRM Stepper.
- **Precedes:** 0767 — Plan the Dashboard Chrome Collapse Feature.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
