# Commit 0842 — 48fb5b2

| Field | Value |
|-------|-------|
| **Commit Number** | 0842 |
| **Commit Hash** | 48fb5b2f250557d969b57e754dc3ece2edf5e4ff |
| **Parent Hash** | f36444ec1a889efd081e3468ddb56e26273c8b79 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 01:47:41 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 756 |
| **Deletions** | 0 |
| **Net Change** | +756 |
| **Merge Commit** | No |

## Render Support Case Reports as Markdown

Report renderer that marks failed runs INCOMPLETE rather than inventing results.

Original commit message: “feat(investigation): render the support case report as Markdown”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/services/investigation/report.js` | Added | 756 | 0 | +756/-0 |

### What changed per file

- **`server/services/investigation/report.js`** — added server service. function added: `text`; function added: `singleLine`; function added: `asArray`; function added: `parseJsonColumn`; function added: `formatTimestamp`; function added: `tableCell` ….

## Detailed Diff Analysis

- **Areas touched:** server service (1 file, +756/-0).
- **Function added** (35): `text`, `singleLine`, `asArray`, `parseJsonColumn`, `formatTimestamp`, `tableCell`, `describeValue`, `renderItemList`, `normalizeConfidence`, `normalizeEvidenceEntry` …
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Admins and clients need a readable report.

## Was It Useful

Useful.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0841 — Run Investigation Agents from a Bounded Queue.
- **Precedes:** 0843 — Merge the Support Case API Workstream.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
