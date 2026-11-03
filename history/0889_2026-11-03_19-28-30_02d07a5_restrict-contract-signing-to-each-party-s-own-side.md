# Commit 0889 — 02d07a5

| Field | Value |
|-------|-------|
| **Commit Number** | 0889 |
| **Commit Hash** | 02d07a5285ddeee2589be59a0cb7fb8b11a344ea |
| **Parent Hash** | 2d9365be3d70c9750ccbe5ad279337b68d9675ac |
| **Author** | Tokyi |
| **Date/Time** | 2026-11-03 19:28:30 |
| **Branch** | fix/client-feedback-2026-11-03 |
| **Files Changed** | 2 |
| **Additions** | 36 |
| **Deletions** | 0 |
| **Net Change** | +36 |
| **Merge Commit** | No |

## Restrict Contract Signing to Each Party's Own Side

Non-staff users can change only their own signature side; test.

Original commit message: “Contract parties can sign only their own side”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/server-authz-guards.test.js` | Modified | 24 | 0 | +24/-0 |
| `server/services/documentService.js` | Modified | 12 | 0 | +12/-0 |

### What changed per file

- **`tests/unit/server-authz-guards.test.js`** — modified test. test case added: `a party cannot sign the other party`.
- **`server/services/documentService.js`** — modified server service. +12/-0 lines.

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +24/-0), server service (1 file, +12/-0).
- **Test case added** (1): `a party cannot sign the other party`
- **Tests:** 1 test file(s) changed: `tests/unit/server-authz-guards.test.js`

## Why This Change Was Needed

One party could sign for the other.

## Was It Useful

Useful. Security.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0888 — Close Contract-Signature Forgery and Free Premium Upgrade Holes.
- **Precedes:** 0890 — Compute Boost Prices on the Server and Fix the Boost Page.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
