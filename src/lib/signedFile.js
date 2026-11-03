import { apiRequest, getToken } from "./auth.js";

// Client half of the signed-URL gate built in server/utils/signedFileUrl.js.
//
// A signed url is a bearer credential in the query string: it is valid for five
// minutes by default (fifteen for call recordings) and it is the only thing
// `/api/files/content` accepts, because that route deliberately sits outside
// requireAuth so an <img>, an <iframe> and a new tab can all reach it without
// attaching an Authorization header.
//
// Three consequences shape everything below:
//
//   1. Sign immediately before you navigate or render. A url captured at mount
//      and reused across renders has already expired by the time anyone clicks.
//      Callers sign in the click handler (signAndOpen / signAndDownload), in a
//      one-shot ahead of a fetch (signOne), or in an effect keyed on the
//      attachment (signAndAssign / useSignedSrc).
//   2. Normalise first. Callers hold absolute urls whenever VITE_API_URL is set,
//      but the server's path helpers only strip a leading "uploads/", so an
//      absolute url arrives as the first segment "http:" and is reported
//      not_gated. Every entry point therefore reduces to a pathname before it
//      is sent.
//   3. Fail closed. A refused path, a network error, a 503 from an unconfigured
//      signing secret — all of them mean there is no url to use, and the helpers
//      return false / null rather than handing back the unsigned path. Nothing
//      here ever falls back to the raw path, because that fallback is the leak
//      the server-side gate exists to prevent.
//
// There is deliberately NO client-side copy of the server's gated-prefix list.
// The client used to keep one, to decide whether a document could be handed to
// the Office viewer — a live signature is a credential, so a private document
// must never reach view.officeapps.live.com. A second copy of that list is a
// drift hazard with a third-party consequence: a prefix added to the server
// without updating the copy left the embed unsuppressed and handed a private
// document's signed url to Microsoft, which fetches and retains it. The server
// now answers the question instead (thirdPartySafe on every /sign entry), and
// the client asks. The same goes for the signature lifetime: the server
// returns the ttl it actually used, instead of the client mirroring a
// constant that drifts the moment the server changes it.
//
// ---------------------------------------------------------------------------
// REQUESTS ARE BATCHED
// ---------------------------------------------------------------------------
//
// The client used to ask the server for ONE PATH PER REQUEST. That does not
// survive a per-user budget: a chat thread with fifty images is fifty
// requests, and a preview modal spends another one asking whether the document
// may be handed to a third party. The server accepts up to 50 paths in a
// single request, and the paths a client wants at the same moment are exactly
// the paths of one render, so they go together.
//
// The batch is flushed on the next microtask: every caller that asks during
// the same turn lands in the same request, and a request never carries more
// than the server's own per-request cap.
//
// ---------------------------------------------------------------------------
// A RATE LIMIT IS NOT A SILENT MISS
// ---------------------------------------------------------------------------
//
// The server answers 429 when the caller has spent its budget, and it answers
// 403 when the caller may not see the file. Those are different facts and the
// user has to be able to tell them apart: a thumbnail that did not appear
// because the server is busy looks exactly like a thumbnail that did not
// appear because the user is not allowed to see it. The old code swallowed
// every failure into an empty object, so the surface could not tell, and the
// preview simply did not render.
//
// So a 429 is reported (SIGN_RATE_LIMITED), the client backs off before the
// next request, and the surfaces turn it into a message.

// server/routes/fileAccessRoutes.js slices the body to MAX_PATHS_PER_REQUEST.
// Matching the cap here keeps the client from sending a request the server
// would silently answer for a prefix of the list.
const MAX_PATHS_PER_SIGN = 50;

// The reason a sign request was refused for being too frequent. Distinct from
// a permission verdict: a 429 is about the CALLER's request rate, not about
// the file.
export const SIGN_RATE_LIMITED = "rate_limited";

