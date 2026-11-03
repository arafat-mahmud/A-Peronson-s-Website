# Commit 0793 — 7724218

| Field | Value |
|-------|-------|
| **Commit Number** | 0793 |
| **Commit Hash** | 7724218ad079d5fbaf80ad9378af8feb3693ced9 |
| **Parent Hash** | 9941cf0f359d692c3014bee901d8095c68f725f9 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-19 01:51:35 |
| **Branch** | main |
| **Files Changed** | 2 |
| **Additions** | 173 |
| **Deletions** | 22 |
| **Net Change** | +151 |
| **Merge Commit** | No |

## Close Fail-Open Paths in the Signed-URL Core

Case-insensitive gated-path matching and other review fixes, with tests.

Original commit message: “fix(uploads): close fail-open paths in signed url core”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/server-signed-file-url.test.js` | Modified | 131 | 12 | +131/-12 |
| `server/utils/signedFileUrl.js` | Modified | 42 | 10 | +42/-10 |

### What changed per file

- **`tests/unit/server-signed-file-url.test.js`** — modified test. function added: `withFakeNow`; test case added: `classifies gated prefixes case-insensitively`; test case added: `refuses to resolve the uploads root itself`; test case added: `round-trips a numeric user id`; test case added: `refuses to sign without a user id`; test case added: `rejects a blank user id before hashing` ….
- **`server/utils/signedFileUrl.js`** — modified server. function added: `normalizeUserId`.

## Detailed Diff Analysis

- **Areas touched:** test (1 file, +131/-12), server (1 file, +42/-10).
- **Function added** (2): `normalizeUserId`, `withFakeNow`
- **Test case added** (9): `classifies gated prefixes case-insensitively`, `refuses to resolve the uploads root itself`, `round-trips a numeric user id`, `refuses to sign without a user id`, `rejects a blank user id before hashing`, `treats the exact expiry millisecond as already expired`, `rejects a ttl outside the short-lived window`, `accepts the media ttl ceiling`, `falls back to the default ttl when none is given`
- **Tests:** 1 test file(s) changed: `tests/unit/server-signed-file-url.test.js`

## Why This Change Was Needed

Case differences on case-insensitive filesystems bypassed the gate.

## Was It Useful

Useful. Security hardening.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0792 — Add the HMAC Signed-URL Core for Private Files.
- **Precedes:** 0794 — Authorize Private Files Through Document Records.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
