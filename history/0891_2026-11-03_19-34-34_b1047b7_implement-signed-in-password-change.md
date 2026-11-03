# Commit 0891 — b1047b7

| Field | Value |
|-------|-------|
| **Commit Number** | 0891 |
| **Commit Hash** | b1047b73eff2dd639c0f5169b3031a6c63451252 |
| **Parent Hash** | 09602cac10c9e8d7003824cfb461cb04be476b10 |
| **Author** | Tokyi |
| **Date/Time** | 2026-11-03 19:34:34 |
| **Branch** | fix/client-feedback-2026-11-03 |
| **Files Changed** | 5 |
| **Additions** | 67 |
| **Deletions** | 5 |
| **Net Change** | +62 |
| **Merge Commit** | No |

## Implement Signed-In Password Change

`PUT /api/auth/password` with current-password check, shared policy and revocation of other sessions; Settings uses the policy.

Original commit message: “Make Settings -> Change password work”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/server-sessions-password-reset.test.js` | Modified | 28 | 0 | +28/-0 |
| `server/services/passwordResetService.js` | Modified | 24 | 1 | +24/-1 |
| `server/controllers/authController.js` | Modified | 8 | 1 | +8/-1 |
| `src/pages/Settings.jsx` | Modified | 5 | 3 | +5/-3 |
| `server/routes/authRoutes.js` | Modified | 2 | 0 | +2/-0 |

### What changed per file

- **`tests/unit/server-sessions-password-reset.test.js`** — modified test. test case added: `needs the current password, enforces the policy, keeps only the caller`.
- **`server/services/passwordResetService.js`** — modified server service. function added: `changePassword`.
- **`server/controllers/authController.js`** — modified API controller. function added: `changeMyPassword`.
- **`src/pages/Settings.jsx`** — modified page. +5/-3 lines.
- **`server/routes/authRoutes.js`** — modified API route. route added: `PUT /password`.

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +28/-0), server service (1 file, +24/-1), API controller (1 file, +8/-1), page (1 file, +5/-3), API route (1 file, +2/-0).
- **Route added** (1): `PUT /password`
- **Function added** (2): `changeMyPassword`, `changePassword`
- **Test case added** (1): `needs the current password, enforces the policy, keeps only the caller`
- **Tests:** 1 test file(s) changed: `tests/unit/server-sessions-password-reset.test.js`

## Why This Change Was Needed

The Settings form called an endpoint that did not exist.

## Was It Useful

Useful. Fixes a broken feature.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths. API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0890 — Compute Boost Prices on the Server and Fix the Boost Page.
- **Precedes:** 0892 — Make the Reconcile Migration Apply to Empty Databases.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
