import { logger } from "./logger.js";

/** @typedef {import('./types.js').User} User */
/** @typedef {import('./types.js').AuthResponse} AuthResponse */

export const API_BASE = import.meta.env.VITE_API_URL || "/api";

const USER_KEY = "user";
const TOKEN_KEY = "jwt";

let cachedUser = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60_000;

// BUG-033: Token refresh state
let refreshPromise = null;
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiry

function loadUserFromStorage() {
	try {
		const raw = localStorage.getItem(USER_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

// BUG-033: Decode JWT payload to check expiry without calling the server
function decodeTokenPayload(token) {
	try {
		const base64 = token.split(".")[1];
		const padded = base64.replace(/-/g, "+").replace(/_/g, "/");
		return JSON.parse(atob(padded));
	} catch {
		return null;
	}
}

// BUG-033: Check if the current token is within 5 minutes of expiry
function isTokenExpiringSoon(token) {
	if (!token) return false;
	const payload = decodeTokenPayload(token);
	if (!payload || !payload.exp) return false;
	const expiryMs = payload.exp * 1000;
	return Date.now() >= expiryMs - REFRESH_THRESHOLD_MS;
}

// BUG-033: Silently refresh the JWT token from the backend
async function refreshAuthToken() {
	const token = getToken();
	if (!token) return null;

	// Deduplicate concurrent refresh calls
	if (refreshPromise) return refreshPromise;

	refreshPromise = (async () => {
		try {
			const res = await fetch(`${API_BASE}/auth/refresh`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
			});
			if (!res.ok) return null;
			const data = await res.json();
			if (data?.token) {
				// Persist the new token
				if (localStorage.getItem(TOKEN_KEY)) {
					localStorage.setItem(TOKEN_KEY, data.token);
				} else {
					sessionStorage.setItem(TOKEN_KEY, data.token);
				}
				if (data.user) {
					cachedUser = data.user;
					cacheTime = Date.now();
				}
				return data.token;
			}
			return null;
		} catch (err) {
			logger.warn("[auth] token refresh failed", err);
			return null;
		} finally {
			refreshPromise = null;
		}
	})();
	return refreshPromise;
}

// getCurrentUser() runs during renders. Once the memory copy was stale it
// started a /users/me request on EVERY call - and while the API was down,
// every render added another one. One request at a time, and a pause after a
// failure.
let userFetchPromise = null;
let userFetchRetryAt = 0;

async function fetchAndCacheUser(token) {
	if (userFetchPromise) return userFetchPromise;
	if (Date.now() < userFetchRetryAt) return cachedUser;
	userFetchPromise = (async () => {
		try {
			const user = await fetchCurrentUser(token);
			if (user) {
				cachedUser = user;
				cacheTime = Date.now();
			}
			return user;
		} catch {
			userFetchRetryAt = Date.now() + 15_000;
			return null;
		} finally {
			userFetchPromise = null;
		}
	})();
	return userFetchPromise;
}

/**
 * Retrieves the JWT token from local or session storage.
 * @returns {string} The JWT token, or an empty string if not found.
 */
export function getToken() {
	return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || "";
}

/**
 * Retrieves the current user from memory cache or storage.
 * @returns {User|null} The current user object, or null if not authenticated.
 */
export function getCurrentUser() {
	const token = getToken();
	if (!token) {
		return null;
	}

	const now = Date.now();
	if (cachedUser && now - cacheTime < CACHE_TTL_MS) {
		return cachedUser;
	}

	if (!cachedUser) {
		const stored = loadUserFromStorage();
		if (stored) {
			cachedUser = stored;
			cacheTime = now;
		}
	}

	fetchAndCacheUser(token).catch(() => {});
	return cachedUser;
}

/**
 * Retrieves the current user from memory cache or storage asynchronously.
 * @returns {Promise<User|null>} The current user object, or null if not authenticated.
 */
export async function getCurrentUserAsync() {
	const token = getToken();
	if (!token) {
		return null;
	}

	const stored = loadUserFromStorage();
	if (stored) {
		cachedUser = stored;
		cacheTime = Date.now();
	}

	const now = Date.now();
	if (cachedUser && now - cacheTime < CACHE_TTL_MS) {
		return cachedUser;
	}

	return fetchAndCacheUser(token);
}

// Sync user data from API before page loads - security critical
/**
 * Sync user data from API before page loads - security critical
 * @param {string} [token] - The JWT token.
 * @returns {Promise<User|null>} The user object, or null if sync failed.
 */
export async function syncUserFromApi(token = getToken()) {
	if (!token) {
		return null;
	}
	try {
		const user = await apiRequest("/users/me", { token });
		if (user) {
			persistUser(user);
			return user;
		}
	} catch (err) {
		logger.error("User sync failed:", err);
	}
	return null;
}

// Check and sync user data - compares localStorage with DB and updates if needed
/**
 * Check and sync user data - compares localStorage with DB and updates if needed
 * @param {string} [token] - The JWT token.
 * @returns {Promise<User|null>} The synced user object, or null if failed.
 */
export async function verifyAndSyncUser(token = getToken()) {
	if (!token) {
		clearSession();
		return null;
	}

	// Always fetch fresh from API - never trust localStorage for security
	return syncUserFromApi(token);
}

/**
 * Persists the minimal user object to localStorage.
 * @param {User} user - The user object to persist.
 * @returns {User|null} The persisted minimal user object, or null if user is null.
 */
export function persistUser(user) {
	if (!user) {
		return null;
	}
	// Only store minimal essential data - never trust sensitive data from localStorage
	// subscription_status, entitlements, capabilities should NOT be stored
	// role is stored but ALWAYS synced from API on page load via verifyAndSyncUser
	const minimalUser = {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
		profile: user.profile
			? {
					avatar_url: user.profile.avatar_url,
					profile_image: user.profile.profile_image,
					organization_name: user.profile.organization_name,
				}
			: null,
	};
	localStorage.setItem(USER_KEY, JSON.stringify(minimalUser));
	return minimalUser;
}

/**
 * Saves the session user and token to storage.
 * @param {User} user - The user object.
 * @param {string} token - The JWT token.
 * @param {Object} [options] - Options.
 * @param {boolean} [options.remember=true] - Whether to remember the session.
 * @returns {void}
 */
export function saveSession(user, token, { remember = true } = {}) {
	persistUser(user);
	if (remember) {
		localStorage.setItem(TOKEN_KEY, token);
		sessionStorage.removeItem(TOKEN_KEY);
		return;
	}

	localStorage.removeItem(TOKEN_KEY);
	sessionStorage.setItem(TOKEN_KEY, token);
}

/**
 * Clears the session user and token from storage.
 * @returns {void}
 */
export const SESSION_CLEARED_EVENT = "gartexhub:session-cleared";

export function clearSession() {
	const hadToken = Boolean(getToken());
	localStorage.removeItem(USER_KEY);
	localStorage.removeItem(TOKEN_KEY);
	sessionStorage.removeItem(TOKEN_KEY);
	cachedUser = null;
	cacheTime = 0;
	// Protected pages listen for this and send the user to the login page,
	// instead of leaving them on a page whose requests now all fail.
	if (hadToken && typeof window !== "undefined") {
		window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
	}
}

/**
 * Makes an API request.
 * @param {string} path - The request path.
 * @param {Object} [options] - The request options.
 * @param {string} [options.method='GET'] - HTTP method.
 * @param {string} [options.token=''] - JWT token.
 * @param {any} [options.body] - Request body.
 * @param {AbortSignal} [options.signal] - Abort signal.
 * @param {Object} [options.headers={}] - HTTP headers.
 * @returns {Promise<any>} The response data.
 */
export async function apiRequest(path, options = {}) {
	const method = String(options.method || "GET").toUpperCase();
	const token = options.token || "";
	// Identical GETs in flight at the same time share one request: several
	// components ask for /users/me (and pages for their config) on mount.
	if (method === "GET" && !options.signal && !options.body) {
		const key = `${path}|${token || getToken()}`;
		const pending = inflightGets.get(key);
		if (pending) {
			return pending.then(copyResponse);
		}
		const promise = performApiRequest(path, { ...options, method }).finally(() => {
			inflightGets.delete(key);
		});
		inflightGets.set(key, promise);
		return promise;
	}
	return performApiRequest(path, { ...options, method });
}

const inflightGets = new Map();

// Each caller of a shared GET gets its own copy of the response.
function copyResponse(data) {
	if (!data || typeof data !== "object") return data;
	return typeof structuredClone === "function"
		? structuredClone(data)
		: JSON.parse(JSON.stringify(data));
}

// Render restarts and cold starts answer 502/503/504 (often with an HTML
// page, not JSON) for a few seconds. Reads are retried; writes only when the
// request provably never reached a handler.
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const RETRY_DELAYS_MS = [800, 2000, 4000];
const DEFAULT_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 5 * 60_000;

function sleep(ms, signal) {
	return new Promise((resolve, reject) => {
		const id = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(id);
				reject(signal.reason || new DOMException("Aborted", "AbortError"));
			},
			{ once: true },
		);
	});
}

