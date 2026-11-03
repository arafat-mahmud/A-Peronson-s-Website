# Commit 0874 — 1aba381

| Field | Value |
|-------|-------|
| **Commit Number** | 0874 |
| **Commit Hash** | 1aba381adb42b07c34552e8f764cac620a8953d1 |
| **Parent Hash** | 176e07f5c1b1723d73ab044b39f804829343969b |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-22 18:44:49 |
| **Branch** | main |
| **Files Changed** | 9 |
| **Additions** | 159 |
| **Deletions** | 93 |
| **Net Change** | +66 |
| **Merge Commit** | No |

## Give AI Routes a Longer Request Budget; Untrack the Session Cache

AI routes get `AI_REQUEST_TIMEOUT_MS` (180 s default); `sessions/` cache is no longer tracked; tests.

Original commit message: “fix(assistant): the AI routes get their own request budget, and the session cache stops being tracked”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `sessions/session_meta.json` | Deleted | 0 | 82 | +0/-82 |
| `tests/unit/server-request-timeout.test.js` | Added | 55 | 0 | +55/-0 |
| `tests/unit/server-assistant-opencode-isolation.test.js` | Modified | 38 | 0 | +38/-0 |
| `server/middleware/requestLogger.js` | Modified | 28 | 1 | +28/-1 |
| `render.yaml` | Modified | 13 | 3 | +13/-3 |
| `AGENTS.md` | Modified | 13 | 0 | +13/-0 |
| `.env.example` | Modified | 8 | 0 | +8/-0 |
| `sessions/opencode_config.json` | Deleted | 0 | 7 | +0/-7 |
| `.gitignore` | Modified | 4 | 0 | +4/-0 |

### What changed per file

- **`sessions/session_meta.json`** — deleted other. +0/-82 lines.
- **`tests/unit/server-request-timeout.test.js`** — added test. test case added: `an ordinary route keeps the default budget`; test case added: `the assistant ask route gets the AI budget`; test case added: `the other assistant routes get it too`; test case added: `the ai routes get it too`; test case added: `a route that merely starts with the same letters is not an AI route`; test case added: `the AI budget is configurable` ….
- **`tests/unit/server-assistant-opencode-isolation.test.js`** — modified test. test case added: `keeps the newest messages when there are too many`; test case added: `drops the oldest messages until the history fits the character budget`; test case added: `a single oversized message is cut down to its newest end`; test case added: `an empty history stays empty`.
- **`server/middleware/requestLogger.js`** — modified server middleware. function added: `resolveRequestTimeoutMs`.
- **`render.yaml`** — modified configuration. +13/-3 lines.
- **`AGENTS.md`** — modified documentation. +13/-0 lines.
- **`.env.example`** — modified configuration. +8/-0 lines.
- **`sessions/opencode_config.json`** — deleted other. +0/-7 lines.
- **`.gitignore`** — modified configuration. +4/-0 lines.

## Detailed Diff Analysis

- **Areas touched:** test (2 files, +93/-0), other (2 files, +0/-89), server middleware (1 file, +28/-1), configuration (3 files, +25/-3), documentation (1 file, +13/-0).
- **Function added** (1): `resolveRequestTimeoutMs`
- **Test case added** (13): `keeps the newest messages when there are too many`, `drops the oldest messages until the history fits the character budget`, `a single oversized message is cut down to its newest end`, `an empty history stays empty`, `an ordinary route keeps the default budget`, `the assistant ask route gets the AI budget`, `the other assistant routes get it too`, `the ai routes get it too`, `a route that merely starts with the same letters is not an AI route`, `the AI budget is configurable` …
- **Tests:** 2 test file(s) changed: `tests/unit/server-assistant-opencode-isolation.test.js`, `tests/unit/server-request-timeout.test.js`
- **Deployment:** changes `render.yaml` (Render Blueprint); takes effect on the next deploy of `main`.

## Why This Change Was Needed

The 45 s global timeout abandoned AI turns; a runtime cache was committed.

## Was It Useful

Useful.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. Build/deploy or tooling configuration changes.

## Relationship to Surrounding Commits

- **Follows:** 0873 — Make the Chat Assistant's opencode Path Work.
- **Precedes:** 0875 — Put Gmail Credentials into render.yaml.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).
- Contains or removes credential-bearing files; values are deliberately not reproduced here.
## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
