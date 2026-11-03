# Commit 0873 — 176e07f

| Field | Value |
|-------|-------|
| **Commit Number** | 0873 |
| **Commit Hash** | 176e07f5c1b1723d73ab044b39f804829343969b |
| **Parent Hash** | 2974b2ae91e9f100edc71fe24ffd3d1156bfe4c9 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-22 18:42:11 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 152 |
| **Deletions** | 13 |
| **Net Change** | +139 |
| **Merge Commit** | No |

## Make the Chat Assistant's opencode Path Work

Fixes six independent faults (wrong readiness route, etc.) in `assistantService`.

Original commit message: “fix(assistant): make the chat assistant's opencode path actually work”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/services/assistantService.js` | Modified | 152 | 13 | +152/-13 |

### What changed per file

- **`server/services/assistantService.js`** — modified server service. function added: `isOpencodeDisabled`; function added: `opencodeReadyTimeoutMs`; function added: `cachedSessionMatchesModel`; function added: `trimHistory`.

## Detailed Diff Analysis

- **Areas touched:** server service (1 file, +152/-13).
- **Function added** (4): `isOpencodeDisabled`, `opencodeReadyTimeoutMs`, `cachedSessionMatchesModel`, `trimHistory`
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

The assistant never answered through opencode.

## Was It Useful

Useful.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0872 — Add a Gmail SMTP Transport for Investigation Reports.
- **Precedes:** 0874 — Give AI Routes a Longer Request Budget; Untrack the Session Cache.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
