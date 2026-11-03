import { runAgentPrompt } from "../../server/services/investigation/opencodeRuntime.js";
import { waitForAssistantTurn } from "../../server/services/opencodeTurns.js";

/**
 * The v2 server's real contract, measured against a live runtime:
 *
 *   finish === undefined / null   the model is STILL PRODUCING this message
 *   finish === "tool-calls"      it will call another tool
 *   finish === "stop"            this is the last message
 *   an `idle` message             the server says the turn is over
 *
 * A reply was observed with finish undefined at 2s and "stop" at 16s: a
 * message with no finish yet is NOT a finished message.
 */

/** An assistant message that is still being written: no finish, no content. */
function stillProducingMessage() {
	return {
		id: "a1",
		type: "assistant",
		agent: "investigator",
		content: [],
	};
}

/** A model that promised a tool call and then went quiet. */
function wedgedModel() {
	return {
		id: "a1",
		type: "assistant",
		agent: "investigator",
		finish: "tool-calls",
		content: [{ type: "tool", tool: "read", state: { status: "completed" } }],
	};
}

/** A model that answers and says so. */
function answeringModel(text) {
	return {
		id: "a1",
		type: "assistant",
		agent: "investigator",
		finish: "stop",
		content: [{ type: "text", text }],
	};
}

function clientReturning(message) {
	let prompted = false;
	return {
		message: { list: async () => ({ data: prompted ? [message] : [] }) },
		session: {
			prompt: async () => {
				prompted = true;
				return { id: "u1" };
			},
		},
	};
}

describe("the turn reader knows what the v2 server is actually saying", () => {
	test("a message with NO finish is still being produced, so the reader waits", async () => {
		const turn = await waitForAssistantTurn({
			client: clientReturning(stillProducingMessage()),
			sessionID: "s1",
			text: "investigate",
			timeoutMs: 400,
			pollIntervalMs: 20,
			// A stability window that would fire immediately if the reader were
			// allowed to use it while the model is producing.
			stablePollsToSettle: 3,
		});

		// It ran to the deadline rather than settling on the stability window.
		expect(turn.timedOut).toBe(true);
		expect(turn.text).toBe("");
	});

	test("a model that promised a tool call and went quiet is a WEDGE, not a finish", async () => {
		const turn = await waitForAssistantTurn({
			client: clientReturning(wedgedModel()),
			sessionID: "s1",
			text: "investigate",
			timeoutMs: 2_000,
			pollIntervalMs: 20,
			stablePollsToSettle: 3,
		});

		expect(turn.wedged).toBe(true);
		// The tool call it made is kept: it is the evidence of what it was doing.
		expect(turn.content.filter((part) => part.type === "tool")).toHaveLength(1);
	});

	test("a turn that finished normally is not a timeout and not a wedge", async () => {
		const turn = await waitForAssistantTurn({
			client: clientReturning(answeringModel("ANSWER")),
			sessionID: "s1",
			text: "investigate",
			timeoutMs: 5_000,
			pollIntervalMs: 20,
		});

		expect(turn.timedOut).toBe(false);
		expect(turn.wedged).toBe(false);
		expect(turn.text).toBe("ANSWER");
	});

	test("runAgentPrompt never blames the JSON parser for a turn that went wrong", async () => {
		const result = await runAgentPrompt({
			client: clientReturning(wedgedModel()),
			sessionID: "s1",
			text: "investigate",
			timeoutMs: 2_000,
		});

		expect(result.error).toBeTruthy();
		// The old error said "the agent did not answer with JSON", which sent
		// the operator looking for a parsing bug that did not exist.
		expect(result.error).not.toMatch(/did not answer with JSON/i);
		expect(result.error).toMatch(/did not finish within|stopped making progress/i);
		expect(result.toolCalls).toHaveLength(1);
	});

	test("runAgentPrompt reports no error when the agent answered", async () => {
		const result = await runAgentPrompt({
			client: clientReturning(answeringModel("ANSWER")),
			sessionID: "s1",
			text: "investigate",
			timeoutMs: 5_000,
		});

		expect(result.error).toBeUndefined();
		expect(result.text).toBe("ANSWER");
	});

	test("a growing answer keeps the reader waiting instead of being cut off", async () => {
		// The model's text grows over several polls, exactly as a streamed
		// answer does. The text LENGTH is part of the reader's signature, so
		// the turn must not be mistaken for a stalled one.
		let prompted = false;
		let poll = 0;
		const client = {
			message: {
				list: async () => {
					poll += 1;
					const text = "x".repeat(poll * 40);
					return {
						data: prompted
							? [
									{
										id: "a1",
										type: "assistant",
										agent: "investigator",
										finish: "stop",
										content: [{ type: "text", text }],
									},
								]
							: [],
					};
				},
			},
			session: {
				prompt: async () => {
					prompted = true;
					return { id: "u1" };
				},
			},
		};

		const turn = await waitForAssistantTurn({
			client,
			sessionID: "s1",
			text: "investigate",
			timeoutMs: 5_000,
			pollIntervalMs: 20,
			stablePollsToSettle: 2,
		});

		// It settled, and on the LONGEST text it saw, not the first.
		expect(turn.text.length).toBeGreaterThan(40);
	});
});
