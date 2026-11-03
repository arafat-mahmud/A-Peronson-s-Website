# Commit 0865 — 74f9051

| Field | Value |
|-------|-------|
| **Commit Number** | 0865 |
| **Commit Hash** | 74f9051afb5392fd739f17e7bd1bc88f5b40aec3 |
| **Parent Hash** | 0afea345c888f132008c98bacd5eecbde07a481f |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 13:01:46 |
| **Branch** | main |
| **Files Changed** | 4 |
| **Additions** | 162 |
| **Deletions** | 4 |
| **Net Change** | +158 |
| **Merge Commit** | No |

## Add a Tool-Call Budget and a Turn Reader That Waits

Prompts get a stopping condition/tool budget; the turn reader waits for the model to finish.

Original commit message: “fix(investigation): a tool-call budget, and a turn reader that waits for the model”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/server-investigation-agent-budget.test.js` | Added | 85 | 0 | +85/-0 |
| `server/services/investigation/agents.js` | Modified | 34 | 2 | +34/-2 |
| `server/services/investigationQueue.js` | Modified | 33 | 1 | +33/-1 |
| `server/services/opencodeTurns.js` | Modified | 10 | 1 | +10/-1 |

### What changed per file

- **`tests/unit/server-investigation-agent-budget.test.js`** — added test. test case added: `the ${role} prompt states a tool-call budget and says to answer when it is spent`; test case added: `the budget is configurable per prompt`; test case added: `a nonsense budget falls back to the default`; test case added: `the verify prompt carries the budget too`; function added: `makeSlowThinkingClient`; test case added: `a long pause between tool calls is NOT the end of the turn`.
- **`server/services/investigation/agents.js`** — modified server service. function added: `budgetGuidance`; function removed: `composePrompt`; function added: `composePrompt`.
- **`server/services/investigationQueue.js`** — modified server service. function added: `agentToolBudget`.
- **`server/services/opencodeTurns.js`** — modified server service. +10/-1 lines.

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +85/-0), server service (3 files, +77/-4).
- **Function added** (4): `budgetGuidance`, `composePrompt`, `agentToolBudget`, `makeSlowThinkingClient`
- **Function removed** (1): `composePrompt`
- **Test case added** (5): `the ${role} prompt states a tool-call budget and says to answer when it is spent`, `the budget is configurable per prompt`, `a nonsense budget falls back to the default`, `the verify prompt carries the budget too`, `a long pause between tool calls is NOT the end of the turn`
- **Tests:** 1 test file(s) changed: `tests/unit/server-investigation-agent-budget.test.js`

## Why This Change Was Needed

Live runs looped or cut answers short — invisible to mocked tests.

## Was It Useful

Useful.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0864 — Raise the Investigation Agent Timeout and Report It Honestly.
- **Precedes:** 0866 — Record the Budget, Reader and Process-Kill Lessons.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
