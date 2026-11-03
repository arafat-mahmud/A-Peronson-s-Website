# Commit 0796 — ad2750f

| Field | Value |
|-------|-------|
| **Commit Number** | 0796 |
| **Commit Hash** | ad2750f9e05b24e4d0a5b29b525effa71c4d8495 |
| **Parent Hash** | 47f949ba23108859a6548ff287b16f16dd1ed806 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-19 11:19:02 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 115 |
| **Deletions** | 7 |
| **Net Change** | +108 |
| **Merge Commit** | No |

## Restore Creator Access to Blank-Party Contracts

Contracts with empty buyer/factory ids are again readable by the creating manager, without trusting forged `uploaded_by`; the contract lookup is narrowed in SQL.

Original commit message: “fix(uploads): restore blank-party contract access and narrow the contract lookup in SQL”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/server-file-access.test.js` | Modified | 65 | 3 | +65/-3 |
| `server/services/fileAccessService.js` | Modified | 50 | 4 | +50/-4 |

### What changed per file

- **`tests/unit/server-file-access.test.js`** — modified test. test case added: `allows a blank-party contract to the manager who created it`; test case added: `allows a blank-party contract with a generated artifact to its creator`; test case added: `denies a blank-party contract to an unrelated user`; test case added: `denies an unknown entity type even when it carries a contract number`; test case added: `narrows the contract lookup to artifact.pdf_path in SQL`.
- **`server/services/fileAccessService.js`** — modified server service. function added: `hasContractProvenance`.

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +65/-3), server service (1 file, +50/-4).
- **Function added** (1): `hasContractProvenance`
- **Test case added** (5): `allows a blank-party contract to the manager who created it`, `allows a blank-party contract with a generated artifact to its creator`, `denies a blank-party contract to an unrelated user`, `denies an unknown entity type even when it carries a contract number`, `narrows the contract lookup to artifact.pdf_path in SQL`
- **Tests:** 1 test file(s) changed: `tests/unit/server-file-access.test.js`

## Why This Change Was Needed

The previous fix locked creators out of their own draft contracts.

## Was It Useful

Useful. Fixes a regression safely.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0795 — Stop Forged Document Rows from Granting File Access.
- **Precedes:** 0797 — Drop the Launderable Artifact Path from Contract Provenance.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
