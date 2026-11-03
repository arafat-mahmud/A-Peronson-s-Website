// Production stability and speed (2026-11-04): the API was OOM-killed every
// few minutes on Render Free, a slow database logged valid users out
// ("Invalid token"), and every request paid ~250 ms per database round trip.
import { jest } from "@jest/globals";

function mockRes() {
	const res = { headers: {} };
	res.status = jest.fn(() => res);
	res.json = jest.fn(() => res);
	res.set = jest.fn((name, value) => {
		res.headers[name] = value;
		return res;
	});
	return res;
}

describe("memory guard for child processes (server/utils/memoryBudget.js)", () => {
	let canAffordChildProcess;
	beforeAll(async () => {
		({ canAffordChildProcess } = await import("../../server/utils/memoryBudget.js"));
	});
	const MB = 1024 * 1024;

	test("refuses a 450 MB child on a 512 MiB container that already uses 200 MB", () => {
		const verdict = canAffordChildProcess(450, { memory: { limit: 512 * MB, usage: 200 * MB } });
		expect(verdict).toMatchObject({ ok: false, reason: "insufficient_memory", freeMb: 312 });
	});

	test("allows it on a 2 GiB instance", () => {
		const verdict = canAffordChildProcess(450, { memory: { limit: 2048 * MB, usage: 200 * MB } });
		expect(verdict.ok).toBe(true);
	});

	test("allows it where no container limit is visible (local development)", () => {
		expect(canAffordChildProcess(450, { memory: { limit: null, usage: null } }).ok).toBe(true);
	});

	test("MEMORY_GUARD=off disables the check", () => {
		process.env.MEMORY_GUARD = "off";
		try {
			const verdict = canAffordChildProcess(450, { memory: { limit: 512 * MB, usage: 500 * MB } });
			expect(verdict.ok).toBe(true);
		} finally {
			delete process.env.MEMORY_GUARD;
		}
	});
});

describe("auth lookup cache (server/utils/authCache.js)", () => {
	let cache;
	beforeEach(async () => {
		jest.resetModules();
		process.env.AUTH_CACHE_TTL_MS = "30000";
		cache = await import("../../server/utils/authCache.js");
	});
	afterEach(() => {
		delete process.env.AUTH_CACHE_TTL_MS;
	});

	test("a second lookup is served from memory, concurrent misses share one query", async () => {
		const load = jest.fn(async () => ({ id: "u1", role: "buyer" }));
		const [a, b] = await Promise.all([cache.cachedUser("u1", load), cache.cachedUser("u1", load)]);
		await cache.cachedUser("u1", load);
		expect(load).toHaveBeenCalledTimes(1);
		expect(a).toEqual({ id: "u1", role: "buyer" });
		expect(b).toEqual(a);
	});

	test("a write clears the entry, so the next request sees the change", async () => {
		const load = jest
			.fn()
			.mockResolvedValueOnce({ id: "u1", status: "active" })
			.mockResolvedValueOnce({ id: "u1", status: "locked" });
		await cache.cachedUser("u1", load);
		cache.invalidateUser("u1");
		expect(await cache.cachedUser("u1", load)).toEqual({ id: "u1", status: "locked" });
	});

	test("a read that started before a write does not put the old row back", async () => {
		let release;
		const slow = jest.fn(
			() =>
				new Promise((resolve) => {
					release = () => resolve({ id: "u1", role: "buyer" });
				}),
		);
		const pending = cache.cachedUser("u1", slow);
		await Promise.resolve();
		cache.invalidateUser("u1"); // the write lands while the read is in flight
		release();
		await pending;
		const fresh = jest.fn(async () => ({ id: "u1", role: "admin" }));
		expect(await cache.cachedUser("u1", fresh)).toEqual({ id: "u1", role: "admin" });
		expect(fresh).toHaveBeenCalledTimes(1);
	});

	test("callers get copies: editing one does not change the cache", async () => {
		const load = jest.fn(async () => ({ id: "u1", profile: { name: "A" } }));
		const first = await cache.cachedUser("u1", load);
		first.profile.name = "changed";
		expect((await cache.cachedUser("u1", load)).profile.name).toBe("A");
	});

	test("a missing row is not cached", async () => {
		const load = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "u2" });
		expect(await cache.cachedSession("s1", load)).toBeNull();
		expect(await cache.cachedSession("s1", load)).toEqual({ id: "u2" });
	});
});

