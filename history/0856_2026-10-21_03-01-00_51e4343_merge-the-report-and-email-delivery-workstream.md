# Commit 0856 — 51e4343

| Field | Value |
|-------|-------|
| **Commit Number** | 0856 |
| **Commit Hash** | 51e43437eb24b83f3245a51f1acf67c5a3d24065 |
| **Parent Hash** | 457f37377241b21de533f584afac82ab72abb1a4, 89e96f9d1c070d3478ef6e21c0de18a2355bd5c4 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 03:01:00 |
| **Branch** | main |
| **Files Changed** | 4 |
| **Additions** | 2328 |
| **Deletions** | 0 |
| **Net Change** | +2328 |
| **Merge Commit** | Yes |

## Merge the Report and Email Delivery Workstream

Merge commit bringing WS3 (report renderer, delivery) into the main line.

Original commit message: “merge: WS3 report and email delivery (feat/ws3-report-email)”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/services/investigation/report.js` | Added | 756 | 0 | +756/-0 |
| `server/services/investigation/delivery.js` | Added | 674 | 0 | +674/-0 |
| `tests/integration/investigation-delivery.test.js` | Added | 487 | 0 | +487/-0 |
| `tests/unit/server-investigation-report.test.js` | Added | 411 | 0 | +411/-0 |

### What changed per file

- **`server/services/investigation/report.js`** — added server service. function added: `text`; function added: `singleLine`; function added: `asArray`; function added: `parseJsonColumn`; function added: `formatTimestamp`; function added: `tableCell` ….
- **`server/services/investigation/delivery.js`** — added server service. function added: `resolveStaffUsers`; function added: `extraStaffEmails`; function added: `resolveRecipientEmails`; function added: `firstMeaningfulParagraph`; function added: `buildSummary`; function added: `measuredLength` ….
- **`tests/integration/investigation-delivery.test.js`** — added test. function added: `findingsPayload`; function added: `reportStatusWrites`; function added: `escalatedWrites`; function added: `notificationRecipients`; function added: `emailRecipients`; test case added: `the case records the report as sent` ….
- **`tests/unit/server-investigation-report.test.js`** — added test. function added: `confidenceFor`; test case added: `the case id is in the report`; test case added: `the case metadata carries the subject, the status and the owner`; test case added: `the original complaint is quoted, not paraphrased away`; test case added: `the conversation log carries every message with its role`; test case added: `every agent that ran is named` ….

## Detailed Diff Analysis

- **Areas touched:** server service (2 files, +1430/-0), test (2 files, +898/-0).
- **Function added** (62): `resolveStaffUsers`, `extraStaffEmails`, `resolveRecipientEmails`, `firstMeaningfulParagraph`, `buildSummary`, `measuredLength`, `buildPlainText`, `buildHtml`, `buildSubject`, `interpretSendResult` …
- **Test case added** (36): `the case records the report as sent`, `the delivery is dated`, `the result reports the delivery as successful`, `the report goes to the owner and the admin`, `the plain text body stays inside emailService`, `the body is a summary with a link, not the whole report`, `the html body carries the same link`, `the case never records the report as sent`, `the case records a failed delivery`, `a failed delivery is not dated as delivered` …
- **Tests:** 2 test file(s) changed: `tests/integration/investigation-delivery.test.js`, `tests/unit/server-investigation-report.test.js`
- **Merge:** diff shown against the first parent; the content was authored in the merged branch's commits.

## Why This Change Was Needed

Integrate parallel branch.

## Was It Useful

Neutral. Merge.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. As a merge, its effect equals that of the merged branch commits.

## Relationship to Surrounding Commits

- **Follows:** 0855 — Merge the Support Case API Review Fixes.
- **Precedes:** 0857 — Merge the Admin Console and Retention Workstream.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
