# Commit 0894 — b2287e8

| Field | Value |
|-------|-------|
| **Commit Number** | 0894 |
| **Commit Hash** | b2287e8f762286b63be52b9675eacf69bbe2f08f |
| **Parent Hash** | f3fbd975c851b4762f3b5841bbed0a800bb4a4c6 |
| **Author** | Tokyi |
| **Date/Time** | 2026-11-03 19:47:00 |
| **Branch** | fix/client-feedback-2026-11-03 |
| **Files Changed** | 24 |
| **Additions** | 4050 |
| **Deletions** | 15 |
| **Net Change** | +4035 |
| **Merge Commit** | No |

## Rebuild the User and Developer Documentation

New `docs/user/` and `docs/developer/` guides, generated API/database/env references and a working `docs:generate`; README corrections.

Original commit message: “Rebuild documentation: user guide, developer guide, generated references”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `docs/developer/database-reference.md` | Added | 1869 | 0 | +1869/-0 |
| `docs/developer/api-reference.md` | Added | 841 | 0 | +841/-0 |
| `scripts/docs/generate-reference.mjs` | Added | 281 | 0 | +281/-0 |
| `docs/developer/env-reference.md` | Added | 222 | 0 | +222/-0 |
| `docs/developer/architecture.md` | Added | 68 | 0 | +68/-0 |
| `docs/developer/security.md` | Added | 63 | 0 | +63/-0 |
| `docs/developer/deployment.md` | Added | 62 | 0 | +62/-0 |
| `docs/user/contracts-and-billing.md` | Added | 55 | 0 | +55/-0 |
| `docs/developer/local-setup.md` | Added | 54 | 0 | +54/-0 |
| `docs/developer/testing.md` | Added | 53 | 0 | +53/-0 |
| `docs/developer/performance.md` | Added | 52 | 0 | +52/-0 |
| `docs/developer/database.md` | Added | 48 | 0 | +48/-0 |
| `docs/user/getting-started.md` | Added | 46 | 0 | +46/-0 |
| `docs/developer/configuration.md` | Added | 44 | 0 | +44/-0 |
| `README.md` | Modified | 27 | 14 | +27/-14 |
| `docs/user/profiles-and-verification.md` | Added | 41 | 0 | +41/-0 |
| `docs/user/sourcing.md` | Added | 39 | 0 | +39/-0 |
| `docs/developer/contributing.md` | Added | 38 | 0 | +38/-0 |
| `docs/user/account-and-security.md` | Added | 38 | 0 | +38/-0 |
| `docs/README.md` | Added | 36 | 0 | +36/-0 |
| `docs/developer/README.md` | Added | 26 | 0 | +26/-0 |
| `docs/user/messaging-and-calls.md` | Added | 26 | 0 | +26/-0 |
| `docs/user/README.md` | Added | 19 | 0 | +19/-0 |
| `package.json` | Modified | 2 | 1 | +2/-1 |

### What changed per file

- **`docs/developer/database-reference.md`** — added documentation. +1869/-0 lines.
- **`docs/developer/api-reference.md`** — added documentation. +841/-0 lines.
- **`scripts/docs/generate-reference.mjs`** — added tooling script. component/const added: `HEADER`; function added: `splitArgs`; function added: `callArgs`; function added: `describeMiddleware`; function added: `parseRouter`; function added: `apiReference` ….
- **`docs/developer/env-reference.md`** — added documentation. +222/-0 lines.
- **`docs/developer/architecture.md`** — added documentation. +68/-0 lines.
- **`docs/developer/security.md`** — added documentation. +63/-0 lines.
- **`docs/developer/deployment.md`** — added documentation. +62/-0 lines.
- **`docs/user/contracts-and-billing.md`** — added documentation. +55/-0 lines.
- **`docs/developer/local-setup.md`** — added documentation. +54/-0 lines.
- **`docs/developer/testing.md`** — added documentation. +53/-0 lines.
- **`docs/developer/performance.md`** — added documentation. +52/-0 lines.
- **`docs/developer/database.md`** — added documentation. +48/-0 lines.

## Detailed Diff Analysis

- **Areas touched:** documentation (22 files, +3767/-14), tooling script (1 file, +281/-0), dependencies (1 file, +2/-1).
- **Function added** (8): `splitArgs`, `callArgs`, `describeMiddleware`, `parseRouter`, `apiReference`, `databaseReference`, `listFiles`, `envReference`
- **Component/const added** (1): `HEADER`
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Docs were stale and the generator scripts were missing.

## Was It Useful

Useful. Documentation.

## Impact Analysis

Dependency set changes; a fresh install is required.

## Relationship to Surrounding Commits

- **Follows:** 0893 — Add End-to-End Tests for Client-Critical Workflows.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
