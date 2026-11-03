# Commit 0838 — 41bbf14

| Field | Value |
|-------|-------|
| **Commit Number** | 0838 |
| **Commit Hash** | 41bbf14f6871a1eca5dee7b4bdc665ffc2cff0a9 |
| **Parent Hash** | e4b8403fec6cbd335d3fac74e2ffa3d92bad1283 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 01:00:34 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 628 |
| **Deletions** | 0 |
| **Net Change** | +628 |
| **Merge Commit** | No |

## Parse, Normalise and Demote Agent Findings

Turns agent output into structured findings and demotes unverified ones; tests.

Original commit message: “feat(investigation): parse, normalise and demote agent findings”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/services/investigation/findings.js` | Added | 408 | 0 | +408/-0 |
| `tests/unit/server-investigation-findings.test.js` | Added | 220 | 0 | +220/-0 |

### What changed per file

- **`server/services/investigation/findings.js`** — added server service. function added: `isPlainObject`; function added: `coerceDetail`; function added: `coerceEvidenceValue`; function added: `normalizeEvidenceEntry`; function added: `normalizeEvidence`; function added: `normalizeFinding` ….
- **`tests/unit/server-investigation-findings.test.js`** — added test. test case added: `extracts a fenced json block`; test case added: `extracts a bare balanced object`; test case added: `fails cleanly on prose with no object`; test case added: `normalizes and clamps confidence values`; test case added: `demotes a finding with no evidence`; test case added: `never throws, whatever it is handed` ….

## Detailed Diff Analysis

- **Areas touched:** server service (1 file, +408/-0), test (1 file, +220/-0).
- **Function added** (17): `isPlainObject`, `coerceDetail`, `coerceEvidenceValue`, `normalizeEvidenceEntry`, `normalizeEvidence`, `normalizeFinding`, `extractFindingsList`, `stripFenceLanguage`, `collectFencedCandidates`, `stepScan` …
- **Test case added** (20): `extracts a fenced json block`, `extracts a bare balanced object`, `fails cleanly on prose with no object`, `normalizes and clamps confidence values`, `demotes a finding with no evidence`, `never throws, whatever it is handed`, `reports a reason for each kind of failure`, `prefers a fenced block over an object in the surrounding prose`, `ignores braces that live inside strings`, `keeps the whole nested object` …
- **Tests:** 1 test file(s) changed: `tests/unit/server-investigation-findings.test.js`

## Why This Change Was Needed

Model output must be validated before it reaches a report.

## Was It Useful

Useful.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0837 — Write Investigation Agent Prompts and Verification Helpers.
- **Precedes:** 0839 — Add the Support Case API with Ownership Checks.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
