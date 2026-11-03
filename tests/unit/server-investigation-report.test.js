// The report renderer is the artefact the owner reads instead of the
// conversation: every agent that ran, every finding it produced, the
// evidence behind that finding, what nobody could establish, and what
// should happen next.
//
// The honesty half is the one that can break silently. A failed
// investigation is NOT a clean result. If the renderer treats "the agent
// died" as "the agent found nothing", the report tells the owner the
// system looked and there was nothing there — a claim the owner will act
// on. These tests pin the difference.
//
// The interface is fixed by the workstream brief:
//
//   buildReport({ caseRow, messages, investigations }) -> string (Markdown)
//
// and the shapes it consumes are fixed by contracts.md §5:
//   SupportInvestigation.findings  -> { summary, findings[], limitations[] }
//   SupportInvestigation.evidence  -> { files[], commits[], queries[], failures[] }
//   SupportInvestigation.tool_log  -> [{ tool, status, error? }]
//   a finding                      -> { confidence, detail, evidence[] }

import { buildReport } from "../../server/services/investigation/report.js";

const CASE_ROW = {
	id: "case-42",
	user_id: "client-7",
	status: "investigating",
	subject: "Payment step returns HTTP 500",
	summary: "The address step succeeds; the payment step does not.",
	ticket_id: "ticket-9",
	escalated: false,
	report_status: null,
	report_delivered_at: null,
	retain: false,
	created_at: new Date("2026-10-20T09:00:00.000Z"),
	updated_at: new Date("2026-10-20T09:30:00.000Z"),
};

const COMPLAINT = "Since yesterday the payment step answers HTTP 500 for every card we try.";

const MESSAGES = [
	{
		id: "m1",
		case_id: "case-42",
		role: "client",
		kind: "question",
		content: COMPLAINT,
		agent: null,
		sequence: 1,
		created_at: new Date("2026-10-20T09:00:00.000Z"),
	},
	{
		id: "m2",
		case_id: "case-42",
		role: "assistant",
		kind: "answer",
		content: "I need the failing request id before I can start investigating.",
		agent: "lead",
		sequence: 2,
		created_at: new Date("2026-10-20T09:02:00.000Z"),
	},
	{
		id: "m3",
		case_id: "case-42",
		role: "client",
		kind: "answer",
		content: "Request id is req-8891, it happens right after the address step.",
		agent: null,
		sequence: 3,
		created_at: new Date("2026-10-20T09:04:00.000Z"),
	},
	{
		id: "m4",
		case_id: "case-42",
		role: "system",
		kind: "notice",
		content: "Investigation started with three specialists.",
		agent: null,
		sequence: 4,
		created_at: new Date("2026-10-20T09:05:00.000Z"),
	},
];

const CONFIRMED_DETAIL =
	"The checkout route awaits the gateway promise with no timeout, so a slow upstream answers with a 500.";
const PROBABLE_DETAIL =
	"The upstream gateway is rate limiting the merchant account during the evening peak.";
const LEAD_DETAIL = "The failure sits upstream of this application rather than inside it.";
const UNSUPPORTED_DETAIL = "The upstream provider may have changed its default timeout last week.";

const EVIDENCE_URL =
	"https://example.test/repo/blob/abc1234def567890/server/routes/paymentRoutes.js#L88";

