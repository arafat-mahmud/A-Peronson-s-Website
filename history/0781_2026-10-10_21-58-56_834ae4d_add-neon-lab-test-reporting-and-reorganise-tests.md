# Commit 0781 — 834ae4d

| Field | Value |
|-------|-------|
| **Commit Number** | 0781 |
| **Commit Hash** | 834ae4d0a9ee02e07830fcbdfe90ef0e029c574b |
| **Parent Hash** | da5ff3b5d610d1b8a41caa5cad7a7ccfd1171289 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-10 21:58:56 |
| **Branch** | main |
| **Files Changed** | 117 |
| **Additions** | 5698 |
| **Deletions** | 4417 |
| **Net Change** | +1281 |
| **Merge Commit** | No |

## Add Neon Lab Test Reporting and Reorganise Tests

Adds Allure/Neon reporting scripts and a hub template, prefixes test names, adds security/wallet tests and removes older theme and offline e2e specs; industry dropdown mapping fix.

Original commit message: “test: neon lab reporting, prefixed test names, industry dropdown mapping”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `package-lock.json` | Modified | 1856 | 46 | +1856/-46 |
| `tests/unit/themeRegression.test.js` | Deleted | 0 | 486 | +0/-486 |
| `tests/e2e/hypercache-offline.spec.js` | Deleted | 0 | 354 | +0/-354 |
| `scripts/neon-hub-template.html` | Added | 227 | 0 | +227/-0 |
| `tests/unit/server-middleware-security.test.js` | Added | 172 | 0 | +172/-0 |
| `tests/unit/server-wallet-coupon.test.js` | Added | 170 | 0 | +170/-0 |
| `tests/unit/server-permissions.test.js` | Added | 155 | 0 | +155/-0 |
| `scripts/neon-hub-data.mjs` | Added | 142 | 0 | +142/-0 |
| `tests/unit/messageModerationIsolation.test.js` | Deleted | 0 | 135 | +0/-135 |
| `tests/unit/authRoutesController.test.js` | Deleted | 0 | 130 | +0/-130 |
| `tests/unit/frontend-auth-session.test.js` | Added | 130 | 0 | +130/-0 |
| `tests/unit/server-auth-middleware.test.js` | Added | 130 | 0 | +130/-0 |
| `tests/unit/frontendAuthAndEvents.test.js` | Deleted | 0 | 129 | +0/-129 |
| `tests/unit/db-schema.test.js` | Added | 124 | 0 | +124/-0 |
| `tests/unit/walletRefundIdempotency.test.js` | Deleted | 0 | 122 | +0/-122 |
| `scripts/neon-allure.mjs` | Added | 121 | 0 | +121/-0 |
| `tests/unit/leadReminderConsistency.test.js` | Deleted | 0 | 117 | +0/-117 |
| `tests/unit/requirementModerationValidation.test.js` | Deleted | 0 | 116 | +0/-116 |
| `tests/unit/server-analytics-governance.test.js` | Added | 115 | 0 | +115/-0 |
| `tests/unit/middlewareAuthz.test.js` | Deleted | 0 | 111 | +0/-111 |
| `tests/unit/server-verification.test.js` | Added | 108 | 0 | +108/-0 |
| `tests/unit/frontendAppProtectedRoutes.rtl.test.js` | Deleted | 0 | 107 | +0/-107 |
| `tests/unit/component-product-industry.test.js` | Added | 104 | 0 | +104/-0 |
| `tests/unit/server-presets-agentsubids.test.js` | Added | 102 | 0 | +102/-0 |
| `tests/unit/frontend-theme-hotkey.test.js` | Added | 100 | 0 | +100/-0 |
| `tests/unit/frontend-cn-leadsource.test.js` | Added | 98 | 0 | +98/-0 |
| `tests/unit/frontend-events.test.js` | Added | 98 | 0 | +98/-0 |
| `tests/unit/hypercache.test.js` | Deleted | 0 | 98 | +0/-98 |
| `tests/unit/frontend-validation.test.js` | Added | 95 | 0 | +95/-0 |
| `tests/unit/server-currency.test.js` | Added | 94 | 0 | +94/-0 |
| `tests/README.md` | Added | 89 | 0 | +89/-0 |
| `tests/unit/component-confirm-dialog.test.js` | Added | 87 | 0 | +87/-0 |
| `scripts/neon-report.mjs` | Added | 86 | 0 | +86/-0 |
| `tests/unit/currencyService.fxFreshness.test.js` | Deleted | 0 | 83 | +0/-83 |
| `tests/unit/messagePolicyIntegrity.test.js` | Deleted | 0 | 82 | +0/-82 |
| `tests/integration/ai-prefill-e2e.test.js` | Deleted | 0 | 81 | +0/-81 |
| `tests/unit/server-validators.test.js` | Added | 81 | 0 | +81/-0 |
| `tests/e2e/workflow-lifecycle.spec.ts` | Deleted | 0 | 80 | +0/-80 |
| `tests/integration/eSignFullFlow.test.js` | Deleted | 0 | 80 | +0/-80 |
| `tests/unit/localStoreFallback.test.js` | Deleted | 0 | 80 | +0/-80 |
| … 77 more files | — | 1214 | 1980 | (smaller changes) |

### What changed per file

