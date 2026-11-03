import fs from "node:fs";
import path from "node:path";
import { jest } from "@jest/globals";

// The admin config drives whether email is actually delivered. Keep it mutable so
// one module graph can produce both a log-only and a genuinely delivered outcome.
let emailEnabled = false;

jest.unstable_mockModule("../../server/services/adminConfigService.js", () => ({
	getAdminConfig: jest.fn(async () => ({
		notifications: {
			email: { enabled: emailEnabled, provider: "smtp", from_name: "GarTexHub" },
		},
	})),
	updateAdminConfig: jest.fn(async (config) => config),
	readConfig: jest.fn(async () => ({})),
	writeConfig: jest.fn(async () => ({})),
}));

const emailLogCreate = jest.fn(async () => ({}));
const emailOutboxCreate = jest.fn(async () => ({}));

// Prisma is mocked explicitly rather than relying on the NODE_ENV === "test"
// proxy in server/utils/prisma.js: jest only sets NODE_ENV when it is unset, so
// a contributor with NODE_ENV=development exported would otherwise reach a real
// PrismaClient and a database round-trip.
function prismaModelStub() {
	return {
		findMany: jest.fn(async () => []),
		findUnique: jest.fn(async () => null),
		findFirst: jest.fn(async () => null),
		count: jest.fn(async () => 0),
		create: jest.fn(async () => ({})),
		update: jest.fn(async () => ({})),
		delete: jest.fn(async () => ({})),
		upsert: jest.fn(async () => ({})),
		createMany: jest.fn(async () => ({ count: 0 })),
		deleteMany: jest.fn(async () => ({ count: 0 })),
		updateMany: jest.fn(async () => ({ count: 0 })),
		aggregate: jest.fn(async () => ({})),
		groupBy: jest.fn(async () => []),
	};
}

jest.unstable_mockModule("../../server/utils/prisma.js", () => ({
	default: new Proxy(
		{},
		{
			get: (target, prop) => {
				if (typeof prop !== "string" || prop.startsWith("_") || prop[0] === "$") {
					return target[prop];
				}
				if (prop === "emailLog") {
					return { create: emailLogCreate };
				}
				if (prop === "emailOutbox") {
					return { create: emailOutboxCreate };
				}
				if (!target[prop]) {
					target[prop] = prismaModelStub();
				}
				return target[prop];
			},
		},
	),
}));

const sendMail = jest.fn(async () => ({ messageId: "test-message-id" }));
jest.unstable_mockModule("nodemailer", () => ({
	createTransport: jest.fn(() => ({ sendMail })),
	default: { createTransport: jest.fn(() => ({ sendMail })) },
}));

jest.unstable_mockModule("../../server/utils/logger.js", () => ({
	logDebug: jest.fn(),
	logInfo: jest.fn(),
	logSuccess: jest.fn(),
	logWarn: jest.fn(),
	logError: jest.fn(),
	logCritical: jest.fn(),
	logEvent: jest.fn(),
	setLogPretty: jest.fn(),
	logger: {},
	printStartupBanner: jest.fn(),
	printStats: jest.fn(),
	getLevel: jest.fn(() => "info"),
}));

const { adminAction } = await import("../../server/controllers/adminMasterController.js");
const { describeEmailTestOutcome, readEmailDeliveryResult } = await import(
	"../../src/pages/AdminPanel.helpers.js"
);

const PROVIDER_ENV_KEYS = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "SMTP_PORT"];
let savedEnv = {};

/**
 * Runs the real email.test_send admin action and returns the HTTP body the
 * browser would receive, so the frontend never has to guess the envelope shape.
 * @returns {Promise<Object>} The parsed /admin/actions response body.
 */
async function runEmailTestSend() {
	const res = { json: jest.fn(), status: jest.fn(() => res) };
	await adminAction(
		{
			body: { action: "email.test_send", payload: { to: "a@b.co" } },
			user: { id: "u1", role: "owner" },
		},
		res,
	);
	return res.json.mock.calls[0]?.[0];
}

beforeAll(() => {
	savedEnv = Object.fromEntries(PROVIDER_ENV_KEYS.map((key) => [key, process.env[key]]));
});

afterAll(() => {
	for (const key of PROVIDER_ENV_KEYS) {
		if (savedEnv[key] === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = savedEnv[key];
		}
	}
});

beforeEach(() => {
	emailEnabled = false;
	sendMail.mockClear();
	emailLogCreate.mockClear();
	emailOutboxCreate.mockClear();
	for (const key of PROVIDER_ENV_KEYS) {
		delete process.env[key];
	}
});

