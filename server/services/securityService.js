import { exec } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import util from "node:util";
import { readAuditLog } from "../utils/auditStore.js";
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

const IMMUTABLE_DIR = path.join(process.cwd(), "server", "immutable_backups");

const STATE_FILE = "security_state.json";
const DEFAULT_STATE = {
	zero_trust: {
		enabled: false,
		policy: "",
	},
	admin_auth: {
		mfa_code: "",
		device_allowlist: [],
		passkeys: [],
	},
	mfa: {
		required: false,
		methods: [],
	},
	session: {
		timeout_minutes: 0,
		device_fingerprinting: false,
	},
	ip_whitelist: [],
	geo_fence: {
		enabled: false,
		countries: [],
	},
	tamper_proof_logs: {
		enabled: false,
		storage: "",
		last_hash_at: "",
	},
	encryption: {
		key_rotation_days: 0,
		last_rotated_at: "",
	},
	incidents: [],
	data_exports: {
		dual_approval: false,
		pending: [],
	},
	forensic_logs: [],
	immutable_backups: {
		enabled: false,
		last_snapshot_at: "",
	},
};

function envBool(value) {
	if (value === undefined || value === null) {
		return;
	}
	return ["true", "1", "yes", "on"].includes(String(value).toLowerCase());
}

function envList(value) {
	if (!value) {
		return [];
	}
	return String(value)
		.split(",")
		.map((v) => v.trim())
		.filter(Boolean);
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
			stdout: stdout || "",
			stderr: stderr || "",
			exitCode: 0,
		};
	} catch (error) {
		return {
			ok: false,
			simulated: false,
			stdout: error?.stdout || "",
			stderr: error?.stderr || error?.message || "",
			exitCode: typeof error?.code === "number" ? error.code : 1,
		};
	}
}

async function listSecurityEvents() {
	if (!EXEC_ENABLED) {
		return [];
	}
	if (process.platform === "win32") {
		const result = await runCommand(
			'powershell -NoProfile -Command "Get-WinEvent -LogName Security -MaxEvents 10 | Select-Object TimeCreated,Id,LevelDisplayName,Message | ConvertTo-Json"',
		);
		if (!(result.ok && result.stdout)) {
			return [];
		}
		try {
			const parsed = JSON.parse(result.stdout);
			const rows = Array.isArray(parsed) ? parsed : [parsed];
			return rows.map((row) => ({
				id: crypto.randomUUID(),
				at: row?.TimeCreated ? new Date(row.TimeCreated).toISOString() : new Date().toISOString(),
				level: row?.LevelDisplayName || "",
				message: String(row?.Message || "").slice(0, 240),
				code: row?.Id || "",
			}));
		} catch {
			return [];
		}
	}
	const authLog = await runCommand("tail -n 20 /var/log/auth.log");
	if (authLog.ok && authLog.stdout) {
		return authLog.stdout
			.split("\n")
			.filter(Boolean)
			.map((line) => ({
				id: crypto.randomUUID(),
				at: new Date().toISOString(),
				level: "auth",
				message: line.slice(0, 240),
			}));
	}
	const secureLog = await runCommand("tail -n 20 /var/log/secure");
	if (!(secureLog.ok && secureLog.stdout)) {
		return [];
	}
	return secureLog.stdout
		.split("\n")
		.filter(Boolean)
		.map((line) => ({
			id: crypto.randomUUID(),
			at: new Date().toISOString(),
			level: "auth",
			message: line.slice(0, 240),
		}));
}

function hashAuditLog(entries = []) {
	const hash = crypto.createHash("sha256");
	entries.forEach((entry) => {
		hash.update(JSON.stringify(entry));
	});
	return hash.digest("hex");
}

