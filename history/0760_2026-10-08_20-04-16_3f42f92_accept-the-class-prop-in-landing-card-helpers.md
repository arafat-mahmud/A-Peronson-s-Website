# Commit 0760 — 3f42f92

| Field | Value |
|-------|-------|
| **Commit Number** | 0760 |
| **Commit Hash** | 3f42f924e999bbd5661568fae57f838d9ffd5dc0 |
| **Parent Hash** | 3fc2955ea124513fe4d2da2474218ca3cf18425c |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-08 20:04:16 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 19 |
| **Deletions** | 14 |
| **Net Change** | +5 |
| **Merge Commit** | No |

## Accept the class Prop in Landing Card Helpers

Card, ScrollReveal and helpers accept a `class` prop in addition to `className`.

Original commit message: “fix(landing): accept class prop in Card, ScrollReveal and helpers”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/pages/TexHub.jsx` | Modified | 14 | 11 | +14/-11 |
| `src/components/ScrollReveal.jsx` | Modified | 5 | 3 | +5/-3 |

### What changed per file

- **`src/pages/TexHub.jsx`** — modified page. function removed: `Card`; function added: `Card`; function removed: `BentoMotion`; function added: `BentoMotion`; function removed: `AnimatedHeroHeading`; function added: `AnimatedHeroHeading` ….
- **`src/components/ScrollReveal.jsx`** — modified component. function removed: `ScrollReveal`; function added: `ScrollReveal`.

## Detailed Diff Analysis

- **Areas touched:** page (1 file, +14/-11), component (1 file, +5/-3).
- **Function added** (6): `ScrollReveal`, `Card`, `BentoMotion`, `AnimatedHeroHeading`, `MagneticLinkButton`, `GlassSurface`
- **Function removed** (6): `ScrollReveal`, `Card`, `BentoMotion`, `AnimatedHeroHeading`, `MagneticLinkButton`, `GlassSurface`
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Classes passed as `class` were dropped.

## Was It Useful

Useful. Fixes lost styling.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0759 — Enlarge Landing Stat and Feature Cards.
- **Precedes:** 0761 — Theme the Stat Dot Glow Through a Variable.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
