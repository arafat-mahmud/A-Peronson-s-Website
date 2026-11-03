import { exec } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import util from "node:util";
import { readLocalJson, updateLocalJson } from "../utils/localStore.js";
import { logError } from "../utils/logger.js";

const execAsync = util.promisify(exec);
const EXEC_ENABLED = ["true", "1", "yes"].includes(
	String(process.env.ADMIN_EXEC_ENABLED || "").toLowerCase(),
);
const EXEC_TIMEOUT_MS = Number(process.env.ADMIN_EXEC_TIMEOUT_MS || 12_000);
const EXEC_ALLOW_ANY = ["true", "1", "yes"].includes(
	String(process.env.ADMIN_EXEC_ALLOW_ANY || "").toLowerCase(),
);
const EXEC_ALLOWLIST = new Set(
	String(process.env.ADMIN_EXEC_ALLOWLIST || "")
		.split(",")
		.map((v) => v.trim())
		.filter(Boolean),
);

const STATE_FILE = "server_admin_state.json";
const FILE_MANAGER_ROOT = path.join(process.cwd(), "server", "file_manager");
const DEFAULT_STATE = {
	web_server: {
		type: "",
		status: "",
		config: "",
		updated_at: "",
	},
	php: {
		version: "",
		available: [],
		updated_at: "",
	},
	databases: [],
	db_admin_sessions: [],
	domains: [],
	dns_records: [],
	apps: [],
	files: [],
	rbac_roles: [],
	task_queues: [],
	automation: {
		auto_updates: false,
		patch_window: "",
		last_run_at: "",
	},
	security: {
		mfa_required: false,
		ssh_key_control: false,
		ids_status: "",
		last_scan_at: "",
	},
	backups: {
		providers: [],
		last_restore_at: "",
	},
	alerts: [],
	logs: [],
};

function toId(value) {
	return String(value || "").trim();
}

function truncate(value, max = 4000) {
	const text = String(value || "");
	if (text.length <= max) {
		return text;
	}
	return `${text.slice(0, max)}...`;
}

async function runCommand(command) {
	if (!EXEC_ENABLED) {
		return {
			ok: false,
			simulated: true,
			stdout: "",
			stderr: "",
			exitCode: null,
		};
	}

	if (!EXEC_ALLOW_ANY && EXEC_ALLOWLIST.size > 0) {
		const allowed = [...EXEC_ALLOWLIST].some((prefix) => command.startsWith(prefix));
		if (!allowed) {
			return {
				ok: false,
				simulated: false,
				stdout: "",
				stderr: "Command not allowlisted.",
				exitCode: 1,
			};
		}
	}

	try {
		const { stdout, stderr } = await execAsync(command, {
			timeout: EXEC_TIMEOUT_MS,
			windowsHide: true,
		});
		return {
			ok: true,
			simulated: false,
			stdout: truncate(stdout),
			stderr: truncate(stderr),
			exitCode: 0,
		};
	} catch (error) {
		return {
			ok: false,
			simulated: false,
			stdout: truncate(error?.stdout || ""),
			stderr: truncate(error?.stderr || error?.message || ""),
			exitCode: typeof error?.code === "number" ? error.code : 1,
		};
	}
}

async function safeReadFile(filePath) {
	try {
		return await fs.readFile(filePath, "utf8");
	} catch {
		return "";
	}
}

async function detectWebServer() {
	if (process.platform === "win32") {
		const result = await runCommand(
			'powershell -NoProfile -Command "Get-Service -Name nginx,Apache2,httpd,W3SVC -ErrorAction SilentlyContinue | Select-Object Name,Status,DisplayName | ConvertTo-Json"',
		);
		if (!(result.ok && result.stdout)) {
			return { type: "", status: "" };
		}
		try {
			const parsed = JSON.parse(result.stdout);
			const rows = Array.isArray(parsed) ? parsed : [parsed];
			const picked = rows.find((row) => row?.Name) || rows[0];
			if (!picked) {
				return { type: "", status: "" };
			}
			return {
				type: String(picked.Name || ""),
				status: String(picked.Status || ""),
			};
		} catch {
			return { type: "", status: "" };
		}
	}
	const result = await runCommand(
		'systemctl list-units --type=service --no-pager --no-legend | grep -E "nginx|apache|httpd" | head -n 1',
	);
	if (!(result.ok && result.stdout)) {
		return { type: "", status: "" };
	}
	const parts = result.stdout.trim().split(/\s+/g);
	return { type: parts[0] || "", status: parts[2] || "" };
}