describe("email.test_send response envelope (server)", () => {
	test("a log-only delivery reports ok:false at response.result.result", async () => {
		const body = await runEmailTestSend();

		expect(body.ok).toBe(true);
		expect(body.result.ok).toBe(true);
		expect(body.result.result).toEqual({ ok: false, status: "logged_disabled" });
		expect(sendMail).not.toHaveBeenCalled();
	});

	test("a log-only delivery never queues a real outbox message", async () => {
		await runEmailTestSend();

		expect(emailOutboxCreate).not.toHaveBeenCalled();
		expect(emailLogCreate).toHaveBeenCalledTimes(1);
	});

	test("a real delivery reports ok:true at response.result.result", async () => {
		emailEnabled = true;
		process.env.SMTP_HOST = "smtp.example.test";
		process.env.SMTP_USER = "mailer@example.test";

		const body = await runEmailTestSend();

		expect(body.result.result).toEqual({ ok: true, status: "sent" });
		expect(sendMail).toHaveBeenCalledTimes(1);
		expect(emailOutboxCreate).toHaveBeenCalledTimes(1);
	});
});

describe("describeEmailTestOutcome (src/pages/AdminPanel.helpers.js)", () => {
	test("a log-only delivery is never reported as sent", async () => {
		const body = await runEmailTestSend();
		const outcome = describeEmailTestOutcome(body);

		expect(outcome.delivered).toBe(false);
		expect(outcome.status).toBe("logged_disabled");
		expect(outcome.notice).toBe("");
		expect(outcome.error).toContain("not delivered");
		expect(outcome.error).toContain("logged_disabled");
		expect(outcome.error).not.toMatch(/test email sent/i);
	});

	test("a real delivery still reads as sent", async () => {
		emailEnabled = true;
		process.env.SMTP_HOST = "smtp.example.test";
		process.env.SMTP_USER = "mailer@example.test";

		const body = await runEmailTestSend();
		const outcome = describeEmailTestOutcome(body);

		expect(outcome.delivered).toBe(true);
		expect(outcome.status).toBe("sent");
		expect(outcome.error).toBe("");
		expect(outcome.notice).toMatch(/test email sent/i);
	});

	test("every log-only status is reported as not delivered", () => {
		for (const status of [
			"logged_disabled",
			"logged_no_smtp",
			"logged_no_gmail",
			"logged_unsupported",
		]) {
			const body = { ok: true, result: { ok: true, result: { ok: false, status } } };
			const outcome = describeEmailTestOutcome(body);

			expect(outcome.delivered).toBe(false);
			expect(outcome.status).toBe(status);
			expect(outcome.notice).toBe("");
			expect(outcome.error).toContain(status);
			expect(outcome.error).not.toMatch(/test email sent/i);
		}
	});

	test("an unknown outcome fails safe instead of claiming a send", () => {
		for (const body of [undefined, null, {}, { ok: true }, { ok: true, result: { ok: true } }]) {
			const outcome = describeEmailTestOutcome(body);

			expect(outcome.delivered).toBe(false);
			expect(outcome.status).toBe("unknown");
			expect(outcome.notice).toBe("");
			expect(outcome.error).not.toMatch(/test email sent/i);
		}
	});

	test("the admin action envelope is not mistaken for a delivery result", () => {
		// response.result is { ok, result } — it has no delivery status, so it must
		// never be read as one.
		expect(readEmailDeliveryResult({ ok: true, result: { ok: true } })).toBeNull();
		expect(
			readEmailDeliveryResult({
				ok: true,
				result: { ok: true, result: { ok: true, status: "sent" } },
			}),
		).toEqual({
			ok: true,
			status: "sent",
		});
	});

	// The envelope grew a `status` on the outer object. Reading that as a
	// delivery result would tell the operator a mail went out when the action
	// envelope knows nothing about mail.
	test("a status on the outer envelope is not a delivery result", () => {
		expect(readEmailDeliveryResult({ ok: true, status: "sent" })).toBeNull();
		expect(readEmailDeliveryResult({ ok: true, result: { ok: true, status: "sent" } })).toBeNull();
	});

	// A flattened body is accepted only when it is explicitly flagged, so that
	// no shape of the envelope can be read as one by accident.
	test("a flattened body is accepted only when it is explicitly flagged", () => {
		expect(readEmailDeliveryResult({ ok: true, status: "sent" })).toBeNull();
		expect(readEmailDeliveryResult({ delivery: { ok: true, status: "sent" } })).toEqual({
			ok: true,
			status: "sent",
		});
	});
});

