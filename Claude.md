# GarTexHub — Project Instructions (Claude.md)

> Revised 2026-11-03. এই ফাইল আগের ~4,400 লাইনের prompt dump-কে প্রতিস্থাপন করে।
> আগের ফাইলে paste করা terminal output-এ live credentials ছিল (database URL, JWT/upload
> secrets, Gmail app password, OpenSearch password, admin codes, GitHub token)। সেগুলো এখান
> থেকে সরানো হয়েছে। **কোনো secret value আর কখনো এই ফাইলে, docs-এ, commit-এ বা report-এ লিখবে না** —
> শুধু variable name। Actual value থাকে owner-এর local `.env` (gitignored) এবং Render dashboard-এ।

## 1. Project

GarTexHub একটি B2B **Garments & Textile sourcing marketplace** — Buyer, Factory, Buying House,
Agent, Owner ও Admin role; marketplace search, buyer requirements, products/feed, realtime chat,
voice/video call, contracts + e-sign, CRM/leads, verification, subscription/wallet, AI assistant।

Stack: React 19 + Vite 6 + Tailwind v4 + Redux Toolkit (`src/`), Express 5 + Prisma 6 + PostgreSQL
(`server/`, `prisma/`), WebSocket (`/ws`) + SSE, shared config (`shared/`), Jest + Playwright (`tests/`).
Hosting: Render Web Service (`render.yaml`, **plan: free**) behind Cloudflare (Brotli already applied at the edge).

## 2. Non-negotiable rules

1. **Purpose & content অক্ষত থাকবে।** Working feature redesign করবে না; নতুন UI existing visual language
   (`src/theme/*` tokens, existing Tailwind patterns) অনুসরণ করবে।
2. **Secrets:** existing credentials ব্যবহার করা যাবে, কিন্তু নতুন করে প্রকাশ করা যাবে না। Rotate/revoke করবে না।
3. **Data safety:** production database-এ test, migration experiment, backfill, reindex, reset চালাবে না।
   Testing শুধু local disposable DB-তে (`gartexhub_dev`)। Production-এ শুধু read-only inspection।
   Real email, payment, refund, contract signing, real user account mutation — নিষিদ্ধ।
4. **Render:** plan `free` থাকবে; paid instance/worker/disk/database যোগ করবে না; শুধু real Blueprint fields।
5. **Git:** `reset --hard`, `clean -fd`, force-push নিষিদ্ধ। Task branch-এ কাজ; `main`-এ force push নয়।
   Commit author: `Tokyi <tokyi@hartonhub.com>`।
6. **Evidence first:** run না করা test-কে pass বলবে না; fix দাবি করার আগে reproduce → fix → re-verify।
   Pre-existing failure আর নতুন regression আলাদা করে লিখবে।
7. **Client evidence read-only:** `bugs/`, `_GarTexHub_Audit/`, `client_forensic_analysis/`, `whatsapp-chats/`,
   `more conv/` — কখনো edit/rename/delete করবে না। এগুলোর পুরোনো "RESOLVED/VERIFIED" দাবি সত্য ধরে নেবে না;
   current code + runtime দিয়ে যাচাই করবে। Client-এর সর্বশেষ স্পষ্ট নির্দেশ অগ্রাধিকার পাবে; client যেটা
   reject করেছে (যেমন Business Relationship 4-step wizard) সেটা আবার বানাবে না।
8. **Output economy (owner, 2026-11-03):** অপ্রয়োজনীয় `.md` report বানাবে না; দরকার হলে একটি সংক্ষিপ্ত summary।

## 3. Local setup & commands (verified 2026-11-03, macOS, Node 24, Postgres 14)

```bash
corepack pnpm@10.20.0 install --frozen-lockfile    # pnpm via corepack; lockfile v9
createdb gartexhub_dev                               # disposable local DB
npx prisma generate && npx prisma migrate deploy     # needs DATABASE_URL in .env
pnpm run server        # API + WS on :4000   (GET /health = liveness)
pnpm run dev           # Vite on :5173, proxies /api /ws /uploads to VITE_API_PROXY
pnpm test              # Jest — do NOT export NODE_ENV; Jest must see NODE_ENV=test (Prisma test proxy)
pnpm run build         # production bundle → dist/
pnpm run lint          # biome
```

