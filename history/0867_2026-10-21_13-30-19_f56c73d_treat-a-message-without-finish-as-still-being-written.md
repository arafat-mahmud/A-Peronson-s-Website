# Commit 0867 — f56c73d

| Field | Value |
|-------|-------|
| **Commit Number** | 0867 |
| **Commit Hash** | f56c73df3342922a1213d7f173d4d2a22730fbd7 |
| **Parent Hash** | da603b596790a52208e50e90efeb2225ee36705e |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 13:30:19 |
| **Branch** | main |
| **Files Changed** | 4 |
| **Additions** | 178 |
| **Deletions** | 76 |
| **Net Change** | +102 |
| **Merge Commit** | No |

## Treat a Message Without finish as Still Being Written

The turn reader waits until `message.finish` settles.

Original commit message: “fix(investigation): a message with no finish is still being produced”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/server-opencode-turn-timeout.test.js` | Modified | 111 | 61 | +111/-61 |
| `server/services/opencodeTurns.js` | Modified | 56 | 12 | +56/-12 |
| `server/services/investigation/opencodeRuntime.js` | Modified | 8 | 0 | +8/-0 |
| `tests/unit/server-investigation-agent-budget.test.js` | Modified | 3 | 3 | +3/-3 |

### What changed per file

- **`tests/unit/server-opencode-turn-timeout.test.js`** — modified test. function removed: `makeNeverFinishingClient`; function added: `stillProducingMessage`; function added: `wedgedModel`; function removed: `makeAnsweringClient`; function added: `answeringModel`; function added: `clientReturning` ….
- **`server/services/opencodeTurns.js`** — modified server service. +56/-12 lines.
- **`server/services/investigation/opencodeRuntime.js`** — modified server service. +8/-0 lines.
- **`tests/unit/server-investigation-agent-budget.test.js`** — modified test. +3/-3 lines.

## Detailed Diff Analysis

- **Areas touched:** test (2 files, +114/-64), server service (2 files, +64/-12).
- **Function added** (4): `stillProducingMessage`, `wedgedModel`, `answeringModel`, `clientReturning`
- **Function removed** (2): `makeNeverFinishingClient`, `makeAnsweringClient`
- **Test case added** (5): `a message with NO finish is still being produced, so the reader waits`, `a model that promised a tool call and went quiet is a WEDGE, not a finish`, `a turn that finished normally is not a timeout and not a wedge`, `runAgentPrompt never blames the JSON parser for a turn that went wrong`, `a growing answer keeps the reader waiting instead of being cut off`
- **Tests:** 2 test file(s) changed: `tests/unit/server-investigation-agent-budget.test.js`, `tests/unit/server-opencode-turn-timeout.test.js`

## Why This Change Was Needed

Replies were read before the model finished.

## Was It Useful

Useful.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0866 — Record the Budget, Reader and Process-Kill Lessons.
- **Precedes:** 0868 — Fall Back Through the Free Model Chain and Stop Over-Escalating.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
