# Commit 0864 — 0afea34

| Field | Value |
|-------|-------|
| **Commit Number** | 0864 |
| **Commit Hash** | 0afea345c888f132008c98bacd5eecbde07a481f |
| **Parent Hash** | 2bdbdcedb86db967b9813a4766d10371e6fcc6c9 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 11:59:57 |
| **Branch** | main |
| **Files Changed** | 6 |
| **Additions** | 240 |
| **Deletions** | 6 |
| **Net Change** | +234 |
| **Merge Commit** | No |

## Raise the Investigation Agent Timeout and Report It Honestly

Longer agent timeout and a clear timeout error instead of 'did not answer with JSON'; tests.

Original commit message: “fix(investigation): the agent timeout was 180s, and it was reported as a JSON bug”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/server-opencode-turn-timeout.test.js` | Added | 132 | 0 | +132/-0 |
| `tests/unit/server-investigation-agent-timeout.test.js` | Added | 40 | 0 | +40/-0 |
| `server/services/investigationQueue.js` | Modified | 23 | 3 | +23/-3 |
| `server/services/opencodeTurns.js` | Modified | 21 | 3 | +21/-3 |
| `AGENTS.md` | Modified | 12 | 0 | +12/-0 |
| `server/services/investigation/opencodeRuntime.js` | Modified | 12 | 0 | +12/-0 |

### What changed per file

- **`tests/unit/server-opencode-turn-timeout.test.js`** — added test. function added: `makeNeverFinishingClient`; function added: `makeAnsweringClient`; test case added: `waitForAssistantTurn says it timed out instead of returning a silent empty turn`; test case added: `a turn that settles normally is NOT reported as a timeout`; test case added: `runAgentPrompt reports a TIMEOUT, not an agent that said nothing`; test case added: `runAgentPrompt reports no error when the agent answered`.
- **`tests/unit/server-investigation-agent-timeout.test.js`** — added test. function added: `loadQueue`; test case added: `defaults to ten minutes, because a codebase investigation is not a one-shot question`; test case added: `honours INVESTIGATION_AGENT_TIMEOUT_MS`; test case added: `floors at 60s so a typo cannot turn a case into a one-minute no-op`; test case added: `ignores a value that is not a number`.
- **`server/services/investigationQueue.js`** — modified server service. function added: `agentTimeoutMs`.
- **`server/services/opencodeTurns.js`** — modified server service. +21/-3 lines.
- **`AGENTS.md`** — modified documentation. +12/-0 lines.
- **`server/services/investigation/opencodeRuntime.js`** — modified server service. +12/-0 lines.

## Detailed Diff Analysis

- **Areas touched:** test (2 files, +172/-0), server service (3 files, +56/-6), documentation (1 file, +12/-0).
- **Function added** (4): `agentTimeoutMs`, `loadQueue`, `makeNeverFinishingClient`, `makeAnsweringClient`
- **Test case added** (8): `defaults to ten minutes, because a codebase investigation is not a one-shot question`, `honours INVESTIGATION_AGENT_TIMEOUT_MS`, `floors at 60s so a typo cannot turn a case into a one-minute no-op`, `ignores a value that is not a number`, `waitForAssistantTurn says it timed out instead of returning a silent empty turn`, `a turn that settles normally is NOT reported as a timeout`, `runAgentPrompt reports a TIMEOUT, not an agent that said nothing`, `runAgentPrompt reports no error when the agent answered`
- **Tests:** 2 test file(s) changed: `tests/unit/server-investigation-agent-timeout.test.js`, `tests/unit/server-opencode-turn-timeout.test.js`

## Why This Change Was Needed

The first live run timed out at 180 s and looked like a parsing bug.

## Was It Useful

Useful.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0863 — Publish the Portal Decision Ledger.
- **Precedes:** 0865 — Add a Tool-Call Budget and a Turn Reader That Waits.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
