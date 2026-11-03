# Commit 0807 — c9e2805

| Field | Value |
|-------|-------|
| **Commit Number** | 0807 |
| **Commit Hash** | c9e2805758ab02cdeb94cd5a3e1e9864f78a45a0 |
| **Parent Hash** | 74c8c40955862b9588412cb57d5e4e8688e3df75 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-19 16:48:28 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 149 |
| **Deletions** | 89 |
| **Net Change** | +60 |
| **Merge Commit** | No |

## Parse JSX Instead of Regex-Stripping in the Binding Guard

The guard test now parses source instead of blanking strings with regexes.

Original commit message: “test(chat): parse the JSX-binding guard instead of regex-stripping source”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/frontend-jsx-bindings.test.js` | Modified | 149 | 89 | +149/-89 |

### What changed per file

- **`tests/unit/frontend-jsx-bindings.test.js`** — modified test. function removed: `stripCommentsAndStrings`; function added: `parseJsx`; function removed: `collectBindings`; function added: `findUnboundJsxNames`; function added: `countJsxElements`; function added: `injectProbe` ….

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +149/-89).
- **Function added** (4): `parseJsx`, `findUnboundJsxNames`, `countJsxElements`, `injectProbe`
- **Function removed** (3): `stripCommentsAndStrings`, `collectBindings`, `findUnboundJsxNames`
- **Test case added** (1): `finds an unbound element after an apostrophe in JSX text`
- **Tests:** 1 test file(s) changed: `tests/unit/frontend-jsx-bindings.test.js`

## Why This Change Was Needed

An apostrophe in JSX text broke the regex approach and hid most tags.

## Was It Useful

Useful. Test reliability.

## Impact Analysis

No runtime behaviour change.

## Relationship to Surrounding Commits

- **Follows:** 0806 — Restore a Missing LazyImage Import in the Chat Panel.
- **Precedes:** 0808 — Pin the JSX-Binding Guard's Own Assertions.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
