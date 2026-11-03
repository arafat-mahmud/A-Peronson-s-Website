# Commit 0832 — 0acfd91

| Field | Value |
|-------|-------|
| **Commit Number** | 0832 |
| **Commit Hash** | 0acfd91c65be272bc0d3fe52611b111d90165933 |
| **Parent Hash** | 76d40734360056cb2a7d31eb5f7e069272652b75 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-20 20:59:57 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 163 |
| **Deletions** | 38 |
| **Net Change** | +125 |
| **Merge Commit** | No |

## Assert the Composed Agent Permission Set

Tests check the effective permissions rather than the config shape.

Original commit message: “fix(investigation): assert the composed agent permission set, not its shape”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/server-investigation-runtime-config.test.js` | Modified | 163 | 38 | +163/-38 |

### What changed per file

- **`tests/unit/server-investigation-runtime-config.test.js`** — modified test. function added: `leafEffects`; function added: `expectNoAllowAtAnyDepth`; function added: `expectMutatingActionsStillDenied`; function added: `expectDeniedReadsNotWidened`; test case added: `the investigator`; test case added: `the global map denies every mutating action on every swept resource` ….

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +163/-38).
- **Function added** (4): `leafEffects`, `expectNoAllowAtAnyDepth`, `expectMutatingActionsStillDenied`, `expectDeniedReadsNotWidened`
- **Test case added** (5): `the investigator`, `the global map denies every mutating action on every swept resource`, `the global map denies reading .env and everything that looks like one`, `the global map allows exactly the read-only tools`, `an `
- **Tests:** 1 test file(s) changed: `tests/unit/server-investigation-runtime-config.test.js`

## Why This Change Was Needed

Shape checks would miss a permissive composition.

## Was It Useful

Useful. Test quality.

## Impact Analysis

No runtime behaviour change.

## Relationship to Surrounding Commits

- **Follows:** 0831 — Drop the Unrunnable CI Spike Job and Gate Agent Permissions.
- **Precedes:** 0833 — Require Explicit Deny for Sensitive Reads.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