export async function getSecurityState() {
	const current = await readLocalJson(STATE_FILE, DEFAULT_STATE);
	const auditLog = await readAuditLog();
	const lastHashAt = auditLog.length > 0 ? auditLog.at(-1)?.at || "" : "";
	const auditHash = auditLog.length > 0 ? hashAuditLog(auditLog) : "";
	const systemEvents = await listSecurityEvents();
	const envMfaRequired = envBool(process.env.ADMIN_MFA_REQUIRED);
	const envIpAllow = envList(process.env.ADMIN_IP_ALLOWLIST);
	const envDeviceAllow = envList(process.env.ADMIN_DEVICE_ALLOWLIST);
	const envTimeout = Number(process.env.ADMIN_STEPUP_MAX_MINUTES || 0);
	const mfaEnabled =
		envMfaRequired === undefined ? Boolean(process.env.ADMIN_MFA_CODE) : envMfaRequired;
	const deviceFingerprinting = envDeviceAllow.length > 0 ? true : undefined;
	return {
		...DEFAULT_STATE,
		...current,
		admin_auth: {
			...DEFAULT_STATE.admin_auth,
			...(current.admin_auth || {}),
		},
		zero_trust: { ...DEFAULT_STATE.zero_trust, ...(current.zero_trust || {}) },
		mfa: {
			...DEFAULT_STATE.mfa,
			...(current.mfa || {}),
			required: current.mfa?.required ?? mfaEnabled,
			methods:
				current.mfa?.methods?.length > 0
					? current.mfa.methods
					: envList(process.env.ADMIN_MFA_METHODS),
		},
		session: {
			...DEFAULT_STATE.session,
			...(current.session || {}),
			timeout_minutes:
				current.session?.timeout_minutes || (Number.isFinite(envTimeout) ? envTimeout : 0),
			device_fingerprinting:
				current.session?.device_fingerprinting ?? deviceFingerprinting ?? false,
		},
		ip_whitelist: current.ip_whitelist?.length > 0 ? current.ip_whitelist : envIpAllow,
		geo_fence: { ...DEFAULT_STATE.geo_fence, ...(current.geo_fence || {}) },
		encryption: { ...DEFAULT_STATE.encryption, ...(current.encryption || {}) },
		data_exports: {
			...DEFAULT_STATE.data_exports,
			...(current.data_exports || {}),
			dual_approval: true,
		},
		immutable_backups: {
			...DEFAULT_STATE.immutable_backups,
			...(current.immutable_backups || {}),
		},
		tamper_proof_logs: {
			...DEFAULT_STATE.tamper_proof_logs,
			...(current.tamper_proof_logs || {}),
			enabled: true,
			storage: "audit-log-chain",
			last_hash_at: lastHashAt,
			hash: auditHash,
		},
		system_events: systemEvents,
	};
}

export async function getAdminAuthConfig() {
	const current = await readLocalJson(STATE_FILE, DEFAULT_STATE);
	const adminAuth = {
		...DEFAULT_STATE.admin_auth,
		...(current.admin_auth || {}),
	};
	const envMfa = String(process.env.ADMIN_MFA_CODE || "").trim();
	const envDevices = envList(process.env.ADMIN_DEVICE_ALLOWLIST);
	const envIps = envList(process.env.ADMIN_IP_ALLOWLIST);
	return {
		mfa_code: adminAuth.mfa_code || envMfa,
		device_allowlist:
			adminAuth.device_allowlist?.length > 0 ? adminAuth.device_allowlist : envDevices,
		ip_allowlist: envIps,
		passkeys: adminAuth.passkeys || [],
	};
}

async function updateState(updater) {
	return updateLocalJson(STATE_FILE, updater, DEFAULT_STATE);
}

