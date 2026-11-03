# GarTexHub developer guide

| Page | Contents |
| --- | --- |
| [Local setup](local-setup.md) | Prerequisites, install, database, running API + web, common problems |
| [Configuration](configuration.md) | Every environment variable group and what needs it |
| [Architecture](architecture.md) | Repo layout, frontend, backend, realtime, auth/sessions, search, assistant |
| [API reference](api-reference.md) | *Generated* — every HTTP endpoint with auth, roles and limits |
| [Database](database.md) | Prisma workflow, migrations, safety rules |
| [Database reference](database-reference.md) | *Generated* — every model/table, column and index |
| [Testing](testing.md) | Jest (unit/integration), Playwright, lint, the pre-commit hook |
| [Deployment & reliability](deployment.md) | Render Blueprint, build/start, health/readiness, crash recovery, shutdown |
| [Security](security.md) | Auth model, sessions, password reset, authorization rules, webhooks, secrets |
| [Performance](performance.md) | Bundle strategy, theme CSS splitting, lab benchmark, budgets |
| [Contributing](contributing.md) | Branches, commits, history log, docs regeneration, rules that are not negotiable |

Regenerate the two generated pages after changing routes or the Prisma schema:

```bash
pnpm run docs:generate   # writes docs/developer/api-reference.md and database-reference.md
pnpm run docs:check      # exits 1 if they are stale (use in CI)
```

Older per-file notes (pages, components, config, server) remain in the folders listed in
[docs/README.md](../README.md#older-reference-notes); they predate the 2026-11 changes and are not
regenerated, so prefer the source and the pages above when they disagree.