// How long the client waits after a 429 before the NEXT sign request goes out.
//
// A rate limit the client keeps hammering is a rate limit that never recovers:
// the client is the thing that has to slow down. The wait is short (the
// server's window is a minute) and it applies to the NEXT request, not to a
// retry of the failed one — a retry would add exactly the load the limiter is
// trying to shed.
const RATE_LIMIT_COOLDOWN_MS = 1000;

let rateLimitedUntil = 0;

/**
 * Milliseconds the client still has to wait before its next sign request.
 *
 * Exported so a surface can say "try again in a moment" and so a test can
 * assert the backoff without sleeping through it.
 *
 * @param {number} [now] - The current time, in milliseconds.
 * @returns {number} Milliseconds remaining, 0 when there is no cooldown.
 */
export function signRateLimitWaitMs(now = Date.now()) {
	return Math.max(0, rateLimitedUntil - now);
}

/**
 * Reduces any url shape to the pathname the server keys its verdict on.
 *
 * @param {string} path - Relative "/uploads/chat/a.png" or absolute
 *   "https://host/uploads/chat/a.png"; both reduce to "/uploads/chat/a.png".
 * @returns {string} The pathname, or "" when nothing usable can be derived.
 */
export function toSignablePath(path) {
	const raw = String(path || "");
	if (!raw) return "";
	try {
		return new URL(raw, window.location.origin).pathname;
	} catch {
		return raw;
	}
}

/**
 * Asks the server to mint signed urls for a batch of private paths.
 *
 * This is the LOW-LEVEL sender: one request, up to the server's own
 * per-request cap. The path-level helpers below go through the batching queue
 * instead, so that many callers in one turn cost one request.
 *
 * @param {string[]} [paths] - Public paths, absolute or relative.
 * @returns {Promise<Record<string, { url?: string, error?: string, status?: number, ttlMs?: number, thirdPartySafe?: boolean }>>}
 *   Keyed by the NORMALISED path that was sent. A refused path has
 *   `error`/`status` and no `url`. Every entry carries `thirdPartySafe`
 *   (false for a gated path) and a signed one carries `ttlMs`, the lifetime
 *   the server actually gave the signature. A rate-limited request answers one
 *   entry per path with `error: "rate_limited"`, so the caller can tell it
 *   apart from a permission verdict. Returns `{}` when the request fails
 *   outright for any other reason.
 */
export async function signPaths(paths) {
	// Normalise before sending: the response is keyed by the string we send, so
	// every caller must look its own entry up by the normalised form too.
	const list = (paths || [])
		.filter(Boolean)
		.map((path) => toSignablePath(path))
		.filter(Boolean)
		.slice(0, MAX_PATHS_PER_SIGN);
	if (list.length === 0) return {};

	// Back off after a rate limit: the next request waits out the remainder of
	// the cooldown instead of adding to the load the limiter is shedding.
	const wait = signRateLimitWaitMs();
	if (wait > 0) {
		await new Promise((resolve) => setTimeout(resolve, wait));
	}

	try {
		const data = await apiRequest("/files/sign", {
			method: "POST",
			token: getToken(),
			body: { paths: list },
		});
		return data?.signed || {};
	} catch (error) {
		if (Number(error?.status) === 429) {
			// A rate limit is NOT a silent miss. The old code returned {} here
			// and the caller could not tell "the server is busy" from "you may
			// not see this file", so a thumbnail or a download simply did not
			// appear, with nothing on screen to say why.
			rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
			const limited = Object.create(null);
			for (const path of list) {
				limited[path] = { error: SIGN_RATE_LIMITED, status: 429 };
			}
			return limited;
		}
		// A sign failure is not exceptional enough to surface on its own: the
		// callers below already translate a miss into their own error path.
		return {};
	}
}

// ---------------------------------------------------------------------------
// The batching queue
// ---------------------------------------------------------------------------

// Paths waiting for the next batch, keyed by the normalised path. A Map, so
// the same path asked for twice in one turn is sent once and both callers get
// the same answer.
let pendingSigns = new Map();
let flushScheduled = false;

