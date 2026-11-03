import { jest } from "@jest/globals";

// Delivery is the step where a lie becomes expensive. `emailService` does not
// throw when it cannot send — it logs the attempt and answers
// `{ ok: false, status: "logged_no_gmail" }` (or logged_disabled,
// logged_no_smtp, logged_unsupported, no_recipients, failed). If the case is
// then recorded as `sent`, the owner is told an investigation report was
// delivered when nothing was ever transmitted, and the only trace is a row
// nobody reads.
//
// So the rule under test is narrow and absolute: the status recorded on the
// case is the server's own verdict, and a failed send is never recorded as
// `sent`.
//
// The interface is fixed by the workstream brief:
//
//   deliverReport({ caseRow, report }) -> Promise<{ ok, status, error? }>
//   escalateIfNeeded(caseId, findings) -> Promise<boolean>
//
// Escalation is deliberately separate from the email: a confirmed
// security/data-loss finding must not wait for a mail server.

const sendEmail = jest.fn();

// The mail transport is the seam. The real `emailService` answers
// `{ ok: false, status: "logged_no_gmail" }` when it could only log the
// message, and that verdict is what the case has to record — so the test
// drives the verdict directly rather than through a live provider.
jest.unstable_mockModule("../../server/services/emailService.js", () => ({
	sendEmail,
	isSmtpConfigured: jest.fn(() => false),
	getEmailDeliveryStatus: jest.fn(async () => ({
		enabled: false,
		provider: "smtp",
		provider_configured: false,
		ready: false,
	})),
}));

// The realtime bus is mocked because `emitCaseEvent` is owned by another
// workstream and may not exist yet; the delivery module must not be blocked
// on it. The notification service is deliberately NOT mocked, so the
// in-app escalation notification travels the real path down to prisma.
const emitCaseEvent = jest.fn();

jest.unstable_mockModule("../../server/realtime/realtimeBus.js", () => ({
	REALTIME_EVENTS: {},
	realtimeBus: { on: jest.fn(), emit: jest.fn(), off: jest.fn(), removeAllListeners: jest.fn() },
	emitNotificationCreated: jest.fn(),
	emitNotificationRead: jest.fn(),
	emitFeedPostCreated: jest.fn(),
	emitFeedPostUpdated: jest.fn(),
	emitFeedPostDeleted: jest.fn(),
	emitSyncInvalidated: jest.fn(),
	emitCaseEvent,
}));

const supportCaseUpdate = jest.fn(async (args) => ({
	id: args?.where?.id,
	...(args?.data || {}),
}));
const supportCaseUpdateMany = jest.fn(async () => ({ count: 1 }));
const supportCaseUpsert = jest.fn(async (args) => ({
	id: args?.where?.id,
	...(args?.update || {}),
}));
const supportCaseFindMany = jest.fn(async () => []);
const supportCaseFindUnique = jest.fn(async () => null);
const supportInvestigationFindMany = jest.fn(async () => []);
const userFindMany = jest.fn(async () => [
	{ id: "owner-1", email: "owner@example.test", role: "owner" },
	{ id: "admin-1", email: "admin@example.test", role: "admin" },
]);
const notificationCreate = jest.fn(async (args) => ({ id: "note-1", ...(args?.data || {}) }));

jest.unstable_mockModule("../../server/utils/prisma.js", () => ({
	default: {
		supportCase: {
			update: supportCaseUpdate,
			updateMany: supportCaseUpdateMany,
			upsert: supportCaseUpsert,
			findMany: supportCaseFindMany,
			findUnique: supportCaseFindUnique,
		},
		supportInvestigation: { findMany: supportInvestigationFindMany },
		user: { findMany: userFindMany },
		notification: { create: notificationCreate },
	},
}));

const { buildCaseReportLink, deliverReport, escalateIfNeeded } = await import(
	"../../server/services/investigation/delivery.js"
);