function retryDelay(res, attempt) {
	const header = Number(res?.headers?.get?.("Retry-After"));
	if (Number.isFinite(header) && header > 0) return Math.min(header * 1000, 5000);
	return RETRY_DELAYS_MS[attempt] ?? 4000;
}

/** Was this failure answered before any handler ran? Then a write is safe to repeat. */
function neverReachedHandler(res, data) {
	if (!res) return true; // network error before a response
	if (data?.code === "AUTH_BACKEND_UNAVAILABLE") return true;
	// The platform's own 503 (no instance up yet) is not JSON from the API.
	return res.status === 503 && !res.headers.get("content-type")?.includes("application/json");
}

async function sendOnce(url, { method, headers, body, signal, timeoutMs }) {
	const timeout = new AbortController();
	const timer = setTimeout(
		() => timeout.abort(new DOMException("Request timed out", "TimeoutError")),
		timeoutMs,
	);
	const onAbort = () => timeout.abort(signal.reason);
	signal?.addEventListener("abort", onAbort, { once: true });
	try {
		return await fetch(url, { method, cache: "no-store", signal: timeout.signal, headers, body });
	} finally {
		clearTimeout(timer);
		signal?.removeEventListener("abort", onAbort);
	}
}

async function readJson(res, method, path) {
	const type = res.headers.get("content-type") || "";
	if (res.status === 204) return {};
	if (!type.includes("application/json")) {
		// A platform error page or an empty body: not worth an error log.
		await res.text().catch(() => "");
		return {};
	}
	try {
		return await res.json();
	} catch (parseErr) {
		logger.error("[api] failed to parse JSON response", {
			method,
			path,
			status: res.status,
			error: parseErr.message,
		});
		return {};
	}
}

