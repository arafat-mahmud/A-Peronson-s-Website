# Commit 0868 — 349bc27

| Field | Value |
|-------|-------|
| **Commit Number** | 0868 |
| **Commit Hash** | 349bc275661001518b82d1fc7164d5e10078ef4e |
| **Parent Hash** | f56c73df3342922a1213d7f173d4d2a22730fbd7 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 13:57:45 |
| **Branch** | main |
| **Files Changed** | 6 |
| **Additions** | 341 |
| **Deletions** | 24 |
| **Net Change** | +317 |
| **Merge Commit** | No |

## Fall Back Through the Free Model Chain and Stop Over-Escalating

Per-model quota failures advance to the next free model; an escalation false positive is fixed; tests.

Original commit message: “fix(investigation): fall back through the free model chain, and stop escalating capabilities”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/services/investigationQueue.js` | Modified | 103 | 20 | +103/-20 |
| `tests/unit/server-investigation-escalation-classifier.test.js` | Added | 76 | 0 | +76/-0 |
| `tests/unit/server-investigation-model-refusal.test.js` | Added | 76 | 0 | +76/-0 |
| `server/services/investigation/delivery.js` | Modified | 48 | 4 | +48/-4 |
| `server/services/opencodeTurns.js` | Modified | 21 | 0 | +21/-0 |
| `server/services/investigation/opencodeRuntime.js` | Modified | 17 | 0 | +17/-0 |

### What changed per file

- **`server/services/investigationQueue.js`** — modified server service. function removed: `runRole`; function added: `runRole`; function added: `runRoleOnce`; function removed: `pickModel`; function added: `pickModels`.
- **`tests/unit/server-investigation-escalation-classifier.test.js`** — added test. test case added: `a finding that says the destructive route is never called does NOT escalate`; test case added: `the same finding WITH an explicit category still escalates`; test case added: `a REAL data-loss incident still escalates`; test case added: `a real hard delete of user data still escalates`; test case added: `a real security incident still escalates`; test case added: `an ordinary confirmed finding does not escalate` ….
- **`tests/unit/server-investigation-model-refusal.test.js`** — added test. function added: `refusedModel`; function added: `clientReturning`; test case added: `the turn carries the model`; test case added: `runAgentPrompt names the refusal and marks it retryable`.
- **`server/services/investigation/delivery.js`** — modified server service. +48/-4 lines.
- **`server/services/opencodeTurns.js`** — modified server service. +21/-0 lines.
- **`server/services/investigation/opencodeRuntime.js`** — modified server service. +17/-0 lines.

## Detailed Diff Analysis

- **Areas touched:** server service (4 files, +189/-24), test (2 files, +152/-0).
- **Function added** (5): `runRole`, `runRoleOnce`, `pickModels`, `refusedModel`, `clientReturning`
- **Function removed** (2): `runRole`, `pickModel`
- **Test case added** (9): `a finding that says the destructive route is never called does NOT escalate`, `the same finding WITH an explicit category still escalates`, `a REAL data-loss incident still escalates`, `a real hard delete of user data still escalates`, `a real security incident still escalates`, `an ordinary confirmed finding does not escalate`, `a probable finding never escalates on its text alone`, `the turn carries the model`, `runAgentPrompt names the refusal and marks it retryable`
- **Tests:** 2 test file(s) changed: `tests/unit/server-investigation-escalation-classifier.test.js`, `tests/unit/server-investigation-model-refusal.test.js`

## Why This Change Was Needed

The fallback chain was never actually used.

## Was It Useful

Useful.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0867 — Treat a Message Without finish as Still Being Written.
- **Precedes:** 0869 — Record the Model-Chain Fallback Lessons.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
