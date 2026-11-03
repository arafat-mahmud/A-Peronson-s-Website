/**
 * @jest-environment allure-jest/jsdom
 *
 * The client half of the support investigation portal (contracts.md 3 and 4).
 *
 * This file owns the assertions for Workstream 4 Part 7A - the state hook in
 * `src/hooks/useSupportCase.js`. The HTTP contract is contracts.md 3:
 *
 *   POST /api/support/cases/:caseId/messages -> { message, reply, ready }
 *   POST /api/support/cases/:caseId/confirm  -> { case }
 *
 * and the event contract is contracts.md 4 - exactly five `support.case.*`
 * type strings, each with its own payload shape.
 *
 * `src/lib/caseRealtime.js` is mocked out on purpose. The SSE endpoint and
 * its wire format belong to the server (contracts.md 4 says so explicitly),
 * so asserting on them here would pin this test to a guess. What is asserted
 * instead is the hook's side of the boundary: the five event names, and the
 * payload keys each one carries.
 */
import { jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react";

const apiRequest = jest.fn();
const getToken = jest.fn(() => "test-token");
const subscribeToCase = jest.fn(() => () => {});

// The hook imports exactly these two symbols from auth.js. An ESM mock factory
// that omits one fails at link time with "does not provide an export named ...".
jest.unstable_mockModule("../../src/lib/auth.js", () => ({ apiRequest, getToken }));

// The SSE client itself, loaded BEFORE the mock below is registered.
//
// The hook tests mock `src/lib/caseRealtime.js` out on purpose: the endpoint
// and its wire format belong to the server (contracts.md §4 says so
// explicitly). The PARSER is ours though - it decides which frames are
// contract events and which are noise - so it is tested here against the
// real module. Jest picks the mock per import, so the real module imported
// first and the mock registered afterwards live side by side: the hook gets
// the mock, this file keeps the real parser.
const realCaseRealtime = await import("../../src/lib/caseRealtime.js");

jest.unstable_mockModule("../../src/lib/caseRealtime.js", () => ({ subscribeToCase }));

const { useSupportCase } = await import("../../src/hooks/useSupportCase.js");

const CASE_ID = "case-1";

// One case row.
function caseRow(overrides = {}) {
	return {
		id: CASE_ID,
		status: "collecting",
		subject: "The export button stopped working",
		summary: null,
		...overrides,
	};
}

// The default server answers for one case.
function defaultResponses(overrides = {}) {
	return {
		case: { case: caseRow(), messages: [] },
		message: {
			message: {
				id: "msg-client",
				role: "client",
				kind: "question",
				content: "The export button stopped working",
				sequence: 1,
			},
			reply: {
				id: "msg-assistant",
				role: "assistant",
				kind: "question",
				content: "Which browser are you on?",
				sequence: 2,
			},
			ready: false,
		},
		confirm: { case: caseRow({ status: "investigating", summary: "The export button 404s." }) },
		...overrides,
	};
}

// Installs the apiRequest mock for one case.
function installApi(overrides = {}) {
	const map = defaultResponses(overrides);
	apiRequest.mockImplementation((path) => {
		if (path === `/support/cases/${CASE_ID}`) {
			return map.case;
		}
		if (path === `/support/cases/${CASE_ID}/messages`) {
			return map.message;
		}
		if (path === `/support/cases/${CASE_ID}/confirm`) {
			return map.confirm;
		}
		throw new Error(`unexpected apiRequest path: ${path}`);
	});
}

// The handler the hook handed to the case stream, captured per test.
let eventHandler = null;

beforeEach(() => {
	apiRequest.mockReset();
	getToken.mockClear();
	eventHandler = null;
	subscribeToCase.mockReset();
	subscribeToCase.mockImplementation((_caseId, handler) => {
		eventHandler = handler;
		return () => {};
	});
});

describe("useSupportCase (src/hooks/useSupportCase.js)", () => {
	test("loads the case with the bearer token when it mounts", async () => {
		installApi();
		const { result } = renderHook(() => useSupportCase(CASE_ID));

		await waitFor(() => expect(result.current.caseRow).not.toBeNull());
		expect(apiRequest).toHaveBeenCalledWith(
			`/support/cases/${CASE_ID}`,
			expect.objectContaining({ token: "test-token" }),
		);
		expect(result.current.status).toBe("collecting");
	});

	test("subscribes to the case event stream", async () => {
		installApi();
		renderHook(() => useSupportCase(CASE_ID));

		await waitFor(() =>
			expect(subscribeToCase).toHaveBeenCalledWith(CASE_ID, expect.any(Function)),
		);
	});

	test("send posts to the case messages endpoint and appends the message and the reply", async () => {
		installApi();
		const { result } = renderHook(() => useSupportCase(CASE_ID));
		await waitFor(() => expect(result.current.caseRow).not.toBeNull());

		await act(async () => {
			await result.current.send("The export button stopped working");
		});

		expect(apiRequest).toHaveBeenCalledWith(
			`/support/cases/${CASE_ID}/messages`,
			expect.objectContaining({
				method: "POST",
				token: "test-token",
				body: expect.objectContaining({ content: "The export button stopped working" }),
			}),
		);

		await waitFor(() => {
			expect(result.current.messages.map((message) => message.id)).toEqual([
				"msg-client",
				"msg-assistant",
			]);
		});
		expect(result.current.messages[1].content).toBe("Which browser are you on?");
	});

	test("send carries attachments in the shape contracts.md 3 defines", async () => {
		installApi();
		const { result } = renderHook(() => useSupportCase(CASE_ID));
		await waitFor(() => expect(result.current.caseRow).not.toBeNull());

		await act(async () => {
			await result.current.send("Here is the screenshot", [
				{ file_path: "/uploads/support/shot.png", mime_type: "image/png", byte_size: 1024 },
			]);
		});

		expect(apiRequest).toHaveBeenCalledWith(
			`/support/cases/${CASE_ID}/messages`,
			expect.objectContaining({
				method: "POST",
				body: expect.objectContaining({
					content: "Here is the screenshot",
					attachments: [
						{ file_path: "/uploads/support/shot.png", mime_type: "image/png", byte_size: 1024 },
					],
				}),
			}),
		);
	});

	test("a ready response moves the case to investigating", async () => {
		installApi({ message: { ...defaultResponses().message, ready: true } });
		const { result } = renderHook(() => useSupportCase(CASE_ID));
		await waitFor(() => expect(result.current.caseRow).not.toBeNull());
		expect(result.current.status).toBe("collecting");

		await act(async () => {
			await result.current.send("The export button stopped working");
		});

		expect(result.current.status).toBe("investigating");
		expect(result.current.caseRow?.status).toBe("investigating");
	});

	test("a response that is not ready leaves the case collecting", async () => {
		installApi();
		const { result } = renderHook(() => useSupportCase(CASE_ID));
		await waitFor(() => expect(result.current.caseRow).not.toBeNull());

		await act(async () => {
			await result.current.send("The export button stopped working");
		});

		expect(result.current.status).toBe("collecting");
	});

	test("confirm posts to the case confirm endpoint", async () => {
		installApi();
		const { result } = renderHook(() => useSupportCase(CASE_ID));
		await waitFor(() => expect(result.current.caseRow).not.toBeNull());

		await act(async () => {
			await result.current.confirm();
		});

		expect(apiRequest).toHaveBeenCalledWith(
			`/support/cases/${CASE_ID}/confirm`,
			expect.objectContaining({ method: "POST", token: "test-token" }),
		);
		expect(result.current.status).toBe("investigating");
		expect(result.current.caseRow?.summary).toBe("The export button 404s.");
	});

	test("applies the five contract event types from contracts.md 4", async () => {
		installApi();
		const { result } = renderHook(() => useSupportCase(CASE_ID));
		await waitFor(() => expect(typeof eventHandler).toBe("function"));

		act(() => {
			eventHandler("support.case.message", {
				message: { id: "msg-live", role: "assistant", content: "live", sequence: 3 },
			});
		});
		expect(result.current.messages.map((message) => message.id)).toContain("msg-live");

		act(() => {
			eventHandler("support.case.status", {
				caseId: CASE_ID,
				status: "reporting",
				summary: "Found it.",
			});
		});
		expect(result.current.status).toBe("reporting");
		expect(result.current.caseRow?.status).toBe("reporting");
		expect(result.current.caseRow?.summary).toBe("Found it.");

		act(() => {
			eventHandler("support.case.progress", {
				caseId: CASE_ID,
				role: "lead",
				status: "running",
				detail: "reading the logs",
			});
		});
		expect(result.current.progress).toEqual([
			{ role: "lead", status: "running", detail: "reading the logs" },
		]);

		act(() => {
			eventHandler("support.case.finding", {
				caseId: CASE_ID,
				role: "code",
				finding: { confidence: "confirmed", detail: "the route is missing", evidence: [] },
			});
		});
		expect(result.current.findings).toHaveLength(1);
		expect(result.current.findings[0].role).toBe("code");
		expect(result.current.findings[0].finding.confidence).toBe("confirmed");

		act(() => {
			eventHandler("support.case.report", {
				caseId: CASE_ID,
				report: "# Investigation report",
				reportStatus: "ready",
			});
		});
		expect(result.current.report).toEqual({
			report: "# Investigation report",
			reportStatus: "ready",
		});
	});

	test("ignores an event type that is not one of the five", async () => {
		installApi();
		const { result } = renderHook(() => useSupportCase(CASE_ID));
		await waitFor(() => expect(typeof eventHandler).toBe("function"));

		act(() => {
			eventHandler("support.case.something-else", { status: "completed" });
		});

		expect(result.current.status).toBe("collecting");
		expect(result.current.messages).toHaveLength(0);
	});

	test("send posts nothing when no case is open", async () => {
		installApi();
		const { result } = renderHook(() => useSupportCase(null));

		await act(async () => {
			await result.current.send("hello");
		});

		expect(apiRequest).not.toHaveBeenCalled();
		expect(result.current.error).toBeTruthy();
	});

	test("send posts nothing when the message is empty", async () => {
		installApi();
		const { result } = renderHook(() => useSupportCase(CASE_ID));
		await waitFor(() => expect(apiRequest).toHaveBeenCalled());
		apiRequest.mockClear();

		await act(async () => {
			await result.current.send("   ");
		});

		expect(apiRequest).not.toHaveBeenCalled();
		expect(result.current.error).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// The SSE parser (src/lib/caseRealtime.js), directly.
//
// The contract is contracts.md §4: exactly five `support.case.*` event type
// strings, and the frame's data is the payload. A frame with any other type
// is ignored rather than guessed at.
// ---------------------------------------------------------------------------

/**
 * A fetch stub that answers with one SSE body and then ends the stream.
 *
 * @param {string} text The raw stream text.
 * @returns {Function} A fetch stub.
 */
function stubStream(text) {
	const encoder = new TextEncoder();
	const chunk = encoder.encode(text);
	let sent = false;
	return jest.fn(async () => ({
		ok: true,
		body: {
			getReader() {
				return {
					async read() {
						if (sent) {
							return { done: true, value: undefined };
						}
						sent = true;
						return { done: false, value: chunk };
					},
				};
			},
		},
	}));
}

/** One SSE frame: a type, a data line and the blank line that ends it. */
function sseFrame(type, data) {
	return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

describe("the case SSE parser (src/lib/caseRealtime.js)", () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		global.fetch = originalFetch;
	});

	test("the event types are exactly the five contracts.md 4 names", () => {
		expect(realCaseRealtime.CASE_EVENT_TYPES).toEqual([
			"support.case.message",
			"support.case.status",
			"support.case.progress",
			"support.case.finding",
			"support.case.report",
		]);
	});

	test("each of the five types is dispatched on, with its payload", () => {
		for (const type of realCaseRealtime.CASE_EVENT_TYPES) {
			const event = realCaseRealtime.normalizeCaseEvent(type, { caseId: CASE_ID, detail: "x" });
			expect(event).not.toBeNull();
			expect(event.type).toBe(type);
			expect(event.payload).toEqual({ caseId: CASE_ID, detail: "x" });
		}
	});

	test("a type that is not one of the five is ignored", () => {
		for (const type of ["support.case.something-else", "support.case", "message", "status", ""]) {
			expect(realCaseRealtime.normalizeCaseEvent(type, { caseId: CASE_ID })).toBeNull();
		}
	});

	test("a frame of the stream reaches the handler with its type and its payload", async () => {
		const events = [];
		global.fetch = stubStream(
			sseFrame("support.case.status", { caseId: CASE_ID, status: "reporting" }),
		);

		const unsubscribe = realCaseRealtime.subscribeToCase(CASE_ID, (type, payload) => {
			events.push({ type, payload });
		});
		await waitFor(() => expect(events).toHaveLength(1));
		unsubscribe?.();

		expect(events[0].type).toBe("support.case.status");
		expect(events[0].payload).toMatchObject({ caseId: CASE_ID, status: "reporting" });
	});

	test("a frame of an unknown type never reaches the handler", async () => {
		const events = [];
		global.fetch = stubStream(
			sseFrame("support.case.something-else", { caseId: CASE_ID, status: "completed" }),
		);

		const unsubscribe = realCaseRealtime.subscribeToCase(CASE_ID, (type, payload) => {
			events.push({ type, payload });
		});
		// The frame is read from the stream; the handler is not called.
		await new Promise((resolve) => setTimeout(resolve, 50));
		unsubscribe?.();

		expect(events).toHaveLength(0);
	});

	test("the stream path is the case stream of contracts.md 4", () => {
		expect(realCaseRealtime.caseStreamPath(CASE_ID)).toBe(`/api/support/cases/${CASE_ID}/stream`);
	});
});
