import {
	selectNewestAssistant,
	waitForAssistantTurn,
} from "../../server/services/opencodeTurns.js";

/**
 * A fake v2 client. The message list is NEWEST FIRST, exactly as the real
 * server returns it, and the messages of the new turn only appear once the
 * prompt has been sent.
 */
function makeClient(initialMessages, messagesAfterPrompt) {
	let messages = [...initialMessages];
	return {
		message: {
			list: async () => ({ data: messages }),
		},
		session: {
			prompt: async () => {
				messages = [...messagesAfterPrompt, ...messages];
				return { id: "u1" };
			},
		},
	};
}

function assistantMessage(id, created, text, finish = "stop") {
	return {
		id,
		type: "assistant",
		agent: "investigator",
		time: { created },
		finish,
		content: [{ type: "text", text }],
	};
}

describe("opencode assistant turn tracking (server/services/opencodeTurns.js)", () => {
	test("selects the NEWEST assistant message from a newest-first list", () => {
		const newestFirst = [
			assistantMessage("a3", 300, "THIRD"),
			assistantMessage("a2", 200, "SECOND"),
			assistantMessage("a1", 100, "FIRST"),
		];
		expect(selectNewestAssistant(newestFirst)?.id).toBe("a3");
	});

	test("selects the newest assistant message even when the list is oldest-first", () => {
		const oldestFirst = [
			assistantMessage("a1", 100, "FIRST"),
			assistantMessage("a2", 200, "SECOND"),
			assistantMessage("a3", 300, "THIRD"),
		];
		expect(selectNewestAssistant(oldestFirst)?.id).toBe("a3");
	});

	test("a second turn does not return the first turn's answer", async () => {
		const turnOne = assistantMessage("a1", 100, "TURN ONE");
		const turnTwo = assistantMessage("a2", 200, "TURN TWO");
		const client = makeClient([turnOne], [turnTwo]);

		const result = await waitForAssistantTurn({
			client,
			sessionID: "s1",
			text: "second question",
			timeoutMs: 5000,
			pollIntervalMs: 5,
			stablePollsToSettle: 3,
		});

		expect(result.newest?.id).toBe("a2");
		expect(result.parts.find((part) => part.type === "text")?.text).toBe("TURN TWO");
		expect(result.text).toContain("TURN TWO");
		expect(result.text).not.toContain("TURN ONE");
	});

	test("a stale finished message from an earlier turn does not settle the turn", async () => {
		// Turn 1 finished. Turn 2 opened with a tool call and is still running.
		const turnOne = assistantMessage("a1", 100, "TURN ONE");
		const turnTwoOpening = {
			id: "a2",
			type: "assistant",
			agent: "investigator",
			time: { created: 200 },
			finish: "tool-calls",
			content: [{ type: "text", text: "working on it" }],
		};
		const client = makeClient([turnOne], [turnTwoOpening]);

		const result = await waitForAssistantTurn({
			client,
			sessionID: "s1",
			text: "second question",
			timeoutMs: 400,
			pollIntervalMs: 5,
			stablePollsToSettle: 3,
		});

		// The turn never finished, so the helper reports the opening message of
		// THIS turn - never turn 1's finished answer.
		expect(result.newest?.id).toBe("a2");
		expect(result.text).not.toContain("TURN ONE");
	});

	test("settles on the newest message's finish instead of spinning to the timeout", async () => {
		const answer = assistantMessage("a1", 100, "THE ANSWER");
		const client = makeClient([], [answer]);

		const started = Date.now();
		const result = await waitForAssistantTurn({
			client,
			sessionID: "s1",
			text: "a question",
			timeoutMs: 30_000,
			pollIntervalMs: 5,
			stablePollsToSettle: 50,
		});

		expect(result.newest?.id).toBe("a1");
		expect(result.text).toContain("THE ANSWER");
		expect(Date.now() - started).toBeLessThan(5000);
	});

	test("reports the text of the turn incrementally", async () => {
		const answer = assistantMessage("a1", 100, "HELLO WORLD");
		const client = makeClient([], [answer]);
		const chunks = [];

		await waitForAssistantTurn({
			client,
			sessionID: "s1",
			text: "a question",
			timeoutMs: 5000,
			pollIntervalMs: 5,
			stablePollsToSettle: 3,
			onText: (delta, total) => chunks.push({ delta, total }),
		});

		expect(chunks.length).toBeGreaterThan(0);
		expect(chunks[chunks.length - 1].total).toContain("HELLO WORLD");
	});
});
