import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { OpenCode } from "@opencode/client";
import { logInfo, logWarn } from "../../utils/logger.js";
import { formatToolError, waitForAssistantTurn } from "../opencodeTurns.js";
import { parseModelChain } from "./modelChain.js";
import { buildInvestigationConfig } from "./runtimeConfig.js";

export const PORT_RANGE_START = 4200;
export const PORT_RANGE_END = 4299;
const SERVER_USER = "opencode";
const POLL_INTERVAL_MS = 1200;
const STABLE_POLLS_TO_SETTLE = 20;

const POWERSHELL_SHIM_TARGET = /& "([^"]*opencode\.exe)"/;
const CMD_SHIM_TARGET = /"?%~dp0\\?([^"]*?opencode\.exe)"?/i;
const V2_VERSION = /v2\.\d+|^1\.(?:1[9-9]|[2-9]\d|[1-9]\d{2,})/i;

/**
 * The repository root, resolved ONCE at startup and never taken from a
 * request. The runtime is allowed to look at exactly one directory - the
 * repository - and a caller that names another one is refused.
 */
export const REPOSITORY_ROOT = resolveRepositoryRoot(process.cwd());

function resolveRepositoryRoot(start) {
	let current = path.resolve(start);
	for (;;) {
		const manifest = path.join(current, "package.json");
		if (fs.existsSync(manifest)) {
			try {
				const pkg = JSON.parse(fs.readFileSync(manifest, "utf8"));
				if (pkg.name === "gartexhub") return fs.realpathSync(current);
			} catch {
				// unreadable manifest: keep walking up
			}
		}
		const parent = path.dirname(current);
		if (parent === current) {
			throw new Error("Could not resolve the GarTexHub repository root from the working directory");
		}
		current = parent;
	}
}

/**
 * Refuse a directory that is not the canonical repository root.
 *
 * The runtime is a read-only investigator over ONE tree. A path that is
 * outside the repository - a home directory, a temporary directory, a symlink
 * that points out of the tree - is out of scope and is refused rather than
 * quietly narrowed.
 */
