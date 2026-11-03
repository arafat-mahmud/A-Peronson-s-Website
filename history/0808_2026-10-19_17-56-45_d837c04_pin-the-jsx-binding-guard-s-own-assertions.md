# Commit 0808 — d837c04

| Field | Value |
|-------|-------|
| **Commit Number** | 0808 |
| **Commit Hash** | d837c048d65c062061a868075ebc6a1167e14ff4 |
| **Parent Hash** | c9e2805758ab02cdeb94cd5a3e1e9864f78a45a0 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-19 17:56:45 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 260 |
| **Deletions** | 76 |
| **Net Change** | +184 |
| **Merge Commit** | No |

## Pin the JSX-Binding Guard's Own Assertions

Fixes guard tests that could never fail (e.g. `>= 0`) by pinning real counts.

Original commit message: “test(chat): pin the JSX-binding guard's own counts, positions and globals”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/frontend-jsx-bindings.test.js` | Modified | 260 | 76 | +260/-76 |

### What changed per file

- **`tests/unit/frontend-jsx-bindings.test.js`** — modified test. function added: `readSource`; function added: `jsxNameToString`; function removed: `injectProbe`; function added: `injectProbes`; test case added: `counts every JSX element, whatever its shape`; test case added: `plants one distinct probe at every JSX position` ….

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +260/-76).
- **Function added** (3): `readSource`, `jsxNameToString`, `injectProbes`
- **Function removed** (1): `injectProbe`
- **Test case added** (5): `counts every JSX element, whatever its shape`, `plants one distinct probe at every JSX position`, `flags a JSX name that resolves only to a runtime global`, `ignores identifiers used outside a JSX tag`, `reports a name bound only inside a narrower scope`
- **Tests:** 1 test file(s) changed: `tests/unit/frontend-jsx-bindings.test.js`

## Why This Change Was Needed

Six of 21 guard tests asserted nothing.

## Was It Useful

Useful. Test quality.

## Impact Analysis

No runtime behaviour change.

## Relationship to Surrounding Commits

- **Follows:** 0807 — Parse JSX Instead of Regex-Stripping in the Binding Guard.
- **Precedes:** 0809 — Report Log-Only Email Delivery as a Failure.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
