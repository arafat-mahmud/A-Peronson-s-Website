# Architecture

One repository, two runtimes: a React single-page app and an Express API, sharing code in `shared/`.

```
src/        React 19 + Vite 6 + Tailwind v4 + Redux Toolkit (SPA, service worker)
server/     Express 5 API, WebSocket server, background workers
shared/     Code used by both: taxonomy, password policy, boost pricing, assistant FAQ engine
prisma/     schema.prisma + migrations (PostgreSQL)
tests/      Jest unit/integration, Playwright e2e
scripts/    Supervisor, docs generator, perf lab, CI helpers, DB backfills
docs/       This documentation
```

## Frontend (`src/`)

- **Entry & shell:** `main.jsx` → `App.jsx`. Every page is a lazy route (`safeLazy`, retries a failed
  chunk once, then reloads). `ProtectedRoute` gates by role; the route→role table is at the top of `App.jsx`.
- **State:** Redux slices in `src/store/` (user, theme, config, toast); server data is fetched per page.
- **API client:** `src/lib/auth.js` — `apiRequest()` adds the JWT (`localStorage` key `jwt`),
  normalizes errors, and handles 401 (session expired).
- **Theme:** `src/theme/blueTheme.css` (default, logo palette) → `themes/tailwind-tokens.css` maps Tailwind
  colours to CSS variables. The 11 other themes are separate CSS chunks loaded on demand by
  `src/theme/loadThemeStyles.js` when selected.
- **Offline & connectivity:** `src/offline/` (connectivity heartbeat, IndexedDB cache, outbox) and
  `OfflineBanner` (transient "Unstable connection" notice).
- **Service worker:** `src/sw.js` — network-first for navigations (no stale `index.html` after a deploy),
  precaches only the shell, runtime-caches lazy chunks.

## Backend (`server/`)

- `server.js` — app setup (helmet, CORS, request logger with timeout), route mounting,
  `/health`, `/ready`, static `dist/` when `SERVE_DIST=true`, WebSocket upgrade, startup and shutdown.
- `routes/` → `controllers/` → `services/` → `utils/prisma.js`. Routes declare auth/role/rate-limit
  middleware; controllers translate HTTP; services hold the logic and authorization checks
  (`utils/permissions.js`). Errors with a `status` pass through the global error handler as-is.
- `middleware/auth.js` — `signToken`, `requireAuth`, `optionalAuth`, `allowRoles(...)`.
- `workers/` — lead reminders; `services/*Queue.js` — image/video processing queues.

Full endpoint list: [api-reference.md](api-reference.md).

## Realtime

- **WebSocket `/ws`** (`server/server.js`): origin-checked (`ALLOWED_WS_ORIGINS`); carries chat rooms
  (`chat_message`, join/leave, policy status), call rooms (WebRTC signalling, participants),
  notifications (`notification_created`, `notification_read`) and the assistant (`ask` → streamed reply).
- **Server-Sent Events:** `GET /api/feed/stream` (feed updates) and support-case progress
  (`server/realtime/realtimeBus.js`).

## Auth & sessions

Login issues a JWT (issuer/audience checked) with a `sid` claim that points to a `user_sessions` row.
`requireAuth` rejects tokens whose session is revoked or expired, and tokens issued before the user's
last password reset. Users list and revoke sessions in Settings → Security. Details:
[security.md](security.md).

## Search & AI

- OpenSearch (full-text) and Qdrant (vectors, embeddings, reranker) are optional services
  (`server/services/openSearchService.js`, `server/routes/qdrantRoutes.js`); `pnpm run ci:reindex` rebuilds the index.
- The assistant (`src/components/FloatingAssistant.jsx`) answers common questions locally with
  `shared/assistant/faqEngine.js` (English/Bangla, works for guests) and sends other questions over
  the WebSocket to `server/services/assistantService.js` (OpenCode / configured providers).

## Data

PostgreSQL through Prisma 6; ~100 models. Workflow and rules: [database.md](database.md); tables:
[database-reference.md](database-reference.md).
