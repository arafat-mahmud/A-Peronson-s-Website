/**
 * @jest-environment node
 *
 * The investigation queue, driven end to end with the runtime, the agents and
 * the database mocked out.
 *
 * The runtime is mocked because a real one spawns an `opencode serve` process
 * and talks to a model; what has to be proved here is the ORCHESTRATION:
 * one session per role, the verifier running last over the findings the
 * specialists produced, the confidence rules of the pipeline, the row that is
 * written per role, and the promise that the runtime is stopped whatever
 * happens.
 */
import path from "node:path";
import { jest } from "@jest/globals";

// --- the database ------------------------------------------------------------
//
// An in-memory store, so the test can assert on what was actually written:
// the row of every role, with its status, its findings and its errors.

const rows = [];
const attachments = [];
const cases = new Map();

const supportInvestigationCreate = jest.fn(async ({ data }) => {
	const row = { ...data };
	rows.push(row);
	return row;
});
const supportInvestigationUpdate = jest.fn(async ({ where, data }) => {
	const row = rows.find((entry) => entry.id === where.id);
	if (row) {
		Object.assign(row, data);
	}
	return row;
});
const supportInvestigationFindMany = jest.fn(async ({ where } = {}) => {
	if (!where?.case_id) {
		return [...rows];
	}
	return rows.filter((row) => row.case_id === where.case_id);
});
const supportCaseUpdateMany = jest.fn(async ({ where, data }) => {
	const row = cases.get(where.id);
	if (!row || (where.status && row.status !== where.status)) {
		return { count: 0 };
	}
	Object.assign(row, data);
	return { count: 1 };
});
const supportCaseUpdate = jest.fn(async ({ where, data }) => {
	const row = cases.get(where.id);
	if (!row) {
		throw new Error(`no case ${where.id}`);
	}
	Object.assign(row, data);
	return { ...row };
});
const supportCaseAttachmentFindMany = jest.fn(async ({ where } = {}) => {
	if (!where?.case_id) {
		return [...attachments];
	}
	return attachments.filter((entry) => entry.case_id === where.case_id);
});

jest.unstable_mockModule("../../server/utils/prisma.js", () => ({
	default: {
		supportInvestigation: {
			create: supportInvestigationCreate,
			update: supportInvestigationUpdate,
			findMany: supportInvestigationFindMany,
		},
		supportCase: { updateMany: supportCaseUpdateMany, update: supportCaseUpdate },
		supportCaseAttachment: { findMany: supportCaseAttachmentFindMany },
	},
}));

// --- the report and the delivery --------------------------------------------
//
// The delivery belongs to the report workstream and it is mocked here: this
// suite is about the ORCHESTRATION - what the queue does with the run - and
// the delivery module has its own suite. The mock records what the queue
// handed over.
const deliverReport = jest.fn(async () => ({ ok: true, status: "sent" }));
const escalateIfNeeded = jest.fn(async () => false);

jest.unstable_mockModule("../../server/services/investigation/delivery.js", () => ({
	deliverReport,
	escalateIfNeeded,
	buildCaseReportLink: (caseId) => `http://localhost:4000/admin?case=${caseId}`,
	classifyFinding: () => null,
}));

// --- the case ---------------------------------------------------------------

const getCaseWithMessages = jest.fn(async (caseId) => cases.get(caseId) || null);

jest.unstable_mockModule("../../server/services/caseService.js", () => ({
	getCaseWithMessages,
}));

// --- the runtime -------------------------------------------------------------

const startInvestigationRuntime = jest.fn(async ({ password }) => ({
	baseUrl: "http://127.0.0.1:4200",
	port: 4200,
	client: { session: { remove: jest.fn(async () => ({ data: true })) } },
	password,
	stop: jest.fn(async () => {}),
}));
const createInvestigationSession = jest.fn(async ({ title }) => ({
	data: { id: `session-${title}` },
}));
const listAvailableModels = jest.fn(async () => [
	{ id: "deepseek-v4.1-flash-free", providerID: "opencode" },
]);
const runAgentPrompt = jest.fn(async ({ text }) => ({ text, toolCalls: [], error: undefined }));

