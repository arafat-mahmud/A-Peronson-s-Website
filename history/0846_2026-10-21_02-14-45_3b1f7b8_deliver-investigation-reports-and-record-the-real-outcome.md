# Commit 0846 — 3b1f7b8

| Field | Value |
|-------|-------|
| **Commit Number** | 0846 |
| **Commit Hash** | 3b1f7b8b7371e1e4e8781e320bc01d64cc77116e |
| **Parent Hash** | 48fb5b2f250557d969b57e754dc3ece2edf5e4ff |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 02:14:45 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 674 |
| **Deletions** | 0 |
| **Net Change** | +674 |
| **Merge Commit** | No |

## Deliver Investigation Reports and Record the Real Outcome

`delivery.js` sends the report and escalates when needed; the case records whether email actually left the server.

Original commit message: “feat(investigation): deliver the report and record the server's own verdict”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/services/investigation/delivery.js` | Added | 674 | 0 | +674/-0 |

### What changed per file

- **`server/services/investigation/delivery.js`** — added server service. function added: `resolveStaffUsers`; function added: `extraStaffEmails`; function added: `resolveRecipientEmails`; function added: `firstMeaningfulParagraph`; function added: `buildSummary`; function added: `measuredLength` ….

## Detailed Diff Analysis

- **Areas touched:** server service (1 file, +674/-0).
- **Function added** (21): `resolveStaffUsers`, `extraStaffEmails`, `resolveRecipientEmails`, `firstMeaningfulParagraph`, `buildSummary`, `measuredLength`, `buildPlainText`, `buildHtml`, `buildSubject`, `interpretSendResult` …
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Email may be log-only; the case must not claim delivery.

## Was It Useful

Useful. Honest state.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0845 — Add the Support Case Event Stream Client and State Hook.
- **Precedes:** 0847 — Test the Support Case Client Hook.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
