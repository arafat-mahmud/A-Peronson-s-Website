# Commit 0739 — ed577cb

| Field | Value |
|-------|-------|
| **Commit Number** | 0739 |
| **Commit Hash** | ed577cbcfa61e641387d84577218cbed65d7ba5b |
| **Parent Hash** | 35eae53102922035ea65f3cf6467e517844d9341 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-05 23:04:52 |
| **Branch** | main |
| **Files Changed** | 48 |
| **Additions** | 7776 |
| **Deletions** | 1336 |
| **Net Change** | +6440 |
| **Merge Commit** | No |

## Build the HyperCache Offline Twin and Fix the PWA Manifest

Adds an offline layer: service-worker app shell (injectManifest), a Dexie IndexedDB store, `/api/sync` head/delta/hydrate endpoints with a SyncChange ledger, SSE invalidations, a stable feed cursor, an outbox for offline sends, an Offline Pack UI and tests. The manifest gets split maskable icons, shortcut icons and screenshots.

Original commit message: “feat: GarTexHub HyperCache offline twin (phases 1-7) + PWA manifest fixes”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `package-lock.json` | Modified | 2202 | 252 | +2202/-252 |
| `src/pages/OrgSettings.jsx` | Modified | 471 | 374 | +471/-374 |
| `src/offline/outbox.js` | Added | 505 | 0 | +505/-0 |
| `src/pages/AdminPanel.jsx` | Modified | 250 | 246 | +250/-246 |
| `src/pages/MainFeed.jsx` | Modified | 349 | 135 | +349/-135 |
| `prisma/schema.prisma` | Modified | 212 | 182 | +212/-182 |
| `tests/e2e/hypercache-offline.spec.js` | Added | 354 | 0 | +354/-0 |
| `src/components/OfflineStorageSection.jsx` | Added | 330 | 0 | +330/-0 |
| `src/offline/connectivity.js` | Added | 287 | 0 | +287/-0 |
| `src/offline/syncEngine.js` | Added | 257 | 0 | +257/-0 |
| `src/components/OfflineBanner.jsx` | Added | 210 | 0 | +210/-0 |
| `src/sw.js` | Added | 209 | 0 | +209/-0 |
| `server/services/feedService.js` | Modified | 144 | 21 | +144/-21 |
| `server/services/syncService.js` | Added | 155 | 0 | +155/-0 |
| `src/offline/cacheManager.js` | Added | 137 | 0 | +137/-0 |
| `src/lib/feedRealtime.js` | Modified | 127 | 1 | +127/-1 |
| `src/offline/syncTransport.js` | Added | 120 | 0 | +120/-0 |
| `src/pages/ChatInterface.jsx` | Modified | 60 | 60 | +60/-60 |
| `src/offline/broadcast.js` | Added | 110 | 0 | +110/-0 |
| `tests/unit/hypercache.test.js` | Added | 98 | 0 | +98/-0 |
| `public/manifest.json` | Modified | 86 | 9 | +86/-9 |
| `src/App.jsx` | Modified | 62 | 27 | +62/-27 |
| `server/services/productService.js` | Modified | 76 | 5 | +76/-5 |
| `server/services/feedPostService.js` | Modified | 73 | 5 | +73/-5 |
| `server/services/requirementService.js` | Modified | 74 | 3 | +74/-3 |
| `server/utils/hypercache.js` | Added | 76 | 0 | +76/-0 |
| `src/offline/conflictResolver.js` | Added | 76 | 0 | +76/-0 |
| `server/services/changeLogService.js` | Added | 72 | 0 | +72/-0 |
| `server/services/feedGenerationService.js` | Added | 62 | 0 | +62/-0 |
| `src/main.jsx` | Modified | 57 | 0 | +57/-0 |
| `server/controllers/feedStreamController.js` | Modified | 49 | 2 | +49/-2 |
| `server/controllers/syncController.js` | Added | 49 | 0 | +49/-0 |
| `src/offline/hash.js` | Added | 49 | 0 | +49/-0 |
| `src/offline/offlineStore.js` | Added | 46 | 0 | +46/-0 |
| `server/services/contentHashService.js` | Added | 41 | 0 | +41/-0 |
| `src/offline/schema.js` | Added | 41 | 0 | +41/-0 |
| `server/realtime/realtimeBus.js` | Modified | 40 | 0 | +40/-0 |
| `server/services/entityVersionService.js` | Added | 35 | 0 | +35/-0 |
| `src/offline/db.js` | Added | 35 | 0 | +35/-0 |
| `prisma/migrations_hypercache_draft.sql` | Added | 32 | 0 | +32/-0 |
| … 8 more files | — | 58 | 14 | (smaller changes) |

