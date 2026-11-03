# Commit 0837 — e4b8403

| Field | Value |
|-------|-------|
| **Commit Number** | 0837 |
| **Commit Hash** | e4b8403fec6cbd335d3fac74e2ffa3d92bad1283 |
| **Parent Hash** | f36444ec1a889efd081e3468ddb56e26273c8b79 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 00:57:16 |
| **Branch** | main |
| **Files Changed** | 3 |
| **Additions** | 537 |
| **Deletions** | 0 |
| **Net Change** | +537 |
| **Merge Commit** | No |

## Write Investigation Agent Prompts and Verification Helpers

Role prompts for the five agents plus verification helpers; tests.

Original commit message: “feat(investigation): agent role prompts and the verification helpers”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `server/services/investigation/agents.js` | Added | 312 | 0 | +312/-0 |
| `tests/unit/server-investigation-agents.test.js` | Added | 118 | 0 | +118/-0 |
| `tests/unit/server-investigation-verify.test.js` | Added | 107 | 0 | +107/-0 |

### What changed per file

- **`server/services/investigation/agents.js`** — added server service. function added: `buildAgentPrompt`; function added: `buildVerifyPrompt`; function added: `applyVerification`; function added: `composePrompt`; function added: `renderCandidateSection`; function added: `renderBulletList` ….
- **`tests/unit/server-investigation-agents.test.js`** — added test. test case added: `declares exactly the five roles, in order`; test case added: `every role`; test case added: `the JSON contract is the exact string the parser is promised`; test case added: `each role states its own question`; test case added: `the verify prompt asks for refutation and names the candidate list`; test case added: `a prompt names the role it is for` ….
- **`tests/unit/server-investigation-verify.test.js`** — added test. test case added: `the verify prompt includes every candidate finding`; test case added: `a refuted finding is downgraded to speculative`; test case added: `an unevidenced finding never stays confirmed`; test case added: `an unevidenced finding is demoted even when the verifier endorsed it`; test case added: `a candidate the verifier could not refute keeps its confidence`; test case added: `the result carries exactly the finding shape, with an evidence array always` ….

## Detailed Diff Analysis

- **Areas touched:** server service (1 file, +312/-0), test (2 files, +225/-0).
- **Function added** (13): `buildAgentPrompt`, `buildVerifyPrompt`, `applyVerification`, `composePrompt`, `renderCandidateSection`, `renderBulletList`, `normalizeRole`, `normalizeCandidates`, `coerceConfidence`, `renderEvidenceEntry` …
- **Test case added** (20): `declares exactly the five roles, in order`, `every role`, `the JSON contract is the exact string the parser is promised`, `each role states its own question`, `the verify prompt asks for refutation and names the candidate list`, `a prompt names the role it is for`, `an unknown role throws instead of silently becoming the lead prompt`, `a missing or malformed context still produces a usable prompt`, `evidence objects are rendered rather than dropped`, `the verify prompt carries every candidate finding and asks for refutation` …
- **Tests:** 2 test file(s) changed: `tests/unit/server-investigation-agents.test.js`, `tests/unit/server-investigation-verify.test.js`

## Why This Change Was Needed

Core of the investigation logic.

## Was It Useful

Useful.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0836 — Compare Case Owner Ids as Text.
- **Precedes:** 0838 — Parse, Normalise and Demote Agent Findings.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
