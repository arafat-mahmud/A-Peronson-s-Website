import { getToken } from "./auth.js";

// The realtime client for one support case.
//
// It is the same shape as src/lib/feedRealtime.js: a plain fetch against a
// text/event-stream endpoint, an AbortController that the caller can trip, and
// a reconnect loop whose backoff starts at 3 seconds and is capped at 30.
//
// It is NOT an EventSource, and that is deliberate. An EventSource cannot
// carry an Authorization header, and every route on this server is behind
// requireAuth — a bearer token in the query string would put a credential in
// a URL, where it lands in logs and in the browser history. fetch can carry
// the header, so fetch it is.

const BASE = import.meta.env.VITE_API_URL || "";
const RECONNECT_BASE_MS = 3000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_BACKOFF_FACTOR = 1.5;

// The five case event types, verbatim from contracts.md §4.
//
// This list is a FILTER, not a second definition of the contract: the server
// owns these names. An event that arrives with a type that is not on this list
// is ignored rather than guessed at, because a page that renders a payload it
// does not understand is worse than a page that misses an update it will get
// again on the next fetch.
const CASE_EVENT_TYPES = Object.freeze([
	"support.case.message",
	"support.case.status",
	"support.case.progress",
	"support.case.finding",
	"support.case.report",
]);

const CASE_EVENT_TYPE_SET = new Set(CASE_EVENT_TYPES);