function scheduleFlush() {
	if (flushScheduled) return;
	flushScheduled = true;
	// A microtask, not a timer: everything asked for during the same turn
	// lands in one request, and the flush happens before the browser gets a
	// chance to paint, so the batch costs no visible latency.
	queueMicrotask(() => {
		flushScheduled = false;
		void flushPendingSigns();
	});
}

/**
 * Queues one path for the next batch and resolves with the server's entry.
 *
 * @param {string} path - Public path, relative or absolute.
 * @returns {Promise<Object|null>} The server's entry for the path, or null
 *   when the request failed for a reason the server did not report.
 */
export function signEntry(path) {
	const normalised = toSignablePath(path);
	if (!normalised) return Promise.resolve(null);
	return new Promise((resolve) => {
		const waiters = pendingSigns.get(normalised);
		if (waiters) {
			waiters.push(resolve);
		} else {
			pendingSigns.set(normalised, [resolve]);
		}
		scheduleFlush();
	});
}

async function flushPendingSigns() {
	if (pendingSigns.size === 0) return;
	const batch = pendingSigns;
	pendingSigns = new Map();
	const paths = [...batch.keys()];
	// The server caps a request at MAX_PATHS_PER_REQUEST, so a larger batch is
	// split — never one request with an over-long body.
	for (let index = 0; index < paths.length; index += MAX_PATHS_PER_SIGN) {
		const chunk = paths.slice(index, index + MAX_PATHS_PER_SIGN);
		// biome-ignore lint/performance/noAwaitInLoops: the chunks must be signed in order, one request each
		const result = await signPaths(chunk);
		for (const path of chunk) {
			const entry = result[path] || null;
			for (const resolve of batch.get(path) || []) {
				resolve(entry);
			}
		}
	}
}

/**
 * A human-readable reason for a sign failure.
 *
 * This is the ONE place a sign failure is understood. Every surface hands it
 * the server's own entry — `{ error, status }` — which is also the shape
 * useSignedSrcState reports, so there is a single representation of a failure
 * and a single place that maps it onto words. A surface that invents its own
 * field name for the reason (the hook used to call it `reason`) drops the
 * reason on the floor: `error` is undefined, and a rate limit reads as the
 * generic "could not be loaded".
 *
 * @param {{ error?: string | null, status?: number | null } | null} [entry] -
 *   The server's entry for the path, or null when the request failed outright.
 * @returns {string} A message the user can act on.
 */
export function describeSignFailure(entry) {
	if (entry?.error === SIGN_RATE_LIMITED) {
		return "Preview unavailable — the server is rate limiting preview requests. Please try again in a moment.";
	}
	if (entry?.error) {
		return "Preview unavailable — you do not have access to this file.";
	}
	return "Preview unavailable — the file could not be loaded.";
}

/**
 * Asks the server whether a document may be handed to a third party.
 *
 * The Office viewer (view.officeapps.live.com) fetches whatever url it is
 * given and retains it, so a private document must never reach it. Whether a
 * path is private is the SERVER's answer: it owns the gated-prefix list, and
 * a client-side copy of it drifts — a prefix added to the server without
 * updating the copy leaves the embed unsuppressed and hands a private
 * document to a third party.
 *
 * Fails closed: anything the server does not explicitly clear is not safe.
 *
 * @param {string} path - Public path, relative or absolute.
 * @returns {Promise<boolean>} True only when the server says the path is not
 *   gated.
 */
export async function isThirdPartySafe(path) {
	const normalised = toSignablePath(path);
	if (!normalised) return false;
	const entry = await signEntry(normalised);
	return entry?.thirdPartySafe === true;
}

