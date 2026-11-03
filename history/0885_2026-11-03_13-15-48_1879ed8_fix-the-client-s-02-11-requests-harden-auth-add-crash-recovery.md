# Commit 0885 — 1879ed8

| Field | Value |
|-------|-------|
| **Commit Number** | 0885 |
| **Commit Hash** | 1879ed8bf25553f1e792237670a76aab991dfa4d |
| **Parent Hash** | eed7e825bdbb5c4e435a2e4b0598226a9e7c307e |
| **Author** | Tokyi |
| **Date/Time** | 2026-11-03 13:15:48 |
| **Branch** | fix/client-feedback-2026-11-03 |
| **Files Changed** | 128 |
| **Additions** | 4820 |
| **Deletions** | 1976 |
| **Net Change** | +2844 |
| **Merge Commit** | No |

## Fix the Client's 02/11 Requests, Harden Auth, Add Crash Recovery

Large client-driven fix: profile 500 (TDZ), signup redesign with company facts and certifications, nav/footer/brand fixes, transient connection notice, Lenis removal, network-first service worker, FAQ assistant fallback, notification deep links, Settings restructure per the 26/09 decision; registration takeover fix and mass-assignment block; schema-drift reconcile migration; crash reporter, `/ready`, graceful shutdown and local supervisor; initial JS cut 68%; Claude.md rewritten without secrets.

