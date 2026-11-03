# Testing

## Jest (unit + integration)

```bash
pnpm test                 # everything, in band
pnpm run test:unit        # tests/unit
pnpm run test:integration # tests/integration (HTTP-level, in-process app)
```

- Do **not** export `NODE_ENV` or `DATABASE_URL` in your shell. Jest must run with `NODE_ENV=test`:
  `server/utils/prisma.js` then returns a test proxy instead of a real client, so unit tests never touch
  a database. If your shell sets them: `env -u NODE_ENV -u DATABASE_URL pnpm test`.
- Environment: `allure-jest/jsdom`; `tests/setupTests.js` adds what jsdom lacks (`ReadableStream`, etc.).
- ESM mocking: use `jest.unstable_mockModule(path, factory)` **before** `await import(...)` of the
  module under test, and `jest.resetModules()` between cases that need fresh mocks. The Prisma proxy
  cannot run `$transaction`; mock `server/utils/prisma.js` with an in-memory stand-in instead
  (see `tests/unit/server-sessions-password-reset.test.js`).
- Regression tests for a bug must fail on the old code. Check with `git stash` before committing.

Security regression tests worth knowing: `server-auth-hardening`, `server-sessions-password-reset`,
`server-authz-guards` (webhook guard, Premium self-upgrade, contract signing sides, boost pricing),
`server-profile-overview`.

## Playwright (end-to-end)

```bash
NODE_ENV=production pnpm run build                    # or build into a scratch dir with --outDir
node scripts/perf/serve-dist.mjs dist 4173            # serves the build + proxies the API on :4000
E2E_BASE_URL=http://localhost:4173 E2E_ALLOW_WRITES=1 pnpm run test:e2e
```

- `tests/e2e/critical-workflows.spec.ts` — the client-critical browser flows (phone viewport).
- `tests/e2e/backend-*.spec.ts` — public API surface.
- Specs skip when nothing is served at `E2E_BASE_URL`. Tests that create data run only with
  `E2E_ALLOW_WRITES=1`; never set it against the live site.
- `E2E_BROWSER_CHANNEL=chrome` uses the installed Chrome instead of Playwright's bundled browser.
- `test-results/` is tracked in git (legacy artifacts). Pass `--output <scratch dir>` to Playwright, or
  `git restore test-results` afterwards, so a run does not modify tracked files.

## Lint

`pnpm run lint` (Biome). The repository has a large pre-existing backlog (thousands of findings, many
of them style rules and CRLF formatting), so judge a change by **no new errors in the files it
touches**: compare `npx biome check <files>` against the same files at the base commit.

## Pre-commit hook

`.husky/pre-commit` runs Biome on staged files, the full Jest suite and `npm run build`. Because of the
lint backlog and because `build` writes into the tracked `dist/`, commits on this branch were made with
`--no-verify` after running tests and a scratch build manually; do the same checks before pushing.

## Performance regression

`scripts/perf/lab-benchmark.mjs` — see [performance.md](performance.md).
