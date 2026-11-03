# Commit 0852 — 9172306

| Field | Value |
|-------|-------|
| **Commit Number** | 0852 |
| **Commit Hash** | 91723062246393c790fad6e587452ccd7ae29d71 |
| **Parent Hash** | 7172ee11ad69652640253aa32bfa355c71f9652e |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 02:40:02 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 916 |
| **Deletions** | 0 |
| **Net Change** | +916 |
| **Merge Commit** | No |

## Prove Clients Cannot Reach Each Other's Cases

End-to-end isolation test over the real routers, services and file resolver with an in-memory Prisma.

Original commit message: “test(support): prove a client can never reach another client's case”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/integration/support-case-isolation.test.js` | Added | 916 | 0 | +916/-0 |

### What changed per file

- **`tests/integration/support-case-isolation.test.js`** — added test. function added: `equalsValue`; function added: `matchesOperator`; function added: `matchField`; function added: `matchesWhere`; function added: `sortRows`; function added: `project` ….

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +916/-0).
- **Function added** (10): `equalsValue`, `matchesOperator`, `matchField`, `matchesWhere`, `sortRows`, `project`, `collection`, `buildApp`, `writeEvidence`, `seed`
- **Test case added** (21): `client A cannot read client B`, `client A`, `client A cannot post to client B`, `client A cannot delete client B`, `the owner of the case can read it - the 403 above is about the caller`, `the owner can open a case and post to it - 201`, `none of client B`, `client A cannot sign client B`, `client A cannot attach client B`, `client A cannot fetch client B` …
- **Tests:** 1 test file(s) changed: `tests/integration/support-case-isolation.test.js`

## Why This Change Was Needed

Cross-tenant access is the main risk of the feature.

## Was It Useful

Useful. Strong security test.

## Impact Analysis

No runtime behaviour change.

## Relationship to Surrounding Commits

- **Follows:** 0851 — Add the Admin Support Case Console.
- **Precedes:** 0853 — Add the Case Stream Endpoint and Evidence Ownership Checks.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