function isPlainObject(value) {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCaseEventType(type) {
	return typeof type === "string" && CASE_EVENT_TYPE_SET.has(type);
}

/**
 * The SSE path of one case stream.
 *
 * The path is a cross-workstream contract (the server owns the route), so it
 * is spelled in exactly one place: a path written twice drifts.
 *
 * @param {string} caseId - The support case id.
 * @returns {string} The path, relative to the API base.
 */
function caseStreamPath(caseId) {
	return `/api/support/cases/${encodeURIComponent(String(caseId ?? ""))}/stream`;
}

/**
 * Resolves one SSE frame into a `{ type, payload }` pair.
 *
 * The event NAME is the contract's; the frame's data is the payload. Two
 * tolerances are built in, because the wire format is the server's to
 * define:
 *
 *   1. The name may arrive as the SSE `event:` field or inside the JSON as a
 *      `type` key. The SSE field wins when both are present.
 *   2. The payload may arrive bare (`{"message": {...}}`) or wrapped in an
 *      envelope (`{"type": "...", "payload": {...}}`). A wrapper is unwrapped;
 *      a bare payload is passed through untouched.
 *
 * @param {string} rawType - The SSE `event:` field, or "" when absent.
 * @param {unknown} parsed - The parsed JSON of the frame's data.
 * @returns {{ type: string, payload: unknown } | null} The event, or null when
 *   the type is not one of the five contract types.
 */
function normalizeCaseEvent(rawType, parsed) {
	let type = typeof rawType === "string" ? rawType.trim() : "";
	if (!type && isPlainObject(parsed) && typeof parsed.type === "string") {
		type = parsed.type.trim();
	}
	if (!isCaseEventType(type)) {
		return null;
	}
	const payload = isPlainObject(parsed) && isPlainObject(parsed.payload) ? parsed.payload : parsed;
	return { type, payload };
}

/**
 * Splits one SSE line into its field and value.
 *
 * @param {string} line - The raw line.
 * @returns {{ kind: "blank" } | { kind: "comment" } | { kind: "field", field: string, value: string } | null}
 *   The parsed line, or null when the line carries no field.
 */
function parseSseLine(line) {
	const text = line.endsWith("\r") ? line.slice(0, -1) : line;
	if (text === "") {
		return { kind: "blank" };
	}
	if (text.startsWith(":")) {
		// A comment — the usual keep-alive ping. Nothing to dispatch.
		return { kind: "comment" };
	}
	const separator = text.indexOf(":");
	if (separator === -1) {
		return null;
	}
	const field = text.slice(0, separator);
	const rawValue = text.slice(separator + 1);
	const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;
	return { kind: "field", field, value };
}

/**
 * One SSE frame parser.
 *
 * The frame state lives in the closure, not in the read loop: a frame can be
 * split across two reads, and state that resets per read loses the event name
 * when the name and the data arrive in different chunks.
 *
 * @param {(type: string, payload: unknown) => void} onEvent - Receives each
 *   contract event.
 * @returns {{ push: (line: string) => void, flush: () => void }} The parser.
 */
function createFrameParser(onEvent) {
	let eventType = "";
	let eventData = "";

	function flush() {
		const rawType = eventType;
		const rawData = eventData;
		eventType = "";
		eventData = "";
		if (!rawData) {
			return;
		}
		let parsed;
		try {
			parsed = JSON.parse(rawData);
		} catch {
			// A frame that is not JSON is not an event. Ignore it, keep reading.
			return;
		}
		const event = normalizeCaseEvent(rawType, parsed);
		if (event) {
			onEvent(event.type, event.payload);
		}
	}

	function push(line) {
		const parsed = parseSseLine(line);
		if (!parsed) {
			return;
		}
		if (parsed.kind === "blank") {
			// A blank line ends the frame.
			flush();
			return;
		}
		if (parsed.kind === "comment") {
			return;
		}
		if (parsed.field === "event") {
			eventType = parsed.value.trim();
		} else if (parsed.field === "data") {
			eventData = eventData ? `${eventData}\n${parsed.value}` : parsed.value;
		}
	}

	return { push, flush };
}

/**
 * Reads a stream to its end, dispatching every frame it carries.
 *
 * @param {Response} response - The open stream.
 * @param {(type: string, payload: unknown) => void} onEvent - Receives each
 *   contract event.
 * @returns {Promise<boolean>} False when the response has no readable body.
 */
async function readEventStream(response, onEvent) {
	const reader = response.body?.getReader();
	if (!reader) {
		return false;
	}
	const decoder = new TextDecoder();
	const parser = createFrameParser(onEvent);
	let buffer = "";
	let chunk = await reader.read();

	while (!chunk.done) {
		buffer += decoder.decode(chunk.value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() || "";
		for (const line of lines) {
			parser.push(line);
		}
		// biome-ignore lint/performance/noAwaitInLoops: a stream is read one chunk at a time, in order
		chunk = await reader.read();
	}

	// The server may close without a trailing blank line. Whatever is left in
	// the buffer is still a frame.
	if (buffer.trim() !== "") {
		parser.push(buffer);
		parser.flush();
	}
	return true;
}

/**
 * Subscribes to one case's event stream.
 *
 * The handler is called as `handler(type, payload)` for each of the five
 * contract event types, with the payload passed through unchanged.
 *
 * @param {string} caseId - The support case id.
 * @param {(type: string, payload: unknown) => void} handler - Called for each
 *   event. Event types that are not on the contract list are never passed to it.
 * @returns {(() => void) | null} An unsubscribe function, or null when there
 *   is no token (nothing to authenticate the stream with) or the arguments are
 *   unusable.
 */
function subscribeToCase(caseId, handler) {
	if (typeof caseId !== "string" || caseId === "" || typeof handler !== "function") {
		return null;
	}
	if (!getToken()) {
		return null;
	}

	let abortController = new AbortController();
	let retryDelay = RECONNECT_BASE_MS;
	let reconnectTimer = null;
	let closed = false;

	function scheduleReconnect() {
		if (closed) {
			return;
		}
		clearTimeout(reconnectTimer);
		reconnectTimer = setTimeout(() => {
			retryDelay = Math.min(retryDelay * RECONNECT_BACKOFF_FACTOR, RECONNECT_MAX_MS);
			connect();
		}, retryDelay);
	}

	async function connect() {
		if (closed) {
			return;
		}
		const current = getToken();
		if (!current) {
			return;
		}
		abortController = new AbortController();

		try {
			const response = await fetch(`${BASE}${caseStreamPath(caseId)}`, {
				headers: { Authorization: `Bearer ${current}` },
				signal: abortController.signal,
			});

			if (!response.ok) {
				scheduleReconnect();
				return;
			}

			retryDelay = RECONNECT_BASE_MS;
			const read = await readEventStream(response, handler);
			if (!read) {
				scheduleReconnect();
				return;
			}
			scheduleReconnect();
		} catch (err) {
			if (err.name !== "AbortError") {
				scheduleReconnect();
			}
		}
	}

	connect();

	const unsubscribe = () => {
		closed = true;
		clearTimeout(reconnectTimer);
		abortController.abort();
	};
	// The feed helper hands back `{ close() }`; this one hands back a function,
	// because that is what "unsubscribe" means. `close()` is kept as an alias
	// so a caller written against the feed helper's shape still works.
	unsubscribe.close = unsubscribe;
	return unsubscribe;
}

export { CASE_EVENT_TYPES, caseStreamPath, isCaseEventType, normalizeCaseEvent, subscribeToCase };
