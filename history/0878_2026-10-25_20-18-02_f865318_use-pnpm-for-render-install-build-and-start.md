# Commit 0878 — f865318

| Field | Value |
|-------|-------|
| **Commit Number** | 0878 |
| **Commit Hash** | f865318b570da4de513f7d86cee210f1066fa68c |
| **Parent Hash** | f915d258dec825ecc952e7de00d9972b96296b45 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-25 20:18:02 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 2 |
| **Deletions** | 2 |
| **Net Change** | +0 |
| **Merge Commit** | No |

## Use pnpm for Render Install, Build and Start

Render commands switch from npm to pnpm.

Original commit message: “fix(render): use pnpm instead of npm for install/build/start”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `render.yaml` | Modified | 2 | 2 | +2/-2 |

### What changed per file

- **`render.yaml`** — modified configuration. +2/-2 lines.

## Detailed Diff Analysis

- **Areas touched:** configuration (1 file, +2/-2).
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.
- **Deployment:** changes `render.yaml` (Render Blueprint); takes effect on the next deploy of `main`.

## Why This Change Was Needed

The lockfile is pnpm's.

## Was It Useful

Useful.

## Impact Analysis

Build/deploy or tooling configuration changes.

## Relationship to Surrounding Commits

- **Follows:** 0877 — Switch the Render Service to the Starter Plan and Add OPENCODE_BIN.
- **Precedes:** 0879 — Add node_modules/.bin to PATH on Render.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).
- Contains or removes credential-bearing files; values are deliberately not reproduced here.
## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
