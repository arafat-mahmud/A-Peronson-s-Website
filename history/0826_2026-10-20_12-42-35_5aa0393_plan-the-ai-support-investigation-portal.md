# Commit 0826 — 5aa0393

| Field | Value |
|-------|-------|
| **Commit Number** | 0826 |
| **Commit Hash** | 5aa03930c46b4a5913a5be587b4d09ec6bee3388 |
| **Parent Hash** | fe6f062ba23b4ac859d25f670b3a5a87bdbfa292 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-20 12:42:35 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 1385 |
| **Deletions** | 0 |
| **Net Change** | +1385 |
| **Merge Commit** | No |

## Plan the AI Support Investigation Portal

Eight-task TDD plan with a live 'spike gate' proving the agent cannot write, run shell, read `.env` or escape.

Original commit message: “docs(plan): AI support investigation portal implementation plan”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `docs/plans/2026-10-20-ai-support-investigation-portal.md` | Added | 1385 | 0 | +1385/-0 |

### What changed per file

- **`docs/plans/2026-10-20-ai-support-investigation-portal.md`** — added documentation. test case added: `uses the singular `; test case added: `denies everything first, then allows only read-only tools`; test case added: `denies every mutating or ambient capability`; test case added: `denies the named MCP servers by tool glob`; test case added: `denies an explicitly requested extra MCP server too`; test case added: `ships an investigator agent that also denies edit and bash` ….

## Detailed Diff Analysis

- **Areas touched:** documentation (1 file, +1385/-0).
- **Prisma model added** (4): `SupportCase`, `SupportCaseMessage`, `SupportInvestigation`, `SupportCaseAttachment`
- **Function added** (16): `buildInvestigationConfig`, `parseModelChain`, `resolveBinary`, `findFreePort`, `startInvestigationRuntime`, `createInvestigationSession`, `runAgentPrompt`, `listAvailableModels`, `searchSourceTree`, `buildApp` …
- **Test case added** (25): `uses the singular `, `denies everything first, then allows only read-only tools`, `denies every mutating or ambient capability`, `denies the named MCP servers by tool glob`, `denies an explicitly requested extra MCP server too`, `ships an investigator agent that also denies edit and bash`, `defaults to the ten free models, deepseek first`, `parses a comma separated list`, `drops blanks and duplicates, keeping order`, `falls back to the default chain for empty input` …
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Implementation plan.

## Was It Useful

Neutral. Planning.

## Impact Analysis

No runtime behaviour change.

## Relationship to Surrounding Commits

- **Follows:** 0825 — Decide Provider, Retention and Escalation for the Portal.
- **Precedes:** 0827 — Close Three Pre-Flight Conflicts in the Portal Plan.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
