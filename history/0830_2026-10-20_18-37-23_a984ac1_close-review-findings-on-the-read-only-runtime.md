# Commit 0830 — a984ac1

| Field | Value |
|-------|-------|
| **Commit Number** | 0830 |
| **Commit Hash** | a984ac1f7a2a83ff5de729a6820dc680ca8b767d |
| **Parent Hash** | b69c0c1945dee37605ca86b74ee65b7b06d27ec5 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-20 18:37:23 |
| **Branch** | main |
| **Files Changed** | 10 |
| **Additions** | 737 |
| **Deletions** | 239 |
| **Net Change** | +498 |
| **Merge Commit** | No |

## Close Review Findings on the Read-Only Runtime

Extracts turn handling into `opencodeTurns.js`, simplifies the runtime, more tests.

Original commit message: “fix(investigation): close the read-only runtime review findings”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/services/investigation/opencodeRuntime.js` | Modified | 89 | 130 | +89/-130 |
| `server/services/opencodeTurns.js` | Added | 205 | 0 | +205/-0 |
| `tests/unit/server-opencode-turns.test.js` | Added | 141 | 0 | +141/-0 |
| `server/services/assistantService.js` | Modified | 31 | 61 | +31/-61 |
| `tests/integration/investigation-readonly.test.js` | Modified | 40 | 34 | +40/-34 |
| `tests/unit/server-investigation-runtime-config.test.js` | Modified | 59 | 3 | +59/-3 |
| `server/services/investigation/runtimeConfig.js` | Modified | 61 | 0 | +61/-0 |
| `server/services/investigation/modelChain.js` | Modified | 44 | 11 | +44/-11 |
| `.github/workflows/investigation-spike.yml` | Added | 45 | 0 | +45/-0 |
| `tests/unit/server-investigation-model-chain.test.js` | Modified | 22 | 0 | +22/-0 |

### What changed per file

- **`server/services/investigation/opencodeRuntime.js`** — modified server service. function added: `resolveRepositoryRoot`; function added: `assertRepositoryRoot`; function removed: `collectMessages`; function removed: `formatToolError`.
- **`server/services/opencodeTurns.js`** — added server service. function added: `sleep`; function added: `collectMessages`; function added: `formatToolError`; function added: `mapAssistantPart`; function added: `toChronologicalOrder`; function added: `selectNewestAssistant` ….
- **`tests/unit/server-opencode-turns.test.js`** — added test. function added: `makeClient`; function added: `assistantMessage`; test case added: `selects the NEWEST assistant message from a newest-first list`; test case added: `selects the newest assistant message even when the list is oldest-first`; test case added: `a second turn does not return the first turn`; test case added: `a stale finished message from an earlier turn does not settle the turn` ….
- **`server/services/assistantService.js`** — modified server service. function removed: `mapAssistantPart`.
- **`tests/integration/investigation-readonly.test.js`** — modified test. function removed: `matches`; function added: `expectReadOnlyToolset`.
- **`tests/unit/server-investigation-runtime-config.test.js`** — modified test. test case added: `disables the tools of the named MCP servers by tool glob`; test case added: `disables the tools of an explicitly requested extra MCP server too`; test case added: `denies every mutating tool`; test case added: `denies every ambient capability`; test case added: `allows exactly the read-only tools`; test case added: `denies reading .env and everything that looks like one` ….
- **`server/services/investigation/runtimeConfig.js`** — modified server service. function added: `matchesPattern`; function added: `resolveEffectivePermission`.
- **`server/services/investigation/modelChain.js`** — modified server service. function added: `isFreeOpencodeModel`.
- **`.github/workflows/investigation-spike.yml`** — added configuration. +45/-0 lines.
- **`tests/unit/server-investigation-model-chain.test.js`** — modified test. test case added: `refuses a provider that is not the free opencode tier`; test case added: `refuses a paid model on the opencode provider`; test case added: `falls back to the default chain when every entry is refused`; test case added: `keeps only free models, whatever the provider prefix says`.

## Detailed Diff Analysis

- **Areas touched:** server service (5 files, +430/-202), test (4 files, +262/-37), configuration (1 file, +45/-0).
- **Function added** (15): `isFreeOpencodeModel`, `resolveRepositoryRoot`, `assertRepositoryRoot`, `matchesPattern`, `resolveEffectivePermission`, `sleep`, `collectMessages`, `formatToolError`, `mapAssistantPart`, `toChronologicalOrder` …
- **Function removed** (4): `mapAssistantPart`, `collectMessages`, `formatToolError`, `matches`
- **Test case added** (18): `refuses a provider that is not the free opencode tier`, `refuses a paid model on the opencode provider`, `falls back to the default chain when every entry is refused`, `keeps only free models, whatever the provider prefix says`, `disables the tools of the named MCP servers by tool glob`, `disables the tools of an explicitly requested extra MCP server too`, `denies every mutating tool`, `denies every ambient capability`, `allows exactly the read-only tools`, `denies reading .env and everything that looks like one` …
- **Tests:** 4 test file(s) changed: `tests/integration/investigation-readonly.test.js`, `tests/unit/server-investigation-model-chain.test.js`, `tests/unit/server-investigation-runtime-config.test.js`, `tests/unit/server-opencode-turns.test.js`

## Why This Change Was Needed

Review findings on the first runtime version.

## Was It Useful

Useful.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. Build/deploy or tooling configuration changes.

## Relationship to Surrounding Commits

- **Follows:** 0829 — Add a Read-Only opencode Runtime for Investigations.
- **Precedes:** 0831 — Drop the Unrunnable CI Spike Job and Gate Agent Permissions.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
