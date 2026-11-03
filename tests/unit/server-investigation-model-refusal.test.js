import { runAgentPrompt } from "../../server/services/investigation/opencodeRuntime.js";
import { waitForAssistantTurn } from "../../server/services/opencodeTurns.js";

/**
 * The model can REFUSE the request, and it says so on the message:
 *
 *   finish: "error"
 *   error: { type: "provider.quota", message: "Rate limit exceeded…", status: 429 }
 *
 * Measured against a live runtime on an exhausted free-tier account: the
 * first three models of the chain answered exactly that, while the fourth
 * answered normally. The refusal produces NO content, so before this was
 * handled the quota error was reported as "the agent did not answer with
 * JSON" - a parsing fault that did not exist.
 */
function refusedModel() {
	return {
		id: "a1",
		type: "assistant",
		agent: "investigator",
		finish: "error",
		content: [],
		error: {
			type: "provider.quota",
			message: "Rate limit exceeded. Please try again later.",
			status: 429,
		},
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

describe("a model that refuses the request is reported as a refusal", () => {
	test("the turn carries the model's own error", async () => {
		const turn = await waitForAssistantTurn({
			client: clientReturning(refusedModel()),
			sessionID: "s1",
			text: "investigate",
			timeoutMs: 2_000,
			pollIntervalMs: 20,
		});

		expect(turn.modelError).toBeTruthy();
		expect(turn.modelError.type).toBe("provider.quota");
		expect(turn.modelError.status).toBe(429);
		expect(turn.text).toBe("");
	});

	test("runAgentPrompt names the refusal and marks it retryable", async () => {
		const result = await runAgentPrompt({
			client: clientReturning(refusedModel()),
			sessionID: "s1",
			text: "investigate",
			timeoutMs: 2_000,
		});

		expect(result.error).toBeTruthy();
		expect(result.errorKind).toBe("model_refused");
		expect(result.error).toMatch(/refused the request/i);
		expect(result.error).toMatch(/Rate limit exceeded/);
		expect(result.error).toMatch(/429/);
		// The old message blamed the JSON parser.
		expect(result.error).not.toMatch(/did not answer with JSON/i);
	});
});
