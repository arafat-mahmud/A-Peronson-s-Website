// HyperCache Phase 1 — offline app shell service worker.
// Built via vite-plugin-pwa `injectManifest` strategy: the build injects the
// precache manifest into `self.__WB_MANIFEST`. Vanilla Cache API only — no
// workbox runtime imports, so the SW never breaks on missing workbox deps.
//
// Routing policy:
// - NetworkOnly: /api/*, /ws*, /api/feed/stream (never cached, incl. SSE)
// - CacheFirst: /assets/* (hashed at build time, capped — lazy route chunks
//   are cached on first use, never precached, so first visits only fetch
//   the shell + vendors + current route). A hashed-asset MISS (404/failed)
//   with nothing cached means the shell is stale (deploy rotated the hashes
//   out from under it): clients are nudged to update (see noteStaleShell).
// - StaleWhileRevalidate: fonts (googleapis/gstatic) + icons (svg/png/ico/woff2)
// - Navigations: cached /index.html served app-shell-first, network revalidates;
//   network fallback when nothing cached yet. Offline -> cached shell.
// - skipWaiting + clientsClaim ONLY via explicit SKIP_WAITING message (never forced).

/* global self, caches, fetch, Response, Request, URL */

const SHELL_CACHE = "gartexhub-app-shell-v1";
const ASSETS_CACHE = "gartexhub-assets-v1";
const RUNTIME_CACHE = "gartexhub-runtime-v1";
const OFFLINE_URL = "/index.html";

// Injected at build time by vite-plugin-pwa. Empty array in dev / before build.
const PRECACHE_MANIFEST = self.__WB_MANIFEST || [];

