# Commit 0817 — 017a4a7

| Field | Value |
|-------|-------|
| **Commit Number** | 0817 |
| **Commit Hash** | 017a4a70ae32f53a2afd7c1bdf41c08fda9f6645 |
| **Parent Hash** | eb631119a78cc72cad69733f0a853d2af404f90f |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-19 22:47:14 |
| **Branch** | main |
| **Files Changed** | 7 |
| **Additions** | 1140 |
| **Deletions** | 4 |
| **Net Change** | +1136 |
| **Merge Commit** | No |

## Publish the Upload Access-Control Decisions and Rollout Notes

Copies the decision ledger, design spec, final review and rollout note into `docs/`.

Original commit message: “docs(uploads): ship the decisions, the rollout note and the API change”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `docs/decisions/2026-10-18-upload-access-control-decisions.md` | Added | 430 | 0 | +430/-0 |
| `docs/superpowers/specs/2026-10-18-upload-access-control-design.md` | Added | 265 | 0 | +265/-0 |
| `docs/decisions/2026-10-18-upload-access-control-final-review.md` | Added | 264 | 0 | +264/-0 |
| `docs/rollout/2026-10-18-upload-access-control-rollout.md` | Added | 89 | 0 | +89/-0 |
| `docs/plans/2026-10-18-upload-access-control.md` | Modified | 47 | 1 | +47/-1 |
| `tests/unit/server-file-access.test.js` | Modified | 29 | 0 | +29/-0 |
| `AGENTS.md` | Modified | 16 | 3 | +16/-3 |

### What changed per file

- **`docs/decisions/2026-10-18-upload-access-control-decisions.md`** — added documentation. +430/-0 lines.
- **`docs/superpowers/specs/2026-10-18-upload-access-control-design.md`** — added documentation. +265/-0 lines.
- **`docs/decisions/2026-10-18-upload-access-control-final-review.md`** — added documentation. +264/-0 lines.
- **`docs/rollout/2026-10-18-upload-access-control-rollout.md`** — added documentation. +89/-0 lines.
- **`docs/plans/2026-10-18-upload-access-control.md`** — modified documentation. +47/-1 lines.
- **`tests/unit/server-file-access.test.js`** — modified test. test case added: `the role restriction is recorded in the spec, the plan and AGENTS.md`.
- **`AGENTS.md`** — modified documentation. +16/-3 lines.

## Detailed Diff Analysis

- **Areas touched:** documentation (6 files, +1111/-4), test (1 file, +29/-0).
- **Test case added** (1): `the role restriction is recorded in the spec, the plan and AGENTS.md`
- **Tests:** 1 test file(s) changed: `tests/unit/server-file-access.test.js`

## Why This Change Was Needed

They lived only in a gitignored folder.

## Was It Useful

Useful. Reviewability.

## Impact Analysis

No runtime behaviour change.

## Relationship to Surrounding Commits

- **Follows:** 0816 — Make the Pre-Commit Test Gate Able to Fail.
- **Precedes:** 0818 — Pin the Attachment Modal's Download and Preview Behaviour.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
