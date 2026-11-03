import crypto from "node:crypto";
import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";

// In-memory stand-ins for the two new tables and the user table.
function makeStore() {
	const db = { tokens: [], sessions: [], users: new Map(), emails: [] };
	const matches = (row, where = {}) =>
		Object.entries(where).every(([key, value]) => {
			if (key === "NOT") return !matches(row, value);
			if (value && typeof value === "object" && "gt" in value) return row[key] > value.gt;
			return row[key] === value;
		});
	const table = (rows) => ({
		// Nullable columns default to null, as in PostgreSQL.
		create: async ({ data }) => {
			const row = { used_at: null, revoked_at: null, ...data };
			rows.push(row);
			return row;
		},
		findFirst: async ({ where }) => rows.find((r) => matches(r, where)) || null,
		findUnique: async ({ where }) => rows.find((r) => matches(r, where)) || null,
		findMany: async ({ where }) => rows.filter((r) => matches(r, where)),
		update: async ({ where, data }) =>
			Object.assign(
				rows.find((r) => matches(r, where)),
				data,
			),
		updateMany: async ({ where, data }) => {
			const hit = rows.filter((r) => matches(r, where));
			for (const r of hit) Object.assign(r, data);
			return { count: hit.length };
		},
	});
	const prisma = {
		passwordResetToken: table(db.tokens),
		userSession: table(db.sessions),
		user: {
			update: async ({ where, data }) => Object.assign(db.users.get(where.id), data),
		},
	};
	return { db, prisma };
}

describe("password reset (server/services/passwordResetService.js)", () => {
	let store;
	let service;
	const user = { id: "u-1", email: "owner@co.example", status: "active", password_hash: "old" };

	beforeEach(async () => {
		jest.resetModules();
		store = makeStore();
		store.db.users.set(user.id, { ...user });
		jest.unstable_mockModule("../../server/utils/prisma.js", () => ({ default: store.prisma }));
		jest.unstable_mockModule("../../server/services/userService.js", () => ({
			findUserByEmail: async (email) => (email === user.email ? store.db.users.get(user.id) : null),
			findUserById: async (id) => store.db.users.get(id) || null,
		}));
		jest.unstable_mockModule("../../server/services/emailService.js", () => ({
			sendEmail: async (message) => {
				store.db.emails.push(message);
				return { ok: true };
			},
		}));
		service = await import("../../server/services/passwordResetService.js");
	});

	test("unknown emails create nothing and send nothing (no enumeration signal)", async () => {
		await service.requestPasswordReset("nobody@co.example");
		expect(store.db.tokens).toHaveLength(0);
		expect(store.db.emails).toHaveLength(0);
	});

	test("a request stores only the token hash, emails the link, and is rate limited", async () => {
		await service.requestPasswordReset(user.email);
		await service.requestPasswordReset(user.email);
		expect(store.db.tokens).toHaveLength(1);
		expect(store.db.emails).toHaveLength(1);
		const link = store.db.emails[0].text.match(/https?:\/\/\S+/)[0];
		const raw = new URL(link).searchParams.get("token");
		expect(store.db.tokens[0].token_hash).toBe(
			crypto.createHash("sha256").update(raw).digest("hex"),
		);
		expect(store.db.tokens[0].token_hash).not.toBe(raw);
		expect(store.db.emails[0].source).toBe("password_reset");
	});

	test("a link works once, revokes sessions, and expired links are refused", async () => {
		await service.requestPasswordReset(user.email);
		const raw = new URL(store.db.emails[0].text.match(/https?:\/\/\S+/)[0]).searchParams.get(
			"token",
		);
		store.db.sessions.push({ id: "s-1", user_id: user.id, revoked_at: null });

		await expect(service.resetPassword(raw, "short")).rejects.toMatchObject({ status: 400 });
		await expect(service.resetPassword(raw, "New-pass-2026")).resolves.toEqual({ userId: user.id });
		expect(store.db.users.get(user.id).password_hash).not.toBe("old");
		expect(store.db.sessions[0].revoked_at).toBeInstanceOf(Date);
		await expect(service.resetPassword(raw, "Another-pass-2026")).rejects.toMatchObject({
			code: "RESET_LINK_INVALID",
		});

		store.db.tokens.push({
			id: "t-old",
			user_id: user.id,
			token_hash: crypto.createHash("sha256").update("expired-token").digest("hex"),
			expires_at: new Date(Date.now() - 1000),
			used_at: null,
		});
		await expect(service.resetPassword("expired-token", "New-pass-2026")).rejects.toMatchObject({
			code: "RESET_LINK_INVALID",
		});
	});
});