const NETWORK_ONLY_PATTERNS = [/^\/api\//, /^\/ws(\/|$)/];
const STREAM_PATHS = ["/api/feed/stream"];

function isNetworkOnly(url) {
	if (url.origin !== self.location.origin) return false;
	const path = url.pathname;
	if (STREAM_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return true;
	return NETWORK_ONLY_PATTERNS.some((re) => re.test(path));
}

function isHashedAsset(url) {
	return url.origin === self.location.origin && url.pathname.startsWith("/assets/");
}

function isFontOrIcon(request, url) {
	if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") return true;
	if (url.origin !== self.location.origin) return false;
	return /\.(?:svg|png|ico|woff2?)$/i.test(url.pathname);
}

async function cacheFirst(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request, { ignoreSearch: false });
	if (cached) return cached;
	let response = null;
	try {
		response = await fetch(request);
	} catch {
		response = null;
	}
	if (response && (response.status === 200 || response.type === "opaque")) {
		cache.put(request, response.clone()).catch(() => {});
		// Cap the assets cache so lazy chunks can't grow it unbounded.
		if (cacheName === ASSETS_CACHE) {
			eventLoopTrim(cache);
		}
		return response;
	}
	// Hashed-asset miss with nothing cached: the cached shell references a
	// deploy that no longer exists on the server. Same failed-request outcome
	// as before, plus a nudge so the update prompt appears.
	if (cacheName === ASSETS_CACHE) {
		noteStaleShell();
	}
	return response || Response.error();
}

// A missing hashed asset means the running shell is older than the live
// deploy. Throttled: pull the newest SW (updatefound -> waiting -> the
// existing OfflineBanner prompt) and tell pages, so the user gets a
// one-tap Refresh instead of a silently broken chunk.
let lastStaleNote = 0;
function noteStaleShell() {
	const now = Date.now();
	if (now - lastStaleNote < 5 * 60 * 1000) return;
	lastStaleNote = now;
	try {
		self.clients
			.matchAll({ includeUncontrolled: true })
			.then((list) =>
				list.forEach((c) => {
					try {
						c.postMessage({ type: "STALE_SHELL" });
					} catch {
						/* client gone */
					}
				}),
			)
			.catch(() => {});
	} catch {
		/* clients API unavailable */
	}
	try {
		const p = self.registration && self.registration.update();
		if (p && typeof p.catch === "function") p.catch(() => {});
	} catch {
		/* update check is best-effort */
	}
}

// Fire-and-forget trim: keep the newest ~120 entries.
function eventLoopTrim(cache) {
	Promise.resolve()
		.then(() => cache.keys())
		.then((keys) => {
			if (keys.length > 120) {
				return cache.delete(keys[0]).catch(() => {});
			}
			return null;
		})
		.catch(() => {});
}

async function staleWhileRevalidate(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	const networkPromise = fetch(request)
		.then((response) => {
			if (response && (response.status === 200 || response.type === "opaque")) {
				cache.put(request, response.clone()).catch(() => {});
			}
			return response;
		})
		.catch(() => null);
	if (cached) return cached;
	const networked = await networkPromise;
	return networked || Response.error();
}

// Navigations: serve the cached app shell instantly (offline-capable),
// revalidate /index.html in the background. If nothing cached yet, try the
// network, then fall back to the cached shell on failure.
// Network-first: the shell must come from the current deploy, because a cached
// index.html names chunk files that a newer deploy has removed - that is what
// showed "Failed to load page" after every deploy. The cached shell is only
// the fallback when the network fails or is slower than NAVIGATION_TIMEOUT_MS.
const NAVIGATION_TIMEOUT_MS = 4000;

async function handleNavigation(event) {
	const cache = await caches.open(SHELL_CACHE);

	const network = (async () => {
		const preload = event.preloadResponse ? await event.preloadResponse.catch(() => null) : null;
		const response = preload || (await fetch(event.request));
		if (response && response.status === 200) {
			event.waitUntil(cache.put(OFFLINE_URL, response.clone()).catch(() => {}));
		}
		return response;
	})();
	// The background fetch keeps refreshing the cache even if the timeout wins.
	event.waitUntil(network.catch(() => null));

	let timer = null;
	const timeout = new Promise((resolve) => {
		timer = setTimeout(() => resolve(null), NAVIGATION_TIMEOUT_MS);
	});
	try {
		const winner = await Promise.race([network, timeout]);
		if (winner) return winner;
	} catch {
		// offline - fall through to the cached shell
	} finally {
		clearTimeout(timer);
	}

	const cachedShell = (await cache.match(OFFLINE_URL)) || (await cache.match("/"));
	if (cachedShell) return cachedShell;
	try {
		return await network;
	} catch {
		return Response.error();
	}
}

// --- Lifecycle ---

self.addEventListener("install", (event) => {
	// Precaching only — do NOT skipWaiting here (update is opt-in via message).
	event.waitUntil(
		(async () => {
			const cache = await caches.open(SHELL_CACHE);
			const entries = PRECACHE_MANIFEST.map((entry) =>
				typeof entry === "string" ? entry : entry.url,
			).filter(Boolean);
			// Cache each entry individually so one 404 doesn't fail the batch.
			await Promise.all(
				entries.map(async (url) => {
					try {
						const res = await fetch(url, { cache: "no-store" });
						if (res && (res.status === 200 || res.type === "opaque")) {
							await cache.put(url, res.clone());
						}
					} catch {
						/* asset unavailable at install — runtime caching covers it */
					}
				}),
			);
		})(),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			// Navigation preload for faster navigations.
			try {
				if ("navigationPreload" in self.registration) {
					await self.registration.navigationPreload.enable();
				}
			} catch {
				/* preload unsupported */
			}
			// Drop stale versioned caches.
			const keep = new Set([SHELL_CACHE, ASSETS_CACHE, RUNTIME_CACHE]);
			const names = await caches.keys();
			await Promise.all(names.map((n) => (keep.has(n) ? null : caches.delete(n))));
			// Claim clients ONLY when an update was explicitly accepted (see message).
			if (self.__gartexClaim === true) {
				self.__gartexClaim = false;
				try {
					await self.clients.claim();
				} catch {
					/* ignore */
				}
			}
		})(),
	);
});

// Opt-in update channel: the page posts { type: "SKIP_WAITING" } only after
// the user accepts the refresh (OfflineBanner). Never forced on install.
self.addEventListener("message", (event) => {
	const type = event?.data?.type || event?.data;
	if (type === "SKIP_WAITING") {
		self.__gartexClaim = true;
		self.skipWaiting().catch(() => {});
	}
	if (type === "GET_VERSION") {
		event?.ports?.[0]?.postMessage?.({ version: SHELL_CACHE });
	}
});

// --- Fetch ---

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;

	let url;
	try {
		url = new URL(request.url);
	} catch {
		return;
	}

	// API / WebSocket / SSE: pure network, never cached, never intercepted.
	if (isNetworkOnly(url)) return;

	// App navigations: offline-capable shell.
	if (request.mode === "navigate") {
		event.respondWith(handleNavigation(event));
		return;
	}

	// Hashed build assets: immutable, cache-first.
	if (isHashedAsset(url)) {
		event.respondWith(cacheFirst(request, ASSETS_CACHE));
		return;
	}

	// Fonts + icons: stale-while-revalidate.
	if (isFontOrIcon(request, url)) {
		event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
	}
});
