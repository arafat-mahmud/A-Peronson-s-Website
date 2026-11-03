// HyperCache Phase 1 — connectivity state machine (app-shell scope).
// States: ONLINE / DEGRADED / OFFLINE / SYNCING / UP_TO_DATE / SYNC_ERROR / OFFLINE_SNAPSHOT.
//
// Sources, in priority order:
// 1. navigator.onLine + online/offline events (coarse OS-level signal)
// 2. Heartbeat GET /api/sync/head (graceful 404/405/501 = reachable backend
//    without sync routes -> ONLINE with syncUnavailable flag, never an error)
// 3. BroadcastChannel "gartexhub-sync" (cross-tab state sharing)
// 4. Explicit sync-phase overrides via setSyncPhase() (Phase 2 engine hooks)
//
// Heartbeat policy: a failed heartbeat -> DEGRADED; the device reporting
// itself offline, or three failures in a row -> OFFLINE (or OFFLINE_SNAPSHOT
// when a local snapshot exists). A slow but successful heartbeat stays ONLINE
// (flagged `slow`). Heartbeat success never clobbers an in-flight
// SYNCING state.

export const ConnectivityState = Object.freeze({
	ONLINE: "ONLINE",
	DEGRADED: "DEGRADED",
	OFFLINE: "OFFLINE",
	SYNCING: "SYNCING",
	UP_TO_DATE: "UP_TO_DATE",
	SYNC_ERROR: "SYNC_ERROR",
	OFFLINE_SNAPSHOT: "OFFLINE_SNAPSHOT",
});

const BASE_STATES = new Set([
	ConnectivityState.ONLINE,
	ConnectivityState.DEGRADED,
	ConnectivityState.OFFLINE,
	ConnectivityState.OFFLINE_SNAPSHOT,
]);

const CHANNEL_NAME = "gartexhub-sync";
const DEFAULT_HEARTBEAT_URL = "/api/sync/head";
const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 8000;
const SLOW_MS = 2500;

const NO_SYNC_STATUSES = new Set([404, 405, 501]);

let status = {
	state:
		typeof navigator !== "undefined" && navigator.onLine === false
			? ConnectivityState.OFFLINE
			: ConnectivityState.ONLINE,
	latencyMs: null,
	lastHeartbeatAt: 0,
	consecutiveFailures: 0,
	syncUnavailable: false,
	updatedAt: Date.now(),
};

const listeners = new Set();
let started = false;
let timerId = null;
let channel = null;
let options = {};
let hasSnapshotFn = null;

function emit() {
	const snapshot = { ...status };
	for (const fn of listeners) {
		try {
			fn(snapshot);
		} catch {
			/* ignore listener errors */
		}
	}
}

function setState(patch, { broadcast = true } = {}) {
	const next = { ...status, ...patch, updatedAt: Date.now() };
	const changed = next.state !== status.state;
	status = next;
	if (changed) {
		emit();
		if (broadcast) postCrossTab();
	}
}

function getChannel() {
	if (channel) return channel;
	try {
		if (typeof BroadcastChannel !== "undefined") {
			channel = new BroadcastChannel(CHANNEL_NAME);
			channel.onmessage = (event) => {
				const msg = event?.data;
				if (!msg || msg.type !== "connectivity" || !msg.state) return;
				if (typeof msg.at === "number" && msg.at < status.updatedAt) return;
				if (BASE_STATES.has(msg.state) && msg.state !== status.state) {
					status = { ...status, state: msg.state, updatedAt: Date.now() };
					emit();
				}
			};
		}
	} catch {
		channel = null;
	}
	return channel;
}

function postCrossTab() {
	const ch = getChannel();
	if (!ch) return;
	try {
		ch.postMessage({ type: "connectivity", state: status.state, at: status.updatedAt });
	} catch {
		/* ignore */
	}
}

async function snapshotAvailable() {
	if (typeof hasSnapshotFn === "function") {
		try {
			return Boolean(await hasSnapshotFn());
		} catch {
			return false;
		}
	}
	return false;
}

async function markUnreachable() {
	const failures = status.consecutiveFailures + 1;
	// "Offline" is reserved for a device that reports itself offline or a
	// backend that stayed unreachable for three heartbeats in a row.
	const deviceOffline = typeof navigator !== "undefined" && navigator.onLine === false;
	if (deviceOffline || failures >= 3) {
		const offlineState = (await snapshotAvailable())
			? ConnectivityState.OFFLINE_SNAPSHOT
			: ConnectivityState.OFFLINE;
		setState({ state: offlineState, consecutiveFailures: failures, latencyMs: null });
	} else {
		setState({ state: ConnectivityState.DEGRADED, consecutiveFailures: failures });
	}
}

function markReachable(latencyMs, syncUnavailable) {
	// Don't clobber an in-flight sync pass; the engine owns the state meanwhile.
	if (status.state === ConnectivityState.SYNCING) {
		status = { ...status, consecutiveFailures: 0, latencyMs, lastHeartbeatAt: Date.now() };
		return;
	}
	// An answer - however slow - proves the connection works. Slowness alone
	// (a cold Render instance, a long route from Bangladesh) used to flag
	// DEGRADED and pin an "Unstable connection" card on screen; it is now only
	// recorded (status.slow) for code that wants to adapt.
	const state = ConnectivityState.ONLINE;
	setState({
		slow: latencyMs > SLOW_MS,
		state,
		consecutiveFailures: 0,
		latencyMs,
		lastHeartbeatAt: Date.now(),
		syncUnavailable,
	});
}

