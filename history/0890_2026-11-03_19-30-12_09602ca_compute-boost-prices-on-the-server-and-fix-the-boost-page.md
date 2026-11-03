# Commit 0890 — 09602ca

| Field | Value |
|-------|-------|
| **Commit Number** | 0890 |
| **Commit Hash** | 09602cac10c9e8d7003824cfb461cb04be476b10 |
| **Parent Hash** | 02d07a5285ddeee2589be59a0cb7fb8b11a344ea |
| **Author** | Tokyi |
| **Date/Time** | 2026-11-03 19:30:12 |
| **Branch** | fix/client-feedback-2026-11-03 |
| **Files Changed** | 4 |
| **Additions** | 59 |
| **Deletions** | 29 |
| **Net Change** | +30 |
| **Merge Commit** | No |

## Compute Boost Prices on the Server and Fix the Boost Page

Server-side price ($9.99 per 7 days, pro-rated) and fixed durations; Boost Details page lists, prices and scopes correctly.

Original commit message: “Compute boost prices on the server; fix the Boost Details page”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/pages/BoostDetailsPage.jsx` | Modified | 18 | 18 | +18/-18 |
| `tests/unit/server-authz-guards.test.js` | Modified | 21 | 0 | +21/-0 |
| `server/services/boostService.js` | Modified | 5 | 11 | +5/-11 |
| `shared/config/boostPricing.js` | Added | 15 | 0 | +15/-0 |

### What changed per file

- **`src/pages/BoostDetailsPage.jsx`** — modified page. +18/-18 lines.
- **`tests/unit/server-authz-guards.test.js`** — modified test. test case added: `the client cannot choose the price or an arbitrary duration`.
- **`server/services/boostService.js`** — modified server service. function removed: `normalizePrice`.
- **`shared/config/boostPricing.js`** — added shared code. function added: `normalizeBoostDuration`; function added: `boostPriceUsd`.

## Detailed Diff Analysis

- **Areas touched:** page (1 file, +18/-18), test (1 file, +21/-0), server service (1 file, +5/-11), shared code (1 file, +15/-0).
- **Function added** (2): `normalizeBoostDuration`, `boostPriceUsd`
- **Function removed** (1): `normalizePrice`
- **Test case added** (1): `the client cannot choose the price or an arbitrary duration`
- **Tests:** 1 test file(s) changed: `tests/unit/server-authz-guards.test.js`

## Why This Change Was Needed

Client-chosen prices and a broken list endpoint.

## Was It Useful

Useful. Security and correctness.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths. API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0889 — Restrict Contract Signing to Each Party's Own Side.
- **Precedes:** 0891 — Implement Signed-In Password Change.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
