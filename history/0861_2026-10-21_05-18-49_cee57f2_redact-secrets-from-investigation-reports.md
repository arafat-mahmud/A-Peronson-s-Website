# Commit 0861 — cee57f2

| Field | Value |
|-------|-------|
| **Commit Number** | 0861 |
| **Commit Hash** | cee57f2c1db193522246ceba56f443a9f8c05e99 |
| **Parent Hash** | 929e10809041b6a23d5774d6b4561face16a7361 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 05:18:49 |
| **Branch** | main |
| **Files Changed** | 28 |
| **Additions** | 2061 |
| **Deletions** | 242 |
| **Net Change** | +1819 |
| **Merge Commit** | No |

## Redact Secrets from Investigation Reports

Adds a shape-based redaction pass (connection strings, tokens, passwords, long blobs) and other final-review fixes across 28 files.

Original commit message: “fix(security): close the final review findings on the investigation portal”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/services/assistantService.js` | Modified | 149 | 122 | +149/-122 |
| `server/controllers/caseController.js` | Modified | 142 | 52 | +142/-52 |
| `tests/integration/support-case-api.test.js` | Modified | 180 | 14 | +180/-14 |
| `tests/unit/server-investigation-redaction.test.js` | Added | 181 | 0 | +181/-0 |
| `server/services/investigation/redaction.js` | Added | 168 | 0 | +168/-0 |
| `tests/integration/investigation-queue.test.js` | Modified | 155 | 5 | +155/-5 |
| `tests/integration/investigation-delivery.test.js` | Modified | 156 | 2 | +156/-2 |
| `tests/unit/server-assistant-opencode-isolation.test.js` | Added | 151 | 0 | +151/-0 |
| `server/services/investigation/opencodeRuntime.js` | Modified | 109 | 15 | +109/-15 |
| `server/services/investigationQueue.js` | Modified | 120 | 3 | +120/-3 |
| `tests/unit/server-investigation-findings.test.js` | Modified | 99 | 0 | +99/-0 |
| `tests/unit/server-investigation-agents.test.js` | Modified | 76 | 0 | +76/-0 |
| `server/services/investigation/delivery.js` | Modified | 66 | 6 | +66/-6 |
| `server/services/investigation/findings.js` | Modified | 61 | 0 | +61/-0 |
| `server/routes/caseRoutes.js` | Modified | 49 | 7 | +49/-7 |
| `server/services/investigation/agents.js` | Modified | 54 | 2 | +54/-2 |
| `server/realtime/realtimeBus.js` | Modified | 26 | 4 | +26/-4 |
| `tests/integration/support-case-isolation.test.js` | Modified | 22 | 0 | +22/-0 |
| `tests/unit/server-investigation-runtime-config.test.js` | Modified | 21 | 0 | +21/-0 |
| `server/services/investigation/report.js` | Modified | 15 | 2 | +15/-2 |
| `server/middleware/rateLimiter.js` | Modified | 15 | 1 | +15/-1 |
| `.env.example` | Modified | 10 | 0 | +10/-0 |
| `docs/server/Assistant.md` | Modified | 7 | 2 | +7/-2 |
| `server/services/investigation/runtimeConfig.js` | Modified | 9 | 0 | +9/-0 |
| `server/routes/adminRoutes.js` | Modified | 6 | 1 | +6/-1 |
| `server/routes/assistantRoutes.js` | Modified | 6 | 1 | +6/-1 |
| `docs/rollout/2026-10-20-support-attachment-migration.md` | Modified | 4 | 2 | +4/-2 |
| `server/controllers/assistantController.js` | Modified | 4 | 1 | +4/-1 |

### What changed per file

- **`server/services/assistantService.js`** — modified server service. function removed: `findFreePort`; function removed: `isOpencodeBinaryAvailable`; function added: `removeAssistantConfigDir`.
- **`server/controllers/caseController.js`** — modified API controller. function removed: `canReadCase`; function added: `maxOpenCases`; function removed: `countClientMessages`; function added: `investigationQueueFullError`; function added: `loadInvestigationQueue`; function added: `assertQueueHasRoom`.
- **`tests/integration/support-case-api.test.js`** — modified test. test case added: `the write routes are rate limited per user`; test case added: `the rate limit is counted per user, not per address`; test case added: `a full investigation queue is refused with a clear 429`; test case added: `a refused case is left where it was`; test case added: `one user cannot open more cases than the cap allows`; test case added: `a closed case does not count against the cap` ….
- **`tests/unit/server-investigation-redaction.test.js`** — added test. test case added: `the connection string does not survive`; test case added: `the signing secret does not survive`; test case added: `the admin code does not survive`; test case added: `the surrounding report text does survive`; test case added: `the structure of the report is intact`; test case added: `the redacted values are marked, not merely removed` ….
- **`server/services/investigation/redaction.js`** — added server service. function added: `isSecretVariableName`; function added: `redactReportSecrets`.
- **`tests/integration/investigation-queue.test.js`** — modified test. test case added: `the queue reports its depth and its limit`; test case added: `the queue refuses the work when the backlog is over the limit`; test case added: `the refusal is a 429, so the caller can be told to try again`; test case added: `a refused job leaves no queued rows behind`; test case added: `the report is redacted before it is persisted and mailed`.
- **`tests/integration/investigation-delivery.test.js`** — modified test. function added: `withBaseUrlEnv`; test case added: `the link carries the case id`; test case added: `a bare hostname gets a scheme`; test case added: `Render`; test case added: `a base url with a scheme is left alone`; test case added: `the link is absolute even when only the bare hostname is configured` ….
- **`tests/unit/server-assistant-opencode-isolation.test.js`** — added test. function added: `buildApp`; test case added: `the spawn env carries an isolated configuration directory`; test case added: `the spawn env disables the project configuration`; test case added: `the spawn env carries the server password`; test case added: `the configuration denies everything first`; test case added: `the configuration allows only the read-only tools` ….
- **`server/services/investigation/opencodeRuntime.js`** — modified server service. function added: `resolveOpencodeBinary`; function added: `createIsolatedConfigDir`; function added: `buildIsolatedRuntimeEnv`; function added: `buildAssistantRuntimeEnv`; function added: `findFreeRuntimePort`.
- **`server/services/investigationQueue.js`** — modified server service. function added: `maxQueueDepth`; function added: `queueCapacity`; function added: `resolvesInsideRepository`.
- **`tests/unit/server-investigation-findings.test.js`** — modified test. function added: `isResolvable`; test case added: `a finding whose cited file resolves keeps its confidence`; test case added: `a finding whose cited file does not resolve is demoted`; test case added: `the unresolvable reference is named`; test case added: `one unresolvable reference demotes the whole finding`; test case added: `a finding with no evidence at all is left to the other demotion` ….
- **`tests/unit/server-investigation-agents.test.js`** — modified test. test case added: `the client`; test case added: `every role`; test case added: `the prompt forbids reproducing a secret`; test case added: `the verify prompt fences the client`; test case added: `the client cannot close the fence early`; test case added: `the JSON contract is still the last thing in the prompt`.

## Detailed Diff Analysis

- **Areas touched:** test (9 files, +1041/-21), server service (9 files, +751/-150), API controller (2 files, +146/-53), API route (3 files, +61/-9), server (1 file, +26/-4), server middleware (1 file, +15/-1), documentation (2 files, +11/-4), configuration (1 file, +10/-0).
- **Route modified (middleware/handler changed)** (7): `DELETE /:caseId`, `GET /`, `GET /:caseId`, `GET /:caseId/stream`, `POST /`, `POST /:caseId/confirm`, `POST /ask-public`
- **Route removed** (1): `POST /:caseId/messages`
- **Function added** (23): `maxOpenCases`, `investigationQueueFullError`, `loadInvestigationQueue`, `assertQueueHasRoom`, `resetRateLimitCounters`, `caseEventChannel`, `removeAssistantConfigDir`, `fenceUntrusted`, `normalizeBaseUrl`, `demoteUnverifiedReferences` …
- **Function removed** (4): `canReadCase`, `countClientMessages`, `findFreePort`, `isOpencodeBinaryAvailable`
- **Test case added** (63): `the link carries the case id`, `a bare hostname gets a scheme`, `Render`, `a base url with a scheme is left alone`, `the link is absolute even when only the bare hostname is configured`, `the event is fired with the report when the mail goes out`, `the event is fired even when the mail did not go out`, `the secret does not reach the client`, `the secret does not reach the mailbox`, `the queue reports its depth and its limit` …
- **Tests:** 9 test file(s) changed: `tests/integration/investigation-delivery.test.js`, `tests/integration/investigation-queue.test.js`, `tests/integration/support-case-api.test.js`, `tests/integration/support-case-isolation.test.js`, `tests/unit/server-assistant-opencode-isolation.test.js` …

## Why This Change Was Needed

Reports could quote repository secrets back to a client.

## Was It Useful

Useful. Important security fix.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. Build/deploy or tooling configuration changes.

## Relationship to Surrounding Commits

- **Follows:** 0860 — Preserve Finding Categories and Use a Public Report URL.
- **Precedes:** 0862 — Redact Findings and Catch More Secret Shapes.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