describe("session tokens (server/middleware/auth.js + sessionService.js)", () => {
	test("login durations are whitelisted; every token expires", async () => {
		jest.resetModules();
		const { normalizeSessionDuration } = await import("../../server/services/sessionService.js");
		expect(normalizeSessionDuration("7d")).toBe("7d");
		expect(normalizeSessionDuration("100y")).toBe("12h");
		expect(normalizeSessionDuration(null)).toBe("12h");

		const { signToken } = await import("../../server/middleware/auth.js");
		for (const duration of ["7d", "30d", "anything", undefined]) {
			const claims = jwt.decode(
				signToken({ id: "u-1", role: "buyer" }, { expiresIn: duration, sessionId: "s-9" }),
			);
			expect(claims.exp).toBeGreaterThan(claims.iat);
			expect(claims.exp - claims.iat).toBeLessThanOrEqual(30 * 24 * 60 * 60);
			expect(claims.sid).toBe("s-9");
		}
	});

	test("user-agent labels are readable", async () => {
		const { describeUserAgent } = await import("../../server/services/sessionService.js");
		expect(describeUserAgent("Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile")).toBe(
			"Chrome on Android",
		);
		expect(describeUserAgent("Mozilla/5.0 (Macintosh; Mac OS X 14) Safari/605.1")).toBe(
			"Safari on macOS",
		);
	});
});

describe("signed-in password change (passwordResetService.changePassword)", () => {
	test("needs the current password, enforces the policy, keeps only the caller's session", async () => {
		jest.resetModules();
		const store = makeStore();
		const bcrypt = (await import("bcryptjs")).default;
		store.db.users.set("u-1", {
			id: "u-1",
			email: "a@co.example",
			password_hash: await bcrypt.hash("Old-pass-2026", 4),
		});
		store.db.sessions.push(
			{ id: "s-me", user_id: "u-1", revoked_at: null },
			{ id: "s-other", user_id: "u-1", revoked_at: null },
		);
		jest.unstable_mockModule("../../server/utils/prisma.js", () => ({ default: store.prisma }));
		jest.unstable_mockModule("../../server/services/userService.js", () => ({
			findUserByEmail: async () => null,
			findUserById: async (id) => store.db.users.get(id) || null,
		}));
		jest.unstable_mockModule("../../server/services/emailService.js", () => ({
			sendEmail: async () => ({ ok: true }),
		}));
		const { changePassword } = await import("../../server/services/passwordResetService.js");

		await expect(changePassword("u-1", "wrong", "New-pass-2026")).rejects.toMatchObject({
			code: "CURRENT_PASSWORD_INCORRECT",
		});
		await expect(changePassword("u-1", "Old-pass-2026", "short")).rejects.toMatchObject({
			status: 400,
		});
		await expect(
			changePassword("u-1", "Old-pass-2026", "New-pass-2026", { keepSessionId: "s-me" }),
		).resolves.toEqual({ revokedSessions: 1 });
		expect(await bcrypt.compare("New-pass-2026", store.db.users.get("u-1").password_hash)).toBe(
			true,
		);
		expect(store.db.sessions.find((s) => s.id === "s-me").revoked_at).toBeNull();
		expect(store.db.sessions.find((s) => s.id === "s-other").revoked_at).toBeInstanceOf(Date);
	});
});
