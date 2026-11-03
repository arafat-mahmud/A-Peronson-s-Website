# Commit 0860 — 929e108

| Field | Value |
|-------|-------|
| **Commit Number** | 0860 |
| **Commit Hash** | 929e10809041b6a23d5774d6b4561face16a7361 |
| **Parent Hash** | cc3950b221cdbd8cb3a3f49d5dd9efd8864470f8 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 04:11:35 |
| **Branch** | main |
| **Files Changed** | 5 |
| **Additions** | 32 |
| **Deletions** | 3 |
| **Net Change** | +29 |
| **Merge Commit** | No |

## Preserve Finding Categories and Use a Public Report URL

Delivery uses `RENDER_EXTERNAL_URL`/`APP_BASE_URL` for links; finding categories survive normalisation; render.yaml declares the base URL.

Original commit message: “fix(investigation): preserve the finding category, and a public base URL for the report link”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `AGENTS.md` | Modified | 11 | 0 | +11/-0 |
| `server/services/investigation/findings.js` | Modified | 9 | 1 | +9/-1 |
| `render.yaml` | Modified | 8 | 0 | +8/-0 |
| `server/services/investigation/agents.js` | Modified | 3 | 1 | +3/-1 |
| `server/services/investigation/delivery.js` | Modified | 1 | 1 | +1/-1 |

### What changed per file

- **`AGENTS.md`** — modified documentation. +11/-0 lines.
- **`server/services/investigation/findings.js`** — modified server service. +9/-1 lines.
- **`render.yaml`** — modified configuration. +8/-0 lines.
- **`server/services/investigation/agents.js`** — modified server service. +3/-1 lines.
- **`server/services/investigation/delivery.js`** — modified server service. +1/-1 lines.

## Detailed Diff Analysis

- **Areas touched:** server service (3 files, +13/-3), documentation (1 file, +11/-0), configuration (1 file, +8/-0).
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.
- **Deployment:** changes `render.yaml` (Render Blueprint); takes effect on the next deploy of `main`.

## Why This Change Was Needed

Emailed links pointed at localhost.

## Was It Useful

Useful.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. Build/deploy or tooling configuration changes.

## Relationship to Surrounding Commits

- **Follows:** 0859 — Finish Investigations: Report, Email, Escalation and Completion.
- **Precedes:** 0861 — Redact Secrets from Investigation Reports.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).
- Contains or removes credential-bearing files; values are deliberately not reproduced here.
## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