// --- AdminPanel.jsx wiring guard -------------------------------------------
//
// The component must route its test-email message through the shared outcome
// helper. A source-level guard is the only cheap way to hold that line (a
// render test of this 3,900-line panel is disproportionate), so the guard has
// to be quote-agnostic: biome enforces double quotes, so a regression written
// as "Test email sent (queued)." has to be caught just as surely as one
// written as `Test email sent (${status}).`.

/**
 * Matches a hardcoded claim that the test email was sent, in any quoting
 * style. The match is confined to a single statement (`[^;\n]*`) so unrelated
 * code cannot make it fire.
 */
const SENT_CLAIM_PATTERN = /test\s+email[^;\n]*\bsent\b/i;

/**
 * Checks that the admin panel routes its test-email message through the shared
 * outcome helper instead of hardcoding a "sent" claim of its own.
 * @param {string} source The AdminPanel.jsx source text.
 * @returns {string[]} The problems found; empty when the wiring is correct.
 */
function findEmailTestNoticeWiringProblems(source) {
	const text = typeof source === "string" ? source : "";
	const problems = [];

	if (SENT_CLAIM_PATTERN.test(text)) {
		problems.push("AdminPanel.jsx hardcodes a 'test email ... sent' claim");
	}
	if (!/describeEmailTestOutcome\s*\(/.test(text)) {
		problems.push("AdminPanel.jsx never calls describeEmailTestOutcome");
	}
	if (!/setEmailConfigNotice\(\s*outcome\.notice\s*\)/.test(text)) {
		problems.push("AdminPanel.jsx does not set the notice from outcome.notice");
	}
	if (!/setEmailConfigError\(\s*outcome\.error\s*\)/.test(text)) {
		problems.push("AdminPanel.jsx does not set the error from outcome.error");
	}

	return problems;
}

/**
 * Builds a synthetic AdminPanel.jsx source around one test-send body.
 * @param {string} body The body of the try block.
 * @returns {string} The synthetic source.
 */
function syntheticSource(body) {
	return [
		"export default function AdminPanel() {",
		"\tasync function sendEmailTest() {",
		"\t\ttry {",
		'\t\t\tconst result = await apiRequest("/admin/actions");',
		body,
		"\t\t} catch (err) {",
		'\t\t\tsetEmailConfigError(err.message || "Unable to send test email.");',
		"\t\t}",
		"\t}",
		"}",
	].join("\n");
}

const CORRECT_BODY = [
	"\t\t\tconst outcome = describeEmailTestOutcome(result);",
	"\t\t\tsetEmailConfigNotice(outcome.notice);",
	"\t\t\tsetEmailConfigError(outcome.error);",
].join("\n");

describe("AdminPanel.jsx wiring guard", () => {
	const source = fs.readFileSync(
		path.join(process.cwd(), "src", "pages", "AdminPanel.jsx"),
		"utf8",
	);

	test("the real AdminPanel.jsx has no wiring problems", () => {
		expect(findEmailTestNoticeWiringProblems(source)).toEqual([]);
	});

	test("the correct wiring is accepted", () => {
		expect(findEmailTestNoticeWiringProblems(syntheticSource(CORRECT_BODY))).toEqual([]);
	});

	test("a hardcoded sent claim is rejected in every quoting style", () => {
		const mutants = [
			{
				name: "backtick template literal",
				line: "setEmailConfigNotice(`Test email sent (${status}).`);",
			},
			{ name: "double-quoted string", line: 'setEmailConfigNotice("Test email sent (queued).");' },
			{ name: "single-quoted string", line: "setEmailConfigNotice('Test email sent (queued).');" },
			{
				name: "template literal without interpolation",
				line: "setEmailConfigNotice(`Test email sent (queued).`);",
			},
			{
				name: "double-quoted 'was sent' phrasing",
				line: 'setEmailConfigNotice("Test email was sent.");',
			},
			{
				name: "double-quoted 'successfully sent' phrasing",
				line: 'setEmailConfigNotice("Test email successfully sent.");',
			},
		];

		for (const mutant of mutants) {
			const problems = findEmailTestNoticeWiringProblems(syntheticSource(mutant.line));
			expect({ name: mutant.name, problems: problems.length > 0 }).toEqual({
				name: mutant.name,
				problems: true,
			});
		}
	});

	test("a dead helper call with a discarded result is rejected", () => {
		const problems = findEmailTestNoticeWiringProblems(
			syntheticSource("\t\t\tdescribeEmailTestOutcome(result);"),
		);
		expect(problems.length).toBeGreaterThan(0);
	});

	test("a component that stops using the helper is rejected", () => {
		const problems = findEmailTestNoticeWiringProblems(
			syntheticSource('\t\t\tsetEmailConfigNotice("queued");'),
		);
		expect(problems.length).toBeGreaterThan(0);
	});
});