const INVESTIGATIONS = [
	{
		id: "inv-lead",
		case_id: "case-42",
		role: "lead",
		status: "complete",
		attempt: 1,
		model_id: "opencode/big-pickle-free",
		prompt: "Plan the investigation of the reported checkout failure.",
		report: "Three specialists dispatched.",
		findings: {
			summary: "The failure is upstream of the application.",
			findings: [
				{
					confidence: "speculative",
					detail: LEAD_DETAIL,
					evidence: [
						{
							file: "docs/architecture.md",
							lines: "10-22",
							commit: "abc1234def567890",
							url: "https://example.test/repo/blob/abc1234def567890/docs/architecture.md",
						},
					],
				},
			],
			limitations: ["Only the public repository was inspected."],
		},
		evidence: {
			files: ["docs/architecture.md"],
			commits: ["abc1234def567890"],
			queries: ["rg checkout gateway"],
			failures: [],
		},
		tool_log: [{ tool: "read", status: "ok" }],
		error: null,
		started_at: new Date("2026-10-20T09:05:00.000Z"),
		completed_at: new Date("2026-10-20T09:06:00.000Z"),
		created_at: new Date("2026-10-20T09:05:00.000Z"),
	},
	{
		id: "inv-code",
		case_id: "case-42",
		role: "code",
		status: "complete",
		attempt: 1,
		model_id: "opencode/grok-code-free",
		prompt: "Find the code path that handles the payment step.",
		report: "The payment route has no timeout.",
		findings: {
			summary: "The payment route awaits an unbounded gateway call.",
			findings: [
				{
					confidence: "confirmed",
					detail: CONFIRMED_DETAIL,
					evidence: [
						{
							file: "server/routes/paymentRoutes.js",
							lines: "88-104",
							commit: "abc1234def567890",
							url: EVIDENCE_URL,
						},
					],
				},
				{
					confidence: "probable",
					detail: PROBABLE_DETAIL,
					evidence: [
						{
							file: "server/services/paymentService.js",
							lines: "12-30",
							commit: "abc1234def567890",
							url: "https://example.test/repo/blob/abc1234def567890/server/services/paymentService.js#L12",
						},
					],
				},
			],
			limitations: ["The live gateway logs were not reachable from the read-only sandbox."],
		},
		evidence: {
			files: ["server/routes/paymentRoutes.js", "server/services/paymentService.js"],
			commits: ["abc1234def567890"],
			queries: ["rg payment timeout"],
			failures: [],
		},
		tool_log: [
			{ tool: "read", status: "ok" },
			{ tool: "grep", status: "ok" },
		],
		error: null,
		started_at: new Date("2026-10-20T09:06:00.000Z"),
		completed_at: new Date("2026-10-20T09:14:00.000Z"),
		created_at: new Date("2026-10-20T09:06:00.000Z"),
	},
	{
		id: "inv-research",
		case_id: "case-42",
		role: "research",
		status: "complete",
		attempt: 1,
		model_id: "opencode/qwen-free",
		prompt: "Look for the provider's documented gateway timeout.",
		report: "No network access; nothing established.",
		findings: {
			summary: "Nothing about the provider could be established.",
			findings: [
				{
					confidence: "speculative",
					detail: UNSUPPORTED_DETAIL,
					evidence: [],
				},
			],
			limitations: ["The sandbox has no network access."],
		},
		evidence: {
			files: [],
			commits: [],
			queries: ["provider gateway timeout"],
			failures: ["webfetch: no network"],
		},
		tool_log: [{ tool: "webfetch", status: "error", error: "no network" }],
		error: null,
		started_at: new Date("2026-10-20T09:06:00.000Z"),
		completed_at: new Date("2026-10-20T09:09:00.000Z"),
		created_at: new Date("2026-10-20T09:06:00.000Z"),
	},
];

// The failed specialist. It produced no findings because it never finished,
// which is a different statement from "it looked and found nothing".
const FAILED_INVESTIGATION = {
	id: "inv-repo",
	case_id: "case-42",
	role: "repo",
	status: "failed",
	attempt: 2,
	model_id: "opencode/grok-code-free",
	prompt: "Search the repository history for the payment change.",
	report: null,
	findings: { summary: "", findings: [], limitations: [] },
	evidence: { files: [], commits: [], queries: [], failures: ["git log: timed out"] },
	tool_log: [{ tool: "bash", status: "error", error: "tool crashed" }],
	error: "agent turn timed out after 120000ms",
	started_at: new Date("2026-10-20T09:06:00.000Z"),
	completed_at: new Date("2026-10-20T09:08:00.000Z"),
	created_at: new Date("2026-10-20T09:06:00.000Z"),
};

/**
 * The confidence the renderer attached to a finding.
 *
 * The label may sit on the finding's own line (before the detail) or on the
 * lines that follow it, so both are read. The first confidence word in that
 * neighbourhood is the label — the report's own legend is far above the
 * finding and is not part of the neighbourhood.
 *
 * @param {string} markdown The rendered report.
 * @param {number} index Where the finding's text starts.
 * @returns {string} "confirmed", "probable", "speculative", or "" when the
 *   finding carries no confidence label at all.
 */
function confidenceFor(markdown, index) {
	const lines = markdown.split("\n");
	const lineIndex = markdown.slice(0, index).split("\n").length - 1;
	const neighbourhood = [lines.at(lineIndex), ...lines.slice(lineIndex + 1, lineIndex + 12)];
	for (const line of neighbourhood) {
		const match = String(line).match(/\b(confirmed|probable|speculative)\b/i);
		if (match) {
			return match[1].toLowerCase();
		}
	}
	return "";
}