async function readWebServerConfig(serverType) {
	if (!serverType) {
		return "";
	}
	const normalized = String(serverType).toLowerCase();
	if (normalized.includes("nginx")) {
		const paths = [path.join("C:\\", "nginx", "conf", "nginx.conf"), "/etc/nginx/nginx.conf"];
		for (const p of paths) {
			const raw = await safeReadFile(p);
			if (raw) {
				return raw.slice(0, 4000);
			}
		}
	}
	if (
		normalized.includes("apache") ||
		normalized.includes("httpd") ||
		normalized.includes("w3svc")
	) {
		const paths = [
			path.join("C:\\", "Apache24", "conf", "httpd.conf"),
			"/etc/apache2/apache2.conf",
			"/etc/httpd/conf/httpd.conf",
		];
		for (const p of paths) {
			const raw = await safeReadFile(p);
			if (raw) {
				return raw.slice(0, 4000);
			}
		}
	}
	return "";
}

async function detectPhpVersion() {
	const result = await runCommand("php -v");
	if (!(result.ok && result.stdout)) {
		return { version: "", available: [] };
	}
	const match = result.stdout.match(/PHP\s+([\d.]+)/i);
	const version = match ? match[1] : "";
	return { version, available: version ? [version] : [] };
}

async function detectDatabases() {
	if (process.platform === "win32") {
		const result = await runCommand(
			`powershell -NoProfile -Command "Get-Service -Name 'postgresql*','mysql*','mariadb*','MongoDB','MSSQL*','Redis*' -ErrorAction SilentlyContinue | Select-Object Name,Status,DisplayName | ConvertTo-Json"`,
		);
		if (!(result.ok && result.stdout)) {
			return [];
		}
		try {
			const parsed = JSON.parse(result.stdout);
			const rows = Array.isArray(parsed) ? parsed : [parsed];
			return rows.filter(Boolean).map((row) => ({
				id: String(row?.Name || crypto.randomUUID()),
				type: String(row?.Name || "").toLowerCase(),
				host: "localhost",
				status: String(row?.Status || "").toLowerCase(),
				last_backup_at: "",
			}));
		} catch {
			return [];
		}
	}
	const result = await runCommand(
		'systemctl list-units --type=service --no-pager --no-legend | grep -E "postgres|mysql|mariadb|mongo|redis" | head -n 10',
	);
	if (!(result.ok && result.stdout)) {
		return [];
	}
	return result.stdout
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			const parts = line.trim().split(/\s+/g);
			return {
				id: parts[0] || crypto.randomUUID(),
				type: parts[0] || "",
				host: "localhost",
				status: parts[2] || "",
				last_backup_at: "",
			};
		});
}

export async function getServerAdminState() {
	const current = await readLocalJson(STATE_FILE, DEFAULT_STATE);
	const [webServerDetected, phpDetected, databases] = await Promise.all([
		detectWebServer(),
		detectPhpVersion(),
		detectDatabases(),
	]);
	const webConfig = await readWebServerConfig(webServerDetected.type);
	return {
		...DEFAULT_STATE,
		...current,
		web_server: {
			...DEFAULT_STATE.web_server,
			...(current.web_server || {}),
			type: webServerDetected.type || current.web_server?.type || "",
			status: webServerDetected.status || current.web_server?.status || "",
			config: webConfig || current.web_server?.config || "",
		},
		php: {
			...DEFAULT_STATE.php,
			...(current.php || {}),
			version: phpDetected.version || current.php?.version || "",
			available:
				phpDetected.available.length > 0 ? phpDetected.available : current.php?.available || [],
		},
		databases: databases.length > 0 ? databases : current.databases || [],
		db_admin_ui: {
			phpmyadmin_url: process.env.PHPMYADMIN_URL || current.db_admin_ui?.phpmyadmin_url || "",
			configured: Boolean(process.env.PHPMYADMIN_URL || current.db_admin_ui?.phpmyadmin_url),
		},
		backups: { ...DEFAULT_STATE.backups, ...(current.backups || {}) },
		security: { ...DEFAULT_STATE.security, ...(current.security || {}) },
	};
}