describe("requireAuth separates a bad token from an unavailable database", () => {
	const mockFindUserById = jest.fn();
	let auth;
	beforeEach(async () => {
		jest.resetModules();
		mockFindUserById.mockReset();
		jest.unstable_mockModule("../../server/services/userService.js", () => ({
			findUserById: (...args) => mockFindUserById(...args),
		}));
		auth = await import("../../server/middleware/auth.js");
	});

	test("a database timeout is 503 AUTH_BACKEND_UNAVAILABLE, never 401", async () => {
		const timeout = Object.assign(new Error("Timed out fetching a new connection"), {
			code: "P2024",
			name: "PrismaClientKnownRequestError",
		});
		mockFindUserById.mockRejectedValue(timeout);
		const token = auth.signToken({ id: "u-1", role: "buyer", email: "b@x.com" });
		const res = mockRes();
		const next = jest.fn();
		await auth.requireAuth({ headers: { authorization: `Bearer ${token}` } }, res, next);
		expect(next).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(503);
		expect(res.json.mock.calls[0][0].code).toBe("AUTH_BACKEND_UNAVAILABLE");
		expect(res.headers["Retry-After"]).toBe("3");
	});

	test("a forged token is still 401 INVALID_TOKEN", async () => {
		const res = mockRes();
		await auth.requireAuth({ headers: { authorization: "Bearer not.a.jwt" } }, res, jest.fn());
		expect(res.status).toHaveBeenCalledWith(401);
		expect(res.json.mock.calls[0][0].code).toBe("INVALID_TOKEN");
	});

	test("the authenticated row is handed to the handler as req.authUser", async () => {
		mockFindUserById.mockResolvedValue({ id: "u-1", status: "active", role: "buyer" });
		const token = auth.signToken({ id: "u-1", role: "buyer", email: "b@x.com" });
		const req = { headers: { authorization: `Bearer ${token}` }, method: "GET", path: "/x" };
		const next = jest.fn();
		await auth.requireAuth(req, mockRes(), next);
		expect(next).toHaveBeenCalled();
		expect(req.authUser).toMatchObject({ id: "u-1", role: "buyer" });
	});
});

describe("error handler: database outages are retryable 503s", () => {
	let errorHandler;
	beforeAll(async () => {
		({ errorHandler } = await import("../../server/middleware/errorHandler.js"));
	});

	test.each(["P1001", "P1017", "P2024"])("%s -> 503 DATABASE_UNAVAILABLE", (code) => {
		const res = mockRes();
		res.headersSent = false;
		const err = Object.assign(
			new Error("Invalid `prisma.x.findMany()` invocation:\n\nCan't reach"),
			{
				code,
			},
		);
		errorHandler(err, { path: "/api/feed", method: "GET" }, res, jest.fn());
		expect(res.status).toHaveBeenCalledWith(503);
		expect(res.json.mock.calls[0][0].code).toBe("DATABASE_UNAVAILABLE");
	});

	test("a real bug is still a 500", () => {
		const res = mockRes();
		errorHandler(new TypeError("x is undefined"), { path: "/api/feed" }, res, jest.fn());
		expect(res.status).toHaveBeenCalledWith(500);
	});
});

describe("database pool settings (databaseUrlWithPool)", () => {
	let databaseUrlWithPool;
	beforeAll(async () => {
		({ databaseUrlWithPool } = await import("../../server/utils/prisma.js"));
	});
	const url = "postgresql://u:p@db.example:5432/app?sslmode=require&connection_limit=3";

	test("DATABASE_CONNECTION_LIMIT overrides the URL's connection_limit", () => {
		const out = new URL(databaseUrlWithPool(url, { DATABASE_CONNECTION_LIMIT: "8" }));
		expect(out.searchParams.get("connection_limit")).toBe("8");
		expect(out.searchParams.get("sslmode")).toBe("require");
		expect(out.password).toBe("p");
	});

	test("without overrides the URL is returned unchanged", () => {
		expect(databaseUrlWithPool(url, {})).toBe(url);
	});
});

describe("app_state read cache (server/utils/appStateCache.js)", () => {
	let c;
	beforeEach(async () => {
		jest.resetModules();
		c = await import("../../server/utils/appStateCache.js");
	});

	test("hit returns a copy; a write invalidates", () => {
		const started = c.appStateGeneration();
		c.setCachedAppState("admin_config.json", { feed_page: { a: 1 } }, started);
		const hit = c.getCachedAppState("admin_config.json");
		hit.feed_page.a = 2;
		expect(c.getCachedAppState("admin_config.json")).toEqual({ feed_page: { a: 1 } });
		c.invalidateAppState("admin_config.json");
		expect(c.getCachedAppState("admin_config.json")).toBeUndefined();
	});

	test("a read that raced a write is not cached", () => {
		const started = c.appStateGeneration();
		c.invalidateAppState("k");
		c.setCachedAppState("k", { old: true }, started);
		expect(c.getCachedAppState("k")).toBeUndefined();
	});
});