`.env` (gitignored) keys: required `DATABASE_URL`, `JWT_SECRET`, `UPLOADS_SIGNING_SECRET` (≥32 chars);
`JWT_ISSUER`, `JWT_AUDIENCE`, `PORT`, `APP_BASE_URL`, `REQUEST_TIMEOUT_MS`; AI (`OPENCODE_*`, `AI_*`, Gemini),
search (`OPENSEARCH_*`, `QDRANT_*`, `EMBEDDING_*`, `RERANKER_*`), email (`EMAIL_PROVIDER`, `GMAIL_*`),
e-sign (`ESIGN_*`), admin (`ADMIN_*`). Locally keep email unset and `OPENCODE_ENABLED=false` unless testing them.

Render: build `pnpm install --frozen-lockfile && pnpm run build && npx prisma migrate deploy && pnpm run db:generate && pnpm run ci:reindex`,
start `pnpm run start:prod`. Only `migrate deploy` runs on deploy — every schema change **must** ship as a migration.

## 4. Architecture map (verified)

- Routing/shell: `src/App.jsx` (lazy routes, `ProtectedRoute`, layout), `src/main.jsx`, `src/sw.js` (service worker).
- Nav/footer: `src/components/NavBar.jsx`, `src/components/Footer.jsx`; connectivity: `src/offline/connectivity.js` + `src/components/OfflineBanner.jsx`.
- Auth: `src/lib/auth.js` (token key `jwt`, `apiRequest`), `server/controllers/authController.js`, `server/services/userService.js`.
- Signup/onboarding: `src/pages/auth/Signup.jsx`, `src/pages/auth/OnboardingPage.jsx`, taxonomy `shared/config/platformTaxonomy.js`.
- Profiles: `src/pages/{Buyer,Factory,BuyingHouse}Profile.jsx` → `GET /api/profiles/:id` (`server/services/profileService.js`).
- Notifications: `src/pages/NotificationsCenter.jsx`, `server/services/notificationService.js`; single-item view `/share/:entityType/:entityId` (`src/pages/SharedPost.jsx`, `getShareablePost` in `server/services/feedService.js`).
- Settings: `src/pages/Settings.jsx`; owner console `src/pages/OwnerDashboard.jsx` (embeds `VerificationPage`).
- Assistant: `src/components/FloatingAssistant.jsx` → WS `ask` in `server/server.js` → `streamOpencodeReply` (`server/services/assistantService.js`).
- Theme: `src/theme/blueTheme.css` (default theme vars) → `src/theme/themes/tailwind-tokens.css` maps Tailwind colors to vars.
- Server lifecycle: `server/server.js` (`start()`, `/health`, process handlers).

## 5. Standing workstreams (আগের prompts থেকে condensed)

- **A. Documentation:** `docs/` → দুই ভাগ: `docs/user/` ও `docs/developer/` (+ `docs/README.md` navigation); root `README.md` landing page।
  শুধু বাস্তবে implemented feature document করবে; mock/simulated (payment, e-sign sandbox) স্পষ্ট লিখবে।
- **B. History:** `history/HISTORY_MAINTENANCE_INSTRUCTIONS.md` অনুসরণ করে প্রতিটি undocumented commit-এর আলাদা file,
  তারপর `history/index.md` + `history/progress.json` update। **Status 2026-11-03: 731 documented, HEAD-এ 885 commit → 154 pending**
  (owner-এর token-economy নির্দেশে এই pass-এ generate করা হয়নি; আলাদা pass-এ করতে হবে)।
- **C. Audit & security:** OWASP Top 10, IDOR/authz, JWT (issuer/audience), uploads, WS origin/auth, admin bypass codes, secret exposure।
- **D. Performance:** baseline → change → same-condition re-measure; Core Web Vitals (LCP ≤2.5s, INP ≤200ms, CLS ≤0.1) lab vs field আলাদা;
  no full-table scans, no unbounded lists, lazy heavy modules, correct cache headers।
- **E. Browser QA:** local + live (`https://gartexhub.onrender.com`, read-only) — routes, interactions, responsive (360/390/430/768/1366/1920), console/network।
- **F. Reliability (SRE):** structured crash log (`logs/crashes/`, rotated, secret-free), fatal → log + bounded flush + non-zero exit,
  graceful SIGTERM/SIGINT, liveness `/health` (Render `healthCheckPath`), local supervisor with capped exponential backoff;
  Render-এ in-process supervisor নয় (platform restart করবে)। Render Free filesystem ephemeral — stdout JSON-ই production crash record।
- **G. Client requirements:** নিচের tracker।

## 6. Client requirement tracker — "রহস্য" group, 02/11/2026 (+ linked earlier decisions)

Evidence: `bugs/WhatsApp Chat with রহস্য/` (chat txt, 18 screenshots, `meow-7 (1).pdf` = Buyer profile design **primary**,
`meow-8.pdf` = Buying House profile, `IMG-20260927-WA0169.jpg` = Factory profile), `more conv/…Shakibul hasan Shaun.txt`.

