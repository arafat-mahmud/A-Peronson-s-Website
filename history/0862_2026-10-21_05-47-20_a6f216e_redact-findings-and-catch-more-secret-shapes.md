# Commit 0862 — a6f216e

| Field | Value |
|-------|-------|
| **Commit Number** | 0862 |
| **Commit Hash** | a6f216ed1a22b89e5a3c87c6558e69653ca3e7af |
| **Parent Hash** | cee57f2c1db193522246ceba56f443a9f8c05e99 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 05:47:20 |
| **Branch** | main |
| **Files Changed** | 7 |
| **Additions** | 849 |
| **Deletions** | 35 |
| **Net Change** | +814 |
| **Merge Commit** | No |

## Redact Findings and Catch More Secret Shapes

Redaction is applied to stored/streamed findings too, with more patterns; tests.

Original commit message: “fix(security): redact the findings, and the secret shapes the redactor missed”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/services/investigation/redaction.js` | Modified | 275 | 25 | +275/-25 |
| `tests/unit/server-investigation-redaction.test.js` | Modified | 220 | 0 | +220/-0 |
| `tests/integration/investigation-queue.test.js` | Modified | 216 | 0 | +216/-0 |
| `tests/integration/support-case-isolation.test.js` | Modified | 51 | 0 | +51/-0 |
| `server/routes/adminRoutes.js` | Modified | 48 | 1 | +48/-1 |
| `server/services/investigationQueue.js` | Modified | 37 | 8 | +37/-8 |
| `README.md` | Modified | 2 | 1 | +2/-1 |

### What changed per file

- **`server/services/investigation/redaction.js`** — modified server service. function removed: `isSecretVariableName`; function added: `isSecretName`; function added: `redactUrlQuerySecrets`; function added: `redactEvidenceEntry`; function added: `redactFindingSecrets`; function added: `redactFindingsSecrets`.
- **`tests/unit/server-investigation-redaction.test.js`** — modified test. test case added: `a secret inside a URL query string does not survive`; test case added: `a secret inside a URL query string survives the URL`; test case added: `the other parameters of a query string survive`; test case added: `an AWS-style access key id does not survive`; test case added: `a lower-case secret name does not survive`; test case added: `a lower-case api_key does not survive` ….
- **`tests/integration/investigation-queue.test.js`** — modified test. function added: `collectFindingEvents`; test case added: `an agent answer that quotes a secret leaves no secret in the database`; test case added: `an agent answer that quotes a secret leaves no secret on the event stream`; test case added: `the escalation does not carry the secret either`; test case added: `a finding whose only evidence is a URL is not demoted`; test case added: `a finding whose only evidence is a path that does not exist is still demoted`.
- **`tests/integration/support-case-isolation.test.js`** — modified test. test case added: `a re-run the queue refuses is a 429, and the case is put back`; test case added: `a re-run the queue refuses does not leave the case investigating`.
- **`server/routes/adminRoutes.js`** — modified API route. function added: `restoreCaseAfterRefusal`.
- **`server/services/investigationQueue.js`** — modified server service. +37/-8 lines.
- **`README.md`** — modified documentation. +2/-1 lines.

## Detailed Diff Analysis

- **Areas touched:** test (3 files, +487/-0), server service (2 files, +312/-33), API route (1 file, +48/-1), documentation (1 file, +2/-1).
- **Function added** (7): `restoreCaseAfterRefusal`, `isSecretName`, `redactUrlQuerySecrets`, `redactEvidenceEntry`, `redactFindingSecrets`, `redactFindingsSecrets`, `collectFindingEvents`
- **Function removed** (1): `isSecretVariableName`
- **Test case added** (24): `an agent answer that quotes a secret leaves no secret in the database`, `an agent answer that quotes a secret leaves no secret on the event stream`, `the escalation does not carry the secret either`, `a finding whose only evidence is a URL is not demoted`, `a finding whose only evidence is a path that does not exist is still demoted`, `a re-run the queue refuses is a 429, and the case is put back`, `a re-run the queue refuses does not leave the case investigating`, `a secret inside a URL query string does not survive`, `a secret inside a URL query string survives the URL`, `the other parameters of a query string survive` …
- **Tests:** 3 test file(s) changed: `tests/integration/investigation-queue.test.js`, `tests/integration/support-case-isolation.test.js`, `tests/unit/server-investigation-redaction.test.js`

## Why This Change Was Needed

The first pass covered only the report artefact.

## Was It Useful

Useful. Security.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0861 — Redact Secrets from Investigation Reports.
- **Precedes:** 0863 — Publish the Portal Decision Ledger.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
