# Commit 0886 — 697349b

| Field | Value |
|-------|-------|
| **Commit Number** | 0886 |
| **Commit Hash** | 697349bf58f725c4fe71ee775b989e6069f371f5 |
| **Parent Hash** | 1879ed8bf25553f1e792237670a76aab991dfa4d |
| **Author** | Tokyi |
| **Date/Time** | 2026-11-03 15:13:29 |
| **Branch** | fix/client-feedback-2026-11-03 |
| **Files Changed** | 14 |
| **Additions** | 844 |
| **Deletions** | 23 |
| **Net Change** | +821 |
| **Merge Commit** | No |

## Add Revocable Sessions and Self-Service Password Reset

`user_sessions` with a `sid` claim checked on every request (logout and per-device revoke work), session list/revoke API and UI; enumeration-safe password reset with hashed one-time 30-minute tokens; migration; tests.

Original commit message: “Add revocable sessions and secure self-service password reset”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/pages/auth/ForgotPassword.jsx` | Added | 242 | 0 | +242/-0 |
| `server/services/sessionService.js` | Added | 137 | 0 | +137/-0 |
| `tests/unit/server-sessions-password-reset.test.js` | Added | 130 | 0 | +130/-0 |
| `server/services/passwordResetService.js` | Added | 121 | 0 | +121/-0 |
| `server/controllers/authController.js` | Modified | 79 | 8 | +79/-8 |
| `server/middleware/auth.js` | Modified | 26 | 7 | +26/-7 |
| `prisma/migrations/20261104000000_add_sessions_and_password_reset/migration.sql` | Added | 32 | 0 | +32/-0 |
| `prisma/schema.prisma` | Modified | 29 | 0 | +29/-0 |
| `src/pages/Settings.jsx` | Modified | 18 | 4 | +18/-4 |
| `server/routes/authRoutes.js` | Modified | 10 | 0 | +10/-0 |
| `server/services/emailService.js` | Modified | 8 | 0 | +8/-0 |
| `shared/assistant/faqEngine.js` | Modified | 3 | 3 | +3/-3 |
| `src/App.jsx` | Modified | 6 | 0 | +6/-0 |
| `src/pages/auth/Login.jsx` | Modified | 3 | 1 | +3/-1 |

### What changed per file

- **`src/pages/auth/ForgotPassword.jsx`** — added page. function added: `AuthCard`; function added: `SubmitButton`; function added: `ForgotPassword`; function added: `ResetPassword`.
- **`server/services/sessionService.js`** — added server service. function added: `normalizeSessionDuration`; function added: `clientIp`; function added: `describeUserAgent`; function added: `createSession`; function added: `extendSession`; function added: `findActiveSession` ….
- **`tests/unit/server-sessions-password-reset.test.js`** — added test. function added: `makeStore`; test case added: `unknown emails create nothing and send nothing (no enumeration signal)`; test case added: `a request stores only the token hash, emails the link, and is rate limited`; test case added: `a link works once, revokes sessions, and expired links are refused`; test case added: `login durations are whitelisted; every token expires`; test case added: `user-agent labels are readable`.
- **`server/services/passwordResetService.js`** — added server service. function added: `hashToken`; function added: `appBaseUrl`; function added: `resetEmail`; function added: `requestPasswordReset`; function added: `resetPassword`.
- **`server/controllers/authController.js`** — modified API controller. function removed: `logout`; function added: `logout`; function added: `listMySessions`; function added: `revokeMySession`; function added: `revokeOtherSessions`; function added: `forgotPassword` ….
- **`server/middleware/auth.js`** — modified server middleware. +26/-7 lines.
- **`prisma/migrations/20261104000000_add_sessions_and_password_reset/migration.sql`** — added database migration. table created: `user_sessions`; table created: `password_reset_tokens`.
- **`prisma/schema.prisma`** — modified database schema. Prisma model added: `UserSession`; Prisma model added: `PasswordResetToken`.
- **`src/pages/Settings.jsx`** — modified page. +18/-4 lines.
- **`server/routes/authRoutes.js`** — modified API route. route added: `GET /sessions`; route added: `DELETE /sessions/:sessionId`; route added: `POST /sessions/revoke-others`; route added: `POST /password/forgot`; route added: `POST /password/reset`.
- **`server/services/emailService.js`** — modified server service. +8/-0 lines.
- **`shared/assistant/faqEngine.js`** — modified shared code. +3/-3 lines.

## Detailed Diff Analysis

- **Areas touched:** page (3 files, +263/-5), server service (3 files, +266/-0), test (1 file, +130/-0), API controller (1 file, +79/-8), server middleware (1 file, +26/-7), database migration (1 file, +32/-0), database schema (1 file, +29/-0), API route (1 file, +10/-0).
- **Route added** (5): `GET /sessions`, `DELETE /sessions/:sessionId`, `POST /sessions/revoke-others`, `POST /password/forgot`, `POST /password/reset`
- **Prisma model added** (2): `UserSession`, `PasswordResetToken`
- **Table created** (2): `user_sessions`, `password_reset_tokens`
- **Function added** (26): `logout`, `listMySessions`, `revokeMySession`, `revokeOtherSessions`, `forgotPassword`, `completePasswordReset`, `hashToken`, `appBaseUrl`, `resetEmail`, `requestPasswordReset` …
- **Function removed** (1): `logout`
- **Test case added** (5): `unknown emails create nothing and send nothing (no enumeration signal)`, `a request stores only the token hash, emails the link, and is rate limited`, `a link works once, revokes sessions, and expired links are refused`, `login durations are whitelisted; every token expires`, `user-agent labels are readable`
- **Tests:** 1 test file(s) changed: `tests/unit/server-sessions-password-reset.test.js`
- **Database:** includes a Prisma migration; it runs on deploy via `prisma migrate deploy`.

## Why This Change Was Needed

Open items from the audit: no session revocation and no password reset.

## Was It Useful

Useful. Security features with tests.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths. API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. Database schema changes on the next deploy; backwards compatibility depends on the migration being additive.

## Relationship to Surrounding Commits

- **Follows:** 0885 — Fix the Client's 02/11 Requests, Harden Auth, Add Crash Recovery.
- **Precedes:** 0887 — Cut Homepage LCP to 2.4 s with Theme Splitting and Deferred Markdown.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