async function updateState(updater) {
	return updateLocalJson(STATE_FILE, updater, DEFAULT_STATE);
}

function appendLog(state, entry) {
	const logs = Array.isArray(state.logs) ? state.logs : [];
	state.logs = [entry, ...logs].slice(0, 100);
	return state;
}

export async function performServerAdminAction(action = "", payload = {}) {
	const actionId = crypto.randomUUID();
	const now = new Date().toISOString();
	let updated = null;

	if (action === "webserver.update_config") {
		updated = await updateState((state) => {
			state.web_server = {
				...state.web_server,
				type: payload.type || state.web_server.type,
				config: String(payload.config || "").trim() || state.web_server.config,
				updated_at: now,
			};
			return appendLog(state, { id: actionId, action, at: now });
		});
	} else if (action === "webserver.restart") {
		updated = await updateState((state) => appendLog(state, { id: actionId, action, at: now }));
	} else if (action === "php.set_version") {
		updated = await updateState((state) => {
			const version = String(payload.version || "").trim();
			if (version) {
				state.php = { ...state.php, version, updated_at: now };
			}
			return appendLog(state, {
				id: actionId,
				action,
				at: now,
				payload: { version },
			});
		});
	} else if (action === "db.add") {
		updated = await updateState((state) => {
			const db = {
				id: payload.id || actionId,
				type: payload.type || "postgres",
				host: payload.host || "localhost",
				status: payload.status || "online",
				last_backup_at: "",
			};
			state.databases = [...(state.databases || []), db];
			return appendLog(state, { id: actionId, action, at: now, payload: db });
		});
	} else if (action === "db.backup") {
		updated = await updateState((state) => {
			const dbId = String(payload.db_id || "").trim();
			state.databases = (state.databases || []).map((db) =>
				String(db.id) === dbId ? { ...db, last_backup_at: now } : db,
			);
			return appendLog(state, {
				id: actionId,
				action,
				at: now,
				payload: { db_id: dbId },
			});
		});
	} else if (action === "db.admin.open") {
		updated = await updateState((state) => {
			const session = {
				id: actionId,
				db_id: payload.db_id || "primary",
				opened_at: now,
				status: "active",
			};
			state.db_admin_sessions = [session, ...(state.db_admin_sessions || [])].slice(0, 20);
			return appendLog(state, {
				id: actionId,
				action,
				at: now,
				payload: session,
			});
		});
	} else if (action === "domain.add") {
		updated = await updateState((state) => {
			const domain = {
				id: actionId,
				domain: payload.domain || "example.com",
				status: "active",
				created_at: now,
			};
			state.domains = [...(state.domains || []), domain];
			return appendLog(state, {
				id: actionId,
				action,
				at: now,
				payload: domain,
			});
		});
	} else if (action === "dns.record.add") {
		updated = await updateState((state) => {
			const record = {
				id: actionId,
				domain: payload.domain || "example.com",
				type: payload.type || "A",
				name: payload.name || "@",
				value: payload.value || "",
				ttl: Number(payload.ttl || 3600),
			};
			state.dns_records = [...(state.dns_records || []), record];
			return appendLog(state, {
				id: actionId,
				action,
				at: now,
				payload: record,
			});
		});
	} else if (action === "app.install") {
		updated = await updateState((state) => {
			const app = {
				id: actionId,
				name: payload.name || "app",
				version: payload.version || "latest",
				status: "installed",
				installed_at: now,
			};
			state.apps = [...(state.apps || []), app];
			return appendLog(state, { id: actionId, action, at: now, payload: app });
		});
	} else if (action === "file.write") {
		updated = await updateState((state) => {
			const requested = String(payload.path || `${actionId.slice(0, 6)}.txt`).trim();
			const safePath = path.join(FILE_MANAGER_ROOT, requested);
			const relPath = path.relative(FILE_MANAGER_ROOT, safePath);
			if (relPath.startsWith("..")) {
				throw new Error("Invalid path");
			}
			const entry = {
				id: actionId,
				path: safePath,
				content: String(payload.content || "").slice(0, 4000),
				updated_at: now,
			};
			fs.mkdir(FILE_MANAGER_ROOT, { recursive: true }).catch((err) =>
				logError("serverAdminService: mkdir file_manager failed", err),
			);
			fs.writeFile(safePath, String(payload.content || ""), "utf8").catch((err) =>
				logError("serverAdminService: writeFile failed", err),
			);
			const existing = (state.files || []).find((f) => String(f.path) === String(safePath));
			state.files = existing
				? (state.files || []).map((f) => (String(f.path) === String(safePath) ? entry : f))
				: [...(state.files || []), entry];
			return appendLog(state, {
				id: actionId,
				action,
				at: now,
				payload: { path: safePath },
			});
		});
	} else if (action === "rbac.role.create") {
		updated = await updateState((state) => {
			const roleId = toId(payload.id || payload.name || actionId);
			const role = {
				id: roleId,
				name: payload.name || roleId,
				permissions: Array.isArray(payload.permissions)
					? payload.permissions
					: String(payload.permissions || "")
							.split(",")
							.filter(Boolean),
				users: [],
			};
			state.rbac_roles = [...(state.rbac_roles || []), role];
			return appendLog(state, { id: actionId, action, at: now, payload: role });
		});
	} else if (action === "rbac.role.assign") {
		updated = await updateState((state) => {
			const roleId = toId(payload.role_id);
			const userId = toId(payload.user_id);
			state.rbac_roles = (state.rbac_roles || []).map((role) => {
				if (String(role.id) !== roleId) {
					return role;
				}
				const users = new Set(role.users || []);
				if (userId) {
					users.add(userId);
				}
				return { ...role, users: [...users] };
			});
			return appendLog(state, {
				id: actionId,
				action,
				at: now,
				payload: { role_id: roleId, user_id: userId },
			});
		});
	} else if (action === "queue.create") {
		updated = await updateState((state) => {
			const queue = {
				id: actionId,
				name: payload.name || "queue",
				pending: 0,
				status: "active",
			};
			state.task_queues = [...(state.task_queues || []), queue];
			return appendLog(state, {
				id: actionId,
				action,
				at: now,
				payload: queue,
			});
		});
	} else if (action === "queue.enqueue") {
		updated = await updateState((state) => {
			const queueId = toId(payload.queue_id);
			state.task_queues = (state.task_queues || []).map((queue) =>
				String(queue.id) === queueId
					? { ...queue, pending: Number(queue.pending || 0) + 1 }
					: queue,
			);
			return appendLog(state, {
				id: actionId,
				action,
				at: now,
				payload: { queue_id: queueId },
			});
		});
	} else if (action === "automation.toggle_updates") {
		updated = await updateState((state) => {
			state.automation = {
				...state.automation,
				auto_updates: Boolean(payload.enabled),
				patch_window: payload.patch_window || state.automation.patch_window,
			};
			return appendLog(state, { id: actionId, action, at: now, payload });
		});
	} else if (action === "security.ids.scan") {
		updated = await updateState((state) => {
			state.security = {
				...state.security,
				ids_status: "scanning",
				last_scan_at: now,
			};
			return appendLog(state, { id: actionId, action, at: now });
		});
	} else if (action === "backup.provider.update") {
		updated = await updateState((state) => {
			const providerId = toId(payload.id);
			state.backups.providers = (state.backups.providers || []).map((provider) =>
				String(provider.id) === providerId
					? {
							...provider,
							bucket: payload.bucket || provider.bucket,
							enabled: payload.enabled === undefined ? provider.enabled : Boolean(payload.enabled),
						}
					: provider,
			);
			return appendLog(state, {
				id: actionId,
				action,
				at: now,
				payload: { id: providerId },
			});
		});
	} else if (action === "backup.restore") {
		updated = await updateState((state) => {
			state.backups.last_restore_at = now;
			return appendLog(state, { id: actionId, action, at: now });
		});
	}

	if (!updated) {
		return { ok: false, error: "Unsupported action" };
	}
	return { ok: true, state: updated };
}
