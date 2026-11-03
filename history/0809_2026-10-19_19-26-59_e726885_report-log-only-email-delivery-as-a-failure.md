# Commit 0809 — e726885

| Field | Value |
|-------|-------|
| **Commit Number** | 0809 |
| **Commit Hash** | e726885470ad215fffa47d9d308ca10e8b34d08b |
| **Parent Hash** | d837c048d65c062061a868075ebc6a1167e14ff4 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-19 19:26:59 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 198 |
| **Deletions** | 14 |
| **Net Change** | +184 |
| **Merge Commit** | No |

## Report Log-Only Email Delivery as a Failure

Email branches that only log now return `ok:false` and warn; tests.

Original commit message: “fix(email): report log-only delivery as a failure”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/server-email-delivery.test.js` | Added | 141 | 0 | +141/-0 |
| `server/services/emailService.js` | Modified | 57 | 14 | +57/-14 |

### What changed per file

- **`tests/unit/server-email-delivery.test.js`** — added test. test case added: `does not report success when email is disabled`; test case added: `does not report success when smtp is unconfigured`; test case added: `does not report success when the gmail provider is unconfigured`; test case added: `does not report success for an unsupported provider`; test case added: `still refuses to send with no recipients`; test case added: `a log-only delivery never queues a real outbox message`.
- **`server/services/emailService.js`** — modified server service. +57/-14 lines.

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +141/-0), server service (1 file, +57/-14).
- **Test case added** (6): `does not report success when email is disabled`, `does not report success when smtp is unconfigured`, `does not report success when the gmail provider is unconfigured`, `does not report success for an unsupported provider`, `still refuses to send with no recipients`, `a log-only delivery never queues a real outbox message`
- **Tests:** 1 test file(s) changed: `tests/unit/server-email-delivery.test.js`

## Why This Change Was Needed

Callers believed messages were delivered when nothing was sent.

## Was It Useful

Useful. Honest status.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0808 — Pin the JSX-Binding Guard's Own Assertions.
- **Precedes:** 0810 — Show Log-Only Test Emails as Not Sent in Admin.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
