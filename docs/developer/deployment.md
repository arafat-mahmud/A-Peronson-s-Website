# Deployment & reliability

## Render (production)

Defined by the Blueprint `render.yaml`: one **Web Service on the `free` plan** behind Cloudflare
(Brotli at the edge). Keep it on `free` — no paid instances, workers, disks or databases — and use only
real Blueprint fields.

| | |
| --- | --- |
| Trigger | `autoDeployTrigger: commit` on `main` — merging to `main` deploys |
| Build | `pnpm install --frozen-lockfile && pnpm run build && npx prisma migrate deploy && pnpm run db:generate && pnpm run ci:reindex` |
| Start | `pnpm run start:prod` (`node server/server.js`, serves `dist/` with `SERVE_DIST=true`) |
| Health check | `healthCheckPath: /health` |
| Shutdown window | `maxShutdownDelaySeconds: 30` |

Because the build runs `prisma migrate deploy`, a schema change without a migration breaks production
(see [database.md](database.md)). Secrets are set in the Render dashboard, never in `render.yaml` values.

**Before enabling an e-sign provider in production, set `ESIGN_WEBHOOK_SECRET`** — the webhook answers
503 without it.

### After a merge

1. Watch the Render deploy log: build, `migrate deploy` (lists applied migrations), start.
2. `GET https://gartexhub.onrender.com/health` → 200 and `/ready` → 200.
3. Browse the live site read-only (or run `tests/e2e` with `E2E_BASE_URL=https://gartexhub.onrender.com`
   **without** `E2E_ALLOW_WRITES`).

## Health endpoints

- `GET /health` — liveness. No database or provider calls, so a slow dependency cannot get a healthy
  process restarted. Used by Render.
- `GET /ready` — readiness. `SELECT 1` with a 1.5 s cap; 503 while shutting down or when the DB is down.
- `GET /api/diagnostics` — light public status; `/api/diagnostics/deep` is owner/admin only.

## Crash handling

`server/utils/crashReporter.js`:

- A fatal error (`uncaughtException`, or `unhandledRejection` when `CRASH_UNHANDLED_REJECTION=fatal`;
  default `log`) is written **synchronously** as one JSON line on stderr — on Render this log stream is
  the durable crash record, because the free plan's disk is ephemeral — and to a rotated file under
  `CRASH_LOG_DIR` (default `logs/crashes/`). Records are secret-free.
- Persisting to the `crash_events` table is best-effort and time-boxed (`CRASH_PERSIST_TIMEOUT_MS`).
- The process then exits **non-zero**; Render starts a fresh instance. The process never continues in a
  corrupted state.

Startup: the database connection is retried with backoff for up to `DB_STARTUP_MAX_WAIT_MS` (default
120 s), then the boot fails visibly instead of serving errors.

## Graceful shutdown

On `SIGTERM`/`SIGINT` the server stops accepting connections, `/ready` turns 503, open WebSockets are
closed, in-flight requests get `SHUTDOWN_TIMEOUT_MS` (default 8 s) to finish, the database disconnects,
and the process exits — well inside Render's 30 s window.

## Local supervisor

`pnpm run server:supervised` (`scripts/supervise-server.mjs`) restarts the API after a crash with capped
exponential backoff (2 s, 4 s, 8 s …), stops during a crash loop, and never restarts after an intentional
stop. It refuses to run on Render (`RENDER` set): there the platform is the supervisor.