| # | Client request (summary) | Ref | Verified root cause | Status |
|---|---|---|---|---|
| 1 | দুই PDF + factory screenshot মিলিয়ে একটি profile design; Organization = org name; Industry = "Garments Industry"/"Textile Industry" | PDFs, WA0169 | profile pages show raw role/sector labels | VERIFIED (factory/buyer/buying-house cards show org name, Garments/Textile Industry, employees, capacity) |
| 2 | Mobile nav: Settings / Dark mode / Logout list-এর নিচে একই list-এ, আলাদা detached row নয় | WA0020, WA0021 | separate footer row in drawer | VERIFIED (Account group at end of list) |
| 3 | "Unstable connection" toast কিছুক্ষণ দেখিয়ে চলে যাবে, স্থায়ী/flicker নয় | WA0020 | heartbeat marks DEGRADED on *slow success* (>2.5s), no auto-hide; false "offline" | VERIFIED (transient, dismissible, once per incident) |
| 4 | Website ও সব scrolling দ্রুত/স্বাভাবিক | chat 8:49 | global Lenis smooth-scroll (`syncTouch`, lerp) hijacks wheel/touch | VERIFIED (Lenis removed; native scroll; route scroll reset) |
| 5 | Bot অন্তত সাধারণ প্রশ্নের উত্তর দিক (algorithmic) | chat 8:50 | AI-only path; guests get "Authentication required"; no FAQ fallback | VERIFIED (FAQ engine EN/BN; guest + member; socket-per-render bug fixed) |
| 6 | Login → Create account → "Failed to load page" | WA0022 | SW serves stale cached `index.html` → old chunk hashes 404 after redeploy; no retry | VERIFIED (network-first SW + chunk retry/reload; cache headers) |
| 7–8 | রঙ: logo-র সঠিক নীল সীমিতভাবে; বর্তমান উজ্জ্বল নীল সব জায়গায় খারাপ | WA0025, logo WA0006 | default theme uses stock neon sky/blue/cyan | IMPLEMENTED (logo navy/teal palette in default theme; client visual sign-off pending) |
| 8b | Signup feature cards "বলদা" দেখায় — sensible design | WA0027 | generic cards ("Premium UI", "Dual theme") above form | IMPLEMENTED (form first on mobile; 4 factual benefits) |
| 9 | Signup-এ আরো তথ্য: employee count, production capacity (unit/period), certificate step (skippable) | WA0028, WA0169 | fields absent in UI/API | VERIFIED (UI→API→DB; optional certifications step 4) |
| 10/17 | Password requirement সংক্ষিপ্ত (৩–৪টি), confirm-এর আগে mismatch নয়; keyboard খোলা অবস্থায় scroll | WA0030, WA0036 | 10-rule checklist; Lenis touch hijack | VERIFIED (3 rules, shared UI/API policy) |
| 11 | Signup-এর "GARTEXHUB" pill/typography অসুন্দর | WA0031 | uppercase tracking pill | VERIFIED (logo + normal typography) |
| 12–13 | Header-এ trolley icon নয়, real logo + স্বাভাবিক "GarTexHub"; "B2B Textile Marketplace" descriptor ভুল | WA0032, WA0006 | cart icon + letter-spaced text | VERIFIED (official emblem; "Garments & Textile Sourcing") |
| 14 | Footer link-এ গেলে page-এর শুরুতে যাবে | WA0033 | scroll reset effect runs once (`[]` deps) + Lenis | VERIFIED (scrollY=0 after footer link) |
| 15 | "View verification standards" — public standards + login/signup-এর পর verification workflow | WA0034 | button → protected `/verification`; buyers get Access denied | VERIFIED (public /help#verification + Get verified → login → /verification; buyers allowed) |
| 16 | Guest menu-তে Settings + Dark mode থাকবে না | WA0035 | guest drawer footer row | VERIFIED |
| 18 | Country dropdown scroll হয় না | WA0037 | nested list inside Lenis without opt-out | VERIFIED (scroll + keyboard + ARIA) |
| 19 | Account তৈরি অনেক ধীর | chat 9:19 | full-screen spinner swap; Render Free CPU/cold start (infra limit) | VERIFIED (UI submit→onboarding 130–370 ms locally; Render Free cold start remains an infra limit) |
| 20 | অন্য factory profile-এ Internal Server Error (বারবার) | WA0038, chat 15/10 | `getProfileOverview` reads `relationship` before `const` (TDZ) → 500 for every non-admin cross-profile view; also full-table scans | VERIFIED (HTTP 200; regression test fails on old code) |
| 21 | Notification click → নির্দিষ্ট text/video, generic feed নয় | chat 9:22 | `/feed?item=` works only if item already loaded | VERIFIED (opens /share/<type>/<id> of the exact item) |
| 22 | Settings সমস্যা (হারানো দীর্ঘ সমাধান) | WA0039 | solution found: client final decision 26/09/2026 (section 7) | IMPLEMENTED (status/wallet panel removed, tab order/names per decision, no duplicate tabs, server-side org-name rule) |

## 7. Settings / My Profile — client final decision (26/09/2026, `more conv/…Shakibul hasan Shaun.txt`)

1. My Profile সবার উপরে। 2. Organization Name সহজে বদলানো যাবে না (normal: 90 দিন lock; verified: trade license + documents re-upload)।
3. "General Info" নাম ভুল — chatbot enable/disable কাজ অনুযায়ী rename, Owner Dashboard-এ। 4. Boosts আলাদা tab নয় — post-এর Boost button → Boost Details।
5. Verification যেমন আছে। 6. Branding → Owner Dashboard। 7–8. Members, Contracts Owner Dashboard-এ — duplicate নয়।
9. "Subscription" → "Subscription & Billing"। 10. **Settings সবার নিচে: Theme, Notifications ON/OFF, Security।**
মূল নীতি: Owner Dashboard-এ যা আছে তা অন্য জায়গায় duplicate হবে না। (15/10: "All" filter button কাজ করে না — যাচাই করবে।)

## 8. Findings log — 2026-11-03

- **Schema drift (critical):** `schema.prisma`-এর ~500 লাইন (tables `assistant_rules`, `assistant_config`, `email_logs`, `orders`,
  `document_views`, `support_tickets`…; columns `content_hash/version`, rating sub-scores, `documents.ai_*`) কোনো migration-এ ছিল না।
  Fix: `prisma/migrations/20261103000000_reconcile_schema_drift` — fully idempotent, additive; migrations-only DB ও db-pushed DB দুইটাতেই
  apply হয়ে residual drift 0 (verified)।
- **Account takeover (critical):** register-এর "orphan recovery" existing email-এর জন্য password ছাড়াই JWT দিত।
- Profile 500 (TDZ) — tracker #20। `ProtectedRoute`: hook after early return; timeout path clears wrong key (`ght_token`)।
- Static serving: `index.html`, `sw.js`, `manifest.json` সহ সব dist file 1-year `immutable`।
- Process: `uncaughtException` swallowed (process continues corrupted); no `SIGTERM` handler।
- Jest baseline (correct env): 67/73 suites, 752 pass / 4 fail; failures = jsdom lacks `ReadableStream` (5 suites) + `@babel/parser` not resolvable under pnpm (1 suite)।
- The staged `codeInvestigation*` diff pasted in the old file was never committed and imported non-existent modules; the existing
  `/api/support/cases` investigation flow covers it — do not re-add.

- **More bugs fixed 2026-11-03:** buyer requirement create always 500 (`match_id` not a column, `assigned_at` = "",
  missing `priority_tier/priority_until` → migration `20261103020000_add_requirement_priority`); assistant socket re-created
  on every render (answers lost); assistant knowledge API missing (routes added, `public_ws`); verification-pricing endpoint
  missing; profile cover fetched from third-party wallhaven.cc (CORS-blocked, broken `<img>`) → local SVG; onboarding called
  non-existent `/api/categories`; Settings org name saved to `display_name`; `updateProfile` mass assignment (setup codes);
  global error handler turned every 4xx into 500; vendor chunk swallowed all `react-*` packages.
- **Verification evidence:** Jest 76/76 suites, 894 pass (baseline 752/4 fail). Browser (Playwright + Chrome, production
  build, mobile): 22/22 client checks pass. Lab perf (4× CPU, 1.6 Mbps, median of 3): LCP 7.8→3.8 s (home), 7.5→2.8 s
  (signup); JS −38%; initial JS+CSS brotli 825→261 KB. Crash injection: uncaught/rejection/DB-down/EADDRINUSE/supervisor all pass.

## 9. Open items

- History backfill (154 commits) — section 5B.
- Not implemented (UI degrades gracefully): `GET/DELETE /api/auth/sessions` (active sessions), self-service password reset.
- Main CSS ships all 12 themes (~1.1 MB raw) — lab FCP ≈ 2.2 s; split non-default themes next.
- `/api/chatbot/settings` 403 for free plans is the intended Premium gate.
- Developer docs (`docs/developer/*`) not updated in this pass (owner: no extra `.md`); this file holds the notes.
- Live deployment verification needs the owner to merge the task branch (Render deploys `main` on commit).
