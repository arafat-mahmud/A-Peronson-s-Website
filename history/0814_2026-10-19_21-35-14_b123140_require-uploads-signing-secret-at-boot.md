# Commit 0814 — b123140

| Field | Value |
|-------|-------|
| **Commit Number** | 0814 |
| **Commit Hash** | b123140be922f9c76c50664bc1c60a60297ba86f |
| **Parent Hash** | 05942cd0c9dc324b8981dc79f6306b69c1ce6298 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-19 21:35:14 |
| **Branch** | main |
| **Files Changed** | 8 |
| **Additions** | 250 |
| **Deletions** | 6 |
| **Net Change** | +244 |
| **Merge Commit** | No |

## Require UPLOADS_SIGNING_SECRET at Boot

`envValidation` fails startup without a ≥32-char secret; `render.yaml` generates one; tests.

Original commit message: “fix(uploads): make the signing secret a required, deployable env var”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/integration/gated-static.test.js` | Modified | 78 | 1 | +78/-1 |
| `tests/unit/server-env-validation.test.js` | Added | 75 | 0 | +75/-0 |
| `tests/unit/server-signed-file-url.test.js` | Modified | 36 | 1 | +36/-1 |
| `server/utils/envValidation.js` | Added | 36 | 0 | +36/-0 |
| `server/utils/signedFileUrl.js` | Modified | 16 | 2 | +16/-2 |
| `render.yaml` | Modified | 5 | 0 | +5/-0 |
| `server/server.js` | Modified | 2 | 2 | +2/-2 |
| `.env.example` | Modified | 2 | 0 | +2/-0 |

### What changed per file

- **`tests/integration/gated-static.test.js`** — modified test. function added: `uploadsFoldersWrittenByServer`; test case added: `every folder the server writes uploads into is gated or explicitly public`; test case added: `every directory under server/uploads is gated or explicitly public`.
- **`tests/unit/server-env-validation.test.js`** — added test. test case added: `the signing secret is required`; test case added: `a complete environment has no problems`; test case added: `an unset signing secret is a boot failure, not a warning`; test case added: `a blank signing secret is a boot failure`; test case added: `a signing secret below the minimum length is a boot failure`; test case added: `a signing secret at exactly the minimum length is accepted` ….
- **`tests/unit/server-signed-file-url.test.js`** — modified test. test case added: `fails closed when the secret is shorter than the minimum length`; test case added: `signs with a secret at exactly the minimum length`.
- **`server/utils/envValidation.js`** — added server. function added: `findMissingEnvVars`.
- **`server/utils/signedFileUrl.js`** — modified server. +16/-2 lines.
- **`render.yaml`** — modified configuration. +5/-0 lines.
- **`server/server.js`** — modified server. +2/-2 lines.
- **`.env.example`** — modified configuration. +2/-0 lines.

## Detailed Diff Analysis

- **Areas touched:** test (3 files, +189/-2), server (3 files, +54/-4), configuration (2 files, +7/-0).
- **Function added** (2): `findMissingEnvVars`, `uploadsFoldersWrittenByServer`
- **Test case added** (11): `every folder the server writes uploads into is gated or explicitly public`, `every directory under server/uploads is gated or explicitly public`, `the signing secret is required`, `a complete environment has no problems`, `an unset signing secret is a boot failure, not a warning`, `a blank signing secret is a boot failure`, `a signing secret below the minimum length is a boot failure`, `a signing secret at exactly the minimum length is accepted`, `render.yaml declares the signing secret`, `fails closed when the secret is shorter than the minimum length` …
- **Tests:** 3 test file(s) changed: `tests/integration/gated-static.test.js`, `tests/unit/server-env-validation.test.js`, `tests/unit/server-signed-file-url.test.js`
- **Deployment:** changes `render.yaml` (Render Blueprint); takes effect on the next deploy of `main`.

## Why This Change Was Needed

Unset, every private file silently became unreachable.

## Was It Useful

Useful. Fail-fast configuration.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. Build/deploy or tooling configuration changes.

## Relationship to Surrounding Commits

- **Follows:** 0813 — Create Document Rows at Upload Time.
- **Precedes:** 0815 — Ask the Server Whether a Document May Leave the Browser.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).
- Contains or removes credential-bearing files; values are deliberately not reproduced here.
## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
