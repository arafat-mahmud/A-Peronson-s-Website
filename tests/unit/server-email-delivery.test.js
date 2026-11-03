import { jest } from "@jest/globals";

let enabled = false;
let provider = "smtp";

// emailService resolves its config through getEmailConfig(), which calls
// getAdminConfig() and reads config.notifications.email — so the admin config
// module is the seam to stub, and it must return the nested admin shape.
jest.unstable_mockModule("../../server/services/adminConfigService.js", () => ({
	getAdminConfig: jest.fn(async () => ({
		notifications: {
			email: { enabled, provider, from_name: "GarTexHub" },
		},
	})),
}));

const emailLogCreate = jest.fn(async () => ({}));
const emailOutboxCreate = jest.fn(async () => ({}));
jest.unstable_mockModule("../../server/utils/prisma.js", () => ({
	default: {
		emailLog: { create: emailLogCreate },
		emailOutbox: { create: emailOutboxCreate },
	},
}));

const logInfo = jest.fn();
const logWarn = jest.fn();
const logError = jest.fn();
jest.unstable_mockModule("../../server/utils/logger.js", () => ({
	logDebug: jest.fn(),
	logInfo,
	logSuccess: jest.fn(),
	logWarn,
	logError,
	logCritical: jest.fn(),
	logEvent: jest.fn(),
	setLogPretty: jest.fn(),
	logger: {},
	printStartupBanner: jest.fn(),
	printStats: jest.fn(),
	getLevel: jest.fn(() => "info"),
}));

const { sendEmail } = await import("../../server/services/emailService.js");

// The provider branches key off these env vars, so they must be absent for the
// "unconfigured" branches to be reachable regardless of the developer's shell.
const PROVIDER_ENV_KEYS = [
	"SMTP_HOST",
	"SMTP_USER",
	"SMTP_PASS",
	"SMTP_PORT",
	"SMTP_SECURE",
	"SMTP_FROM",
	"GMAIL_CLIENT_ID",
	"GMAIL_CLIENT_SECRET",
	"GMAIL_REFRESH_TOKEN",
	"GMAIL_SENDER",
];

let savedEnv = {};

beforeAll(() => {
	savedEnv = Object.fromEntries(PROVIDER_ENV_KEYS.map((key) => [key, process.env[key]]));
	for (const key of PROVIDER_ENV_KEYS) {
		delete process.env[key];
	}
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
	enabled = false;
	provider = "smtp";
	logInfo.mockClear();
	logWarn.mockClear();
	logError.mockClear();
	emailLogCreate.mockClear();
	emailOutboxCreate.mockClear();
});

describe("emailService delivery status", () => {
	test("does not report success when email is disabled", async () => {
		enabled = false;
		const res = await sendEmail({ to: ["a@b.co"], subject: "s", text: "t" });
		expect(res).toEqual({ ok: false, status: "logged_disabled" });
		expect(logWarn).toHaveBeenCalledWith(
			"email_logged_disabled",
			expect.objectContaining({ to: ["a@b.co"] }),
		);
	});

	test("does not report success when smtp is unconfigured", async () => {
		enabled = true;
		provider = "smtp";
		const res = await sendEmail({ to: ["a@b.co"], subject: "s", text: "t" });
		expect(res).toEqual({ ok: false, status: "logged_no_smtp" });
		expect(logWarn).toHaveBeenCalledWith(
			"email_logged_no_smtp",
			expect.objectContaining({ to: ["a@b.co"] }),
		);
	});

	test("does not report success when the gmail provider is unconfigured", async () => {
		enabled = true;
		provider = "gmail_api";
		const res = await sendEmail({ to: ["a@b.co"], subject: "s", text: "t" });
		expect(res).toEqual({ ok: false, status: "logged_no_gmail" });
		expect(logWarn).toHaveBeenCalledWith(
			"email_logged_no_gmail",
			expect.objectContaining({ to: ["a@b.co"] }),
		);
	});

	test("does not report success for an unsupported provider", async () => {
		enabled = true;
		provider = "carrier-pigeon";
		const res = await sendEmail({ to: ["a@b.co"], subject: "s", text: "t" });
		expect(res).toEqual({ ok: false, status: "logged_unsupported" });
		expect(logWarn).toHaveBeenCalledWith(
			"email_logged_unsupported",
			expect.objectContaining({ to: ["a@b.co"] }),
		);
	});

	test("still refuses to send with no recipients", async () => {
		const res = await sendEmail({ to: [], subject: "s", text: "t" });
		expect(res).toEqual({ ok: false, status: "no_recipients" });
	});

	test("a log-only delivery never queues a real outbox message", async () => {
		enabled = false;
		await sendEmail({ to: ["a@b.co"], subject: "s", text: "t" });
		expect(emailOutboxCreate).not.toHaveBeenCalled();
		expect(emailLogCreate).toHaveBeenCalledTimes(1);
	});
});