export function assertRepositoryRoot(directory) {
	const resolved = fs.realpathSync(path.resolve(String(directory || "")));
	if (resolved !== REPOSITORY_ROOT) {
		throw new Error(
			`Refusing to use a directory outside the repository root: ${resolved} (expected ${REPOSITORY_ROOT})`,
		);
	}
	return resolved;
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read the real executable out of a pnpm shim.
 *
 * The pnpm shims are PowerShell/cmd wrappers around a hashed `.exe`. The
 * PowerShell one interpolates `$basedir` at runtime, so the literal path in the
 * file is not a usable path until it is expanded.
 */
function readShimTarget(shimPath) {
	try {
		const text = fs.readFileSync(shimPath, "utf8");
		const dir = path.dirname(shimPath);
		const psMatch = text.match(POWERSHELL_SHIM_TARGET);
		if (psMatch) {
			const raw = psMatch[1].replace(/\$basedir/g, dir).replace(/^\/\//, "\\\\");
			return path.resolve(raw);
		}
		const cmdMatch = text.match(CMD_SHIM_TARGET);
		if (cmdMatch) {
			return path.resolve(dir, cmdMatch[1].replace(/\\/g, path.sep));
		}
	} catch {
		return null;
	}
	return null;
}

/**
 * opencode v1 and v2 expose incompatible APIs. A v1 binary answers the v2
 * routes with the SPA's HTML, so the runtime has to refuse to start on one.
 */
function isV2Binary(binary) {
	try {
		const result = spawnSync(binary, ["--version"], {
			encoding: "utf8",
			timeout: 20_000,
			windowsHide: true,
		});
		const version = `${result.stdout || ""}${result.stderr || ""}`;
		return V2_VERSION.test(version);
	} catch {
		return false;
	}
}

function resolveBinary() {
	const explicit = process.env.OPENCODE_BIN;
	if (explicit && fs.existsSync(explicit)) {
		if (!isV2Binary(explicit)) {
			throw new Error(
				`OPENCODE_BIN does not point at an opencode v2 binary: ${explicit}. The v1 API is not compatible with this runtime.`,
			);
		}
		return { command: explicit, shell: false };
	}

	const candidates = [];
	if (process.platform === "win32") {
		const localAppData = process.env.LOCALAPPDATA || "";
		for (const shim of ["opencode.ps1", "opencode.cmd", "opencode.CMD"]) {
			const target = readShimTarget(path.join(localAppData, "pnpm", "bin", shim));
			if (target && fs.existsSync(target)) {
				candidates.push(target);
			}
		}
	} else {
		candidates.push("opencode");
	}

	for (const candidate of candidates) {
		if (isV2Binary(candidate)) {
			return { command: candidate, shell: false };
		}
	}

	// Fail fast. Spawning an UNVERIFIED binary means the v1 API, which answers
	// the v2 routes with the SPA's HTML, and the failure then surfaces as an
	// opaque error from a later call. Say what is wrong instead.
	throw new Error(
		"No opencode v2 binary found. Install the opencode CLI (v2) or set OPENCODE_BIN to its executable. The v1 CLI is not compatible with this runtime.",
	);
}

function findFreePort(start, attempts) {
	return new Promise((resolve) => {
		let cursor = start;
		const tryPort = (port) => {
			const server = net.createServer();
			server.once("error", () => {
				server.close(() => {
					if (cursor >= start + attempts - 1) {
						resolve(null);
					} else {
						cursor += 1;
						tryPort(cursor);
					}
				});
			});
			server.once("listening", () => server.close(() => resolve(port)));
			server.listen(port, "127.0.0.1");
		};
		tryPort(cursor);
	});
}

/**
 * Resolve the real opencode executable.
 *
 * Exported so that every process that spawns an opencode server resolves the
 * same binary: on Windows the `opencode` on PATH is a pnpm shim, and
 * `spawn("opencode")` without a shell raises ENOENT.
 *
 * @returns {{command: string, shell: boolean}}
 */
export function resolveOpencodeBinary() {
	return resolveBinary();
}

/**
 * Create the isolated config directory the server is spawned with.
 *
 * The developer's global opencode config normally declares MCP servers (and
 * plugins, and skills); inheriting them would hand the agent ambient
 * capabilities that the restrictive config cannot take away. A fresh
 * temporary directory holds nothing, so nothing is inherited.
 *
 * @param {string} [prefix] The temporary directory prefix.
 * @returns {string} The absolute path of the new directory.
 */
export function createIsolatedConfigDir(prefix = "opencode-investigation-config-") {
	return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * The environment an isolated opencode server is spawned with.
 *
 * The three keys that carry the isolation:
 *
 *  - `OPENCODE_CONFIG_DIR` - the server reads its configuration from a fresh
 *    temporary directory, so the operator's global config (and its MCP
 *    servers) is not in scope at all;
 *  - `OPENCODE_CONFIG_PROJECT_DISABLE` - a stray `opencode.json` in the
 *    repository cannot widen the rules;
 *  - `OPENCODE_CONFIG_CONTENT` - the restrictive configuration itself.
 *
 * @param {Object} params
 * @param {Object} params.config The configuration the server runs with.
 * @param {string} params.password The server's basic-auth password.
 * @param {string} params.configDir The isolated configuration directory.
 * @param {Object} [params.baseEnv] The environment to build on.
 * @returns {Object} The environment for the spawned process.
 */
export function buildIsolatedRuntimeEnv({
	config,
	password,
	configDir,
	baseEnv = process.env,
} = {}) {
	return {
		...baseEnv,
		OPENCODE_SERVER_PASSWORD: password,
		OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
		OPENCODE_LOG_LEVEL: "ERROR",
		OPENCODE_CONFIG_DIR: configDir,
		OPENCODE_CONFIG_PROJECT_DISABLE: "1",
	};
}

/**
 * The environment the ASSISTANT's opencode server is spawned with.
 *
 * The assistant reads the codebase to answer platform questions, so it runs
 * with the same read-only configuration the investigation runtime uses: it
 * may read, search and list, and it may not write, run commands or delegate
 * to a subagent. It gets its OWN isolated configuration directory, so it does
 * not inherit the operator's global opencode config either.
 *
 * @param {Object} params
 * @param {string} params.password The server's basic-auth password.
 * @param {string} params.configDir The isolated configuration directory.
 * @param {Object} [params.baseEnv] The environment to build on.
 * @returns {Object} The environment for the spawned process.
 */
export function buildAssistantRuntimeEnv({ password, configDir, baseEnv = process.env } = {}) {
	return buildIsolatedRuntimeEnv({
		config: buildInvestigationConfig(),
		password,
		configDir,
		baseEnv,
	});
}

/**
 * A free port from the runtime's dedicated range.
 *
 * The range excludes 4096-4116, so the portal can never attach to an
 * interactive TUI's server.
 *
 * @returns {Promise<number|null>} The port, or null when the range is full.
 */
export async function findFreeRuntimePort() {
	return findFreePort(PORT_RANGE_START, PORT_RANGE_END - PORT_RANGE_START + 1);
}

export async function startInvestigationRuntime({
	cwd,
	config,
	password,
	port,
	readyTimeoutMs = 180_000,
}) {
	// The working directory is the repository, and only the repository.
	const workingDirectory = assertRepositoryRoot(cwd);

	const chosenPort = port || (await findFreeRuntimePort());
	if (!chosenPort) {
		throw new Error("No free port for the investigation runtime");
	}

	// The runtime gets its OWN config directory. The developer's global
	// opencode config normally declares MCP servers (and plugins, and skills);
	// inheriting them would hand the investigator ambient capabilities that the
	// restrictive config cannot take away. `OPENCODE_CONFIG_PROJECT_DISABLE`
	// stops a stray `opencode.json` in the repository from widening the rules.
	const isolatedConfigDir = createIsolatedConfigDir();

	const binary = resolveBinary();
	const child = spawn(
		binary.command,
		["serve", "--port", String(chosenPort), "--hostname", "127.0.0.1"],
		{
			cwd: workingDirectory,
			stdio: ["ignore", "pipe", "pipe"],
			shell: binary.shell,
			windowsHide: true,
			env: buildIsolatedRuntimeEnv({
				config,
				password,
				configDir: isolatedConfigDir,
			}),
		},
	);

	// The child writes to stdout for the lifetime of the runtime. The pipe has
	// to be drained or the child blocks once the buffer fills.
	child.stdout.on("data", () => {});
	child.stderr.on("data", (chunk) => {
		const line = String(chunk).trim();
		if (line) logWarn("investigation runtime stderr", { line: line.slice(0, 300) });
	});
	child.on("error", (error) => {
		logWarn("investigation runtime process error", { error: error.message });
	});

	const baseUrl = `http://127.0.0.1:${chosenPort}`;
	const authorization = `Basic ${Buffer.from(`${SERVER_USER}:${password}`).toString("base64")}`;
	const client = OpenCode.make({
		baseUrl,
		// The client builds a `Headers` instance. Spreading it with `{...headers}`
		// yields `{}` and silently drops `content-type`, which the server
		// answers with 415. Rebuild it instead.
		fetch: (input, init = {}) => {
			const headers = new Headers(init.headers || {});
			headers.set("Authorization", authorization);
			return fetch(input, { ...init, headers });
		},
	});

	const deadline = Date.now() + readyTimeoutMs;
	let ready = false;
	let lastError = null;
	while (Date.now() < deadline) {
		try {
			// `model.list()` only answers once the location has finished
			// activating its plugins. `/api/config` answers much earlier, while
			// the server is still initializing, so it is not a readiness signal.
			await client.model.list();
			ready = true;
			break;
		} catch (error) {
			lastError = error;
		}
		await sleep(1000);
	}
	if (!ready) {
		try {
			child.kill();
		} catch {
			// already gone
		}
		try {
			fs.rmSync(isolatedConfigDir, { recursive: true, force: true });
		} catch {
			// best effort
		}
		const reason = lastError?.message ? ` (last error: ${lastError.message})` : "";
		throw new Error(`Investigation runtime did not become ready on port ${chosenPort}${reason}`);
	}
	logInfo("investigation runtime started", {
		port: chosenPort,
		cwd,
		binary: binary.command,
		configDir: isolatedConfigDir,
	});

	return {
		baseUrl,
		port: chosenPort,
		client,
		stop: async () => {
			try {
				child.kill();
			} catch {
				// already gone
			}
			try {
				fs.rmSync(isolatedConfigDir, { recursive: true, force: true });
			} catch {
				// best effort
			}
		},
	};
}

export async function createInvestigationSession({ client, title, model, directory }) {
	// The session may only ever point at the repository.
	const location = assertRepositoryRoot(directory);
	const created = await client.session.create({
		title,
		model: { id: model.id, providerID: model.providerID },
		location: { directory: location },
	});
	const id = created?.data?.id || created?.id;
	if (!id) throw new Error("Could not create an investigation session");
	return id;
}

/**
 * Send one prompt and wait for the assistant turn to settle.
 *
 * The turn itself is tracked by `waitForAssistantTurn`, which is shared with
 * the assistant service so both read the v2 message list the same way. That
 * module knows the two traps of the v2 list: it is ordered NEWEST FIRST, and
 * a tool call's state changes without the content array changing size.
 */
export async function runAgentPrompt({ client, sessionID, text, timeoutMs = 180_000 }) {
	let turn;
	try {
		turn = await waitForAssistantTurn({
			client,
			sessionID,
			text,
			timeoutMs,
			pollIntervalMs: POLL_INTERVAL_MS,
			stablePollsToSettle: STABLE_POLLS_TO_SETTLE,
		});
	} catch (error) {
		return { text: "", toolCalls: [], error: error?.message || String(error) };
	}

	const toolCalls = turn.content
		.filter((part) => part.type === "tool")
		.map((part) => ({
			tool: part.tool || part.name || "unknown",
			status: part.state?.status || "unknown",
			error: part.state?.error ? formatToolError(part.state.error) : undefined,
		}));

	// The model REFUSED the request. The free tier's quota is PER MODEL, so
	// this is the one failure another model in the chain can answer for.
	if (turn.modelError) {
		const kind = turn.modelError.type || "provider error";
		const status = turn.modelError.status ? ` (HTTP ${turn.modelError.status})` : "";
		const message = turn.modelError.message || kind;
		return {
			text: turn.text,
			toolCalls,
			agent: turn.newest?.agent || null,
			errorKind: "model_refused",
			error: `The model refused the request: ${message}${status} [${kind}]`,
		};
	}

	// A turn that ran out of time is reported as a timeout, not as an agent
	// that said nothing. The tool calls it DID make are kept, because they are
	// the evidence that it was still working when the clock ran out.
	if (turn.wedged) {
		return {
			text: turn.text,
			toolCalls,
			agent: turn.newest?.agent || null,
			errorKind: "wedged",
			error: `The agent stopped making progress: it had made ${toolCalls.length} read-only tool call(s) and then produced nothing for several minutes.`,
		};
	}
	if (turn.timedOut) {
		return {
			text: turn.text,
			toolCalls,
			agent: turn.newest?.agent || null,
			errorKind: "timeout",
			error: `The agent did not finish within ${Math.round((turn.timeoutMs ?? timeoutMs) / 1000)}s. It had made ${toolCalls.length} read-only tool call(s) and was still working.`,
		};
	}

	return {
		text: turn.text,
		toolCalls,
		agent: turn.newest?.agent || null,
	};
}

export async function listAvailableModels(client) {
	const response = await client.model.list();
	const flat = Object.values(response?.data || response || {}).flat();
	return flat
		.filter((model) => model && (model.modelID || model.id))
		.map((model) => ({
			id: model.modelID || model.id,
			providerID: model.providerID,
		}));
}

export { parseModelChain };
