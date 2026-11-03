# Commit 0848 — ed8b69b

| Field | Value |
|-------|-------|
| **Commit Number** | 0848 |
| **Commit Hash** | ed8b69b30ba9058b60a9078bf712cda836f10b03 |
| **Parent Hash** | f36444ec1a889efd081e3468ddb56e26273c8b79 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 02:26:18 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 843 |
| **Deletions** | 0 |
| **Net Change** | +843 |
| **Merge Commit** | No |

## Sweep Expired Support Cases and Their Evidence Files

Retention worker deletes cases past `CASE_RETENTION_DAYS` (90) with their rows and attachment bytes; live cases are skipped; tests.

Original commit message: “feat(support): case retention sweep with evidence byte removal”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/workers/caseRetentionWorker.js` | Added | 441 | 0 | +441/-0 |
| `tests/unit/server-case-retention.test.js` | Added | 402 | 0 | +402/-0 |

### What changed per file

- **`server/workers/caseRetentionWorker.js`** — added server. function added: `retentionDays`; function added: `retentionIntervalMs`; function added: `normalizeNow`; function added: `isLiveStatus`; function added: `isRetained`; function added: `shouldSweep` ….
- **`tests/unit/server-case-retention.test.js`** — added test. function added: `daysAgo`; function added: `caseRow`; function added: `writeProbe`; function added: `stillThere`; test case added: `defaults to 90 days`; test case added: `honours CASE_RETENTION_DAYS` ….

## Detailed Diff Analysis

- **Areas touched:** server (1 file, +441/-0), test (1 file, +402/-0).
- **Function added** (18): `retentionDays`, `retentionIntervalMs`, `normalizeNow`, `isLiveStatus`, `isRetained`, `shouldSweep`, `isStrictlyInside`, `publicPathSegments`, `resolveEvidenceFile`, `removeAttachmentBytes` …
- **Test case added** (21): `defaults to 90 days`, `honours CASE_RETENTION_DAYS`, `falls back to the default when the value is unusable`, `sweeps an old terminal case and removes its bytes`, `returns the attachment paths it removed`, `does not sweep a live case, and keeps its bytes`, `does not sweep a case that is still being investigated`, `does not sweep a retained case, and keeps its bytes`, `does not sweep a case that is inside the retention window`, `a case exactly at the window edge is still inside it` …
- **Tests:** 1 test file(s) changed: `tests/unit/server-case-retention.test.js`

## Why This Change Was Needed

Data minimisation for client evidence.

## Was It Useful

Useful. Privacy.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0847 — Test the Support Case Client Hook.
- **Precedes:** 0849 — Test the Report Renderer and Delivery Outcome.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