async function performApiRequest(
	path,
	{ method = "GET", token = "", body, signal, headers = {} } = {},
) {
	const debugRequests = import.meta.env.DEV;
	const startedAt = debugRequests ? performance.now() : 0;

	// BUG-033: Auto-refresh token before it expires (silently)
	let activeToken = token || getToken();
	if (activeToken && isTokenExpiringSoon(activeToken) && path !== "/auth/refresh") {
		const refreshed = await refreshAuthToken();
		if (refreshed) {
			activeToken = refreshed;
		}
	}

	const isFormData = body instanceof FormData;
	const payload = isFormData ? body : body ? JSON.stringify(body) : undefined;
	const buildHeaders = (authToken) => ({
		...(isFormData ? {} : { "Content-Type": "application/json" }),
		...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
		...headers,
	});
	const timeoutMs = isFormData ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
	const idempotent = method === "GET" || method === "HEAD";
	const url = `${API_BASE}${path}`;

	let res = null;
	let data = {};
	for (let attempt = 0; ; attempt++) {
		let networkError = null;
		try {
			res = await sendOnce(url, {
				method,
				headers: buildHeaders(activeToken),
				body: payload,
				signal,
				timeoutMs,
			});
			data = await readJson(res, method, path);
		} catch (err) {
			if (signal?.aborted) throw err;
			networkError = err;
			res = null;
			data = {};
		}
		const retryable = networkError ? true : RETRYABLE_STATUS.has(res.status);
		const safeToRepeat = idempotent || (!isFormData && neverReachedHandler(res, data));
		if (retryable && safeToRepeat && attempt < RETRY_DELAYS_MS.length) {
			await sleep(retryDelay(res, attempt), signal);
			continue;
		}
		if (networkError) {
			if (debugRequests) {
				logger.warn("[api] request failed", {
					method,
					path,
					ms: Math.round(performance.now() - startedAt),
				});
			}
			const error = new Error(
				networkError?.name === "TimeoutError"
					? "The server is taking too long to respond. Please try again."
					: "Unable to reach the server. Check your connection and try again.",
			);
			error.status = 0;
			error.cause = networkError;
			throw error;
		}
		break;
	}

	if (debugRequests) {
		const elapsed = performance.now() - startedAt;
		const entry = { method, path, status: res.status, ms: Math.round(elapsed) };
		if (elapsed >= 10_000) {
			logger.warn("[api] slow request", entry);
		} else {
			logger.info("[api] request", entry);
		}
	}
	if (!res.ok) {
		// BUG-033: On 401, try refreshing the token once before clearing the session.
		// The API answers 401 only for a token that is really invalid or expired;
		// a slow or unavailable backend is a 503 and never ends the session.
		if (res.status === 401 && path !== "/auth/refresh" && activeToken) {
			const refreshed = await refreshAuthToken();
			if (refreshed) {
				try {
					const retryRes = await sendOnce(url, {
						method,
						headers: buildHeaders(refreshed),
						body: payload,
						signal,
						timeoutMs,
					});
					if (retryRes.ok) {
						return await readJson(retryRes, method, path);
					}
				} catch {
					// Fall through to original error handling
				}
			}
			clearSession();
		}
		if (res.status === 403 && data?.code === "ACCOUNT_LOCKED") {
			try {
				localStorage.setItem("ght_account_locked", "1");
			} catch {}
		}
		const fallbackMessage =
			res.status >= 500
				? "The server is busy or restarting. Please try again in a moment."
				: "Request failed";
		const error = new Error(data.error || fallbackMessage);
		error.status = res.status;
		error.details = data;
		throw error;
	}
	return data;
}

