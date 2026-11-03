import { jest } from "@jest/globals";
import {
	buildAgentPrompt,
	buildVerifyPrompt,
	DEFAULT_TOOL_BUDGET,
} from "../../server/services/investigation/agents.js";
import { waitForAssistantTurn } from "../../server/services/opencodeTurns.js";

describe("the prompts give an agent a stopping condition", () => {
	for (const role of ["lead", "code", "repo", "research", "verify"]) {
		test(`the ${role} prompt states a tool-call budget and says to answer when it is spent`, () => {
			const prompt = buildAgentPrompt(role, { description: "something broke", evidence: [] });
			expect(prompt).toMatch(/budget of roughly \d+ tool calls/i);
			expect(prompt).toMatch(/STOP investigating and reply with your JSON answer/i);
			expect(prompt).toMatch(/limitations/);
		});
	}

	test("the budget is configurable per prompt", () => {
		const prompt = buildAgentPrompt("code", { description: "x", evidence: [], toolBudget: 7 });
		expect(prompt).toMatch(/budget of roughly 7 tool calls/i);
	});

	test("a nonsense budget falls back to the default", () => {
		const prompt = buildAgentPrompt("code", { description: "x", evidence: [], toolBudget: 0 });
		expect(prompt).toMatch(new RegExp(`budget of roughly ${DEFAULT_TOOL_BUDGET} tool calls`, "i"));
	});

	test("the verify prompt carries the budget too", () => {
		const prompt = buildVerifyPrompt({
			description: "x",
			candidateFindings: [{ confidence: "confirmed", detail: "d", evidence: [] }],
		});
		expect(prompt).toMatch(/budget of roughly \d+ tool calls/i);
	});
});

/**
 * A client whose assistant makes one tool call and then goes quiet for a long
 * time before its next action.
 *
 * The v2 message list does not change while the model is THINKING, so the
 * stability heuristic in the turn reader used to fire during that pause and
 * declare the turn finished with no text at all. The second live end-to-end
 * run lost a role that way: 7 tool calls, then a generation pause longer than
 * the stability window, and the answer was an empty string.
 */
function makeSlowThinkingClient() {
	let prompted = false;
	const toolMessage = {
		id: "a1",
		type: "assistant",
		agent: "investigator",
		// The model has NOT finished: it is still producing this message, so
		// it carries no finish at all.
		content: [{ type: "tool", tool: "read", state: { status: "completed" } }],
	};
	return {
		message: {
			list: async () => ({ data: prompted ? [toolMessage] : [] }),
		},
		session: {
			prompt: async () => {
				prompted = true;
				return { id: "u1" };
			},
		},
	};
}

describe("the turn reader does not end a turn while the model is still thinking", () => {
	test("a long pause between tool calls is NOT the end of the turn", async () => {
		const turn = await waitForAssistantTurn({
			client: makeSlowThinkingClient(),
			sessionID: "s1",
			text: "investigate",
			timeoutMs: 400,
			pollIntervalMs: 20,
			// A stability window that expires quickly - the point is that it
			// must not fire while the newest message carries no finish.
			stablePollsToSettle: 3,
		});

		// It ran to the deadline rather than settling on the stability window.
		expect(turn.timedOut).toBe(true);
		// And it kept the tool call it made.
		expect(turn.content.filter((part) => part.type === "tool")).toHaveLength(1);
	});
});
