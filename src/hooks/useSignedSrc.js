import { useEffect, useState } from "react";
import { SIGN_RATE_LIMITED, signEntry, signRateLimitWaitMs } from "../lib/signedFile.js";

// How many times a rate-limited sign is retried before the surface is left
// to report the failure. Bounded on purpose: an unbounded retry is a poll,
// and a poll is the load the limiter is trying to shed.
const MAX_RATE_LIMIT_RETRIES = 3;

/**
 * Signs a gated asset path and reports what happened.
 *
 * "" is the fail-closed value: callers render nothing rather than the raw path,
 * so an unsigned private url can never reach a DOM sink. That also means a
 * public (non-gated) path renders nothing too — the server reports `not_gated`
 * and issues no url — so use this only for gated assets (chat attachments,
 * contract artifacts, call recordings).
 *
 * The `error` half exists because a failed sign and a pending sign are not the
 * same thing. A pending sign is a blank space the user is about to see filled
 * in; a failed sign is a preview that is NOT going to arrive, and if the
 * surface cannot tell the two apart it renders nothing and says nothing, and
 * the user is left looking at a hole where a file should be. A rate-limited
 * sign in particular used to be indistinguishable from a refused one.
 *
 * The failure is reported in the SERVER'S OWN SHAPE — `{ error, status }`,
 * the same object signEntry resolves with — and NOT renamed on the way out.
 * It used to be reshaped to `{ reason, status }`, and describeSignFailure
 * reads `error`, so the reason was dropped at the boundary: the thumbnail
 * showed the generic "could not be loaded" for a rate limit and for a
 * refusal alike, which is the very confusion the failure half exists to
 * remove. One representation, understood in one place (describeSignFailure),
 * so a surface can hand the failure straight to it.
 *
 * @param {string} url - Asset path, relative or absolute. Falsy disables signing.
 * @param {{ refreshMs?: number | null }} [options] - `refreshMs` re-signs on an
 *   interval so a surface the user leaves open past the signature's ttl keeps
 *   working. `null` (the default) means "half the lifetime the SERVER gave the
 *   signature" — the server is the authority on how long a signature lasts, and
 *   a client-side copy of that number drifts the moment the server changes it.
 *   Pass 0 for short-lived decorative thumbnails: every refresh swaps the
 *   element's src, which visibly reloads an <img> and restarts a <video>, so it
 *   is only worth paying for on interactive surfaces.
 * @returns {{ src: string, error: { error: string | null, status: number | null } | null }}
 *   The signed url ("" until the server hands one back) and the reason the
 *   sign failed, or null while it is pending or after it succeeded. The
 *   failure carries the server's own `{ error, status }` shape, so it can be
 *   passed to describeSignFailure unchanged. `error` is null when the sign
 *   failed for a reason the server did not report (a network error, a
 *   response with no entry for the path): the failure is known, the reason is
 *   not.
 */
export function useSignedSrcState(url, { refreshMs = null } = {}) {
	const [state, setState] = useState({ src: "", error: null });

	useEffect(() => {
		let alive = true;
		let timer = null;
		let retryTimer = null;
		let rateLimitRetries = 0;

		// Always clear first, on every url change and not only when the url goes
		// empty: a new asset invalidates the previous signature, and a stale url
		// rendering against a different file is exactly the leak this guards.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setState({ src: "", error: null });

		if (!url) {
			return () => {
				alive = false;
			};
		}

		const clearTimer = () => {
			if (timer) {
				clearInterval(timer);
				timer = null;
			}
		};

		const clearRetry = () => {
			if (retryTimer) {
				clearTimeout(retryTimer);
				retryTimer = null;
			}
		};

		const sign = async () => {
			const entry = await signEntry(url);
			if (!alive) {
				return;
			}
			if (!entry?.url) {
				// The sign failed. A rate limit is transient — the client has
				// backed off, and one more attempt after the cooldown is what
				// turns a blank thumbnail into a picture. A refusal is not, so
				// it is reported and left alone.
				//
				// The failure is reported in the SERVER'S SHAPE ({ error,
				// status }), not renamed. describeSignFailure reads `error`, and
				// a renamed field is a dropped reason: the thumbnail used to
				// say "could not be loaded" for a rate limit and for a refusal
				// alike.
				const error = { error: entry?.error ?? null, status: entry?.status ?? null };
				setState({ src: "", error });
				// The retries are BOUNDED. A server that keeps answering 429
				// would otherwise be polled forever by every thumbnail on the
				// screen, which is the load the limiter is trying to shed.
				if (error.error === SIGN_RATE_LIMITED && rateLimitRetries < MAX_RATE_LIMIT_RETRIES) {
					rateLimitRetries += 1;
					clearRetry();
					retryTimer = setTimeout(() => {
						retryTimer = null;
						void sign();
					}, signRateLimitWaitMs() + 50);
				}
				return;
			}
			setState({ src: entry.url, error: null });
			clearTimer();
			clearRetry();
			rateLimitRetries = 0;
			// The interval is half the signature's own lifetime, so the refresh
			// always lands before the signature expires — and it follows the
			// server when the server changes the lifetime.
			const interval = refreshMs === null ? Math.floor((Number(entry.ttlMs) || 0) / 2) : refreshMs;
			if (interval > 0) {
				timer = setInterval(sign, interval);
			}
		};

		void sign();
		// The timer lives inside this effect, so a refresh swaps the url without
		// clearing it first — only a genuinely new asset blanks the element.
		return () => {
			alive = false;
			clearTimer();
			clearRetry();
		};
	}, [url, refreshMs]);

	return state;
}

/**
 * Signs a gated asset path and returns "" until the server hands back a url.
 *
 * The string-only form of useSignedSrcState, for the surfaces that have
 * nothing to say about a failure. A surface that CAN say something — that
 * wants to tell the user the preview did not load — wants
 * useSignedSrcState instead.
 *
 * @param {string} url - Asset path, relative or absolute. Falsy disables signing.
 * @param {{ refreshMs?: number | null }} [options] - See useSignedSrcState.
 * @returns {string} The signed url, or "" while pending and after a refusal.
 */
export function useSignedSrc(url, options = {}) {
	return useSignedSrcState(url, options).src;
}

export default useSignedSrc;