/**
 * Gets the home page path for a role.
 * @param {string} _role - The user role.
 * @returns {string} The home page path.
 */
export function getRoleHome(_role) {
	return "/feed";
}

/**
 * Fetches the current user from API.
 * @param {string} [token] - The JWT token.
 * @returns {Promise<User|null>} The user object, or null if not found.
 */
export async function fetchCurrentUser(token = getToken()) {
	if (!token) {
		return null;
	}
	const data = await apiRequest("/users/me", { token });
	const user = data || null;
	if (user) {
		persistUser(user);
	}
	return user;
}

// Fetch fresh user data from API - use this for sensitive/permission checks
// Never trust localStorage for security decisions
/**
 * Fetches fresh user data from API - use this for sensitive/permission checks
 * Never trust localStorage for security decisions
 * @param {string} [token] - The JWT token.
 * @returns {Promise<User|null>} The user object, or null if failed.
 */
export async function getUserFromApi(token = getToken()) {
	if (!token) {
		return null;
	}
	try {
		const user = await apiRequest("/users/me", { token });
		return user;
	} catch (err) {
		logger.error("Failed to fetch user from API:", err);
		return null;
	}
}

// Check if user has role (fetches fresh from API for security-critical checks)
/**
 * Checks if the user has a role (fetches fresh from API for security-critical checks).
 * @param {string} requiredRole - The required role.
 * @param {string} [token] - The JWT token.
 * @returns {Promise<boolean>} True if the user has the role, false otherwise.
 */
export async function hasRole(requiredRole, token = getToken()) {
	const user = await getUserFromApi(token);
	return user?.role === requiredRole;
}

/**
 * Checks if the user has a specific entitlement.
 * @param {User} user - The user object.
 * @param {string} feature - The feature to check.
 * @returns {boolean} True if the user has the entitlement, false otherwise.
 */
export function hasEntitlement(user, feature) {
	if (!(user && feature)) {
		return false;
	}
	const entitlements = user.entitlements || user;
	if (entitlements?.features && Object.hasOwn(entitlements.features, feature)) {
		return Boolean(entitlements.features[feature]);
	}
	const plan = String(entitlements?.plan || user.subscription_status || "").toLowerCase();
	if (plan === "premium") {
		return true;
	}
	return false;
}