/**
 * Signs one path and returns the url.
 *
 * The one-shot counterpart to signAndOpen/signAndAssign, for callers that need
 * the url itself rather than a side effect — a fetch of a preview, a pdf.js
 * document, a library that takes a url and not an element.
 *
 * @param {string} path - Public path to sign, relative or absolute.
 * @returns {Promise<string | null>} The signed url, or null when refused.
 */
export async function signOne(path) {
	const normalised = toSignablePath(path);
	if (!normalised) return null;
	const entry = await signEntry(normalised);
	return entry?.url || null;
}

/**
 * Signs one path and returns the url and the lifetime the server gave it.
 *
 * The ttl is the server's, not a client-side mirror: a mirrored constant
 * drifts the moment the server changes it, and a stale refresh interval
 * outlives the signature it was meant to renew.
 *
 * @param {string} path - Public path to sign, relative or absolute.
 * @returns {Promise<{ url: string, ttlMs: number } | null>} The signed url
 *   and its lifetime, or null when refused.
 */
export async function signOneWithTtl(path) {
	const normalised = toSignablePath(path);
	if (!normalised) return null;
	const entry = await signEntry(normalised);
	if (!entry?.url) return null;
	const ttlMs = Number(entry.ttlMs);
	return { url: entry.url, ttlMs: Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 0 };
}

/**
 * Signs one path and opens it in a new tab.
 *
 * @param {string} path - Public path to sign, relative or absolute.
 * @returns {Promise<boolean>} True only when a url was returned *and* opened.
 */
export async function signAndOpen(path) {
	const url = await signOne(path);
	if (!url) return false;
	window.open(url, "_blank");
	return true;
}

/**
 * Signs one path and hands the url to a setter, for surfaces that render the
 * file inline (<img src>, <video src>, <iframe src>).
 *
 * The setter is invoked asynchronously and only on success, so callers should
 * render `signedUrl || null` — an empty state keeps the unsigned path out of
 * the DOM while the request is in flight and if it fails.
 *
 * @param {string} path - Public path to sign, relative or absolute.
 * @param {(url: string) => void} setter - Receives the signed url.
 * @returns {Promise<boolean>} True when the setter was called.
 */
export async function signAndAssign(path, setter) {
	if (typeof setter !== "function") return false;
	const url = await signOne(path);
	if (!url) return false;
	setter(url);
	return true;
}

/**
 * Signs one path and downloads it under a caller-chosen filename.
 *
 * window.open cannot carry a `download` attribute, so "Save as..." needs a
 * synthesised anchor. The signed url is put in the anchor's href at the moment
 * of the click, never before, so the unsigned path never reaches the DOM.
 *
 * @param {string} path - Public path to sign, relative or absolute.
 * @param {string} [filename] - Suggested download filename.
 * @returns {Promise<boolean>} True only when a url was returned *and* clicked.
 */
export async function signAndDownload(path, filename = "") {
	const outcome = await signAndDownloadWithReason(path, filename);
	return outcome.ok;
}

/**
 * Signs one path and downloads it, reporting WHY it did not.
 *
 * The boolean form of signAndDownload cannot say "the server is rate limiting
 * you" as opposed to "you may not see this file", and a download that silently
 * does nothing is the same failure the thumbnail had. This is the form a
 * surface should use when it can show a message.
 *
 * @param {string} path - Public path to sign, relative or absolute.
 * @param {string} [filename] - Suggested download filename.
 * @returns {Promise<{ ok: boolean, error: string | null }>} Whether the
 *   download was triggered, and the reason it was not.
 */
export async function signAndDownloadWithReason(path, filename = "") {
	const normalised = toSignablePath(path);
	if (!normalised) {
		return { ok: false, error: describeSignFailure(null) };
	}
	const entry = await signEntry(normalised);
	if (!entry?.url) {
		return { ok: false, error: describeSignFailure(entry) };
	}
	const anchor = document.createElement("a");
	anchor.href = entry.url;
	anchor.rel = "noopener noreferrer";
	if (filename) {
		anchor.download = filename;
	}
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	return { ok: true, error: null };
}
