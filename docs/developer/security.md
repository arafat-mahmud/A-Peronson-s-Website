# Security

## Authentication

- **Access token:** JWT signed with `JWT_SECRET`, `iss`/`aud` checked (`JWT_ISSUER`, `JWT_AUDIENCE`),
  always with an expiry (login choice 12 h / 24 h / 7 d / 30 d; anything else falls back to 12 h).
  Sent as `Authorization: Bearer …` — not a cookie, which is why CSRF tokens are not needed.
- **Sessions:** each login creates a `user_sessions` row and the token carries its id (`sid`).
  `requireAuth` loads the user and the session together and answers 401 when the session is revoked or
  expired; activity is touched at most every 5 minutes. Users list/revoke sessions
  (`GET/DELETE /api/auth/sessions…`); `POST /api/auth/logout` revokes the current one.
- **Passkeys:** WebAuthn registration/login under `/api/auth/passkey*`.
- **Password policy:** `shared/config/passwordPolicy.js` (8+ chars, a letter, a number) — the same
  rules in the UI and the API.
- **Password reset:** `POST /api/auth/password/forgot` always answers the same (no account
  enumeration), sends at most one email a minute per account; the 32-byte token is stored only as a
  SHA-256 hash, expires in 30 minutes, is claimed atomically (one use), and a completed reset revokes all
  sessions and older tokens. Reset emails are stored in `email_logs` with the body redacted.
- **Password change:** `PUT /api/auth/password` needs the current password and signs out every other
  session.
- **Rate limits:** `authLimiter` on register/login/reset/change, `passkeyLimiter`, and per-feature limiters
  (`server/middleware/rateLimiter.js`; Redis when available, in-memory otherwise).

## Authorization

- Routes declare `requireAuth` and `allowRoles(...)`; the generated [api-reference.md](api-reference.md)
  shows both for every endpoint — review it when adding routes.
- Object-level checks live in services (`server/utils/permissions.js`: `canAccessContract`,
  `canModifyContract`, …). Rules that are easy to get wrong:
  - a contract party may change only **its own** signature side; staff (owner/admin) may record either;
  - self-service subscription changes can only **cancel**; Premium comes from the wallet-charged renewal
    or an admin;
  - prices (verification, Premium, boosts) are computed on the server; a client-sent price is ignored;
  - profile updates whitelist fields (no mass assignment of role, verification, setup codes);
  - organization name changes follow the 90-day / re-verification rule (`userService.js`).
- Admin endpoints additionally pass `requireAdminSecurity` (step-up / allowlists from `ADMIN_*`).

## Webhooks & sandbox

- `POST /api/documents/contracts/:id/sign-callback` (e-sign provider) is public by necessity: it accepts
  an HMAC signature (`x-esign-signature: t=…,v1=…`, 5-minute tolerance, replay-protected nonces) or the
  static secret header. **In production it answers 503 until `ESIGN_WEBHOOK_SECRET` is set.**
- `/api/dev/*` (e-sign sandbox that can mark contracts signed) is mounted only when
  `NODE_ENV !== "production"`.

## Files & transport

- Private files are served through short-lived signed URLs (`/api/files/sign` → `/api/files/content`,
  HMAC with `UPLOADS_SIGNING_SECRET`).
- `helmet` sets security headers and a CSP; CORS and WebSocket origins are allow-listed in production
  (`ALLOWED_WS_ORIGINS`).
- The global error handler passes 4xx errors through with their message and hides internals on 5xx.

## Secrets

- Values live only in the owner's local `.env` (gitignored) and the Render dashboard. Docs, commits,
  issues and reports name variables, never values.
- Before every commit, scan the staged diff for credentials; never commit `.env`, dumps or test artifacts.
- Do not rotate or revoke production credentials as part of feature work; that is the owner's call.

## Reporting

Security issues: email gartexhubsupport@gmail.com rather than opening a public issue.
