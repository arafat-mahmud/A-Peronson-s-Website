# Commit 0875 — 9ceecfa

| Field | Value |
|-------|-------|
| **Commit Number** | 0875 |
| **Commit Hash** | 9ceecfa1148bf6bbda98cbea769e03da5e1583d5 |
| **Parent Hash** | 1aba381adb42b07c34552e8f764cac620a8953d1 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-24 22:52:00 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 1 |
| **Deletions** | 1 |
| **Net Change** | +0 |
| **Merge Commit** | No |

## Put Gmail Credentials into render.yaml

Declares EMAIL_PROVIDER, GMAIL_USER, GMAIL_APP_PASSWORD and INVESTIGATION_REPORT_EMAIL_PROVIDER with literal values in `render.yaml` so the deployed instance needs no dashboard step (commit message: 'user asked, security off the table').

Original commit message: “config: put the Gmail credentials in render.yaml (user asked, security off the table)”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `render.yaml` | Modified | 1 | 1 | +1/-1 |

### What changed per file

- **`render.yaml`** — modified configuration. +1/-1 lines.

## Detailed Diff Analysis

- **Areas touched:** configuration (1 file, +1/-1).
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.
- **Deployment:** changes `render.yaml` (Render Blueprint); takes effect on the next deploy of `main`.

## Why This Change Was Needed

Owner request for zero-configuration email on Render (stated in the commit message).

## Was It Useful

Risky. The repository is public, so the credential values are exposed; they should be moved to the Render dashboard (`sync: false`) and rotated by the owner. Values are not reproduced here.

## Impact Analysis

Build/deploy or tooling configuration changes.

## Relationship to Surrounding Commits

- **Follows:** 0874 — Give AI Routes a Longer Request Budget; Untrack the Session Cache.
- **Precedes:** 0876 — Fix opencode Binary Detection and pnpm Dependency Overrides.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).
- Contains or removes credential-bearing files; values are deliberately not reproduced here.
## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
