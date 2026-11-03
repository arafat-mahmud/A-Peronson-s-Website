# Commit 0841 — a10ee74

| Field | Value |
|-------|-------|
| **Commit Number** | 0841 |
| **Commit Hash** | a10ee7453f072a84f5a1c0b084d62b8949342903 |
| **Parent Hash** | 41bbf14f6871a1eca5dee7b4bdc665ffc2cff0a9 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 01:42:12 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 1356 |
| **Deletions** | 0 |
| **Net Change** | +1356 |
| **Merge Commit** | No |

## Run Investigation Agents from a Bounded Queue

Queue that runs the five read-only agents with limits; tests.

Original commit message: “feat(investigation): run the five read-only agents from a bounded queue”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/services/investigationQueue.js` | Added | 867 | 0 | +867/-0 |
| `tests/integration/investigation-queue.test.js` | Added | 489 | 0 | +489/-0 |

### What changed per file

- **`server/services/investigationQueue.js`** — added server service. function added: `queueDepth`; function added: `enqueueInvestigation`; function added: `dispatch`; function added: `concurrencyLimit`; function added: `createQueuedRows`; function added: `readPreviousAttempts` ….
- **`tests/integration/investigation-queue.test.js`** — added test. function added: `agentReply`; function added: `roleOf`; function added: `defaultAnswer`; function added: `rowFor`; function added: `lastRowFor`; function added: `waitForDrain` ….

## Detailed Diff Analysis

- **Areas touched:** server service (1 file, +867/-0), test (1 file, +489/-0).
- **Function added** (40): `queueDepth`, `enqueueInvestigation`, `dispatch`, `concurrencyLimit`, `createQueuedRows`, `readPreviousAttempts`, `runInvestigation`, `runVerification`, `runRole`, `buildVerdict` …
- **Test case added** (13): `queues one row per role and drains to zero when the run is over`, `a re-run of the same case gets a higher attempt`, `the runtime is started with a per-run random password`, `every role gets its own session, and the verifier runs last`, `the verify prompt carries the findings of the specialists`, `a refuted finding is downgraded in the final set and in its own row`, `a finding with no evidence never stays confirmed`, `the row of a role keeps its summary, findings, limitations and tool log`, `a reply that is not JSON is recorded as a failure, with the raw answer`, `a verification that fails leaves the findings recorded, but unverified` …
- **Tests:** 1 test file(s) changed: `tests/integration/investigation-queue.test.js`

## Why This Change Was Needed

Investigations are slow and must not overload the host.

## Was It Useful

Useful.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0840 — Add the Clarification Answerer, Case Events and API Mount.
- **Precedes:** 0842 — Render Support Case Reports as Markdown.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
