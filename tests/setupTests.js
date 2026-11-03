import "@testing-library/jest-dom";
import {
	clearImmediate as nodeClearImmediate,
	setImmediate as nodeSetImmediate,
} from "node:timers";
import { TextDecoder, TextEncoder } from "node:util";

// Test-environment defaults. server/middleware/auth.js throws at import time
// when JWT_SECRET is missing, so ensure a deterministic test secret here
// (setupFilesAfterEach runs before any test file is imported).
if (!process.env.JWT_SECRET) {
	process.env.JWT_SECRET = "test-jwt-secret-do-not-use-in-prod";
}
if (!process.env.NODE_ENV) {
	process.env.NODE_ENV = "test";
}

if (!globalThis.TextEncoder) {
	globalThis.TextEncoder = TextEncoder;
}

if (!globalThis.TextDecoder) {
	globalThis.TextDecoder = TextDecoder;
}

// jsdom has no WHATWG streams, but server modules under test (e.g. the
// @google/genai SDK) build on them at import time. Node ships them.
if (typeof globalThis.ReadableStream === "undefined") {
	const webStreams = await import("node:stream/web");
	globalThis.ReadableStream = webStreams.ReadableStream;
	globalThis.WritableStream = webStreams.WritableStream;
	globalThis.TransformStream = webStreams.TransformStream;
}

if (!globalThis.setImmediate) {
	globalThis.setImmediate = nodeSetImmediate;
}

if (!globalThis.clearImmediate) {
	globalThis.clearImmediate = nodeClearImmediate;
}

if (typeof window !== "undefined" && !window.scrollTo) {
	window.scrollTo = () => {};
}

if (typeof globalThis.fetch !== "function") {
	globalThis.fetch = (url, options = {}) => {
		const { method = "GET" } = options;
		return Promise.resolve({
			ok: method !== "POST" || !String(url).includes("fail"),
			status: 200,
			json: () =>
				Promise.resolve({
					choices: [{ message: { content: "Mock response" } }],
				}),
			text: () => Promise.resolve("Mock response"),
		});
	};
}