### What changed per file

- **`package-lock.json`** — modified dependencies. +2202/-252 lines.
- **`src/pages/OrgSettings.jsx`** — modified page. +471/-374 lines.
- **`src/offline/outbox.js`** — added frontend library. function added: `normalizeEntity`; function added: `isBlockedEntity`; function added: `isSafeEntity`; function added: `endpointFor`; function added: `getBlocklist`; function added: `makeLocalId` ….
- **`src/pages/AdminPanel.jsx`** — modified page. +250/-246 lines.
- **`src/pages/MainFeed.jsx`** — modified page. +349/-135 lines.
- **`prisma/schema.prisma`** — modified database schema. Prisma model added: `SyncChange`.
- **`tests/e2e/hypercache-offline.spec.js`** — added test. function added: `skipIfNoBackend`; function added: `seedAuth`; function added: `stubAppApis`; function added: `dexieCount`; function added: `dexieGet`; function added: `runSyncInPage` ….
- **`src/components/OfflineStorageSection.jsx`** — added component. function added: `toEpochMs`; function added: `asArray`; function added: `fetchFeedSnapshot`; function added: `fetchProfileSnapshot`; function added: `fetchProductsSnapshot`; function added: `OfflineStorageSection`.
- **`src/offline/connectivity.js`** — added frontend library. function added: `emit`; function added: `setState`; function added: `getChannel`; function added: `postCrossTab`; function added: `snapshotAvailable`; function added: `markUnreachable` ….
- **`src/offline/syncEngine.js`** — added frontend library. function added: `storeFor`; function added: `getLocalSequence`; function added: `setLocalSequence`; function added: `isFullResyncPending`; function added: `setFullResyncPending`; function added: `applyChanges` ….
- **`src/components/OfflineBanner.jsx`** — added component. function added: `SwUpdateCard`; function added: `OfflineBanner`.
- **`src/sw.js`** — added other. function added: `isNetworkOnly`; function added: `isHashedAsset`; function added: `isFontOrIcon`; function added: `cacheFirst`; function added: `staleWhileRevalidate`; function added: `handleNavigation`.

## Detailed Diff Analysis

- **Areas touched:** dependencies (2 files, +2205/-252), page (4 files, +1130/-815), frontend library (12 files, +1790/-1), server service (9 files, +732/-34), component (2 files, +540/-0), test (2 files, +452/-0), database schema (1 file, +212/-182), other (4 files, +360/-27).
- **Route added** (4): `GET /head`, `GET /delta`, `GET /hydrate`, `POST /hydrate`
- **Prisma model added** (1): `SyncChange`
- **Table created** (1): `sync_changes`
- **Function added** (144): `sendEvent`, `feedStream`, `getSyncHead`, `getSyncDelta`, `hydrateSyncEntities`, `emitSyncInvalidated`, `appendChange`, `emitAfterCommit`, `canonicalize`, `canonicalJson` …
- **Function removed** (3): `sendEvent`, `feedStream`, `subscribeFeedRealtime`
- **Test case added** (9): `(a) online load populates Dexie (feed visible)`, `(b) offline reload still renders /feed from snapshot`, `(c) reconnect with no changes -> tiny/no entity payload`, `(d) one-post change -> only delta fetched`, `head shape: buildSyncHead returns entity/version/hash/seq contract`, `delta ordering: out-of-order prisma rows sort ascending by seq`, `hash determinism: key order and repeated calls give identical digests`, `outbox idempotency: same key inserts once`, `RESET_REQUIRED: seq gap detected, contiguous stream passes`
- **Dependencies:** added/changed `dexie` ^4.4.6; added/changed `vite-plugin-pwa` ^2.0.0; added/changed `workbox-window` ^7.4.1
- **Tests:** 2 test file(s) changed: `tests/e2e/hypercache-offline.spec.js`, `tests/unit/hypercache.test.js`

## Why This Change Was Needed

Users on unreliable connections (common for the target market) should keep reading and queue actions offline (inference from the feature set).

## Was It Useful

Useful but large. A big new subsystem in one commit, touching the schema and several pages; it raises maintenance cost and needed follow-up fixes.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths. API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. Database schema changes on the next deploy; backwards compatibility depends on the migration being additive. Build/deploy or tooling configuration changes. Dependency set changes; a fresh install is required.

## Relationship to Surrounding Commits

- **Follows:** 0738 — Return 403 Instead of 500 for Premium Chatbot Settings.
- **Precedes:** 0740 — Stop Sync Heartbeat 401 Noise for Signed-Out Users.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: `public/favicon-96x96.png`, `public/screenshot-narrow.png`, `public/screenshot-wide.png`.
- Build output (`dist/`) files: 0.
