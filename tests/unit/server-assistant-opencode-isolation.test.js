import fs from "node:fs";
import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

// The assistant's opencode server used to be spawned with no isolation at
// all: no `OPENCODE_CONFIG_CONTENT`, no isolated `OPENCODE_CONFIG_DIR`, and
// no `OPENCODE_CONFIG_PROJECT_DISABLE`. It therefore inherited the
// operator's global opencode config - MCP servers and all - and its sessions
// carried no permission restriction.
//
// And `POST /api/assistant/ask-public` had no `requireAuth`, so an
// unauthenticated caller reached `createUserOpencodeSession(null)`: a guest
// session, created per call, owned by nobody, on a write-capable agent.
//
// The two rules under test are narrow and absolute:
//   1. the assistant's server is spawned with the isolation keys, and
//   2. the "public" assistant route refuses an unauthenticated caller.

const userFindUnique = jest.fn(async () => null);

jest.unstable_mockModule("../../server/utils/prisma.js", () => ({
	default: {
		user: { findUnique: userFindUnique },
		appState: { findUnique: jest.fn(async () => null) },
		assistantKnowledge: { findMany: jest.fn(async () => []) },
	},
}));

const { buildAssistantRuntimeEnv, createIsolatedConfigDir } = await import(
	"../../server/services/investigation/opencodeRuntime.js"
);
const assistantRoutes = (await import("../../server/routes/assistantRoutes.js")).default;
const { trimHistory } = await import("../../server/services/assistantService.js");

function buildApp() {
	const app = express();
	app.use(express.json());
	app.use("/api/assistant", assistantRoutes);
	return app;
}

describe("the assistant's opencode isolation", () => {
	test("the spawn env carries an isolated configuration directory", () => {
		const env = buildAssistantRuntimeEnv({
			password: "a-password",
			configDir: "/tmp/isolated-config-dir",
		});

		expect(env.OPENCODE_CONFIG_DIR).toBe("/tmp/isolated-config-dir");
	});

	test("the spawn env disables the project configuration", () => {
		const env = buildAssistantRuntimeEnv({
			password: "a-password",
			configDir: "/tmp/isolated-config-dir",
		});

		expect(env.OPENCODE_CONFIG_PROJECT_DISABLE).toBe("1");
	});

	test("the spawn env carries the server password", () => {
		const env = buildAssistantRuntimeEnv({
			password: "a-password",
			configDir: "/tmp/isolated-config-dir",
		});

		expect(env.OPENCODE_SERVER_PASSWORD).toBe("a-password");
	});

	test("the configuration denies everything first", () => {
		const env = buildAssistantRuntimeEnv({
			password: "a-password",
			configDir: "/tmp/isolated-config-dir",
		});
		const config = JSON.parse(env.OPENCODE_CONFIG_CONTENT);

		expect(config.permission["*"]).toBe("deny");
	});

	test("the configuration allows only the read-only tools", () => {
		const env = buildAssistantRuntimeEnv({
			password: "a-password",
			configDir: "/tmp/isolated-config-dir",
		});
		const config = JSON.parse(env.OPENCODE_CONFIG_CONTENT);

		expect(config.permission.read["*"]).toBe("allow");
		expect(config.permission.glob).toBe("allow");
		expect(config.permission.grep).toBe("allow");
		expect(config.permission.list).toBe("allow");
	});

	test("the configuration denies the mutating tools and the delegation path", () => {
		const env = buildAssistantRuntimeEnv({
			password: "a-password",
			configDir: "/tmp/isolated-config-dir",
		});
		const config = JSON.parse(env.OPENCODE_CONFIG_CONTENT);

		for (const tool of ["edit", "bash", "task"]) {
			expect(config.permission[tool]).toBe("deny");
		}
	});

	test("the configuration denies the .env files", () => {
		const env = buildAssistantRuntimeEnv({
			password: "a-password",
			configDir: "/tmp/isolated-config-dir",
		});
		const config = JSON.parse(env.OPENCODE_CONFIG_CONTENT);

		expect(config.permission.read["*.env"]).toBe("deny");
		expect(config.permission.read["**/.env"]).toBe("deny");
		expect(config.permission.read["**/.env.*"]).toBe("deny");
	});

	test("the configuration disables the MCP integrations", () => {
		const env = buildAssistantRuntimeEnv({
			password: "a-password",
			configDir: "/tmp/isolated-config-dir",
		});
		const config = JSON.parse(env.OPENCODE_CONFIG_CONTENT);

		expect(config.tools["render_*"]).toBe(false);
		expect(config.tools["chrome-devtools_*"]).toBe(false);
		expect(config.tools["github_*"]).toBe(false);
	});

	test("the isolated configuration directory is a fresh empty directory", () => {
		const dir = createIsolatedConfigDir("opencode-assistant-isolation-test-");

		expect(dir).toContain("opencode-assistant-isolation-test-");
		expect(fs.readdirSync(dir)).toEqual([]);
	});
});

describe("the assistant's conversation history", () => {
	const message = (n, size = 10) => ({
		role: n % 2 ? "user" : "assistant",
		text: `${n}:`.padEnd(size, "x"),
	});

	test("keeps the newest messages when there are too many", () => {
		const history = Array.from({ length: 30 }, (_, index) => message(index));

		const kept = trimHistory(history);

		expect(kept).toHaveLength(12);
		expect(kept[kept.length - 1].text).toBe(history[history.length - 1].text);
	});

	test("drops the oldest messages until the history fits the character budget", () => {
		const history = Array.from({ length: 10 }, (_, index) => message(index, 5_000));

		const kept = trimHistory(history);

		expect(kept.length).toBeLessThan(10);
		expect(kept[kept.length - 1].text).toBe(history[history.length - 1].text);
		expect(kept.reduce((sum, entry) => sum + entry.text.length, 0)).toBeLessThanOrEqual(12_000);
	});

	test("a single oversized message is cut down to its newest end", () => {
		const giant = { role: "user", text: `OLDEST-START${"y".repeat(30_000)}NEWEST-END` };

		const kept = trimHistory([giant]);

		expect(kept).toHaveLength(1);
		expect(kept[0].text.length).toBe(12_000);
		expect(kept[0].text.endsWith("NEWEST-END")).toBe(true);
	});

	test("an empty history stays empty", () => {
		expect(trimHistory([])).toEqual([]);
	});
});

describe("the assistant's public route", () => {
	test("an unauthenticated caller is refused", async () => {
		const res = await request(buildApp())
			.post("/api/assistant/ask-public")
			.send({ question: "how do I place an order?" });

		expect(res.status).toBe(401);
	});

	test("a caller with no token is refused", async () => {
		const res = await request(buildApp()).post("/api/assistant/ask-public").send({});

		expect(res.status).toBe(401);
	});
});
