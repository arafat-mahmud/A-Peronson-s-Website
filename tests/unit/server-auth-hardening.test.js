import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { jest } from "@jest/globals";

function mockRes() {
	const res = { statusCode: 200, body: null };
	res.status = (code) => {
		res.statusCode = code;
		return res;
	};
	res.json = (body) => {
		res.body = body;
		return res;
	};
	return res;
}

describe("register orphan recovery (server/controllers/authController.js)", () => {
	const existing = {
		id: "u-orphan",
		email: "owner@co.example",
		role: "factory",
		password_hash: "x",
	};
	let verifyPassword;
	let register;

	beforeEach(async () => {
		jest.resetModules();
		process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-unit-tests-only-000000";
		verifyPassword = jest.fn(async () => false);
		jest.unstable_mockModule("../../server/services/userService.js", () => ({
			findUserByEmail: async () => existing,
			findUserById: async () => existing,
			findUserByMemberId: async () => null,
			registerUser: async () => {
				throw new Error("must not create a second account");
			},
			verifyPassword,
		}));
		jest.unstable_mockModule("../../server/services/subscriptionService.js", () => ({
			upsertSubscription: async () => ({}),
		}));
		jest.unstable_mockModule("../../server/services/walletService.js", () => ({
			assertCouponRedeemable: async () => true,
			creditWallet: async () => ({}),
		}));
		jest.unstable_mockModule("../../server/services/entitlementService.js", () => ({
			getEntitlements: async () => ({}),
		}));
		({ register } = await import("../../server/controllers/authController.js"));
	});

	const body = (password) => ({
		name: "Mallory",
		email: existing.email,
		password,
		role: "buyer",
		company_name: "M",
		profile: { country: "Bangladesh", position: "Owner" },
	});

	test("someone who only knows the email gets 409, not the account's token", async () => {
		const res = mockRes();
		await register({ body: body("wrong-password-1") }, res);
		expect(verifyPassword).toHaveBeenCalled();
		expect(res.statusCode).toBe(409);
		expect(res.body.token).toBeUndefined();
	});

	test("the account owner (correct password) can still resume an orphaned signup", async () => {
		verifyPassword.mockImplementation(async () => true);
		const res = mockRes();
		await register({ body: body("right-password-1") }, res);
		expect(res.statusCode).toBe(200);
		expect(res.body.recovered).toBe(true);
		expect(typeof res.body.token).toBe("string");
	});

	test("weak passwords are rejected by the API, not only by the form", async () => {
		const res = mockRes();
		await register({ body: { ...body("short1"), email: "new@co.example" } }, res);
		expect(res.statusCode).toBe(400);
		expect(res.body.error).toMatch(/at least 8 characters/);
	});

	test("invalid company facts are rejected before any account work", async () => {
		const res = mockRes();
		await register(
			{
				body: {
					...body("valid-pass-1"),
					email: "new@co.example",
					profile: { country: "BD", position: "Owner", employee_count: -2 },
				},
			},
			res,
		);
		expect(res.statusCode).toBe(400);
		expect(res.body.fields.employee_count).toBeTruthy();
	});
});

describe("API error handler (server/middleware/errorHandler.js)", () => {
	test("expected 4xx errors keep their status and message; others become a generic 500", async () => {
		const { errorHandler } = await import("../../server/middleware/errorHandler.js");
		const conflict = Object.assign(new Error("Email already used"), { status: 409, code: "DUP" });
		let res = mockRes();
		errorHandler(conflict, { path: "/x" }, res, () => {});
		expect(res.statusCode).toBe(409);
		expect(res.body).toEqual({ error: "Email already used", code: "DUP" });

		res = mockRes();
		errorHandler({ type: "entity.parse.failed" }, { path: "/x" }, res, () => {});
		expect(res.statusCode).toBe(400);

		res = mockRes();
		errorHandler(new Error("db exploded: password=hunter2"), { path: "/x" }, res, () => {});
		expect(res.statusCode).toBe(500);
		expect(res.body).toEqual({ error: "Internal server error" });
	});
});

describe("crash reporter (server/utils/crashReporter.js)", () => {
	let dir;
	let crash;

	beforeEach(async () => {
		jest.resetModules();
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "gtx-crash-"));
		process.env.CRASH_LOG_DIR = dir;
		process.env.CRASH_LOG_MAX_SIZE_MB = "0.001";
		process.env.CRASH_LOG_MAX_FILES = "2";
		const realWriteSync = fs.writeSync;
		jest
			.spyOn(fs, "writeSync")
			.mockImplementation((fd, ...rest) => (fd === 2 ? 0 : realWriteSync(fd, ...rest)));
		crash = await import("../../server/utils/crashReporter.js");
	});

	afterEach(() => {
		jest.restoreAllMocks();
		delete process.env.CRASH_LOG_DIR;
		delete process.env.CRASH_LOG_MAX_SIZE_MB;
		delete process.env.CRASH_LOG_MAX_FILES;
		delete process.env.TEST_FAKE_SECRET;
		fs.rmSync(dir, { recursive: true, force: true });
	});

	test("a crash record is diagnostic and secret-free", () => {
		process.env.TEST_FAKE_SECRET = "s3cr3t-value-123";
		const err = new Error(
			"boom postgresql://user:pw@db.example:5432/x Bearer abc.def token=s3cr3t-value-123",
		);
		const record = crash.buildCrashRecord({ type: "uncaughtException", error: err, exitCode: 1 });
		const text = JSON.stringify(record);
		expect(record).toMatchObject({
			type: "uncaughtException",
			fatal: true,
			exit_code: 1,
			pid: process.pid,
		});
		expect(record.memory.rss_mb).toBeGreaterThan(0);
		expect(text).not.toContain("s3cr3t-value-123");
		expect(text).not.toContain("user:pw@");
		expect(text).toContain("[REDACTED]");
	});

	test("records are written synchronously, once per error, and rotated", () => {
		for (let i = 0; i < 6; i += 1) {
			crash.writeCrashSync(
				crash.buildCrashRecord({ type: "test", error: new Error(`e${i} ${"x".repeat(400)}`) }),
			);
		}
		const files = fs.readdirSync(dir);
		expect(files).toContain("crash-history.jsonl");
		expect(files.some((name) => /^crash-\d{4}-\d{2}-\d{2}\.log$/.test(name))).toBe(true);
		// rotation keeps at most CRASH_LOG_MAX_FILES rotated copies per kind
		expect(files.filter((name) => name.startsWith("crash-history.")).length).toBeLessThanOrEqual(2);
		expect(fs.writeSync).toHaveBeenCalledWith(2, expect.stringContaining('"event":"crash"'));
	});

	test("an unwritable log directory degrades to stderr instead of throwing", () => {
		process.env.CRASH_LOG_DIR = path.join(dir, "file-not-dir");
		fs.writeFileSync(process.env.CRASH_LOG_DIR, "");
		const result = crash.writeCrashSync(
			crash.buildCrashRecord({ type: "test", error: new Error("x") }),
		);
		expect(result.file).toBeNull();
	});
});
