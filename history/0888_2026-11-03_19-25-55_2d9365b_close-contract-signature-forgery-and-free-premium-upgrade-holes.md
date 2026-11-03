# Commit 0888 — 2d9365b

| Field | Value |
|-------|-------|
| **Commit Number** | 0888 |
| **Commit Hash** | 2d9365be3d70c9750ccbe5ad279337b68d9675ac |
| **Parent Hash** | 6c0b27b2007e5cdfd9b6dcff53fefe49209977b6 |
| **Author** | Tokyi |
| **Date/Time** | 2026-11-03 19:25:55 |
| **Branch** | fix/client-feedback-2026-11-03 |
| **Files Changed** | 5 |
| **Additions** | 113 |
| **Deletions** | 3 |
| **Net Change** | +110 |
| **Merge Commit** | No |

## Close Contract-Signature Forgery and Free Premium Upgrade Holes

E-sign webhook refuses unsigned calls in production without a secret; `/api/dev` sandbox not mounted in production; self-service can no longer grant Premium; deep diagnostics owner/admin only; tests.

Original commit message: “Close contract-signature forgery, free Premium self-upgrade, public deep diagnostics”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/server-authz-guards.test.js` | Added | 97 | 0 | +97/-0 |
| `server/controllers/subscriptionController.js` | Modified | 6 | 1 | +6/-1 |
| `server/controllers/documentController.js` | Modified | 5 | 0 | +5/-0 |
| `server/routes/diagnosticsRoutes.js` | Modified | 3 | 1 | +3/-1 |
| `server/server.js` | Modified | 2 | 1 | +2/-1 |

### What changed per file

- **`tests/unit/server-authz-guards.test.js`** — added test. function added: `call`; test case added: `production without a secret refuses every call`; test case added: `with a secret, a wrong static secret is refused`; test case added: `with a secret, the matching static secret is accepted`; test case added: `a user cannot grant themselves Premium; cancelling still works`.
- **`server/controllers/subscriptionController.js`** — modified API controller. +6/-1 lines.
- **`server/controllers/documentController.js`** — modified API controller. +5/-0 lines.
- **`server/routes/diagnosticsRoutes.js`** — modified API route. route modified: `GET /diagnostics/deep`.
- **`server/server.js`** — modified server. +2/-1 lines.

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +97/-0), API controller (2 files, +11/-1), API route (1 file, +3/-1), server (1 file, +2/-1).
- **Route modified (middleware/handler changed)** (1): `GET /diagnostics/deep`
- **Function added** (1): `call`
- **Test case added** (4): `production without a secret refuses every call`, `with a secret, a wrong static secret is refused`, `with a secret, the matching static secret is accepted`, `a user cannot grant themselves Premium; cancelling still works`
- **Tests:** 1 test file(s) changed: `tests/unit/server-authz-guards.test.js`

## Why This Change Was Needed

Audit findings: anyone could mark contracts signed or get Premium for free.

## Was It Useful

Useful. Security.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0887 — Cut Homepage LCP to 2.4 s with Theme Splitting and Deferred Markdown.
- **Precedes:** 0889 — Restrict Contract Signing to Each Party's Own Side.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