Original commit message: “Fix client-reported bugs, harden auth, add crash recovery and cut initial JS 68%”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/pages/auth/Signup.jsx` | Modified | 646 | 540 | +646/-540 |
| `src/theme/blueTheme.css` | Modified | 355 | 355 | +355/-355 |
| `prisma/migrations/20261103000000_reconcile_schema_drift/migration.sql` | Added | 424 | 0 | +424/-0 |
| `server/utils/crashReporter.js` | Added | 403 | 0 | +403/-0 |
| `scripts/blue-overlay.css` | Modified | 145 | 145 | +145/-145 |
| `src/theme/themes/blue-overlay.css` | Modified | 145 | 145 | +145/-145 |
| `shared/assistant/faqEngine.js` | Added | 269 | 0 | +269/-0 |
| `server/server.js` | Modified | 194 | 59 | +194/-59 |
| `tests/unit/server-profile-overview.test.js` | Added | 174 | 0 | +174/-0 |
| `tests/unit/server-auth-hardening.test.js` | Added | 172 | 0 | +172/-0 |
| `Claude.md` | Added | 155 | 0 | +155/-0 |
| `src/App.jsx` | Modified | 113 | 38 | +113/-38 |
| `src/pages/auth/OnboardingPage.jsx` | Modified | 123 | 25 | +123/-25 |
| `server/services/userService.js` | Modified | 123 | 10 | +123/-10 |
| `shared/config/platformTaxonomy.js` | Modified | 118 | 2 | +118/-2 |
| `server/services/profileService.js` | Modified | 75 | 42 | +75/-42 |
| `src/pages/Settings.jsx` | Modified | 53 | 62 | +53/-62 |
| `src/components/NavBar.jsx` | Modified | 69 | 44 | +69/-44 |
| `scripts/supervise-server.mjs` | Added | 112 | 0 | +112/-0 |
| `src/components/OfflineBanner.jsx` | Modified | 57 | 23 | +57/-23 |
| `tests/unit/server-requirement-create.test.js` | Added | 80 | 0 | +80/-0 |
| `vite.config.js` | Modified | 46 | 26 | +46/-26 |
| `src/pages/NotificationsCenter.jsx` | Modified | 42 | 21 | +42/-21 |
| `src/sw.js` | Modified | 31 | 24 | +31/-24 |
| `src/pages/admin/sections/AdminHomeSection.jsx` | Modified | 27 | 27 | +27/-27 |
| `src/lib/fallbackCover.js` | Modified | 23 | 26 | +23/-26 |
| `src/tailwind.css` | Modified | 17 | 20 | +17/-20 |
| `server/utils/db.js` | Modified | 33 | 3 | +33/-3 |
| `server/controllers/assistantKnowledgeController.js` | Added | 34 | 0 | +34/-0 |
| `src/components/LenisProvider.jsx` | Deleted | 0 | 34 | +0/-34 |
| `shared/config/passwordPolicy.js` | Added | 33 | 0 | +33/-0 |
| `src/pages/About.jsx` | Modified | 23 | 9 | +23/-9 |
| `server/controllers/authController.js` | Modified | 29 | 2 | +29/-2 |
| `src/pages/AdminPanel.jsx` | Modified | 15 | 15 | +15/-15 |
| `prisma/schema.prisma` | Modified | 28 | 0 | +28/-0 |
| `server/middleware/errorHandler.js` | Modified | 24 | 3 | +24/-3 |
| `public/favicon.svg` | Modified | 1 | 25 | +1/-25 |
| `src/components/ui/BrandMark.jsx` | Added | 26 | 0 | +26/-0 |
| `prisma/migrations/20261103010000_add_crash_events/migration.sql` | Added | 25 | 0 | +25/-0 |
| `src/pages/FactoryProfile.jsx` | Modified | 19 | 6 | +19/-6 |
| … 88 more files | — | 339 | 245 | (smaller changes) |

### What changed per file

- **`src/pages/auth/Signup.jsx`** — modified page. function removed: `FieldShell`; function added: `inputClass`; function added: `FieldShell`; function removed: `CheckIcon`; function added: `RuleMark`; function added: `PasswordInput` ….
- **`src/theme/blueTheme.css`** — modified styling/theme. +355/-355 lines.
- **`prisma/migrations/20261103000000_reconcile_schema_drift/migration.sql`** — added database migration. table created: `sync_changes`; table created: `business_relationships`; table created: `license_requests`; table created: `document_views`; table created: `assistant_rules`; table created: `assistant_config` ….
- **`server/utils/crashReporter.js`** — added server. function added: `envFlag`; function added: `envNumber`; function added: `crashConfig`; function added: `secretValues`; function added: `redact`; function added: `readVersion` ….
- **`scripts/blue-overlay.css`** — modified styling/theme. +145/-145 lines.
- **`src/theme/themes/blue-overlay.css`** — modified styling/theme. +145/-145 lines.
- **`shared/assistant/faqEngine.js`** — added shared code. function added: `normalizeQuestion`; function added: `stem`; function added: `tokenize`; function added: `tokenMatches`; function added: `phraseHit`; function added: `comboHit` ….
- **`server/server.js`** — modified server. function added: `gracefulShutdown`.
- **`tests/unit/server-profile-overview.test.js`** — added test. test case added: `a company can open another company`; test case added: `only the viewer/profile pair is read - never whole tables`; test case added: `self and admin views keep private fields`; test case added: `public profile carries the company facts the profile design shows`; test case added: `unknown profile id stays a 404 signal`; test case added: `normalizes employee count and capacity, rejects bad input` ….
- **`tests/unit/server-auth-hardening.test.js`** — added test. function added: `mockRes`; test case added: `someone who only knows the email gets 409, not the account`; test case added: `the account owner (correct password) can still resume an orphaned signup`; test case added: `weak passwords are rejected by the API, not only by the form`; test case added: `invalid company facts are rejected before any account work`; test case added: `expected 4xx errors keep their status and message; others become a generic 500` ….
- **`Claude.md`** — added documentation. +155/-0 lines.
- **`src/App.jsx`** — modified other. function added: `reloadOnceForNewBuild`; function added: `VerificationRoute`; function added: `RouteScrollManager`.

## Detailed Diff Analysis

- **Areas touched:** page (53 files, +1140/-883), styling/theme (4 files, +662/-665), server (3 files, +630/-62), database migration (3 files, +454/-0), test (7 files, +446/-8), shared code (3 files, +420/-2), component (16 files, +195/-137), server service (3 files, +201/-57).
- **Route added** (5): `GET /knowledge`, `POST /knowledge`, `PATCH /knowledge/:id`, `DELETE /knowledge/:id`, `GET /me/verification-pricing`
- **Prisma model added** (1): `CrashEvent`
- **Table created** (16): `sync_changes`, `business_relationships`, `license_requests`, `document_views`, `assistant_rules`, `assistant_config`, `ai_response_audit`, `admin_audit`, `workflow_audit_logs`, `support_tickets` …
- **Function added** (69): `envNumber`, `restartDelay`, `log`, `main`, `listKnowledgeHandler`, `createKnowledgeHandler`, `updateKnowledgeHandler`, `deleteKnowledgeHandler`, `getMyVerificationPricing`, `clientErrorStatus` …
- **Function removed** (8): `errorHandler`, `cancelReconnect`, `LenisProvider`, `feedLinkForEntity`, `Settings`, `submit`, `FieldShell`, `CheckIcon`
- **Test case added** (19): `someone who only knows the email gets 409, not the account`, `the account owner (correct password) can still resume an orphaned signup`, `weak passwords are rejected by the API, not only by the form`, `invalid company facts are rejected before any account work`, `expected 4xx errors keep their status and message; others become a generic 500`, `a crash record is diagnostic and secret-free`, `records are written synchronously, once per error, and rotated`, `an unwritable log directory degrades to stderr instead of throwing`, `a company can open another company`, `only the viewer/profile pair is read - never whole tables` …
- **Tests:** 7 test file(s) changed: `tests/setupTests.js`, `tests/unit/component-product-industry.test.js`, `tests/unit/frontend-jsx-bindings.test.js`, `tests/unit/frontend-product-industry.test.js`, `tests/unit/server-auth-hardening.test.js` …
- **Database:** includes a Prisma migration; it runs on deploy via `prisma migrate deploy`.
- **Deployment:** changes `render.yaml` (Render Blueprint); takes effect on the next deploy of `main`.

## Why This Change Was Needed

Client requirement list of 02/11/2026 plus an audit (Claude.md §6–§8).

## Was It Useful

Useful. Very broad commit; each part is described in its message and verified in tests/browser.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths. API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. Database schema changes on the next deploy; backwards compatibility depends on the migration being additive. Build/deploy or tooling configuration changes. Dependency set changes; a fresh install is required.

## Relationship to Surrounding Commits

- **Follows:** 0884 — Add More Client Conversation Archives.
- **Precedes:** 0886 — Add Revocable Sessions and Self-Service Password Reset.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).
- Contains or removes credential-bearing files; values are deliberately not reproduced here.
## Optional Technical Details

- Renamed files: none.
- Binary files: `public/android-chrome-192x192.png`, `public/android-chrome-512x512.png`, `public/apple-touch-icon.png`, `public/brand/gartexhub-mark-128.png`, `public/brand/gartexhub-mark-128.webp`, `public/brand/gartexhub-mark-192.png`, `public/brand/gartexhub-mark-192.webp`, `public/brand/gartexhub-mark-64.png`, `public/brand/gartexhub-mark-64.webp`, `public/favicon-16x16.png`, `public/favicon-32x32.png`, `public/favicon-96x96.png`, `public/favicon.ico`, `public/mstile-150x150.png`.
- Build output (`dist/`) files: 0.