jest.unstable_mockModule("../../server/services/investigation/opencodeRuntime.js", () => ({
	// The REAL repository root: the pipeline verifies that a finding's cited
	// evidence file resolves inside the repository before the finding keeps
	// its confidence, so a fake root would demote every finding.
	REPOSITORY_ROOT: path.resolve(process.cwd()),
	startInvestigationRuntime,
	createInvestigationSession,
	listAvailableModels,
	runAgentPrompt,
}));

const { enqueueInvestigation, queueCapacity, queueDepth } = await import(
	"../../server/services/investigationQueue.js"
);

// The realtime bus the queue publishes its findings on. The queue looks the
// emitter up through the module namespace at call time, so the test can
// subscribe to the same channel the client does and see exactly what went
// onto the wire.
const { realtimeBus } = await import("../../server/realtime/realtimeBus.js");

// --- helpers ----------------------------------------------------------------

const CASE_ID = "case-1";

/** A reply that satisfies the agents' JSON contract. */
function agentReply(findings, limitations = [], summary = "a summary") {
	return JSON.stringify({ summary, findings, limitations });
}

/** The role a prompt belongs to. The prompts name their role in the first line. */
function roleOf(prompt) {
	return /You are the (\w+) investigator/.exec(prompt)?.[1] || "unknown";
}

/**
 * Is this the NUDGE - the follow-up turn that asks a model which answered with
 * prose to give the same answer as JSON?
 */
function isNudge(prompt) {
	return /^Your previous reply was not a JSON object\./.test(String(prompt || ""));
}

/**
 * The default answer of every role: each specialist reports its own finding,
 * the verifier refutes nothing.
 */
function defaultAnswer({ text }) {
	if (roleOf(text) === "verify") {
		return { text: agentReply([]), toolCalls: [] };
	}
	const role = roleOf(text);
	return {
		text: agentReply(
			[
				{
					confidence: "confirmed",
					detail: `finding from ${role}`,
					// The cited file has to EXIST: the pipeline verifies that
					// an evidence file resolves inside the repository before
					// the finding keeps its confidence.
					evidence: [{ file: "server/server.js", lines: "10-20", commit: "abc1234" }],
				},
			],
			[],
			`the ${role} summary`,
		),
		toolCalls: [],
	};
}

/** The row of one role. */
function rowFor(role, caseId = CASE_ID) {
	return rows.find((row) => row.role === role && row.case_id === caseId);
}

/** The LAST row of one role - the one a re-run wrote. */
function lastRowFor(role, caseId = CASE_ID) {
	return rows.filter((row) => row.role === role && row.case_id === caseId).at(-1);
}

