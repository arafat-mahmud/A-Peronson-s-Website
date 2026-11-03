# Configuration

All configuration is environment variables: `.env` locally (gitignored; start from `.env.example`),
the Render dashboard / `render.yaml` in production. The complete generated list, with where each
variable is read, is [env-reference.md](env-reference.md).

> Values never go into the repo, docs, commit messages or reports — names only. Existing production
> credentials are managed by the owner in the Render dashboard.

## Required

The server refuses to start if one of these is missing (`server/utils/envValidation.js`).

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. Local: `gartexhub_dev`. |
| `JWT_SECRET` | Signs access tokens. |
| `UPLOADS_SIGNING_SECRET` | ≥ 32 characters; signs private file URLs (`/api/files/content`). |

## Core

`NODE_ENV` (production on Render), `PORT` (default 4000), `APP_BASE_URL` (used in emailed links),
`JWT_ISSUER` / `JWT_AUDIENCE` (checked on every token), `ALLOWED_WS_ORIGINS` (WebSocket/CORS origins
in production), `REQUEST_TIMEOUT_MS` (default 45 s), `SERVE_DIST=true` (the API also serves the built `dist/`), `VITE_*`
(read at **build** time by the frontend).

## Feature groups

| Group | Variables | When unset |
| --- | --- | --- |
| Email | `EMAIL_PROVIDER`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` | Emails are only logged (`email_logs`). Keep unset locally. |
| AI assistant | `OPENCODE_*`, `AI_*`, `OPENROUTER_*`, `OLLAMA_*`, `GEMINI_*` | Assistant answers from the built-in FAQ engine. |
| Search | `OPENSEARCH_*`, `QDRANT_*`, `EMBEDDING_*`, `RERANKER_*` | Server starts and retries OpenSearch; vector/full-text features degrade. |
| E-sign | `ESIGN_PROVIDER_TYPE`, `ESIGN_PROVIDER_URL`, `ESIGN_PROVIDER_API_KEY`, `ESIGN_WEBHOOK_SECRET`, `ESIGN_WEBHOOK_*` | No external provider. **Production refuses the provider webhook until `ESIGN_WEBHOOK_SECRET` is set.** |
| Admin hardening | `ADMIN_MFA_CODE`, `ADMIN_STEPUP_*`, `ADMIN_IP_ALLOWLIST`, `ADMIN_DEVICE_ALLOWLIST`, `ADMIN_EXPORT_CODE_*`, `ADMIN_EXEC_*`, `ADMIN_OWNER_EMAILS` | Admin step-up and export checks per their defaults. |
| Reliability | `CRASH_LOG_*`, `CRASH_PERSIST_TIMEOUT_MS`, `CRASH_UNHANDLED_REJECTION`, `SHUTDOWN_TIMEOUT_MS`, `DB_STARTUP_MAX_WAIT_MS`, `MEMORY_*`, `CRASH_RESTART_*` (local supervisor) | Safe defaults; see [deployment.md](deployment.md). |
| Boosts | `BOOST_DEFAULT_PRICE_USD` (9.99), `BOOST_DEFAULT_DURATION_DAYS`, `BOOST_DEFAULT_MULTIPLIER` | Defaults shown. The price per 7 days is pro-rated for 14/30-day boosts. |

## Local values that avoid side effects

```
EMAIL_PROVIDER=          # unset: no real email
OPENCODE_ENABLED=false
```
