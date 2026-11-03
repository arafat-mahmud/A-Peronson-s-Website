# Commit 0844 — f22a92f

| Field | Value |
|-------|-------|
| **Commit Number** | 0844 |
| **Commit Hash** | f22a92fe0b78b34905a5ffccadbae0b1648c869e |
| **Parent Hash** | 7240c0fa75bc15090f3f14005299e84dbddbeed9, a10ee7453f072a84f5a1c0b084d62b8949342903 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 01:53:04 |
| **Branch** | main |
| **Files Changed** | 7 |
| **Additions** | 2521 |
| **Deletions** | 0 |
| **Net Change** | +2521 |
| **Merge Commit** | Yes |

## Merge the Investigation Orchestration Workstream

Merge commit bringing WS2 (queue, agents, findings) into the main line.

Original commit message: “merge: WS2 orchestration + verification (feat/ws2-orchestration)”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/services/investigationQueue.js` | Added | 867 | 0 | +867/-0 |
| `tests/integration/investigation-queue.test.js` | Added | 489 | 0 | +489/-0 |
| `server/services/investigation/findings.js` | Added | 408 | 0 | +408/-0 |
| `server/services/investigation/agents.js` | Added | 312 | 0 | +312/-0 |
| `tests/unit/server-investigation-findings.test.js` | Added | 220 | 0 | +220/-0 |
| `tests/unit/server-investigation-agents.test.js` | Added | 118 | 0 | +118/-0 |
| `tests/unit/server-investigation-verify.test.js` | Added | 107 | 0 | +107/-0 |

### What changed per file

- **`server/services/investigationQueue.js`** — added server service. function added: `queueDepth`; function added: `enqueueInvestigation`; function added: `dispatch`; function added: `concurrencyLimit`; function added: `createQueuedRows`; function added: `readPreviousAttempts` ….
- **`tests/integration/investigation-queue.test.js`** — added test. function added: `agentReply`; function added: `roleOf`; function added: `defaultAnswer`; function added: `rowFor`; function added: `lastRowFor`; function added: `waitForDrain` ….
- **`server/services/investigation/findings.js`** — added server service. function added: `isPlainObject`; function added: `coerceDetail`; function added: `coerceEvidenceValue`; function added: `normalizeEvidenceEntry`; function added: `normalizeEvidence`; function added: `normalizeFinding` ….
- **`server/services/investigation/agents.js`** — added server service. function added: `buildAgentPrompt`; function added: `buildVerifyPrompt`; function added: `applyVerification`; function added: `composePrompt`; function added: `renderCandidateSection`; function added: `renderBulletList` ….
- **`tests/unit/server-investigation-findings.test.js`** — added test. test case added: `extracts a fenced json block`; test case added: `extracts a bare balanced object`; test case added: `fails cleanly on prose with no object`; test case added: `normalizes and clamps confidence values`; test case added: `demotes a finding with no evidence`; test case added: `never throws, whatever it is handed` ….
- **`tests/unit/server-investigation-agents.test.js`** — added test. test case added: `declares exactly the five roles, in order`; test case added: `every role`; test case added: `the JSON contract is the exact string the parser is promised`; test case added: `each role states its own question`; test case added: `the verify prompt asks for refutation and names the candidate list`; test case added: `a prompt names the role it is for` ….
- **`tests/unit/server-investigation-verify.test.js`** — added test. test case added: `the verify prompt includes every candidate finding`; test case added: `a refuted finding is downgraded to speculative`; test case added: `an unevidenced finding never stays confirmed`; test case added: `an unevidenced finding is demoted even when the verifier endorsed it`; test case added: `a candidate the verifier could not refute keeps its confidence`; test case added: `the result carries exactly the finding shape, with an evidence array always` ….

## Detailed Diff Analysis

- **Areas touched:** server service (3 files, +1587/-0), test (4 files, +934/-0).
- **Function added** (68): `buildAgentPrompt`, `buildVerifyPrompt`, `applyVerification`, `composePrompt`, `renderCandidateSection`, `renderBulletList`, `normalizeRole`, `normalizeCandidates`, `coerceConfidence`, `renderEvidenceEntry` …
- **Test case added** (53): `queues one row per role and drains to zero when the run is over`, `a re-run of the same case gets a higher attempt`, `the runtime is started with a per-run random password`, `every role gets its own session, and the verifier runs last`, `the verify prompt carries the findings of the specialists`, `a refuted finding is downgraded in the final set and in its own row`, `a finding with no evidence never stays confirmed`, `the row of a role keeps its summary, findings, limitations and tool log`, `a reply that is not JSON is recorded as a failure, with the raw answer`, `a verification that fails leaves the findings recorded, but unverified` …
- **Tests:** 4 test file(s) changed: `tests/integration/investigation-queue.test.js`, `tests/unit/server-investigation-agents.test.js`, `tests/unit/server-investigation-findings.test.js`, `tests/unit/server-investigation-verify.test.js`
- **Merge:** diff shown against the first parent; the content was authored in the merged branch's commits.

## Why This Change Was Needed

Integrate parallel workstream branches.

## Was It Useful

Neutral. Merge.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. As a merge, its effect equals that of the merged branch commits.

## Relationship to Surrounding Commits

- **Follows:** 0843 — Merge the Support Case API Workstream.
- **Precedes:** 0845 — Add the Support Case Event Stream Client and State Hook.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