function readAuthToken() {
	// Same key as src/lib/auth.js TOKEN_KEY ("jwt"). Read directly instead of
	// importing auth.js to avoid a dependency cycle with the offline layer.
	try {
		if (typeof localStorage !== "undefined") {
			const t = localStorage.getItem("jwt") || sessionStorage.getItem("jwt");
			if (t) return t;
		}
	} catch {
		/* storage unavailable */
	}
	return "";
}

export async function pingNow() {
	const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

	if (typeof navigator !== "undefined" && navigator.onLine === false) {
		await markUnreachable();
		return { ...status };
	}

	// Logged in -> heartbeat the sync endpoint (proves sync path works).
	// Logged out -> /api/sync/head would 401 and spam the console with
	// "Failed to load resource" noise, so probe public URLs instead.
	// NOTE: adblockers sometimes block individual paths (seen: /health hit
	// by ERR_BLOCKED_BY_CLIENT), so probe a chain — any HTTP response,
	// even 404, proves the backend is reachable. Only total failure of
	// every candidate means offline.
	const token = readAuthToken();
	const candidates = token
		? [{ url: options.heartbeatUrl || DEFAULT_HEARTBEAT_URL, headers: { Authorization: `Bearer ${token}` } }]
		: [
				{ url: "/health", headers: {} },
				{ url: "/favicon.ico", headers: {} },
				{ url: "/manifest.json", headers: {} },
			];

	const controller = typeof AbortController === "undefined" ? null : new AbortController();
	try {
		for (const { url, headers } of candidates) {
			const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
			const startedAt = Date.now();
			try {
				const res = await fetch(url, {
					method: "GET",
					cache: "no-store",
					credentials: "same-origin",
					headers,
					signal: controller?.signal,
				});
				const latencyMs = Date.now() - startedAt;
				if (timer) clearTimeout(timer);
				if (res.ok || NO_SYNC_STATUSES.has(res.status)) {
					markReachable(latencyMs, !res.ok || !token);
					return { ...status };
				}
				if (res.status >= 500) continue; // try next candidate
				// Other 4xx (e.g. expired token): backend reachable -> link is fine.
				markReachable(latencyMs, true);
				return { ...status };
			} catch {
				if (timer) clearTimeout(timer);
				continue; // blocked/aborted/timeout -> try next candidate
			}
		}
		await markUnreachable();
	} catch {
		await markUnreachable();
	}
	return { ...status };
}

function handleOnline() {
	// Re-probe immediately; the OS signal alone is not trustworthy.
	pingNow();
}

async function handleOffline() {
	const offlineState = (await snapshotAvailable())
		? ConnectivityState.OFFLINE_SNAPSHOT
		: ConnectivityState.OFFLINE;
	setState({ state: offlineState, consecutiveFailures: 0, latencyMs: null });
}

/**
 * Explicit sync-phase override (wired to the Phase 2 sync engine).
 * SYNCING / UP_TO_DATE / SYNC_ERROR are engine-owned; heartbeats won't
 * overwrite SYNCING, and base states resume on the next explicit call.
 */
export function setSyncPhase(phase) {
	if (!Object.values(ConnectivityState).includes(phase)) return;
	setState({ state: phase });
}

/** Non-sync reachability states only (for UI that ignores sync phases). */
export function isOnline() {
	return (
		status.state === ConnectivityState.ONLINE ||
		status.state === ConnectivityState.UP_TO_DATE ||
		status.state === ConnectivityState.DEGRADED
	);
}

export function getStatus() {
	return { ...status };
}

export function subscribe(fn) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

export function startConnectivity(opts = {}) {
	options = {
		heartbeatUrl: DEFAULT_HEARTBEAT_URL,
		intervalMs: DEFAULT_INTERVAL_MS,
		timeoutMs: DEFAULT_TIMEOUT_MS,
		...opts,
	};
	if (typeof opts.hasSnapshot === "function") hasSnapshotFn = opts.hasSnapshot;
	getChannel();
	if (started || typeof window === "undefined") return () => stopConnectivity();
	started = true;
	window.addEventListener("online", handleOnline);
	window.addEventListener("offline", handleOffline);
	pingNow();
	timerId = setInterval(pingNow, options.intervalMs);
	return () => stopConnectivity();
}

export function stopConnectivity() {
	started = false;
	if (timerId) {
		clearInterval(timerId);
		timerId = null;
	}
	if (typeof window !== "undefined") {
		window.removeEventListener("online", handleOnline);
		window.removeEventListener("offline", handleOffline);
	}
	try {
		channel?.close?.();
	} catch {
		/* ignore */
	}
	channel = null;
}

export function __resetConnectivityForTests() {
	stopConnectivity();
	listeners.clear();
	hasSnapshotFn = null;
	options = {};
	status = {
		state: ConnectivityState.ONLINE,
		latencyMs: null,
		lastHeartbeatAt: 0,
		consecutiveFailures: 0,
		syncUnavailable: false,
		updatedAt: Date.now(),
	};
}

export default {
	ConnectivityState,
	getStatus,
	subscribe,
	startConnectivity,
	stopConnectivity,
	setSyncPhase,
	pingNow,
	isOnline,
};
