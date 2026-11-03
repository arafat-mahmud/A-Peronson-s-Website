# Local setup

Verified on macOS with Node 24, PostgreSQL 14 and pnpm 10.20.

## 1. Install

```bash
corepack enable                                   # or prefix commands with: corepack pnpm@10.20.0
corepack pnpm@10.20.0 install --frozen-lockfile   # lockfile v9
```

## 2. Database (local and disposable)

```bash
createdb gartexhub_dev
cp .env.example .env          # then edit: DATABASE_URL, JWT_SECRET, UPLOADS_SIGNING_SECRET (≥ 32 chars)
npx prisma generate
npx prisma migrate deploy     # applies prisma/migrations/* in order
```

Never point `DATABASE_URL` at production while developing; see [database.md](database.md#safety-rules).

## 3. Run

```bash
pnpm run server            # API + WebSocket on :4000   (GET /health, GET /ready)
pnpm run dev               # Vite on :5173; proxies /api, /ws, /uploads to VITE_API_PROXY
pnpm run server:supervised # optional: API with automatic restart after a crash (local only)
```

Open http://localhost:5173. Sign up through the UI, or call `POST /api/auth/register` with
`name, email, password, role, company_name` and `profile: { country, position, factory_sector }`.

Optional services (Ollama, Qdrant; OpenSearch via `OPENSEARCH_URL`) for AI and vector/full-text
search: `pnpm run dev:services` (Docker). Without them the API still starts (it retries OpenSearch in
the background); the assistant answers from the built-in FAQ, and search features backed by those
services return reduced results.

## 4. Keep these unset locally

- `EMAIL_PROVIDER` / `GMAIL_*` — otherwise real email is sent (password reset, notifications).
  With no provider, emails are only logged to the `email_logs` table.
- `OPENCODE_ENABLED=false` unless you are testing the AI assistant.
- `NODE_ENV` — leave it out of your shell: Jest must see `NODE_ENV=test` (see [testing.md](testing.md)).

## Common problems

| Symptom | Cause / fix |
| --- | --- |
| `pnpm: command not found` | Use `corepack pnpm@10.20.0 …` or `corepack enable` |
| Prisma: "column … does not exist" | Run `npx prisma migrate deploy`; never `db push` against shared databases |
| Jest fails with Prisma proxy errors | `NODE_ENV` exported in your shell — unset it |
| `vite build` produces a development React bundle | `.env` has `NODE_ENV=development`; build with `NODE_ENV=production pnpm run build` |
| 429 "Too many requests" on login while testing | `authLimiter` (in-memory); restart the API to reset |
