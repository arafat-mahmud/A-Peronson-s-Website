# Commit 0849 — 89e96f9

| Field | Value |
|-------|-------|
| **Commit Number** | 0849 |
| **Commit Hash** | 89e96f9d1c070d3478ef6e21c0de18a2355bd5c4 |
| **Parent Hash** | 3b1f7b8b7371e1e4e8781e320bc01d64cc77116e |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 02:34:23 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 898 |
| **Deletions** | 0 |
| **Net Change** | +898 |
| **Merge Commit** | No |

## Test the Report Renderer and Delivery Outcome

Unit and integration tests for the Markdown report and delivery verdict.

Original commit message: “test(investigation): cover the report renderer and the delivery verdict”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/integration/investigation-delivery.test.js` | Added | 487 | 0 | +487/-0 |
| `tests/unit/server-investigation-report.test.js` | Added | 411 | 0 | +411/-0 |

### What changed per file

- **`tests/integration/investigation-delivery.test.js`** — added test. function added: `findingsPayload`; function added: `reportStatusWrites`; function added: `escalatedWrites`; function added: `notificationRecipients`; function added: `emailRecipients`; test case added: `the case records the report as sent` ….
- **`tests/unit/server-investigation-report.test.js`** — added test. function added: `confidenceFor`; test case added: `the case id is in the report`; test case added: `the case metadata carries the subject, the status and the owner`; test case added: `the original complaint is quoted, not paraphrased away`; test case added: `the conversation log carries every message with its role`; test case added: `every agent that ran is named` ….

## Detailed Diff Analysis

- **Areas touched:** test (2 files, +898/-0).
- **Function added** (6): `findingsPayload`, `reportStatusWrites`, `escalatedWrites`, `notificationRecipients`, `emailRecipients`, `confidenceFor`
- **Test case added** (36): `the case records the report as sent`, `the delivery is dated`, `the result reports the delivery as successful`, `the report goes to the owner and the admin`, `the plain text body stays inside emailService`, `the body is a summary with a link, not the whole report`, `the html body carries the same link`, `the case never records the report as sent`, `the case records a failed delivery`, `a failed delivery is not dated as delivered` …
- **Tests:** 2 test file(s) changed: `tests/integration/investigation-delivery.test.js`, `tests/unit/server-investigation-report.test.js`

## Why This Change Was Needed

Coverage for the report pipeline.

## Was It Useful

Useful. Tests.

## Impact Analysis

No runtime behaviour change.

## Relationship to Surrounding Commits

- **Follows:** 0848 — Sweep Expired Support Cases and Their Evidence Files.
- **Precedes:** 0850 — Turn the Support Page into a Chat-First Investigation Flow.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
