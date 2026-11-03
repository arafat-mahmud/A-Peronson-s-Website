# Contributing

## Ground rules

1. **Keep purpose and content.** Fix and improve working features; do not redesign them. New UI follows
   the existing visual language (`src/theme/*` tokens, existing Tailwind patterns).
2. **Client decisions win.** The latest explicit client instruction takes priority; do not rebuild what the
   client rejected (for example the 4-step Business Relationship wizard). The tracker is in `Claude.md`.
3. **Client evidence is read-only:** `bugs/`, `_GarTexHub_Audit/`, `client_forensic_analysis/`,
   `whatsapp-chats/`, `more conv/`. Never edit, rename or delete them, and verify their old
   "RESOLVED" claims against the code before relying on them.
4. **Evidence first.** Reproduce → fix → re-verify. Do not report a test as passing without running it;
   keep pre-existing failures separate from new regressions.
5. **Data and secrets:** see [database.md](database.md#safety-rules) and [security.md](security.md#secrets).
6. **Render stays on the free plan.**

## Git

- Work on a task branch; open a PR to `main`. `main` changes only through an owner-approved merge
  (merging deploys to production).
- Never `reset --hard`, `clean -fd` or force-push.
- Commit author for project work: `Tokyi <tokyi@hartonhub.com>`. Write messages that say what changed
  and why, with the evidence (tests, measurements).
- Before committing: run the relevant Jest tests, a scratch production build, Biome on the changed files
  (no new errors), and scan the staged diff for credentials. See [testing.md](testing.md).

## Documentation

- User-facing behaviour → `docs/user/`; implementation → `docs/developer/`. Document only what is
  implemented; say clearly when something is simulated or operator-dependent (e-sign provider, payments).
- After changing routes, the Prisma schema or environment variables: `pnpm run docs:generate`
  (CI can run `pnpm run docs:check`).

## History log

`history/` holds one file per commit plus `index.md` and `progress.json`. After commits land, document the
new ones by following `history/HISTORY_MAINTENANCE_INSTRUCTIONS.md` (sequential numbers, never rewrite
existing files).