/** Wait until the queue has drained. */
async function waitForDrain(timeoutMs = 10_000) {
	const deadline = Date.now() + timeoutMs;
	while (queueDepth() > 0 && Date.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	if (queueDepth() !== 0) {
		throw new Error(`the queue did not drain: ${queueDepth()} jobs left`);
	}
}

function seedCase(caseId = CASE_ID, overrides = {}) {
	const caseRow = {
		id: caseId,
		user_id: "user-1",
		status: "investigating",
		subject: "the feed is empty",
		summary: "the feed shows nothing after the migration",
		ticket_id: "TICKET-1",
		messages: [
			{ role: "client", kind: "question", content: "the feed is empty", sequence: 1 },
			{ role: "assistant", kind: "answer", content: "what did you migrate?", sequence: 2 },
		],
		...overrides,
	};
	cases.set(caseId, caseRow);
	return caseRow;
}

beforeEach(() => {
	rows.length = 0;
	attachments.length = 0;
	cases.clear();
	seedCase();

	supportInvestigationCreate.mockClear();
	supportInvestigationUpdate.mockClear();
	supportInvestigationFindMany.mockClear();
	supportCaseUpdateMany.mockClear();
	supportCaseUpdate.mockClear();
	supportCaseAttachmentFindMany.mockClear();
	getCaseWithMessages.mockClear();
	startInvestigationRuntime.mockClear();
	createInvestigationSession.mockClear();
	listAvailableModels.mockClear();
	runAgentPrompt.mockClear();
	deliverReport.mockClear();
	deliverReport.mockResolvedValue({ ok: true, status: "sent" });
	escalateIfNeeded.mockClear();
	escalateIfNeeded.mockResolvedValue(false);

	listAvailableModels.mockResolvedValue([
		{ id: "deepseek-v4.1-flash-free", providerID: "opencode" },
	]);
	createInvestigationSession.mockImplementation(async ({ title }) => ({
		data: { id: `session-${title}` },
	}));
	runAgentPrompt.mockImplementation(defaultAnswer);
});

// The queue is BOUNDED. Concurrency is 2, but the backlog was not: a client
// that opened a thousand cases filled the queue with a thousand jobs, each of
// which would hold a spawned runtime, write five rows and mail every owner
// when it eventually ran.
describe("the queue's bound", () => {
	const savedLimit = process.env.INVESTIGATION_QUEUE_MAX_DEPTH;
	const savedConcurrency = process.env.INVESTIGATION_CONCURRENCY;

	afterEach(() => {
		if (savedLimit === undefined) {
			delete process.env.INVESTIGATION_QUEUE_MAX_DEPTH;
		} else {
			process.env.INVESTIGATION_QUEUE_MAX_DEPTH = savedLimit;
		}
		if (savedConcurrency === undefined) {
			delete process.env.INVESTIGATION_CONCURRENCY;
		} else {
			process.env.INVESTIGATION_CONCURRENCY = savedConcurrency;
		}
	});

	test("the queue reports its depth and its limit", () => {
		const capacity = queueCapacity();

		expect(typeof capacity.depth).toBe("number");
		expect(typeof capacity.limit).toBe("number");
		expect(capacity.accepting).toBe(true);
	});

	test("the queue refuses the work when the backlog is over the limit", async () => {
		process.env.INVESTIGATION_QUEUE_MAX_DEPTH = "1";
		process.env.INVESTIGATION_CONCURRENCY = "1";

		// The first job never finishes, so the queue stays occupied.
		let release;
		const gate = new Promise((resolve) => {
			release = resolve;
		});
		runAgentPrompt.mockImplementation(async () => {
			await gate;
			return { text: agentReply([]), toolCalls: [] };
		});

		try {
			await enqueueInvestigation(CASE_ID);
			expect(queueDepth()).toBe(1);

			await expect(enqueueInvestigation("case-2")).rejects.toThrow(/queue is full/i);
		} finally {
			release();
		}
		await waitForDrain();
	});

	test("the refusal is a 429, so the caller can be told to try again", async () => {
		process.env.INVESTIGATION_QUEUE_MAX_DEPTH = "1";
		process.env.INVESTIGATION_CONCURRENCY = "1";

		let release;
		const gate = new Promise((resolve) => {
			release = resolve;
		});
		runAgentPrompt.mockImplementation(async () => {
			await gate;
			return { text: agentReply([]), toolCalls: [] };
		});

		try {
			await enqueueInvestigation(CASE_ID);
			const error = await enqueueInvestigation("case-2").catch((caught) => caught);

			expect(error?.status).toBe(429);
			expect(String(error?.message)).toMatch(/try again shortly/i);
		} finally {
			release();
		}
		await waitForDrain();
	});

	test("a refused job leaves no queued rows behind", async () => {
		process.env.INVESTIGATION_QUEUE_MAX_DEPTH = "1";
		process.env.INVESTIGATION_CONCURRENCY = "1";

		let release;
		const gate = new Promise((resolve) => {
			release = resolve;
		});
		runAgentPrompt.mockImplementation(async () => {
			await gate;
			return { text: agentReply([]), toolCalls: [] };
		});

		try {
			await enqueueInvestigation(CASE_ID);
			const before = rows.length;
			await enqueueInvestigation("case-2").catch(() => {});

			expect(rows).toHaveLength(before);
			expect(rows.some((row) => row.case_id === "case-2")).toBe(false);
		} finally {
			release();
		}
		await waitForDrain();
	});
});

describe("the investigation queue", () => {
	test("queues one row per role and drains to zero when the run is over", async () => {
		await enqueueInvestigation(CASE_ID);

		expect(rows).toHaveLength(5);
		for (const role of ["lead", "code", "repo", "research", "verify"]) {
			const row = rowFor(role);
			expect(row).toBeDefined();
			expect(row.status).toBe("queued");
			expect(row.case_id).toBe(CASE_ID);
		}

		// The depth reports the work that is outstanding: one job, waiting or
		// running, until it is over.
		expect(queueDepth()).toBe(1);

		await waitForDrain();

		expect(queueDepth()).toBe(0);
		for (const role of ["lead", "code", "repo", "research", "verify"]) {
			expect(rowFor(role).status).toBe("complete");
		}
	});

	test("a re-run of the same case gets a higher attempt", async () => {
		await enqueueInvestigation(CASE_ID);
		await waitForDrain();
		await enqueueInvestigation(CASE_ID);

		expect(lastRowFor("lead").attempt).toBe(2);
		await waitForDrain();
	});

	test("the runtime is started with a per-run random password", async () => {
		await enqueueInvestigation(CASE_ID);
		await waitForDrain();
		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		expect(startInvestigationRuntime).toHaveBeenCalledTimes(2);
		const [first] = startInvestigationRuntime.mock.calls[0];
		const [second] = startInvestigationRuntime.mock.calls[1];
		expect(typeof first.password).toBe("string");
		expect(first.password.length).toBeGreaterThan(16);
		expect(first.password).not.toBe(second.password);
	});

	test("every role gets its own session, and the verifier runs last", async () => {
		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		expect(createInvestigationSession).toHaveBeenCalledTimes(5);
		const titles = createInvestigationSession.mock.calls.map(([call]) => call.title);
		expect(titles).toEqual([
			`investigation lead ${CASE_ID}`,
			`investigation code ${CASE_ID}`,
			`investigation repo ${CASE_ID}`,
			`investigation research ${CASE_ID}`,
			`investigation verify ${CASE_ID}`,
		]);

		// One session each: the queue never delegates through the model's own
		// `task` tool.
		expect(new Set(titles).size).toBe(5);
	});

	test("the verify prompt carries the findings of the specialists", async () => {
		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		const verifyCall = runAgentPrompt.mock.calls.find(([call]) => roleOf(call.text) === "verify");
		expect(verifyCall).toBeDefined();
		expect(verifyCall[0].text).toContain("finding from lead");
		expect(verifyCall[0].text).toContain("finding from research");
		expect(verifyCall[0].text).toContain("server/server.js");
	});

	test("a refuted finding is downgraded in the final set and in its own row", async () => {
		runAgentPrompt.mockImplementation(async ({ text }) => {
			if (roleOf(text) === "verify") {
				// The verifier refutes the lead's finding by repeating its exact
				// detail as a speculative finding.
				return {
					text: agentReply([
						{
							confidence: "speculative",
							detail: "finding from lead",
							evidence: [{ file: "server/server.js", lines: "99-100" }],
						},
					]),
					toolCalls: [],
				};
			}
			return defaultAnswer({ text });
		});

		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		// The final set - the verify row - carries every specialist finding.
		const verifyRow = rowFor("verify");
		expect(verifyRow.status).toBe("complete");
		expect(verifyRow.findings.findings).toHaveLength(4);
		const leadFinding = verifyRow.findings.findings.find(
			(finding) => finding.detail === "finding from lead",
		);
		expect(leadFinding.confidence).toBe("speculative");
		const codeFinding = verifyRow.findings.findings.find(
			(finding) => finding.detail === "finding from code",
		);
		expect(codeFinding.confidence).toBe("confirmed");

		// The row the refuted finding came from must not keep claiming
		// "confirmed".
		expect(rowFor("lead").findings.findings[0].confidence).toBe("speculative");
		expect(rowFor("code").findings.findings[0].confidence).toBe("confirmed");
	});

	test("a finding with no evidence never stays confirmed", async () => {
		runAgentPrompt.mockImplementation(async ({ text }) => {
			if (roleOf(text) === "verify") {
				return { text: agentReply([]), toolCalls: [] };
			}
			return {
				text: agentReply([{ confidence: "confirmed", detail: "a guess" }]),
				toolCalls: [],
			};
		});

		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		expect(rowFor("verify").findings.findings[0].confidence).toBe("speculative");
		expect(rowFor("lead").findings.findings[0].confidence).toBe("speculative");
	});

	test("the row of a role keeps its summary, findings, limitations and tool log", async () => {
		runAgentPrompt.mockImplementation(async ({ text }) => {
			if (roleOf(text) === "verify") {
				return { text: agentReply([], ["no history was readable"]), toolCalls: [] };
			}
			return {
				text: agentReply(
					[
						{
							confidence: "probable",
							detail: "the migration left a stale index",
							evidence: [{ file: "prisma/schema.prisma", lines: "1-5" }],
						},
					],
					["the git history was not readable"],
					"the migration is the likely cause",
				),
				toolCalls: [{ tool: "read", status: "completed" }],
			};
		});

		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		const row = rowFor("lead");
		expect(row.status).toBe("complete");
		expect(row.findings.summary).toBe("the migration is the likely cause");
		expect(row.findings.limitations).toEqual(["the git history was not readable"]);
		expect(row.findings.findings[0].confidence).toBe("probable");
		expect(row.evidence.files).toEqual(["prisma/schema.prisma"]);
		expect(row.evidence.commits).toEqual([]);
		expect(row.evidence.queries).toEqual([]);
		expect(row.evidence.failures).toEqual([]);
		expect(row.tool_log).toEqual([{ tool: "read", status: "completed" }]);
		expect(row.model_id).toBe("deepseek-v4.1-flash-free");
		expect(row.prompt).toContain("the feed is empty");
		expect(row.started_at).toBeInstanceOf(Date);
		expect(row.completed_at).toBeInstanceOf(Date);
		expect(row.error).toBeUndefined();
	});

	test("a reply that is not JSON is recorded as a failure, with the raw answer", async () => {
		runAgentPrompt.mockImplementation(async ({ text }) => {
			if (roleOf(text) === "verify") {
				return { text: agentReply([]), toolCalls: [] };
			}
			// The nudge asks the SAME session for the answer as JSON. A model
			// that cannot answer in the contract cannot answer it on the
			// second ask either.
			return { text: "I am sorry, I could not do that.", toolCalls: [] };
		});

		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		const row = rowFor("lead");
		expect(row.status).toBe("failed");
		expect(row.error).toContain("did not answer with JSON");
		expect(row.error).toContain("I am sorry, I could not do that.");
		// A failed parse never becomes an empty-but-successful result.
		expect(row.findings).toBeUndefined();
	});

	test("a model that answered with prose is NUDGED for JSON in the same session", async () => {
		const asked = [];
		runAgentPrompt.mockImplementation(async ({ text, sessionID }) => {
			asked.push({ text, sessionID });
			if (roleOf(text) === "verify") {
				return { text: agentReply([]), toolCalls: [] };
			}
			if (isNudge(text)) {
				// The nudge is answered with the JSON the model should have
				// given the first time.
				return {
					text: agentReply([
						{
							confidence: "confirmed",
							detail: "the recovered finding",
							evidence: [{ file: "server/server.js", lines: "1-2", commit: "abc1234" }],
						},
					]),
					toolCalls: [],
				};
			}
			if (roleOf(text) === "lead") {
				// Only the LEAD answers with prose; every other role answers in
				// the contract, so exactly one nudge is sent.
				return { text: "Based on my investigation, I can now provide a summary.", toolCalls: [] };
			}
			return defaultAnswer({ text });
		});

		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		const row = rowFor("lead");
		expect(row.status).toBe("complete");
		expect(row.findings.findings[0].detail).toBe("the recovered finding");

		// The nudge was sent, exactly once, and it went to the SAME session as
		// the original turn - the session still holds the investigation, so the
		// work is not repeated.
		const nudges = asked.filter((a) => isNudge(a.text));
		expect(nudges).toHaveLength(1);
		const original = asked.find((a) => /You are the lead investigator/.test(a.text));
		expect(original).toBeTruthy();
		expect(nudges[0].sessionID).toBe(original.sessionID);
	});

	test("a verification that fails leaves the findings recorded, but unverified", async () => {
		runAgentPrompt.mockImplementation(async ({ text }) => {
			if (roleOf(text) === "verify" || isNudge(text)) {
				return { text: "I could not verify anything.", toolCalls: [] };
			}
			return defaultAnswer({ text });
		});

		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		const verifyRow = rowFor("verify");
		expect(verifyRow.status).toBe("failed");
		expect(verifyRow.error).toContain("did not answer with JSON");
		// The specialists' findings survive the failed verification.
		expect(verifyRow.findings.findings).toHaveLength(4);
		expect(rowFor("lead").status).toBe("complete");
	});

	test("the runtime is stopped even when a role fails", async () => {
		let runtime = null;
		startInvestigationRuntime.mockImplementation(async ({ password }) => {
			runtime = {
				baseUrl: "http://127.0.0.1:4200",
				port: 4200,
				client: { session: { remove: jest.fn(async () => ({ data: true })) } },
				password,
				stop: jest.fn(async () => {}),
			};
			return runtime;
		});
		runAgentPrompt.mockImplementation(async () => {
			throw new Error("the runtime fell over");
		});

		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		expect(runtime.stop).toHaveBeenCalledTimes(1);
		expect(rowFor("lead").status).toBe("failed");
		expect(rowFor("lead").error).toContain("the runtime fell over");
	});

	test("the case moves on to reporting when the investigation is over", async () => {
		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		expect(supportCaseUpdateMany).toHaveBeenCalled();
		const [call] = supportCaseUpdateMany.mock.calls.at(-1);
		expect(call.where).toEqual({ id: CASE_ID, status: "investigating" });
		expect(call.data.status).toBe("reporting");
	});

	test("two investigations run at once, and never three", async () => {
		let active = 0;
		let peak = 0;
		startInvestigationRuntime.mockImplementation(async ({ password }) => {
			active += 1;
			peak = Math.max(peak, active);
			return {
				baseUrl: "http://127.0.0.1:4200",
				port: 4200,
				client: { session: { remove: jest.fn(async () => ({ data: true })) } },
				password,
				stop: jest.fn(async () => {
					active -= 1;
				}),
			};
		});

		seedCase("case-2");
		seedCase("case-3");

		await enqueueInvestigation(CASE_ID);
		await enqueueInvestigation("case-2");
		await enqueueInvestigation("case-3");
		await waitForDrain();

		expect(peak).toBe(2);
		expect(queueDepth()).toBe(0);
		expect(rows.filter((row) => row.case_id === "case-3")).toHaveLength(5);
	});
});

// ---------------------------------------------------------------------------
// The end of the investigation.
//
// The queue used to stop at `reporting`: the agents ran, the rows were
// written, and nobody ever built a report, mailed it or escalated anything.
// These tests pin the rest of the job.
// ---------------------------------------------------------------------------
describe("the end of the investigation", () => {
	test("the report is built, written to the verify row, and mailed", async () => {
		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		const report = rowFor("verify").report;
		expect(typeof report).toBe("string");
		expect(report.length).toBeGreaterThan(0);
		// It is the report of THIS case: its id and its conversation.
		expect(report).toContain(CASE_ID);
		expect(report).toContain("the feed is empty");

		// The mail carried the very same report.
		expect(deliverReport).toHaveBeenCalledTimes(1);
		expect(deliverReport.mock.calls[0][0].report).toBe(report);
	});

	// The report is built from what the investigators read in the repository,
	// and the repository holds credentials. The report is redacted BEFORE it
	// is written down, so the database never holds the raw value either.
	test("the report is redacted before it is persisted and mailed", async () => {
		const SECRET = "postgresql://investigator:hunter2@db.internal.example:5432/gartexhub";
		runAgentPrompt.mockImplementation(async ({ text }) => {
			if (roleOf(text) === "verify") {
				return { text: agentReply([]), toolCalls: [] };
			}
			return {
				text: agentReply([
					{
						confidence: "confirmed",
						detail: `finding from ${roleOf(text)}`,
						evidence: [{ file: "server/server.js", lines: "10-20" }],
					},
				]),
				toolCalls: [],
			};
		});

		// The agent quotes the deployment file's connection string in its
		// summary.
		seedCase(CASE_ID, { summary: `The connection string is ${SECRET}` });

		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		const report = rowFor("verify").report;
		expect(report).not.toContain(SECRET);
		expect(report).not.toContain("hunter2");
		expect(report).toContain("[redacted]");

		// The mail carried the redacted report too.
		expect(String(deliverReport.mock.calls[0][0].report)).not.toContain("hunter2");
	});

	// The verify row holds the accumulated set of findings, and each
	// specialist row holds its own copy of the findings it produced, so the
	// same finding reaches the report twice. It must be counted ONCE.
	test("a finding is counted once, not once per run that reported it", async () => {
		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		const report = rowFor("verify").report;
		expect(report).toContain("### Confirmed findings (4)");
		expect(report).not.toContain("### Confirmed findings (8)");
	});

	// The report must not quote a report: a row that already holds one would
	// put the previous report inside the new one.
	test("the report does not quote a report", async () => {
		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		const first = rowFor("verify").report;
		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		const second = lastRowFor("verify").report;
		expect(second).not.toContain(first);
		expect(second).not.toContain("**Agent report**");
	});

	test("the escalation runs on the final findings, and the mail does not gate it", async () => {
		// The mail provider is broken.
		deliverReport.mockResolvedValueOnce({ ok: false, status: "failed", error: "no_smtp" });

		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		// The escalation happened anyway.
		expect(escalateIfNeeded).toHaveBeenCalledTimes(1);
		const [caseId, findings] = escalateIfNeeded.mock.calls[0];
		expect(caseId).toBe(CASE_ID);
		// The FINAL set: every specialist finding, with the verification
		// applied - the verify row's findings, not one specialist's.
		expect(findings.findings).toHaveLength(4);
		expect(findings.findings.map((finding) => finding.detail)).toContain("finding from lead");
		expect(findings.findings.map((finding) => finding.detail)).toContain("finding from research");
	});

	test("the case ends completed", async () => {
		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		expect(cases.get(CASE_ID).status).toBe("completed");
	});

	test("a case that cannot be found is failed, not left investigating", async () => {
		await enqueueInvestigation("case-that-does-not-exist");
		await waitForDrain();

		expect(queueDepth()).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// The findings are redacted before they are stored and before they are
// emitted.
//
// The report is not the only consumer of what the investigator said. The
// raw findings are written to the `SupportInvestigation` row and pushed to
// the client over SSE as `support.case.finding`, and the client renders
// `finding.detail` and the evidence references AS THEY STAND. So a redacted
// report with an un-redacted finding is a secret with a lid on one end.
//
// The database and the event stream are two different consumers of the same
// payload, so both are covered here: redacting only one of them is not a
// fix.
// ---------------------------------------------------------------------------
describe("the findings are redacted before they are stored and emitted", () => {
	const FAKE_DATABASE_URL = "postgresql://investigator:hunter2@db.internal.example:5432/gartexhub";
	const FAKE_JWT_SECRET = "3f8a1c9e7b2d4a6f8e0c1b3d5a7f9e1c3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a";

	/** Every finding event the run published. */
	function collectFindingEvents() {
		const events = [];
		const channel = `support.case.finding:${CASE_ID}`;
		const listener = (payload) => events.push(payload);
		realtimeBus.on(channel, listener);
		return {
			events,
			stop: () => realtimeBus.off(channel, listener),
		};
	}

	test("an agent answer that quotes a secret leaves no secret in the database", async () => {
		runAgentPrompt.mockImplementation(async ({ text }) => {
			if (roleOf(text) === "verify") {
				return { text: agentReply([]), toolCalls: [] };
			}
			return {
				text: agentReply(
					[
						{
							confidence: "confirmed",
							detail: `the deployment file holds ${FAKE_DATABASE_URL} and JWT_SECRET=${FAKE_JWT_SECRET}`,
							evidence: [
								{ file: "server/server.js", lines: "10-20", commit: "abc1234" },
								{ url: `https://api.example.com/v1?JWT_SECRET=${FAKE_JWT_SECRET}` },
							],
						},
					],
					[],
					`the summary quotes ${FAKE_DATABASE_URL}`,
				),
				toolCalls: [],
			};
		});

		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		for (const role of ["lead", "code", "repo", "research", "verify"]) {
			const stored = JSON.stringify(rowFor(role).findings);
			expect(stored).not.toContain(FAKE_DATABASE_URL);
			expect(stored).not.toContain("hunter2");
			expect(stored).not.toContain(FAKE_JWT_SECRET);
		}

		// The non-secret surrounding text survives: the finding is still a
		// finding, and it still says what it found.
		const finding = rowFor("lead").findings.findings[0];
		expect(finding.detail).toContain("the deployment file holds");
		expect(finding.detail).toContain("[redacted]");
		expect(finding.evidence[0].file).toBe("server/server.js");
		expect(finding.evidence[0].lines).toBe("10-20");
	});

	test("an agent answer that quotes a secret leaves no secret on the event stream", async () => {
		runAgentPrompt.mockImplementation(async ({ text }) => {
			if (roleOf(text) === "verify") {
				return { text: agentReply([]), toolCalls: [] };
			}
			return {
				text: agentReply(
					[
						{
							confidence: "confirmed",
							detail: `the deployment file holds ${FAKE_DATABASE_URL} and JWT_SECRET=${FAKE_JWT_SECRET}`,
							evidence: [{ url: `https://api.example.com/v1?JWT_SECRET=${FAKE_JWT_SECRET}` }],
						},
					],
					[],
					"a summary",
				),
				toolCalls: [],
			};
		});

		const collector = collectFindingEvents();
		try {
			await enqueueInvestigation(CASE_ID);
			await waitForDrain();
		} finally {
			collector.stop();
		}

		expect(collector.events.length).toBeGreaterThan(0);
		for (const event of collector.events) {
			expect(event.type).toBeUndefined();
			const payload = JSON.stringify(event);
			expect(payload).not.toContain(FAKE_DATABASE_URL);
			expect(payload).not.toContain("hunter2");
			expect(payload).not.toContain(FAKE_JWT_SECRET);
			expect(payload).toContain("the deployment file holds");
		}
	});

	// The escalation reads the final findings and puts the detail into an
	// in-app notification, so it is a third consumer of the same payload.
	test("the escalation does not carry the secret either", async () => {
		runAgentPrompt.mockImplementation(async ({ text }) => {
			if (roleOf(text) === "verify") {
				return { text: agentReply([]), toolCalls: [] };
			}
			return {
				text: agentReply(
					[
						{
							confidence: "confirmed",
							detail: `hardcoded password: hunter2 in the deployment file`,
							evidence: [{ file: "server/server.js" }],
						},
					],
					[],
					"a summary",
				),
				toolCalls: [],
			};
		});

		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		expect(escalateIfNeeded).toHaveBeenCalledTimes(1);
		const [, findings] = escalateIfNeeded.mock.calls[0];
		expect(JSON.stringify(findings)).not.toContain("hunter2");
	});
});

// ---------------------------------------------------------------------------
// The evidence resolver.
//
// A URL is a legitimate reference: the demotion is a claim that the
// reference does not resolve, and a URL resolves by being a URL. Only a
// filesystem path that does not exist is demoted.
// ---------------------------------------------------------------------------
describe("the evidence resolver", () => {
	test("a finding whose only evidence is a URL is not demoted", async () => {
		runAgentPrompt.mockImplementation(async ({ text }) => {
			if (roleOf(text) === "verify") {
				return { text: agentReply([]), toolCalls: [] };
			}
			return {
				text: agentReply([
					{
						confidence: "confirmed",
						detail: "the vendor documents the behaviour",
						evidence: [{ file: "https://docs.example.com/feed" }],
					},
				]),
				toolCalls: [],
			};
		});

		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		const finding = rowFor("verify").findings.findings.find(
			(entry) => entry.detail === "the vendor documents the behaviour",
		);
		expect(finding).toBeDefined();
		expect(finding.confidence).toBe("confirmed");
		expect(finding.unverified_references).toBeUndefined();
	});

	test("a finding whose only evidence is a path that does not exist is still demoted", async () => {
		runAgentPrompt.mockImplementation(async ({ text }) => {
			if (roleOf(text) === "verify") {
				return { text: agentReply([]), toolCalls: [] };
			}
			return {
				text: agentReply([
					{
						confidence: "confirmed",
						detail: "a claim about a file that is not there",
						evidence: [{ file: "server/there-is-no-such-file.js" }],
					},
				]),
				toolCalls: [],
			};
		});

		await enqueueInvestigation(CASE_ID);
		await waitForDrain();

		const finding = rowFor("verify").findings.findings.find(
			(entry) => entry.detail === "a claim about a file that is not there",
		);
		expect(finding).toBeDefined();
		expect(finding.confidence).toBe("speculative");
		expect(finding.unverified_references).toContain("server/there-is-no-such-file.js");
	});
});
