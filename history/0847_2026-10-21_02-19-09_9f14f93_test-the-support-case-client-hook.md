# Commit 0847 — 9f14f93

| Field | Value |
|-------|-------|
| **Commit Number** | 0847 |
| **Commit Hash** | 9f14f9378ef5b36118d8c8d017dc163462706477 |
| **Parent Hash** | efa3e34db1e31b9f6717ec3af5aebfbaf4ef3f82 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 02:19:09 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 319 |
| **Deletions** | 0 |
| **Net Change** | +319 |
| **Merge Commit** | No |

## Test the Support Case Client Hook

Tests for sending, investigating state and confirm calls.

Original commit message: “test(support): cover the support case client hook”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/frontend-support-case.test.js` | Added | 319 | 0 | +319/-0 |

### What changed per file

- **`tests/unit/frontend-support-case.test.js`** — added test. function added: `caseRow`; function added: `defaultResponses`; function added: `installApi`; test case added: `loads the case with the bearer token when it mounts`; test case added: `subscribes to the case event stream`; test case added: `send posts to the case messages endpoint and appends the message and the reply` ….

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +319/-0).
- **Function added** (3): `caseRow`, `defaultResponses`, `installApi`
- **Test case added** (11): `loads the case with the bearer token when it mounts`, `subscribes to the case event stream`, `send posts to the case messages endpoint and appends the message and the reply`, `send carries attachments in the shape contracts.md 3 defines`, `a ready response moves the case to investigating`, `a response that is not ready leaves the case collecting`, `confirm posts to the case confirm endpoint`, `applies the five contract event types from contracts.md 4`, `ignores an event type that is not one of the five`, `send posts nothing when no case is open` …
- **Tests:** 1 test file(s) changed: `tests/unit/frontend-support-case.test.js`

## Why This Change Was Needed

Cover part 7A.

## Was It Useful

Useful. Tests.

## Impact Analysis

No runtime behaviour change.

## Relationship to Surrounding Commits

- **Follows:** 0846 — Deliver Investigation Reports and Record the Real Outcome.
- **Precedes:** 0848 — Sweep Expired Support Cases and Their Evidence Files.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