const CASE_ROW = {
	id: "case-42",
	user_id: "client-7",
	status: "reporting",
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

// A report longer than emailService's 2000 character cap, so a body that is
// the report verbatim is visibly too long to be a summary.
const REPORT = [
	"# Support investigation report",
	"",
	"Case: case-42",
	"",
	"## Original complaint",
	"",
	"Since yesterday the payment step answers HTTP 500 for every card we try.",
	"",
	"## Findings",
	"",
	"The checkout route awaits the gateway promise with no timeout, so a slow upstream answers with a 500.",
	"",
	"## Evidence",
	"",
	"- server/routes/paymentRoutes.js lines 88-104 @ abc1234def567890",
	"",
	"## Next steps",
	"",
	"Add a timeout to the gateway call and re-run the payment step.",
	"",
	"## Audit and delivery",
	"",
	"Read-only safeguards were in force for the whole investigation.",
	"",
	"## Appendix",
	"",
	"padding ".repeat(200),
].join("\n");

const SECURITY_FINDING = {
	confidence: "confirmed",
	detail:
		"Security issue: customer session tokens are stored in plaintext in the database, which is a data loss and data-loss exposure.",
	category: "security",
	type: "security",
	evidence: [
		{
			file: "server/db/userStore.js",
			lines: "42-58",
			commit: "abc1234def567890",
			url: "https://example.test/repo/blob/abc1234def567890/server/db/userStore.js#L42",
		},
	],
};

const BENIGN_FINDING = {
	confidence: "confirmed",
	detail: "The checkout page loads slowly because a large asset bundle is served unminified.",
	category: "performance",
	type: "performance",
	evidence: [
		{
			file: "src/pages/Checkout.jsx",
			lines: "10-20",
			commit: "abc1234def567890",
			url: "https://example.test/repo/blob/abc1234def567890/src/pages/Checkout.jsx#L10",
		},
	],
};

/**
 * contracts.md §5 stores a specialist's findings as
 * `{ summary, findings[], limitations[] }`, while the brief hands
 * `escalateIfNeeded(caseId, findings)` an argument called "findings". The two
 * readings differ — the array of findings, or the wrapper object — so the
 * payload carries both: it is an array of findings that also exposes
 * `.summary`, `.findings` and `.limitations`. `.findings` is a copy, not a
 * self-reference, so the payload stays safe to serialize.
 *
 * @param {Object} params
 * @param {string} params.summary
 * @param {Object[]} params.findings
 * @param {string[]} [params.limitations]
 * @returns {Object[]} The findings, in both shapes.
 */
function findingsPayload({ summary, findings, limitations = [] }) {
	const list = Array.isArray(findings) ? [...findings] : [];
	list.summary = summary;
	list.findings = [...list];
	list.limitations = [...limitations];
	return list;
}

/**
 * Every `report_status` the delivery wrote to the case, from whichever write
 * path it used.
 *
 * @returns {string[]} The recorded statuses.
 */
function reportStatusWrites() {
	const statuses = [];
	for (const call of supportCaseUpdate.mock.calls) {
		const value = call[0]?.data?.report_status;
		if (value !== undefined) {
			statuses.push(value);
		}
	}
	for (const call of supportCaseUpdateMany.mock.calls) {
		const value = call[0]?.data?.report_status;
		if (value !== undefined) {
			statuses.push(value);
		}
	}
	for (const call of supportCaseUpsert.mock.calls) {
		const value = call[0]?.update?.report_status;
		if (value !== undefined) {
			statuses.push(value);
		}
	}
	return statuses;
}

/**
 * The `escalated` flag as written to the case.
 *
 * @returns {boolean[]} The written values.
 */
function escalatedWrites() {
	const values = [];
	for (const call of supportCaseUpdate.mock.calls) {
		const value = call[0]?.data?.escalated;
		if (value !== undefined) {
			values.push(value);
		}
	}
	return values;
}

/**
 * The users an in-app notification was raised for.
 *
 * @returns {string[]} The notified user ids.
 */
function notificationRecipients() {
	return notificationCreate.mock.calls.map((call) => call[0]?.data?.user_id).filter(Boolean);
}

/**
 * The recipients of the outgoing email, whether they were passed as an array
 * or as a comma separated string.
 *
 * @returns {string[]} The recipient addresses.
 */
function emailRecipients() {
	const [call] = sendEmail.mock.calls;
	if (!call) {
		return [];
	}
	const to = call[0]?.to;
	if (Array.isArray(to)) {
		return to.map((value) => String(value).trim()).filter(Boolean);
	}
	return String(to || "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
}

const savedEnv = {
	ADMIN_OWNER_EMAILS: process.env.ADMIN_OWNER_EMAILS,
	APP_BASE_URL: process.env.APP_BASE_URL,
	PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
	RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL,
};

beforeAll(() => {
	// The same addresses the owner/admin query returns, so the test does not
	// depend on which of the two sources the implementation reads.
	process.env.ADMIN_OWNER_EMAILS = "owner@example.test,admin@example.test";
	process.env.APP_BASE_URL = "https://app.example.test";
});

afterAll(() => {
	for (const [key, value] of Object.entries(savedEnv)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
});

/**
 * Set the base-url environment variables for one assertion.
 *
 * @param {Object} values
 */
function withBaseUrlEnv(values) {
	for (const [key, value] of Object.entries(savedEnv)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
	for (const [key, value] of Object.entries(values)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
}

beforeEach(() => {
	sendEmail.mockReset();
	emitCaseEvent.mockReset();
	supportCaseUpdate.mockClear();
	supportCaseUpdateMany.mockClear();
	supportCaseUpsert.mockClear();
	supportCaseFindMany.mockClear();
	supportCaseFindUnique.mockClear();
	supportInvestigationFindMany.mockClear();
	notificationCreate.mockClear();
	userFindMany.mockClear();
	userFindMany.mockResolvedValue([
		{ id: "owner-1", email: "owner@example.test", role: "owner" },
		{ id: "admin-1", email: "admin@example.test", role: "admin" },
	]);
});

describe("deliverReport — a successful send", () => {
	beforeEach(() => {
		sendEmail.mockResolvedValue({ ok: true, status: "sent" });
	});

	test("the case records the report as sent", async () => {
		await deliverReport({ caseRow: CASE_ROW, report: REPORT });

		expect(sendEmail).toHaveBeenCalledTimes(1);
		expect(reportStatusWrites()).toContain("sent");
	});

	test("the delivery is dated", async () => {
		await deliverReport({ caseRow: CASE_ROW, report: REPORT });

		const write = supportCaseUpdate.mock.calls.find(
			(call) => call[0]?.data?.report_status !== undefined,
		);
		expect(write).toBeTruthy();
		expect(write[0].data.report_delivered_at).toBeTruthy();
	});

	test("the result reports the delivery as successful", async () => {
		const result = await deliverReport({ caseRow: CASE_ROW, report: REPORT });

		expect(result.ok).toBe(true);
		expect(result.status).toBe("sent");
	});

	test("the report goes to the owner and the admin", async () => {
		await deliverReport({ caseRow: CASE_ROW, report: REPORT });

		expect(emailRecipients()).toEqual(
			expect.arrayContaining(["owner@example.test", "admin@example.test"]),
		);
	});

	test("the plain text body stays inside emailService's 2000 character cap", async () => {
		await deliverReport({ caseRow: CASE_ROW, report: REPORT });

		const text = String(sendEmail.mock.calls[0][0]?.text || "");
		expect(text.length).toBeLessThanOrEqual(2000);
	});

	test("the body is a summary with a link, not the whole report", async () => {
		await deliverReport({ caseRow: CASE_ROW, report: REPORT });

		const text = String(sendEmail.mock.calls[0][0]?.text || "");
		expect(text.length).toBeLessThan(REPORT.length);
		expect(text).toContain("case-42");
	});

	test("the html body carries the same link", async () => {
		await deliverReport({ caseRow: CASE_ROW, report: REPORT });

		const html = String(sendEmail.mock.calls[0][0]?.html || "");
		expect(html).toContain("case-42");
	});
});

describe("deliverReport — a send that did not happen", () => {
	beforeEach(() => {
		sendEmail.mockResolvedValue({ ok: false, status: "logged_no_gmail" });
	});

	test("the case never records the report as sent", async () => {
		await deliverReport({ caseRow: CASE_ROW, report: REPORT });

		const statuses = reportStatusWrites();
		expect(statuses.length).toBeGreaterThan(0);
		expect(statuses).not.toContain("sent");
	});

	test("the case records a failed delivery", async () => {
		await deliverReport({ caseRow: CASE_ROW, report: REPORT });

		expect(reportStatusWrites()).toContain("failed");
	});

	test("a failed delivery is not dated as delivered", async () => {
		await deliverReport({ caseRow: CASE_ROW, report: REPORT });

		const write = supportCaseUpdate.mock.calls.find(
			(call) => call[0]?.data?.report_status !== undefined,
		);
		expect(write).toBeTruthy();
		expect(write[0].data.report_delivered_at ?? null).toBeNull();
	});

	test("the result reports the failure", async () => {
		const result = await deliverReport({ caseRow: CASE_ROW, report: REPORT });

		expect(result.ok).toBe(false);
		expect(result.status).not.toBe("sent");
	});

	test("a send that throws records a failure, not a sent one", async () => {
		sendEmail.mockRejectedValue(new Error("the mail path exploded"));

		const result = await deliverReport({ caseRow: CASE_ROW, report: REPORT });

		expect(reportStatusWrites()).not.toContain("sent");
		expect(reportStatusWrites()).toContain("failed");
		expect(result.ok).toBe(false);
	});

	test("a delivery whose verdict could not be written down is not reported as sent", async () => {
		sendEmail.mockResolvedValue({ ok: true, status: "sent" });
		supportCaseUpdate.mockRejectedValueOnce(new Error("the database is down"));

		const result = await deliverReport({ caseRow: CASE_ROW, report: REPORT });

		// The mail went out, but the case does not know that, so nothing may
		// claim it was sent.
		expect(result.ok).toBe(false);
		expect(result.status).not.toBe("sent");
	});
});

describe("escalateIfNeeded — confirmed security findings", () => {
	const securityFindings = findingsPayload({
		summary: "Session tokens are stored in plaintext.",
		findings: [SECURITY_FINDING],
		limitations: [],
	});

	test("a confirmed security finding sets escalated on the case", async () => {
		const escalated = await escalateIfNeeded("case-42", securityFindings);

		expect(escalated).toBe(true);
		expect(escalatedWrites()).toContain(true);
	});

	test("the escalation is recorded against the right case", async () => {
		await escalateIfNeeded("case-42", securityFindings);

		const write = supportCaseUpdate.mock.calls.find((call) => call[0]?.data?.escalated === true);
		expect(write).toBeTruthy();
		expect(write[0].where.id).toBe("case-42");
	});

	test("the escalation notifies the owner and the admin in-app", async () => {
		await escalateIfNeeded("case-42", securityFindings);

		expect(notificationRecipients()).toEqual(expect.arrayContaining(["owner-1", "admin-1"]));
	});

	test("the escalation does not wait for the email", async () => {
		await escalateIfNeeded("case-42", securityFindings);

		expect(sendEmail).not.toHaveBeenCalled();
	});
});

describe("escalateIfNeeded — what must not escalate", () => {
	test("a confirmed finding that is not a security issue does not escalate", async () => {
		const findings = findingsPayload({
			summary: "The checkout page is slow.",
			findings: [BENIGN_FINDING],
			limitations: [],
		});

		const escalated = await escalateIfNeeded("case-42", findings);

		expect(escalated).toBe(false);
		expect(escalatedWrites()).not.toContain(true);
	});

	test("a security finding that is only probable does not escalate", async () => {
		const findings = findingsPayload({
			summary: "Session tokens may be stored in plaintext.",
			findings: [{ ...SECURITY_FINDING, confidence: "probable" }],
			limitations: [],
		});

		const escalated = await escalateIfNeeded("case-42", findings);

		expect(escalated).toBe(false);
		expect(escalatedWrites()).not.toContain(true);
	});
});

// The emailed link is the only way the owner reaches the report from their
// inbox. Render's `fromService: { property: host }` produces a bare
// hostname, and a bare hostname is a relative path as far as a mail client is
// concerned: the link opens nothing.
describe("the report link (buildCaseReportLink)", () => {
	afterEach(() => {
		withBaseUrlEnv({ APP_BASE_URL: savedEnv.APP_BASE_URL });
	});

	test("the link carries the case id", () => {
		withBaseUrlEnv({ APP_BASE_URL: "https://app.example.test" });

		const link = buildCaseReportLink("case-42");

		expect(link).toContain("/admin?case=case-42");
	});

	test("a bare hostname gets a scheme", () => {
		withBaseUrlEnv({ APP_BASE_URL: "gartexhub.onrender.com" });

		const link = buildCaseReportLink("case-42");

		expect(link.startsWith("http://") || link.startsWith("https://")).toBe(true);
		expect(link).toBe("https://gartexhub.onrender.com/admin?case=case-42");
	});

	test("Render's own external url wins over the schemeless one", () => {
		withBaseUrlEnv({
			RENDER_EXTERNAL_URL: "https://gartexhub.onrender.com",
			APP_BASE_URL: "gartexhub.onrender.com",
		});

		const link = buildCaseReportLink("case-42");

		expect(link).toBe("https://gartexhub.onrender.com/admin?case=case-42");
	});

	test("a base url with a scheme is left alone", () => {
		withBaseUrlEnv({ APP_BASE_URL: "http://localhost:4000" });

		const link = buildCaseReportLink("case-42");

		expect(link).toBe("http://localhost:4000/admin?case=case-42");
	});

	test("the link is absolute even when only the bare hostname is configured", () => {
		withBaseUrlEnv({
			RENDER_EXTERNAL_URL: undefined,
			APP_BASE_URL: "gartexhub.onrender.com",
			PUBLIC_APP_URL: undefined,
		});

		const link = buildCaseReportLink("case-42");

		expect(link.startsWith("http://") || link.startsWith("https://")).toBe(true);
	});
});

// The report event is the client's only signal that the report is ready. It
// used to be emitted only on the success path, so with the mail provider
// down the client waited forever for a report the server had already
// written down.
describe("the report event", () => {
	test("the event is fired with the report when the mail goes out", async () => {
		sendEmail.mockResolvedValue({ ok: true, status: "sent" });

		await deliverReport({ caseRow: CASE_ROW, report: REPORT });

		expect(emitCaseEvent).toHaveBeenCalledTimes(1);
		expect(emitCaseEvent.mock.calls[0][0]).toBe("case-42");
		expect(emitCaseEvent.mock.calls[0][1]).toBe("support.case.report");
		expect(emitCaseEvent.mock.calls[0][2].reportStatus).toBe("sent");
	});

	test("the event is fired even when the mail did not go out", async () => {
		sendEmail.mockResolvedValue({ ok: false, status: "logged_no_smtp" });

		await deliverReport({ caseRow: CASE_ROW, report: REPORT });

		expect(emitCaseEvent).toHaveBeenCalledTimes(1);
		expect(emitCaseEvent.mock.calls[0][2].reportStatus).toBe("failed");
		expect(emitCaseEvent.mock.calls[0][2].report).toContain("Support investigation report");
	});
});

// The report is built from what the investigators read in the repository, and
// the repository holds credentials. The report is redacted before it is
// emailed or pushed to the client.
describe("the redacted report", () => {
	const SECRET_REPORT = [
		"# Support investigation report",
		"",
		"Case: case-42",
		"",
		"The deployment file carries the connection string",
		"postgresql://investigator:hunter2@db.internal.example:5432/gartexhub",
		"and the signing secret",
		"JWT_SECRET=3f8a1c9e7b2d4a6f8e0c1b3d5a7f9e1c3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a",
		"",
		"## 5. Findings",
		"",
		"The payment route has no timeout.",
	].join("\n");

	test("the secret does not reach the client", async () => {
		sendEmail.mockResolvedValue({ ok: true, status: "sent" });

		await deliverReport({ caseRow: CASE_ROW, report: SECRET_REPORT });

		const emitted = String(emitCaseEvent.mock.calls[0]?.[2]?.report || "");
		expect(emitted).not.toContain("hunter2");
		expect(emitted).not.toContain(
			"3f8a1c9e7b2d4a6f8e0c1b3d5a7f9e1c3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a",
		);
		expect(emitted).toContain("The payment route has no timeout.");
	});

	test("the secret does not reach the mailbox", async () => {
		sendEmail.mockResolvedValue({ ok: true, status: "sent" });

		await deliverReport({ caseRow: CASE_ROW, report: SECRET_REPORT });

		const text = String(sendEmail.mock.calls[0][0]?.text || "");
		expect(text).not.toContain("hunter2");
	});
});
