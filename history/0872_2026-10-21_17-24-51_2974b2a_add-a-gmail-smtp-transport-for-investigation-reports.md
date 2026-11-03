# Commit 0872 — 2974b2a

| Field | Value |
|-------|-------|
| **Commit Number** | 0872 |
| **Commit Hash** | 2974b2ae91e9f100edc71fe24ffd3d1156bfe4c9 |
| **Parent Hash** | 70c3fea5670c8c0bc71a273f7756ff70ddfc38f6 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 17:24:51 |
| **Branch** | main |
| **Files Changed** | 5 |
| **Additions** | 295 |
| **Deletions** | 18 |
| **Net Change** | +277 |
| **Merge Commit** | No |

## Add a Gmail SMTP Transport for Investigation Reports

Per-purpose email transport so reports can use Gmail app-password SMTP; config keys in `.env.example` and `render.yaml`; tests.

Original commit message: “feat(email): a Gmail transport for the investigation report”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/server-email-gmail-transport.test.js` | Added | 174 | 0 | +174/-0 |
| `server/services/emailService.js` | Modified | 72 | 17 | +72/-17 |
| `server/services/investigation/delivery.js` | Modified | 19 | 0 | +19/-0 |
| `.env.example` | Modified | 17 | 0 | +17/-0 |
| `render.yaml` | Modified | 13 | 1 | +13/-1 |

### What changed per file

- **`tests/unit/server-email-gmail-transport.test.js`** — added test. test case added: `an unconfigured gmail is reported as logged_no_gmail, not logged_no_smtp`; test case added: `the transport is smtp.gmail.com on 465 with the App Password`; test case added: `the gmail transport never uses SMTP_HOST or SMTP_USER`; test case added: `a send can PIN its provider over the admin config and the env override`; test case added: `EMAIL_PROVIDER overrides the admin config when nothing is pinned`; test case added: `the delivery status names the gmail provider and its readiness`.
- **`server/services/emailService.js`** — modified server service. function added: `isGmailAppPasswordConfigured`; function added: `resolveProvider`; function removed: `sendEmail`; function added: `sendEmail`.
- **`server/services/investigation/delivery.js`** — modified server service. +19/-0 lines.
- **`.env.example`** — modified configuration. +17/-0 lines.
- **`render.yaml`** — modified configuration. +13/-1 lines.

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +174/-0), server service (2 files, +91/-17), configuration (2 files, +30/-1).
- **Function added** (3): `isGmailAppPasswordConfigured`, `resolveProvider`, `sendEmail`
- **Function removed** (1): `sendEmail`
- **Test case added** (6): `an unconfigured gmail is reported as logged_no_gmail, not logged_no_smtp`, `the transport is smtp.gmail.com on 465 with the App Password`, `the gmail transport never uses SMTP_HOST or SMTP_USER`, `a send can PIN its provider over the admin config and the env override`, `EMAIL_PROVIDER overrides the admin config when nothing is pinned`, `the delivery status names the gmail provider and its readiness`
- **Tests:** 1 test file(s) changed: `tests/unit/server-email-gmail-transport.test.js`
- **Deployment:** changes `render.yaml` (Render Blueprint); takes effect on the next deploy of `main`.

## Why This Change Was Needed

Only one global provider existed and the Gmail REST provider needed OAuth.

## Was It Useful

Useful, with a caveat: render.yaml later received literal credential values (see 9ceecfa1).

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. Build/deploy or tooling configuration changes.

## Relationship to Surrounding Commits

- **Follows:** 0871 — Record the JSON Nudge in AGENTS.md.
- **Precedes:** 0873 — Make the Chat Assistant's opencode Path Work.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).
- Contains or removes credential-bearing files; values are deliberately not reproduced here.
## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