- **`package-lock.json`** — modified dependencies. +1856/-46 lines.
- **`tests/unit/themeRegression.test.js`** — deleted test. +0/-486 lines.
- **`tests/e2e/hypercache-offline.spec.js`** — deleted test. +0/-354 lines.
- **`scripts/neon-hub-template.html`** — added tooling script. function added: `fmt`; function added: `card`; function added: `missingCard`; function added: `jestCard`; function added: `playwrightCard`; function added: `coverageCard` ….
- **`tests/unit/server-middleware-security.test.js`** — added test. function added: `mockRes`; test case added: `passes through when no step-up code is configured`; test case added: `rejects missing or wrong codes with 403`; test case added: `accepts the correct code and enforces the timestamp window`; test case added: `passes through when no export codes are configured`; test case added: `admins bypass dual approval` ….
- **`tests/unit/server-wallet-coupon.test.js`** — added test. function added: `loadWallet`; test case added: `getWallet returns null for unknown users and rounded balances otherwise`; test case added: `creditWallet rejects invalid amounts before touching the DB`; test case added: `creditWallet reports missing users with 404`; test case added: `creditWallet credits the balance and records history in one transaction`; test case added: `debitWallet enforces sufficient funds with WALLET_INSUFFICIENT` ….
- **`tests/unit/server-permissions.test.js`** — added test. function added: `resDouble`; test case added: `hasRole matches any of the given roles`; test case added: `isOwnerOrAdmin covers owner and admin only`; test case added: `isAgent is exact`; test case added: `member management covers owner/admin/buying_house/factory`; test case added: `org policy/queue gates fall back to the permission matrix` ….
- **`scripts/neon-hub-data.mjs`** — added tooling script. function added: `readJson`; function added: `layerForTestFile`; function added: `summarizeJest`; function added: `summarizePlaywright`.
- **`tests/unit/messageModerationIsolation.test.js`** — deleted test. +0/-135 lines.
- **`tests/unit/authRoutesController.test.js`** — deleted test. +0/-130 lines.
- **`tests/unit/frontend-auth-session.test.js`** — added test. function added: `makeStorage`; test case added: `getToken reads localStorage first, then sessionStorage`; test case added: `saveSession persists user + token per remember flag`; test case added: `persistUser stores only the minimal safe subset`; test case added: `getCurrentUser primes from storage on a cold cache`; test case added: `getCurrentUser returns null without a token` ….
- **`tests/unit/server-auth-middleware.test.js`** — added test. function added: `mockRes`; test case added: `signToken creates a verifiable JWT with the platform claims`; test case added: `requireAuth rejects requests without a bearer token`; test case added: `requireAuth rejects forged tokens`; test case added: `requireAuth passes valid users through`; test case added: `requireAuth blocks locked accounts except the unlock/logout allowlist` ….

## Detailed Diff Analysis

- **Areas touched:** test (100 files, +3022/-4308), dependencies (2 files, +1868/-48), tooling script (4 files, +576/-0), documentation (1 file, +89/-0), configuration (4 files, +58/-5), page (1 file, +44/-7), server (1 file, +0/-48), other (3 files, +40/-0).
- **Function added** (38): `existingResultDirs`, `sleepSync`, `renameWithRetry`, `finalize`, `smokeCheck`, `readJson`, `layerForTestFile`, `summarizeJest`, `summarizePlaywright`, `fmt` …
- **Function removed** (29): `testSuppressLabeledItems`, `testDeniedFieldsStripped`, `run`, `skipIfNoBackend`, `seedAuth`, `stubAppApis`, `dexieCount`, `dexieGet`, `runSyncInPage`, `createMockRes` …
- **Test case added** (208): `GET /health reports status and uptime`, `GET /api/diagnostics is reachable without auth`, `GET /api/system/* serves public marketing content`, `protected endpoints reject anonymous callers with 401`, `POST /api/events validates the event type`, `search endpoints reject mistyped filters with 400`, `assistant endpoints require their payloads`, `auth endpoints rate-limit or validate login payloads`, `POST /extract-requirement rejects missing text with 400`, `POST /generate-first-response rejects missing extracted fields with 400` …
- **Dependencies:** removed/changed `@playwright/test` ^1.49.1; added/changed `@jest/globals` ^29.7.0; added/changed `@playwright/test` ^1.64.0; added/changed `allure` ^3.20.1; added/changed `allure-jest` ^3.13.0; added/changed `allure-playwright` ^3.13.0; added/changed `supertest` ^7.3.1
- **Tests:** 100 test file(s) changed: `tests/e2e/backend-health.spec.ts`, `tests/e2e/backend-validation.spec.ts`, `tests/e2e/deal-journey-matrix.spec.ts`, `tests/e2e/hypercache-offline.spec.js`, `tests/e2e/workflow-lifecycle.spec.ts` …

## Why This Change Was Needed

Better test visibility and reports (inference).

## Was It Useful

Mixed. Reporting is useful; removing 840 lines of existing tests reduced coverage of themes/offline.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths. API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. Build/deploy or tooling configuration changes. Dependency set changes; a fresh install is required.

## Relationship to Surrounding Commits

- **Follows:** 0780 — Stack Factory Document Rows and Fall Back to Initials.
- **Precedes:** 0782 — Remove the Duplicate Settings Entry from the Mobile Drawer.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