export async function performSecurityAction(action = "", payload = {}) {
	const actionId = crypto.randomUUID();
	const now = new Date().toISOString();
	let updated = null;

	if (action === "security.zero_trust.toggle") {
		updated = await updateState((state) => {
			state.zero_trust = {
				...state.zero_trust,
				enabled: Boolean(payload.enabled),
			};
			return state;
		});
	} else if (action === "security.mfa.require") {
		const methods = Array.isArray(payload.methods)
			? payload.methods
			: String(payload.methods || "")
					.split(",")
					.map((v) => v.trim())
					.filter(Boolean);
		updated = await updateState((state) => {
			state.mfa = {
				...state.mfa,
				required: Boolean(payload.required),
				methods: methods.length > 0 ? methods : state.mfa.methods,
			};
			return state;
		});
	} else if (action === "security.session.timeout") {
		updated = await updateState((state) => {
			state.session = {
				...state.session,
				timeout_minutes: Number(payload.timeout_minutes || 30),
			};
			return state;
		});
	} else if (action === "security.device_fingerprint") {
		updated = await updateState((state) => {
			state.session = {
				...state.session,
				device_fingerprinting: Boolean(payload.enabled),
			};
			return state;
		});
	} else if (action === "security.ip.allowlist") {
		const list = Array.isArray(payload.ip_whitelist)
			? payload.ip_whitelist
			: String(payload.ip_whitelist || "")
					.split(",")
					.map((v) => v.trim())
					.filter(Boolean);
		updated = await updateState((state) => {
			state.ip_whitelist = list;
			return state;
		});
	} else if (action === "security.geo_fence") {
		updated = await updateState((state) => {
			state.geo_fence = {
				enabled: Boolean(payload.enabled),
				countries: Array.isArray(payload.countries)
					? payload.countries
					: String(payload.countries || "")
							.split(",")
							.map((v) => v.trim())
							.filter(Boolean),
			};
			return state;
		});
	} else if (action === "security.encryption.rotate") {
		updated = await updateState((state) => {
			state.encryption = { ...state.encryption, last_rotated_at: now };
			return state;
		});
	} else if (action === "security.incident.create") {
		updated = await updateState((state) => {
			const incident = {
				id: actionId,
				title: payload.title || "Incident",
				status: "open",
				created_at: now,
				severity: payload.severity || "medium",
			};
			state.incidents = [incident, ...(state.incidents || [])];
			return state;
		});
	} else if (action === "security.incident.resolve") {
		updated = await updateState((state) => {
			state.incidents = (state.incidents || []).map((inc) =>
				String(inc.id) === String(payload.id)
					? { ...inc, status: "resolved", resolved_at: now }
					: inc,
			);
			return state;
		});
	} else if (action === "security.export.request") {
		updated = await updateState((state) => {
			const req = {
				id: actionId,
				dataset: payload.dataset || "export",
				requested_at: now,
				status: "pending",
			};
			state.data_exports.pending = [req, ...(state.data_exports.pending || [])];
			return state;
		});
	} else if (action === "security.export.approve") {
		updated = await updateState((state) => {
			state.data_exports.pending = (state.data_exports.pending || []).map((req) =>
				String(req.id) === String(payload.id)
					? { ...req, status: "approved", approved_at: now }
					: req,
			);
			return state;
		});
	} else if (action === "security.forensic.log") {
		updated = await updateState((state) => {
			const entry = {
				id: actionId,
				message: payload.message || "Forensic entry",
				created_at: now,
			};
			state.forensic_logs = [entry, ...(state.forensic_logs || [])].slice(0, 100);
			return state;
		});
	} else if (action === "security.immutable.snapshot") {
		const auditLog = await readAuditLog();
		const auditHash = auditLog.length > 0 ? hashAuditLog(auditLog) : crypto.randomUUID();
		await fs
			.mkdir(IMMUTABLE_DIR, { recursive: true })
			.catch((err) => logError("securityService: mkdir immutable dir failed", err));
		const fileName = `immutable-${now.replace(/[:.]/g, "-")}.json`;
		const payloadOut = {
			created_at: now,
			audit_hash: auditHash,
			entries: auditLog.slice(-200),
		};
		await fs
			.writeFile(path.join(IMMUTABLE_DIR, fileName), JSON.stringify(payloadOut, null, 2), "utf8")
			.catch((err) => logError("securityService: writeFile immutable backup failed", err));
		updated = await updateState((state) => {
			state.immutable_backups = {
				...state.immutable_backups,
				last_snapshot_at: now,
				last_hash: auditHash,
				last_file: fileName,
			};
			return state;
		});
	} else if (action === "security.admin.mfa.set") {
		const code = String(payload.code || "").trim();
		updated = await updateState((state) => {
			state.admin_auth = { ...(state.admin_auth || {}), mfa_code: code };
			return state;
		});
	} else if (action === "security.admin.device.add") {
		const deviceId = String(payload.device_id || "")
			.trim()
			.toLowerCase();
		if (!deviceId) {
			return { ok: false, error: "Missing device ID" };
		}
		updated = await updateState((state) => {
			const list = new Set(state.admin_auth?.device_allowlist || []);
			list.add(deviceId);
			state.admin_auth = {
				...(state.admin_auth || {}),
				device_allowlist: Array.from(list),
			};
			return state;
		});
	} else if (action === "security.admin.device.remove") {
		const deviceId = String(payload.device_id || "")
			.trim()
			.toLowerCase();
		updated = await updateState((state) => {
			const list = (state.admin_auth?.device_allowlist || []).filter(
				(id) => String(id).toLowerCase() !== deviceId,
			);
			state.admin_auth = {
				...(state.admin_auth || {}),
				device_allowlist: list,
			};
			return state;
		});
	} else if (action === "security.admin.passkey.add") {
		const passkey = String(payload.passkey || "").trim();
		if (!passkey) {
			return { ok: false, error: "Missing passkey" };
		}
		updated = await updateState((state) => {
			const list = new Set(state.admin_auth?.passkeys || []);
			list.add(passkey);
			state.admin_auth = {
				...(state.admin_auth || {}),
				passkeys: Array.from(list),
			};
			return state;
		});
	} else if (action === "security.admin.passkey.remove") {
		const passkey = String(payload.passkey || "").trim();
		updated = await updateState((state) => {
			const list = (state.admin_auth?.passkeys || []).filter((key) => key !== passkey);
			state.admin_auth = { ...(state.admin_auth || {}), passkeys: list };
			return state;
		});
	}

	if (!updated) {
		return { ok: false, error: "Unsupported action" };
	}
	return { ok: true, state: updated };
}
