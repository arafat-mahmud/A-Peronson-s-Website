# Commit 0893 — f3fbd97

| Field | Value |
|-------|-------|
| **Commit Number** | 0893 |
| **Commit Hash** | f3fbd975c851b4762f3b5841bbed0a800bb4a4c6 |
| **Parent Hash** | c3ffd270a176d5eebbf2c7cbb2fd1d499dc2a6e7 |
| **Author** | Tokyi |
| **Date/Time** | 2026-11-03 19:44:23 |
| **Branch** | fix/client-feedback-2026-11-03 |
| **Files Changed** | 1 |
| **Additions** | 127 |
| **Deletions** | 0 |
| **Net Change** | +127 |
| **Merge Commit** | No |

## Add End-to-End Tests for Client-Critical Workflows

Playwright spec covering the client tracker's browser flows on a phone viewport.

Original commit message: “Add Playwright e2e for the client-critical workflows”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/e2e/critical-workflows.spec.ts` | Added | 127 | 0 | +127/-0 |

### What changed per file

- **`tests/e2e/critical-workflows.spec.ts`** — added test. function added: `appUp`; test case added: `header shows the brand, not a cart icon, with the right descriptor (#12-13)`; test case added: `guest menu has no Settings or Dark mode; account items sit in the list (#2, #16)`; test case added: `footer links open the next page at the top (#14)`; test case added: `signup: form first, 3 password rules, mismatch only after confirming (#8b, #10)`; test case added: `verification standards are public and Get verified leads to login (#15)` ….

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +127/-0).
- **Function added** (1): `appUp`
- **Test case added** (9): `header shows the brand, not a cart icon, with the right descriptor (#12-13)`, `guest menu has no Settings or Dark mode; account items sit in the list (#2, #16)`, `footer links open the next page at the top (#14)`, `signup: form first, 3 password rules, mismatch only after confirming (#8b, #10)`, `verification standards are public and Get verified leads to login (#15)`, `the assistant answers a common question for guests (#5)`, `login links to the password reset page`, `forgot password gives the same answer for unknown emails (no enumeration)`, `a new factory account reaches onboarding (#9, #19)`
- **Tests:** 1 test file(s) changed: `tests/e2e/critical-workflows.spec.ts`

## Why This Change Was Needed

Regression protection for the client fixes.

## Was It Useful

Useful. Tests.

## Impact Analysis

No runtime behaviour change.

## Relationship to Surrounding Commits

- **Follows:** 0892 — Make the Reconcile Migration Apply to Empty Databases.
- **Precedes:** 0894 — Rebuild the User and Developer Documentation.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
