# Database

PostgreSQL, accessed only through Prisma 6 (`server/utils/prisma.js`). Schema: `prisma/schema.prisma`;
history: `prisma/migrations/`. Generated table reference: [database-reference.md](database-reference.md).

## Changing the schema

Render runs **only** `prisma migrate deploy` on each deploy, so every schema change must ship as a
migration — a model added to `schema.prisma` without one is a production crash waiting to happen.

```bash
# 1. edit prisma/schema.prisma
# 2. create the migration against your LOCAL database
npx prisma migrate dev --name add_something      # or write SQL by hand (see below)
# 3. confirm there is no drift left
createdb gartexhub_shadow                         # once; an empty scratch database
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url postgresql://localhost/gartexhub_shadow   # expect: "No difference detected"
npx prisma generate
pnpm run docs:generate                            # refresh database-reference.md
```

Hand-written migrations are fine (and preferred for additive changes) — make them **idempotent**
(`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, guarded constraints) so they apply both to a
migrations-only database and to one that was once `db push`ed. Example:
`prisma/migrations/20261103000000_reconcile_schema_drift`.

Do not run `prisma format` on the whole schema in a feature change; it reformats ~100 models.

## Safety rules

- Production data is never used for tests, experiments, backfills or reindexing from a laptop.
  Use the disposable local database `gartexhub_dev`.
- Production access is read-only inspection, and only when necessary.
- No real emails, payments, refunds or contract signatures as part of testing.
- Backfill scripts (`pnpm run db:backfill:*`) are written to be re-runnable; run them locally first.

## Tables worth knowing

| Area | Tables |
| --- | --- |
| Accounts | `users`, `user_sessions` (revocable logins), `password_reset_tokens` (hashed, one-time) |
| Content | `feed_posts`, `company_products`, `requirements` (buyer requests), `documents` (incl. contracts) |
| Messaging | `messages`, `message_requests`, `message_reads`, `conversation_locks`, `call_sessions` |
| Money (internal) | `subscriptions`, `wallet_history`, `boosts`, `coupon_codes`, `coupon_redemptions`, `payment_proofs` |
| Reliability | `crash_events`, `email_logs`, `email_outbox` |

Exact names and columns: [database-reference.md](database-reference.md).