describe("CORS policy (server/utils/corsPolicy.js)", () => {
	let corsOptions;
	const previousEnv = process.env.NODE_ENV;
	beforeAll(async () => {
		({ corsOptions } = await import("../../server/utils/corsPolicy.js"));
	});
	afterEach(() => {
		process.env.NODE_ENV = previousEnv;
		delete process.env.CORS_ALLOWED_ORIGINS;
	});
	const decide = (origin, host) =>
		new Promise((resolve, reject) =>
			corsOptions({ headers: { origin, host } }, (err, options) =>
				err ? reject(err) : resolve(options.origin),
			),
		);

	test("production allows the page's own origin on any host name (no 500 for its JS/CSS)", async () => {
		process.env.NODE_ENV = "production";
		await expect(decide("https://www.gartexhub.example", "www.gartexhub.example")).resolves.toBe(
			true,
		);
	});

	test("production refuses a foreign origin without throwing", async () => {
		process.env.NODE_ENV = "production";
		await expect(decide("https://evil.example", "gartexhub.onrender.com")).resolves.toBe(false);
	});

	test("CORS_ALLOWED_ORIGINS adds origins", async () => {
		process.env.NODE_ENV = "production";
		process.env.CORS_ALLOWED_ORIGINS = "https://partner.example/";
		await expect(decide("https://partner.example", "gartexhub.onrender.com")).resolves.toBe(true);
	});
});

describe("write-behind batches (server/utils/batchWriter.js) - analytics events", () => {
	let createBatchWriter;
	beforeAll(async () => {
		({ createBatchWriter } = await import("../../server/utils/batchWriter.js"));
	});

	test("five events in a burst become one write, not five round trips", async () => {
		const write = jest.fn(async () => {});
		const writer = createBatchWriter({ write, intervalMs: 10_000 });
		for (let i = 0; i < 5; i++) writer.add({ id: i });
		expect(write).not.toHaveBeenCalled();
		await writer.flush();
		expect(write).toHaveBeenCalledTimes(1);
		expect(write.mock.calls[0][0]).toHaveLength(5);
	});

	test("a full batch is written without waiting for the timer", async () => {
		const write = jest.fn(async () => {});
		const writer = createBatchWriter({ write, intervalMs: 10_000, batchSize: 3 });
		for (let i = 0; i < 3; i++) writer.add({ id: i });
		await writer.flush();
		expect(write.mock.calls[0][0]).toHaveLength(3);
	});

	test("a failed batch is kept and written on the next flush", async () => {
		const write = jest.fn().mockRejectedValueOnce(new Error("db down")).mockResolvedValue();
		const onError = jest.fn();
		const writer = createBatchWriter({ write, onError, intervalMs: 10_000, retryDelayMs: 10_000 });
		writer.add({ id: 1 });
		await writer.flush();
		expect(onError).toHaveBeenCalled();
		expect(writer.size()).toBe(1);
		await writer.flush();
		expect(write).toHaveBeenCalledTimes(2);
		expect(writer.size()).toBe(0);
	});
});

describe("a locked account can still unlock itself (router mounted at /api/users)", () => {
	const mockFindUserById = jest.fn();
	let app;
	let token;
	beforeAll(async () => {
		jest.resetModules();
		mockFindUserById.mockResolvedValue({ id: "u-9", status: "locked", role: "buyer" });
		jest.unstable_mockModule("../../server/services/userService.js", () => ({
			findUserById: (...args) => mockFindUserById(...args),
		}));
		const { default: express } = await import("express");
		const auth = await import("../../server/middleware/auth.js");
		token = auth.signToken({ id: "u-9", role: "buyer", email: "l@x.com" });
		const router = express.Router();
		router.delete("/me/lock", auth.requireAuth, (_req, res) => res.json({ unlocked: true }));
		router.get("/me", auth.requireAuth, (_req, res) => res.json({ ok: true }));
		app = express();
		app.use("/api/users", router);
	});

	test("DELETE /api/users/me/lock passes (it used to answer 403 forever)", async () => {
		const { default: request } = await import("supertest");
		const res = await request(app)
			.delete("/api/users/me/lock")
			.set("Authorization", `Bearer ${token}`);
		expect(res.status).toBe(200);
		expect(res.body.unlocked).toBe(true);
	});

	test("other routes stay blocked while locked", async () => {
		const { default: request } = await import("supertest");
		const res = await request(app).get("/api/users/me").set("Authorization", `Bearer ${token}`);
		expect(res.status).toBe(403);
		expect(res.body.code).toBe("ACCOUNT_LOCKED");
	});
});
