# Commit 0859 — cc3950b

| Field | Value |
|-------|-------|
| **Commit Number** | 0859 |
| **Commit Hash** | cc3950b221cdbd8cb3a3f49d5dd9efd8864470f8 |
| **Parent Hash** | 981fc37da5134c67cc2a5aa059e307ca3cf91eb9 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 04:04:48 |
| **Branch** | main |
| **Files Changed** | 15 |
| **Additions** | 856 |
| **Deletions** | 21 |
| **Net Change** | +835 |
| **Merge Commit** | No |

## Finish Investigations: Report, Email, Escalation and Completion

The queue now builds the report, mails it, escalates confirmed security findings and sets a terminal status; tests across layers.

Original commit message: “fix(support): finish the investigation - report, mail, escalation, terminal status”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/services/investigationQueue.js` | Modified | 251 | 3 | +251/-3 |
| `tests/unit/frontend-support-case.test.js` | Modified | 122 | 0 | +122/-0 |
| `tests/integration/investigation-queue.test.js` | Modified | 114 | 1 | +114/-1 |
| `tests/integration/support-case-isolation.test.js` | Modified | 99 | 0 | +99/-0 |
| `tests/integration/support-case-api.test.js` | Modified | 61 | 0 | +61/-0 |
| `tests/unit/server-investigation-report.test.js` | Modified | 44 | 0 | +44/-0 |
| `server/controllers/caseController.js` | Modified | 28 | 5 | +28/-5 |
| `server/services/investigation/delivery.js` | Modified | 29 | 3 | +29/-3 |
| `server/services/investigation/report.js` | Modified | 31 | 0 | +31/-0 |
| `src/pages/admin/sections/AdminPlatformSection.jsx` | Modified | 26 | 2 | +26/-2 |
| `tests/unit/server-case-retention.test.js` | Modified | 16 | 6 | +16/-6 |
| `src/pages/AdminPanel.jsx` | Modified | 18 | 0 | +18/-0 |
| `server/server.js` | Modified | 11 | 0 | +11/-0 |
| `.gitignore` | Modified | 5 | 0 | +5/-0 |
| `docs/plans/2026-10-20-ai-support-investigation-portal.md` | Modified | 1 | 1 | +1/-1 |

### What changed per file

- **`server/services/investigationQueue.js`** — modified server service. function added: `finalizeInvestigation`; function added: `readRunRows`; function added: `finalFindings`; function added: `persistReport`; function added: `loadDeliveryModule`; function added: `escalate` ….
- **`tests/unit/frontend-support-case.test.js`** — modified test. function added: `stubStream`; function added: `sseFrame`; test case added: `the event types are exactly the five contracts.md 4 names`; test case added: `each of the five types is dispatched on, with its payload`; test case added: `a type that is not one of the five is ignored`; test case added: `a frame of the stream reaches the handler with its type and its payload` ….
- **`tests/integration/investigation-queue.test.js`** — modified test. test case added: `the report is built, written to the verify row, and mailed`; test case added: `a finding is counted once, not once per run that reported it`; test case added: `the report does not quote a report`; test case added: `the escalation runs on the final findings, and the mail does not gate it`; test case added: `the case ends completed`; test case added: `a case that cannot be found is failed, not left investigating`.
- **`tests/integration/support-case-isolation.test.js`** — modified test. test case added: `an admin can escalate a case, and the case records it`; test case added: `a client cannot escalate a case - 403, and the case is not escalated`; test case added: `an admin can re-run a case, and a new investigation is queued`; test case added: `a client cannot re-run a case - 403, and nothing is queued`; test case added: `a re-run reports that the runtime is not available - 503`.
- **`tests/integration/support-case-api.test.js`** — modified test. test case added: `confirming a case that is already being investigated changes nothing`; test case added: `confirming a finished case is an acknowledgement, not a restart`.
- **`tests/unit/server-investigation-report.test.js`** — modified test. test case added: `a finding the verify row repeats is counted once`; test case added: `the count of rendered findings is the count of the findings`.
- **`server/controllers/caseController.js`** — modified API controller. +28/-5 lines.
- **`server/services/investigation/delivery.js`** — modified server service. function added: `baseUrl`.
- **`server/services/investigation/report.js`** — modified server service. function added: `findingKey`.
- **`src/pages/admin/sections/AdminPlatformSection.jsx`** — modified page. +26/-2 lines.
- **`tests/unit/server-case-retention.test.js`** — modified test. +16/-6 lines.
- **`src/pages/AdminPanel.jsx`** — modified page. +18/-0 lines.

## Detailed Diff Analysis

- **Areas touched:** test (6 files, +456/-7), server service (3 files, +311/-6), page (2 files, +44/-2), API controller (1 file, +28/-5), server (1 file, +11/-0), configuration (1 file, +5/-0), documentation (1 file, +1/-1).
- **Function added** (12): `baseUrl`, `findingKey`, `finalizeInvestigation`, `readRunRows`, `finalFindings`, `persistReport`, `loadDeliveryModule`, `escalate`, `deliver`, `setTerminalStatus` …
- **Test case added** (21): `the report is built, written to the verify row, and mailed`, `a finding is counted once, not once per run that reported it`, `the report does not quote a report`, `the escalation runs on the final findings, and the mail does not gate it`, `the case ends completed`, `a case that cannot be found is failed, not left investigating`, `confirming a case that is already being investigated changes nothing`, `confirming a finished case is an acknowledgement, not a restart`, `an admin can escalate a case, and the case records it`, `a client cannot escalate a case - 403, and the case is not escalated` …
- **Tests:** 6 test file(s) changed: `tests/integration/investigation-queue.test.js`, `tests/integration/support-case-api.test.js`, `tests/integration/support-case-isolation.test.js`, `tests/unit/frontend-support-case.test.js`, `tests/unit/server-case-retention.test.js` …

## Why This Change Was Needed

Investigations ran but never completed.

## Was It Useful

Useful. Completes the feature.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths. API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. Build/deploy or tooling configuration changes.

## Relationship to Surrounding Commits

- **Follows:** 0858 — Merge the Support Client Chat UI Workstream.
- **Precedes:** 0860 — Preserve Finding Categories and Use a Public Report URL.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