describe("buildReport — the complete report", () => {
	let md = "";

	beforeAll(() => {
		md = buildReport({
			caseRow: CASE_ROW,
			messages: MESSAGES,
			investigations: INVESTIGATIONS,
		});
	});

	test("the case id is in the report", () => {
		expect(md).toContain("case-42");
	});

	test("the case metadata carries the subject, the status and the owner", () => {
		expect(md).toContain("Payment step returns HTTP 500");
		expect(md).toMatch(/\binvestigating\b/);
		expect(md).toContain("client-7");
		expect(md.toLowerCase()).toMatch(/created/);
	});

	test("the original complaint is quoted, not paraphrased away", () => {
		expect(md.toLowerCase()).toMatch(/complaint/);
		expect(md).toContain(COMPLAINT);
	});

	test("the conversation log carries every message with its role", () => {
		expect(md.toLowerCase()).toMatch(/conversation/);
		const lower = md.toLowerCase();
		for (const message of MESSAGES) {
			expect(md).toContain(message.content);
			expect(lower).toContain(String(message.role).toLowerCase());
		}
	});

	test("every agent that ran is named", () => {
		for (const investigation of INVESTIGATIONS) {
			expect(md.toLowerCase()).toContain(investigation.role);
		}
	});

	test("every finding is quoted with its detail", () => {
		expect(md).toContain(CONFIRMED_DETAIL);
		expect(md).toContain(PROBABLE_DETAIL);
		expect(md).toContain(LEAD_DETAIL);
		expect(md).toContain(UNSUPPORTED_DETAIL);
	});

	test("the confidence of every finding is shown", () => {
		expect(md.toLowerCase()).toMatch(/confirmed/);
		expect(md.toLowerCase()).toMatch(/probable/);
		expect(md.toLowerCase()).toMatch(/speculative/);
	});

	test("the evidence references are shown", () => {
		expect(md).toContain("server/routes/paymentRoutes.js");
		expect(md).toMatch(/88\D{0,3}104/);
		expect(md).toMatch(/abc1234/);
		expect(md).toContain(EVIDENCE_URL);
	});

	test("the limitations are shown", () => {
		expect(md.toLowerCase()).toMatch(/limitation/);
		expect(md).toContain("The live gateway logs were not reachable from the read-only sandbox.");
		expect(md).toContain("The sandbox has no network access.");
	});

	test("there is a next steps section with content in it", () => {
		const index = md.search(/next steps/i);
		expect(index).toBeGreaterThan(-1);
		expect(md.slice(index).trim().length).toBeGreaterThan("next steps".length + 10);
	});

	test("the audit and delivery section is present", () => {
		expect(md.toLowerCase()).toMatch(/audit/);
		expect(md.toLowerCase()).toMatch(/deliver/);
	});
});

describe("buildReport — a failed investigation is incomplete, not empty", () => {
	let md = "";

	beforeAll(() => {
		md = buildReport({
			caseRow: CASE_ROW,
			messages: MESSAGES,
			investigations: [...INVESTIGATIONS, FAILED_INVESTIGATION],
		});
	});

	test("the report says the investigation was incomplete", () => {
		expect(md.toLowerCase()).toMatch(/incomplete/);
	});

	test("the failure and its error are reported", () => {
		expect(md).toContain("agent turn timed out after 120000ms");
		expect(md.toLowerCase()).toMatch(/failed/);
	});

	test("a failed investigation is not reported as 'no findings found'", () => {
		expect(md.toLowerCase()).not.toMatch(/no findings/);
	});

	// The case where the dishonesty actually bites: the ONLY run failed, so
	// there is nothing else in the report. A renderer that treats a crashed
	// run as an empty one has nothing left to say and writes "no findings
	// found" — which reads as "we looked and there was nothing to find".
	test("a case whose only run failed does not read as 'no findings found'", () => {
		const onlyFailed = buildReport({
			caseRow: CASE_ROW,
			messages: MESSAGES,
			investigations: [FAILED_INVESTIGATION],
		});

		expect(onlyFailed.toLowerCase()).toContain("incomplete");
		expect(onlyFailed.toLowerCase()).not.toMatch(/no findings/);
		expect(onlyFailed).toContain("agent turn timed out after 120000ms");
	});

	test("the specialists that did finish still have their findings in the report", () => {
		expect(md).toContain(CONFIRMED_DETAIL);
		expect(md).toContain(LEAD_DETAIL);
	});
});

describe("buildReport — an unevidenced claim is never sold as confirmed", () => {
	test("a finding with no evidence renders, and is labelled speculative", () => {
		const md = buildReport({
			caseRow: CASE_ROW,
			messages: MESSAGES,
			investigations: [INVESTIGATIONS[2]],
		});

		// It renders at all — an unevidenced claim is not hidden.
		expect(md).toContain(UNSUPPORTED_DETAIL);

		// And it is not sold as a confirmed claim. The label the renderer
		// attached to THIS finding is what matters, not the confidence legend
		// the report prints above the findings.
		const index = md.indexOf(UNSUPPORTED_DETAIL);
		expect(confidenceFor(md, index)).toBe("speculative");
	});
});

// The verify run holds the FINAL set of findings — every specialist finding
// with the verification applied — and each specialist run holds its own copy
// of the findings it produced. The same finding therefore reaches the report
// twice, and counting it twice would report twice as many findings as the
// investigation produced.
describe("buildReport — the final finding set is counted once", () => {
	const codeRun = INVESTIGATIONS[1];
	const verifyRun = {
		...codeRun,
		id: "inv-verify",
		role: "verify",
		findings: {
			summary: "the final set of findings",
			findings: codeRun.findings.findings,
			limitations: [],
		},
	};

	test("a finding the verify row repeats is counted once", () => {
		const md = buildReport({
			caseRow: CASE_ROW,
			messages: MESSAGES,
			investigations: [codeRun, verifyRun],
		});

		expect(md).toContain("### Confirmed findings (1)");
		expect(md).toContain("### Probable findings (1)");
		expect(md).toContain("### Speculative findings (0)");
		// The finding is attributed to the run that FOUND it, not to the
		// verifier that checked it.
		expect(md).toContain("**Source role:** code");
	});

	test("the count of rendered findings is the count of the findings", () => {
		const md = buildReport({
			caseRow: CASE_ROW,
			messages: MESSAGES,
			investigations: [codeRun, verifyRun],
		});

		expect(md).toContain("**Findings rendered:** 2");
	});
});
