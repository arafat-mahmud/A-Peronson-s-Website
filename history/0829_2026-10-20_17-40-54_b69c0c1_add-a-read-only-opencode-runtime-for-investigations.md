# Commit 0829 — b69c0c1

| Field | Value |
|-------|-------|
| **Commit Number** | 0829 |
| **Commit Hash** | b69c0c1945dee37605ca86b74ee65b7b06d27ec5 |
| **Parent Hash** | 6ea0a457f05ef8e8eaa1f893c3bd8755dd8a6e61 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-20 17:40:54 |
| **Branch** | main |
| **Files Changed** | 11 |
| **Additions** | 1287 |
| **Deletions** | 255 |
| **Net Change** | +1032 |
| **Merge Commit** | No |

## Add a Read-Only opencode Runtime for Investigations

Spawns a restricted opencode runtime (read-only tools, permission config) with integration tests; refactors the assistant service.

Original commit message: “feat(investigation): read-only opencode runtime with a live spike gate”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/services/assistantService.js` | Modified | 292 | 238 | +292/-238 |
| `server/services/investigation/opencodeRuntime.js` | Added | 403 | 0 | +403/-0 |
| `tests/integration/investigation-readonly.test.js` | Added | 305 | 0 | +305/-0 |
| `server/services/investigation/runtimeConfig.js` | Added | 78 | 0 | +78/-0 |
| `package-lock.json` | Modified | 54 | 15 | +54/-15 |
| `tests/unit/server-investigation-runtime-config.test.js` | Added | 63 | 0 | +63/-0 |
| `server/services/investigation/modelChain.js` | Added | 38 | 0 | +38/-0 |
| `tests/unit/server-investigation-model-chain.test.js` | Added | 36 | 0 | +36/-0 |
| `.env.example` | Modified | 14 | 0 | +14/-0 |
| `biome.json` | Modified | 2 | 1 | +2/-1 |
| `package.json` | Modified | 2 | 1 | +2/-1 |

### What changed per file

- **`server/services/assistantService.js`** — modified server service. function added: `searchSourceTree`; function added: `opencodeV2Client`; function added: `mapAssistantPart`; function added: `promptOpencodeSession`.
- **`server/services/investigation/opencodeRuntime.js`** — added server service. function added: `sleep`; function added: `readShimTarget`; function added: `isV2Binary`; function added: `resolveBinary`; function added: `findFreePort`; function added: `startInvestigationRuntime` ….
- **`tests/integration/investigation-readonly.test.js`** — added test. function added: `newSession`; function added: `matches`; function added: `effectiveEffect`.
- **`server/services/investigation/runtimeConfig.js`** — added server service. function added: `buildInvestigationConfig`.
- **`package-lock.json`** — modified dependencies. +54/-15 lines.
- **`tests/unit/server-investigation-runtime-config.test.js`** — added test. test case added: `uses the singular `; test case added: `denies everything first, then allows only read-only tools`; test case added: `denies every mutating or ambient capability`; test case added: `denies the named MCP servers by tool glob`; test case added: `denies an explicitly requested extra MCP server too`; test case added: `ships an investigator agent that also denies edit and bash`.
- **`server/services/investigation/modelChain.js`** — added server service. function added: `parseModelChain`.
- **`tests/unit/server-investigation-model-chain.test.js`** — added test. test case added: `defaults to the ten free models, deepseek first`; test case added: `parses a comma separated list`; test case added: `drops blanks and duplicates, keeping order`; test case added: `falls back to the default chain for empty input`.
- **`.env.example`** — modified configuration. +14/-0 lines.
- **`biome.json`** — modified configuration. +2/-1 lines.
- **`package.json`** — modified dependencies. +2/-1 lines.

## Detailed Diff Analysis

- **Areas touched:** server service (4 files, +811/-238), test (3 files, +404/-0), dependencies (2 files, +56/-16), configuration (2 files, +16/-1).
- **Function added** (20): `searchSourceTree`, `opencodeV2Client`, `mapAssistantPart`, `promptOpencodeSession`, `parseModelChain`, `sleep`, `readShimTarget`, `isV2Binary`, `resolveBinary`, `findFreePort` …
- **Test case added** (10): `defaults to the ten free models, deepseek first`, `parses a comma separated list`, `drops blanks and duplicates, keeping order`, `falls back to the default chain for empty input`, `uses the singular `, `denies everything first, then allows only read-only tools`, `denies every mutating or ambient capability`, `denies the named MCP servers by tool glob`, `denies an explicitly requested extra MCP server too`, `ships an investigator agent that also denies edit and bash`
- **Dependencies:** removed/changed `@opencode-ai/sdk` ^1.15.3; added/changed `@opencode/client` ^2.0.32
- **Tests:** 3 test file(s) changed: `tests/integration/investigation-readonly.test.js`, `tests/unit/server-investigation-model-chain.test.js`, `tests/unit/server-investigation-runtime-config.test.js`

## Why This Change Was Needed

The investigator must never modify the repo or read secrets.

## Was It Useful

Useful. Security-conscious design.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. Build/deploy or tooling configuration changes. Dependency set changes; a fresh install is required.

## Relationship to Surrounding Commits

- **Follows:** 0828 — Make the Portal Spike Gate Opt-In.
- **Precedes:** 0830 — Close Review Findings on the Read-Only Runtime.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
