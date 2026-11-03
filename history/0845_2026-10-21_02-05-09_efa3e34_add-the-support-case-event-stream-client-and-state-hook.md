# Commit 0845 — efa3e34

| Field | Value |
|-------|-------|
| **Commit Number** | 0845 |
| **Commit Hash** | efa3e34db1e31b9f6717ec3af5aebfbaf4ef3f82 |
| **Parent Hash** | f36444ec1a889efd081e3468ddb56e26273c8b79 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 02:05:09 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 696 |
| **Deletions** | 0 |
| **Net Change** | +696 |
| **Merge Commit** | No |

## Add the Support Case Event Stream Client and State Hook

`src/lib/caseRealtime.js` (SSE over fetch with bearer auth and capped backoff) and `useSupportCase` hook.

Original commit message: “feat(support): case event stream client and case state hook”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/hooks/useSupportCase.js` | Added | 399 | 0 | +399/-0 |
| `src/lib/caseRealtime.js` | Added | 297 | 0 | +297/-0 |

### What changed per file

- **`src/hooks/useSupportCase.js`** — added frontend library. function added: `compareBySequence`; function added: `mergeMessages`; function added: `mergeAttachments`; function added: `upsertProgress`; function added: `toAttachmentPayload`; function added: `buildAttachmentPayload` ….
- **`src/lib/caseRealtime.js`** — added frontend library. function added: `isPlainObject`; function added: `isCaseEventType`; function added: `caseStreamPath`; function added: `normalizeCaseEvent`; function added: `parseSseLine`; function added: `createFrameParser` ….

## Detailed Diff Analysis

- **Areas touched:** frontend library (2 files, +696/-0).
- **Function added** (28): `compareBySequence`, `mergeMessages`, `mergeAttachments`, `upsertProgress`, `toAttachmentPayload`, `buildAttachmentPayload`, `applyStatusEvent`, `applyReportEvent`, `applyCaseEvent`, `applySent` …
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Client side of the portal (part 7A).

## Was It Useful

Useful.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0844 — Merge the Investigation Orchestration Workstream.
- **Precedes:** 0846 — Deliver Investigation Reports and Record the Real Outcome.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
