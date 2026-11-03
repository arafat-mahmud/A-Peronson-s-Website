# Commit 0797 — 91703a8

| Field | Value |
|-------|-------|
| **Commit Number** | 0797 |
| **Commit Hash** | 91703a8f93cc01ad351816da8f27426d2daad92f |
| **Parent Hash** | ad2750f9e05b24e4d0a5b29b525effa71c4d8495 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-19 11:31:53 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 29 |
| **Deletions** | 24 |
| **Net Change** | +5 |
| **Merge Commit** | No |

## Drop the Launderable Artifact Path from Contract Provenance

Removes reliance on the contract artifact column for provenance, since requireAuth-only routes could write it.

Original commit message: “fix(uploads): drop the launderable artifact arm from contract provenance”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/server-file-access.test.js` | Modified | 18 | 16 | +18/-16 |
| `server/services/fileAccessService.js` | Modified | 11 | 8 | +11/-8 |

### What changed per file

- **`tests/unit/server-file-access.test.js`** — modified test. test case added: `denies a forged contract row laundered with an artifact`; test case added: `denies a party-less contract row to its claimed uploader`.
- **`server/services/fileAccessService.js`** — modified server service. +11/-8 lines.

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +18/-16), server service (1 file, +11/-8).
- **Test case added** (2): `denies a forged contract row laundered with an artifact`, `denies a party-less contract row to its claimed uploader`
- **Tests:** 1 test file(s) changed: `tests/unit/server-file-access.test.js`

## Why This Change Was Needed

A forged row could launder access through the artifact field.

## Was It Useful

Useful. Security.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0796 — Restore Creator Access to Blank-Party Contracts.
- **Precedes:** 0798 — Serve Private Files Only Through Signed URLs.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
