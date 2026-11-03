import { exec } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
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

const STATE_FILE = "infra_state.json";
const DEFAULT_STATE = {
	firewall_rules: [],
	packages: [],
	cron_jobs: [],
	updates: [],
	os_users: [],
	ssh_keys: [],
	ssl_certs: [],
	logs: [],
	security_audit: [],
	zombie_processes: [],
	network_settings: {
		interfaces: [],
		dns_servers: [],
		vlan: [],
		ip_assignments: [],
	},
	time_settings: {
		timezone: "",
		ntp_servers: [],
		last_sync_at: "",
	},
	update_policy: {
		auto_updates: false,
		patch_window: "",
	},
	backups: {
		retention_days: 0,
		last_run_at: "",
		last_status: "",
		history: [],
	},
	last_actions: [],
};

function truncate(value, max = 4000) {
	const text = String(value || "");
	if (text.length <= max) {
		return text;
	}
	return `${text.slice(0, max)}...`;
}

function normalizePort(value) {
	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65_535) {
		return 0;
	}
	return port;
}

function normalizeProtocol(value) {
	const proto = String(value || "tcp").toLowerCase();
	return proto === "udp" ? "udp" : "tcp";
}

function isWindows() {
	return process.platform === "win32";
}

let lastNetSample = {
	at: 0,
	bytes: 0,
};

async function getNetworkBytes() {
	if (isWindows()) {
		const result = await runCommand(
			'powershell -NoProfile -Command "Get-Counter \\"\\\\Network Interface(*)\\\\Bytes Total/sec\\" | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue | Measure-Object -Sum | Select-Object -ExpandProperty Sum"',
		);
		if (!(result.ok && result.stdout)) {
			return null;
		}
		const value = Number(String(result.stdout).trim());
		return Number.isFinite(value) ? value : null;
	}
	const raw = await readTextFile("/proc/net/dev");
	if (!raw) {
		return null;
	}
	const lines = raw.split("\n").slice(2).filter(Boolean);
	let total = 0;
	lines.forEach((line) => {
		const parts = line.replace(/\s+/g, " ").trim().split(" ");
		const bytes = Number(parts[1] || 0);
		total += Number.isFinite(bytes) ? bytes : 0;
	});
	return total;
}

async function getBandwidthMbps() {
	const now = Date.now();
	const bytes = await getNetworkBytes();
	if (bytes === null) {
		return null;
	}
	if (!lastNetSample.at) {
		lastNetSample = { at: now, bytes };
		return null;
	}
	const elapsed = Math.max(1, (now - lastNetSample.at) / 1000);
	const delta = Math.max(0, bytes - lastNetSample.bytes);
	lastNetSample = { at: now, bytes };
	const bps = delta / elapsed;
	return Math.round(((bps * 8) / 1_000_000) * 100) / 100;
}

async function getDiskIops() {
	if (isWindows()) {
		const result = await runCommand(
			'powershell -NoProfile -Command "Get-Counter \\"\\\\PhysicalDisk(_Total)\\\\Disk Transfers/sec\\" | Select-Object -ExpandProperty CounterSamples | Select-Object -First 1 -ExpandProperty CookedValue"',
		);
		if (!(result.ok && result.stdout)) {
			return null;
		}
		const value = Number(String(result.stdout).trim());
		return Number.isFinite(value) ? Math.round(value) : null;
	}
	const result = await runCommand("iostat -d 1 2");
	if (!(result.ok && result.stdout)) {
		return null;
	}
	const lines = result.stdout.split("\n").filter((line) => line.trim());
	const last = lines.at(-1) || "";
	const parts = last.trim().split(/\s+/g);
	const value = Number(parts[1]);
	return Number.isFinite(value) ? Math.round(value) : null;
}

async function readTextFile(filePath) {
	try {
		return await fs.readFile(filePath, "utf8");
	} catch {
		return "";
	}
}

async function listOsUsers() {
	if (isWindows()) {
		const result = await runCommand(
			'powershell -NoProfile -Command "Get-LocalUser | Select-Object -First 60 Name,Enabled,LastLogon | ConvertTo-Json"',
		);
		if (!(result.ok && result.stdout)) {
			return [];
		}
		try {
			const parsed = JSON.parse(result.stdout);
			const rows = Array.isArray(parsed) ? parsed : [parsed];
			return rows.map((row) => ({
				id: String(row?.Name || ""),
				username: String(row?.Name || ""),
				status: row?.Enabled ? "active" : "disabled",
				last_logon: row?.LastLogon || "",
			}));
		} catch {
			return [];
		}
	}
	const result = await runCommand("getent passwd | awk -F: '{print $1}' | head -n 60");
	if (!(result.ok && result.stdout)) {
		return [];
	}
	return result.stdout
		.split("\n")
		.filter(Boolean)
		.map((name) => ({ id: name, username: name, status: "active" }));
}

async function listFirewallRules() {
	if (isWindows()) {
		const result = await runCommand(
			'powershell -NoProfile -Command "Get-NetFirewallRule | Select-Object -First 60 DisplayName,Enabled,Action,Direction,Profile | ConvertTo-Json"',
		);
		if (!(result.ok && result.stdout)) {
			return [];
		}
		try {
			const parsed = JSON.parse(result.stdout);
			const rows = Array.isArray(parsed) ? parsed : [parsed];
			return rows.map((row, idx) => ({
				id: String(idx),
				action: String(row?.Action || "").toLowerCase(),
				name: String(row?.DisplayName || ""),
				direction: String(row?.Direction || ""),
				enabled: Boolean(row?.Enabled),
				profile: String(row?.Profile || ""),
			}));
		} catch {
			return [];
		}
	}
	const result = await runCommand("ufw status numbered");
	if (!(result.ok && result.stdout)) {
		return [];
	}
	return result.stdout
		.split("\n")
		.slice(2)
		.filter(Boolean)
		.map((line, idx) => ({
			id: String(idx),
			name: line.trim(),
		}));
}

async function listCronJobs() {
	if (isWindows()) {
		const result = await runCommand("schtasks /Query /FO CSV /V");
		if (!(result.ok && result.stdout)) {
			return [];
		}
		const lines = result.stdout.split("\n").slice(1, 20).filter(Boolean);
		return lines.map((line, idx) => ({
			id: String(idx),
			name: line.split('","')[0].replace(/^"/, ""),
			schedule: "windows",
			command: line,
			status: line.includes("Ready") ? "active" : "disabled",
		}));
	}
	const result = await runCommand("crontab -l");
	if (!(result.ok && result.stdout)) {
		return [];
	}
	return result.stdout
		.split("\n")
		.filter((line) => line.trim() && !line.startsWith("#"))
		.map((line, idx) => ({
			id: String(idx),
			name: `cron-${idx + 1}`,
			schedule: line.split(" ").slice(0, 5).join(" "),
			command: line.split(" ").slice(5).join(" "),
			status: "active",
		}));
}

async function listPackages() {
	if (isWindows()) {
		const result = await runCommand(
			'powershell -NoProfile -Command "Get-Package | Select-Object -First 80 Name,Version | ConvertTo-Json"',
		);
		if (!(result.ok && result.stdout)) {
			return [];
		}
		try {
			const parsed = JSON.parse(result.stdout);
			const rows = Array.isArray(parsed) ? parsed : [parsed];
			return rows.map((row) => ({
				name: String(row?.Name || ""),
				version: String(row?.Version || ""),
			}));
		} catch {
			return [];
		}
	}
	const dnfCheck = await runCommand("command -v dnf");
	if (dnfCheck.ok && dnfCheck.stdout) {
		const result = await runCommand("dnf list installed | head -n 80");
		if (!(result.ok && result.stdout)) {
			return [];
		}
		return result.stdout
			.split("\n")
			.slice(1)
			.filter(Boolean)
			.map((line) => {
				const [name, version] = line.replace(/\s+/g, " ").trim().split(" ");
				return { name: (name || "").split(".")[0], version: version || "" };
			});
	}
	const yumCheck = await runCommand("command -v yum");
	if (yumCheck.ok && yumCheck.stdout) {
		const result = await runCommand("yum list installed | head -n 80");
		if (!(result.ok && result.stdout)) {
			return [];
		}
		return result.stdout
			.split("\n")
			.slice(1)
			.filter(Boolean)
			.map((line) => {
				const [name, version] = line.replace(/\s+/g, " ").trim().split(" ");
				return { name: (name || "").split(".")[0], version: version || "" };
			});
	}
	const result = await runCommand("apt list --installed 2>/dev/null | head -n 80");
	if (!(result.ok && result.stdout)) {
		return [];
	}
	return result.stdout
		.split("\n")
		.slice(1)
		.filter(Boolean)
		.map((line) => {
			const [name, version] = line.split(" ");
			return { name: (name || "").split("/")[0], version: version || "" };
		});
}

async function listSshKeys() {
	const keys = [];
	const home = os.homedir();
	const authPath = path.join(home, ".ssh", "authorized_keys");
	const raw = await readTextFile(authPath);
	if (raw) {
		raw
			.split("\n")
			.filter(Boolean)
			.forEach((line, idx) => {
				keys.push({
					id: `local-${idx}`,
					label: line.split(" ").slice(2).join(" ") || `key-${idx + 1}`,
					fingerprint: crypto.createHash("sha256").update(line).digest("hex").slice(0, 16),
				});
			});
	}
	if (isWindows()) {
		try {
			const usersDir = path.join(process.env.SystemDrive || "C:\\", "Users");
			const entries = await fs.readdir(usersDir, { withFileTypes: true });
			for (const entry of entries.filter((e) => e.isDirectory())) {
				const filePath = path.join(usersDir, entry.name, ".ssh", "authorized_keys");
				const content = await readTextFile(filePath);
				if (!content) {
					continue;
				}
				content
					.split("\n")
					.filter(Boolean)
					.forEach((line, idx) => {
						keys.push({
							id: `user-${entry.name}-${idx}`,
							label: line.split(" ").slice(2).join(" ") || `${entry.name}-key-${idx + 1}`,
							fingerprint: crypto.createHash("sha256").update(line).digest("hex").slice(0, 16),
						});
					});
			}
		} catch {
			// ignore
		}
	} else {
		try {
			const homes = await fs.readdir("/home", { withFileTypes: true });
			for (const entry of homes.filter((e) => e.isDirectory())) {
				const filePath = path.join("/home", entry.name, ".ssh", "authorized_keys");
				const content = await readTextFile(filePath);
				if (!content) {
					continue;
				}
				content
					.split("\n")
					.filter(Boolean)
					.forEach((line, idx) => {
						keys.push({
							id: `user-${entry.name}-${idx}`,
							label: line.split(" ").slice(2).join(" ") || `${entry.name}-key-${idx + 1}`,
							fingerprint: crypto.createHash("sha256").update(line).digest("hex").slice(0, 16),
						});
					});
			}
		} catch {
			// ignore
		}
	}
	return keys;
}

async function listSslCerts() {
	const certs = [];
	const linuxDir = "/etc/letsencrypt/live";
	const winDir = path.join(process.env.ProgramData || "C:\\ProgramData", "letsencrypt", "live");
	const dir = isWindows() ? winDir : linuxDir;
	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		entries
			.filter((e) => e.isDirectory())
			.forEach((e) => {
				certs.push({
					id: e.name,
					domain: e.name,
					status: "active",
					issuer: "LetsEncrypt",
				});
			});
	} catch {
		return [];
	}
	return certs;
}

async function getDnsServers() {
	if (isWindows()) {
		const result = await runCommand(
			'powershell -NoProfile -Command "Get-DnsClientServerAddress -AddressFamily IPv4 | Select-Object -First 4 -ExpandProperty ServerAddresses | ConvertTo-Json"',
		);
		if (!(result.ok && result.stdout)) {
			return [];
		}
		try {
			const parsed = JSON.parse(result.stdout);
			return Array.isArray(parsed) ? parsed : [parsed];
		} catch {
			return [];
		}
	}
	const raw = await readTextFile("/etc/resolv.conf");
	return raw
		.split("\n")
		.filter((line) => line.startsWith("nameserver"))
		.map((line) => line.split(" ")[1]);
}

async function getTimezone() {
	if (isWindows()) {
		const result = await runCommand("tzutil /g");
		return result.stdout?.trim() || "";
	}
	const result = await runCommand("timedatectl show -p Timezone --value");
	return result.stdout?.trim() || "";
}

async function getNtpStatus() {
	if (isWindows()) {
		const result = await runCommand("w32tm /query /status");
		return result.stdout ? new Date().toISOString() : "";
	}
	const result = await runCommand("timedatectl timesync-status");
	return result.stdout ? new Date().toISOString() : "";
}

export async function getInfraState() {
	const current = await readLocalJson(STATE_FILE, DEFAULT_STATE);
	const [
		osUsers,
		firewallRules,
		cronJobs,
		packages,
		sshKeys,
		sslCerts,
		dnsServers,
		timezone,
		ntpStatus,
		auditLog,
	] = await Promise.all([
		listOsUsers(),
		listFirewallRules(),
		listCronJobs(),
		listPackages(),
		listSshKeys(),
		listSslCerts(),
		getDnsServers(),
		getTimezone(),
		getNtpStatus(),
		readAuditLog(),
	]);
	const infraAudit = auditLog
		.filter((entry) => String(entry.path || "").includes("/api/infra"))
		.slice(-80);
	return {
		...DEFAULT_STATE,
		...current,
		firewall_rules: firewallRules,
		packages,
		cron_jobs: cronJobs,
		os_users: osUsers,
		ssh_keys: sshKeys,
		ssl_certs: sslCerts,
		security_audit: infraAudit,
		backups: { ...DEFAULT_STATE.backups, ...(current.backups || {}) },
		network_settings: {
			...(DEFAULT_STATE.network_settings || {}),
			...(current.network_settings || {}),
			dns_servers: dnsServers,
			interfaces: Object.keys(os.networkInterfaces() || {}).map((name) => ({
				name,
			})),
		},
		time_settings: {
			...DEFAULT_STATE.time_settings,
			...(current.time_settings || {}),
			timezone,
			last_sync_at: ntpStatus,
		},
		update_policy: {
			...DEFAULT_STATE.update_policy,
			...(current.update_policy || {}),
		},
	};
}

async function updateInfraState(updater) {
	return updateLocalJson(STATE_FILE, updater, DEFAULT_STATE);
}

function appendAction(state, entry) {
	const next = { ...state };
	const log = Array.isArray(next.last_actions) ? next.last_actions : [];
	const updated = [entry, ...log].slice(0, 20);
	next.last_actions = updated;
	return next;
}

function hasShellInjection(cmd) {
	const dangerous = /[;&|`$()]|#.*$/m;
	const stripped = cmd.replace(/"[^"]*"/g, "").replace(/'[^']*'/g, "");
	return dangerous.test(stripped);
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

	if (hasShellInjection(command)) {
		return {
			ok: false,
			simulated: false,
			stdout: "",
			stderr: "Command rejected: shell metacharacters detected.",
			exitCode: 1,
		};
	}

	if (!EXEC_ALLOW_ANY && EXEC_ALLOWLIST.size > 0) {
		const commandPrefix = command.split(/\s+/)[0];
		const allowed = [...EXEC_ALLOWLIST].some((entry) => entry === commandPrefix);
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

async function getDiskUsage() {
	if (isWindows()) {
		const cmd =
			'powershell -NoProfile -Command "Get-PSDrive -PSProvider FileSystem | Select-Object Name,Used,Free | ConvertTo-Json"';
		const result = await runCommand(cmd);
		if (!(result.ok && result.stdout)) {
			return [];
		}
		try {
			const parsed = JSON.parse(result.stdout);
			const rows = Array.isArray(parsed) ? parsed : [parsed];
			return rows.map((row) => ({
				mount: String(row?.Name || ""),
				used_bytes: Number(row?.Used || 0),
				free_bytes: Number(row?.Free || 0),
			}));
		} catch {
			return [];
		}
	}

	const cmd = "df -kP";
	const result = await runCommand(cmd);
	if (!(result.ok && result.stdout)) {
		return [];
	}
	const lines = result.stdout.split("\n").slice(1).filter(Boolean);
	return lines.map((line) => {
		const parts = line.replace(/\s+/g, " ").trim().split(" ");
		return {
			mount: parts[5] || "",
			used_bytes: Number(parts[2] || 0) * 1024,
			free_bytes: Number(parts[3] || 0) * 1024,
		};
	});
}

async function getProcessList() {
	if (isWindows()) {
		const cmd =
			'powershell -NoProfile -Command "Get-Process | Select-Object -First 60 Id,ProcessName,CPU,WS | ConvertTo-Json"';
		const result = await runCommand(cmd);
		if (!(result.ok && result.stdout)) {
			return [];
		}
		try {
			const parsed = JSON.parse(result.stdout);
			const rows = Array.isArray(parsed) ? parsed : [parsed];
			return rows.map((row) => ({
				pid: Number(row?.Id),
				name: String(row?.ProcessName || ""),
				cpu: Number(row?.CPU || 0),
				memory_bytes: Number(row?.WS || 0),
			}));
		} catch {
			return [];
		}
	}

	const cmd = "ps -eo pid,comm,%cpu,%mem --sort=-%cpu | head -n 30";
	const result = await runCommand(cmd);
	if (!(result.ok && result.stdout)) {
		return [];
	}
	const lines = result.stdout.split("\n").slice(1).filter(Boolean);
	return lines.map((line) => {
		const parts = line.trim().split(/\s+/g);
		return {
			pid: Number(parts[0] || 0),
			name: parts[1] || "",
			cpu: Number(parts[2] || 0),
			memory_percent: Number(parts[3] || 0),
		};
	});
}

async function getServiceList() {
	if (isWindows()) {
		const cmd =
			'powershell -NoProfile -Command "Get-Service | Select-Object -First 80 Name,DisplayName,Status,StartType | ConvertTo-Json"';
		const result = await runCommand(cmd);
		if (!(result.ok && result.stdout)) {
			return [];
		}
		try {
			const parsed = JSON.parse(result.stdout);
			const rows = Array.isArray(parsed) ? parsed : [parsed];
			return rows.map((row) => ({
				name: String(row?.Name || ""),
				display_name: String(row?.DisplayName || ""),
				status: String(row?.Status || ""),
				start_type: String(row?.StartType || ""),
			}));
		} catch {
			return [];
		}
	}

	const cmd = "systemctl list-units --type=service --no-pager --no-legend | head -n 40";
	const result = await runCommand(cmd);
	if (!(result.ok && result.stdout)) {
		return [];
	}
	return result.stdout
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			const parts = line.trim().split(/\s+/g);
			return {
				name: parts[0] || "",
				status: parts[2] || "",
				description: parts.slice(4).join(" "),
			};
		});
}

async function getCpuUsagePercent() {
	if (isWindows()) {
		try {
			const result = await runCommand(
				'powershell -NoProfile -Command "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average"',
			);
			if (result.ok && result.stdout) {
				const val = Number.parseFloat(result.stdout.trim());
				if (!Number.isNaN(val)) {
					return Math.round(val);
				}
			}
		} catch {
			return 0;
		}
		return 0;
	}
	const load = os.loadavg();
	const cores = os.cpus().length || 1;
	return Math.min(100, Math.round((load[0] / cores) * 100));
}

export async function getSystemOverview() {
	const cpus = os.cpus();
	const totalMem = os.totalmem();
	const freeMem = os.freemem();
	const load = os.loadavg();
	const disks = await getDiskUsage();
	const processes = await getProcessList();
	const services = await getServiceList();
	const interfaces = os.networkInterfaces();
	const ifaceCount = Object.keys(interfaces || {}).length;
	const bandwidthEstimate = await getBandwidthMbps();
	const diskIops = await getDiskIops();
	const usagePercent = await getCpuUsagePercent();

	return {
		generated_at: new Date().toISOString(),
		platform: os.platform(),
		release: os.release(),
		hostname: os.hostname(),
		uptime_seconds: os.uptime(),
		cpu: {
			cores: cpus.length,
			model: cpus[0]?.model || "",
			usage_percent: usagePercent,
			load_1m: load[0] || 0,
			load_5m: load[1] || 0,
			load_15m: load[2] || 0,
		},
		memory: {
			total_bytes: totalMem,
			free_bytes: freeMem,
			used_bytes: Math.max(0, totalMem - freeMem),
		},
		storage: disks,
		io: {
			disk_iops: diskIops,
		},
		network: {
			interfaces: ifaceCount,
			bandwidth_mbps: bandwidthEstimate || null,
		},
		processes,
		services,
		exec_enabled: EXEC_ENABLED,
	};
}

export async function listProcesses() {
	return getProcessList();
}

export async function listServices() {
	return getServiceList();
}

export async function listStorage() {
	return getDiskUsage();
}

export async function performInfraAction(action = "", payload = {}) {
	const actionId = crypto.randomUUID();
	const name = String(action || "");
	const requestedAt = new Date().toISOString();

	const response = {
		action_id: actionId,
		action: name,
		requested_at: requestedAt,
		payload,
		simulated: !EXEC_ENABLED,
		status: EXEC_ENABLED ? "executed" : "queued",
		result: null,
		state: null,
	};
	let command = "";
	let stateUpdater = null;

	if (name === "firewall.allow_port" || name === "firewall.block_port") {
		const port = normalizePort(payload?.port);
		const protocol = normalizeProtocol(payload?.protocol);
		const actionType = name === "firewall.allow_port" ? "allow" : "block";
		const description = String(payload?.description || "").trim();
		if (!port) {
			response.result = { ok: false, message: "Valid port is required." };
			return response;
		}
		const systemName = `Admin${actionType}-${port}-${protocol}-${actionId.slice(0, 6)}`;
		stateUpdater = (state) => {
			const rules = Array.isArray(state.firewall_rules) ? state.firewall_rules : [];
			const nextRule = {
				id: actionId,
				action: actionType,
				port,
				protocol,
				source: String(payload?.source || "any"),
				description,
				system_name: systemName,
				created_at: requestedAt,
				updated_at: requestedAt,
			};
			return { ...state, firewall_rules: [...rules, nextRule] };
		};
		command = isWindows()
			? `netsh advfirewall firewall add rule name="${systemName}" dir=in action=${actionType} protocol=${protocol} localport=${port}`
			: actionType === "allow"
				? `ufw allow ${port}/${protocol}`
				: `ufw deny ${port}/${protocol}`;
	} else if (name === "firewall.remove_rule") {
		const ruleId = String(payload?.rule_id || "").trim();
		if (!ruleId) {
			response.result = { ok: false, message: "rule_id is required." };
			return response;
		}
		const current = await getInfraState();
		const rule = (current.firewall_rules || []).find((r) => String(r.id) === ruleId);
		stateUpdater = (state) => ({
			...state,
			firewall_rules: (state.firewall_rules || []).filter((r) => String(r.id) !== ruleId),
		});
		if (rule) {
			const protocol = rule.protocol || "tcp";
			const port = rule.port || "";
			const actionType = rule.action || "allow";
			if (isWindows()) {
				const systemName = rule.system_name || `Admin${actionType}-${port}-${protocol}`;
				command = `netsh advfirewall firewall delete rule name="${systemName}"`;
			} else {
				command =
					actionType === "allow"
						? `ufw delete allow ${port}/${protocol}`
						: `ufw delete deny ${port}/${protocol}`;
			}
		}
	} else if (name === "package.update") {
		const mode = String(payload?.mode || "check").toLowerCase();
		const apply = payload?.apply === true || String(payload?.apply || "").toLowerCase() === "true";
		const updateId = crypto.randomUUID();
		stateUpdater = (state) => {
			const updates = Array.isArray(state.updates) ? state.updates : [];
			updates.unshift({
				id: updateId,
				mode,
				apply,
				status: EXEC_ENABLED && apply ? "applied" : "queued",
				requested_at: requestedAt,
			});
			return { ...state, updates: updates.slice(0, 40) };
		};
		if (isWindows()) {
			command = apply
				? 'powershell -NoProfile -Command "winget upgrade --all --accept-package-agreements --accept-source-agreements --silent"'
				: 'powershell -NoProfile -Command "winget upgrade"';
		} else {
			const dnf = await runCommand("command -v dnf");
			const yum = await runCommand("command -v yum");
			if (dnf.ok && dnf.stdout) {
				command = apply ? "dnf upgrade -y" : "dnf check-update";
			} else if (yum.ok && yum.stdout) {
				command = apply ? "yum update -y" : "yum check-update";
			} else {
				command = apply ? "apt-get update && apt-get upgrade -y" : "apt-get update";
			}
		}
	} else if (name === "package.install") {
		const pkg = String(payload?.package || payload?.name || "").trim();
		if (!pkg) {
			response.result = { ok: false, message: "package name is required." };
			return response;
		}
		stateUpdater = (state) => {
			const packages = Array.isArray(state.packages) ? state.packages : [];
			const existing = packages.find((row) => row.name === pkg);
			const nextRow = {
				name: pkg,
				status: "installed",
				updated_at: requestedAt,
			};
			const next = existing
				? packages.map((row) => (row.name === pkg ? { ...row, ...nextRow } : row))
				: [...packages, nextRow];
			return { ...state, packages: next };
		};
		if (isWindows()) {
			command = `powershell -NoProfile -Command "winget install --id ${pkg} --accept-package-agreements --accept-source-agreements --silent"`;
		} else {
			const dnf = await runCommand("command -v dnf");
			const yum = await runCommand("command -v yum");
			command =
				dnf.ok && dnf.stdout
					? `dnf install -y ${pkg}`
					: yum.ok && yum.stdout
						? `yum install -y ${pkg}`
						: `apt-get install -y ${pkg}`;
		}
	} else if (name === "package.remove") {
		const pkg = String(payload?.package || payload?.name || "").trim();
		if (!pkg) {
			response.result = { ok: false, message: "package name is required." };
			return response;
		}
		stateUpdater = (state) => ({
			...state,
			packages: (state.packages || []).filter((row) => row.name !== pkg),
		});
		if (isWindows()) {
			command = `powershell -NoProfile -Command "winget uninstall --id ${pkg} --silent"`;
		} else {
			const dnf = await runCommand("command -v dnf");
			const yum = await runCommand("command -v yum");
			command =
				dnf.ok && dnf.stdout
					? `dnf remove -y ${pkg}`
					: yum.ok && yum.stdout
						? `yum remove -y ${pkg}`
						: `apt-get remove -y ${pkg}`;
		}
	} else if (name === "cron.add") {
		const schedule = String(payload?.schedule || "").trim();
		const taskCommand = String(payload?.command || "").trim();
		const label = String(payload?.name || "Scheduled job").trim();
		if (!(schedule && taskCommand)) {
			response.result = {
				ok: false,
				message: "schedule and command are required.",
			};
			return response;
		}
		const jobId = crypto.randomUUID();
		stateUpdater = (state) => {
			const jobs = Array.isArray(state.cron_jobs) ? state.cron_jobs : [];
			const nextJob = {
				id: jobId,
				name: label,
				schedule,
				command: taskCommand,
				status: "active",
				created_at: requestedAt,
				updated_at: requestedAt,
			};
			return { ...state, cron_jobs: [...jobs, nextJob] };
		};
		command = isWindows()
			? `schtasks /Create /SC DAILY /TN "AdminJob-${jobId.slice(0, 6)}" /TR "${taskCommand}" /ST 02:00`
			: 'echo "Cron job scheduled"';
	} else if (name === "cron.remove") {
		const jobId = String(payload?.job_id || "").trim();
		if (!jobId) {
			response.result = { ok: false, message: "job_id is required." };
			return response;
		}
		stateUpdater = (state) => ({
			...state,
			cron_jobs: (state.cron_jobs || []).filter((job) => String(job.id) !== jobId),
		});
		command = isWindows()
			? `schtasks /Delete /TN "AdminJob-${jobId.slice(0, 6)}" /F`
			: 'echo "Cron job removed"';
	} else if (name === "cron.toggle") {
		const jobId = String(payload?.job_id || "").trim();
		const enabled = payload?.enabled === undefined ? true : Boolean(payload.enabled);
		if (!jobId) {
			response.result = { ok: false, message: "job_id is required." };
			return response;
		}
		stateUpdater = (state) => ({
			...state,
			cron_jobs: (state.cron_jobs || []).map((job) =>
				String(job.id) === jobId
					? {
							...job,
							status: enabled ? "active" : "disabled",
							updated_at: requestedAt,
						}
					: job,
			),
		});
		command = isWindows()
			? `schtasks /Change /TN "AdminJob-${jobId.slice(0, 6)}" ${enabled ? "/ENABLE" : "/DISABLE"}`
			: 'echo "Cron job toggled"';
	} else if (name === "log.collect") {
		const level = String(payload?.level || "info").trim();
		const message = String(payload?.message || "System log collected").trim();
		stateUpdater = (state) => {
			const logs = Array.isArray(state.logs) ? state.logs : [];
			const entry = { id: actionId, level, message, created_at: requestedAt };
			return { ...state, logs: [entry, ...logs].slice(0, 200) };
		};
		command = isWindows()
			? 'powershell -NoProfile -Command "Get-EventLog -LogName System -Newest 20"'
			: "tail -n 20 /var/log/syslog";
	} else if (name === "log.rotate") {
		stateUpdater = (state) => ({ ...state, logs: [] });
		command = isWindows()
			? "powershell -NoProfile -Command \"Write-Output 'Logs rotated'\""
			: 'echo "Logs rotated"';
	} else if (name === "process.scan_zombies") {
		const processList = await getProcessList();
		stateUpdater = (state) => {
			const zombies = processList
				.filter((proc) => Number(proc.cpu || 0) === 0)
				.slice(0, 10)
				.map((proc) => ({
					...proc,
					state: "zombie",
					detected_at: requestedAt,
				}));
			return { ...state, zombie_processes: zombies };
		};
		command = isWindows()
			? 'powershell -NoProfile -Command "Get-Process | Where-Object { $_.CPU -eq $null } | Select-Object -First 5"'
			: "ps -eo pid,stat,comm | grep Z";
	} else if (name === "os.user.create") {
		const username = String(payload?.username || "").trim();
		if (!username) {
			response.result = { ok: false, message: "username is required." };
			return response;
		}
		stateUpdater = (state) => {
			const users = Array.isArray(state.os_users) ? state.os_users : [];
			const entry = {
				id: actionId,
				username,
				role: payload?.role || "user",
				status: "active",
				created_at: requestedAt,
			};
			return { ...state, os_users: [...users, entry] };
		};
		command = isWindows() ? `net user ${username} /add` : `useradd ${username}`;
	} else if (name === "os.user.delete") {
		const username = String(payload?.username || "").trim();
		stateUpdater = (state) => ({
			...state,
			os_users: (state.os_users || []).filter((u) => String(u.username) !== username),
		});
		command = isWindows() ? `net user ${username} /delete` : `userdel ${username}`;
	} else if (name === "os.user.reset") {
		const username = String(payload?.username || "").trim();
		stateUpdater = (state) => ({
			...state,
			os_users: (state.os_users || []).map((u) =>
				String(u.username) === username ? { ...u, password_reset_at: requestedAt } : u,
			),
		});
		command = isWindows() ? `net user ${username} *` : `passwd ${username}`;
	} else if (name === "os.user.sudo") {
		const username = String(payload?.username || "").trim();
		const enabled = payload?.enabled === undefined ? true : Boolean(payload.enabled);
		stateUpdater = (state) => ({
			...state,
			os_users: (state.os_users || []).map((u) =>
				String(u.username) === username ? { ...u, sudo: enabled, updated_at: requestedAt } : u,
			),
		});
		command = isWindows()
			? "powershell -NoProfile -Command \"Write-Output 'Sudo privileges updated'\""
			: enabled
				? `usermod -aG sudo ${username}`
				: `gpasswd -d ${username} sudo`;
	} else if (name === "ssh.key.add") {
		const label = String(payload?.label || `key-${actionId.slice(0, 6)}`).trim();
		const fingerprint = String(payload?.fingerprint || "").trim();
		stateUpdater = (state) => {
			const keys = Array.isArray(state.ssh_keys) ? state.ssh_keys : [];
			return {
				...state,
				ssh_keys: [...keys, { id: actionId, label, fingerprint, created_at: requestedAt }],
			};
		};
		command = isWindows()
			? "powershell -NoProfile -Command \"Write-Output 'SSH key added'\""
			: 'echo "ssh key added"';
	} else if (name === "ssh.key.remove") {
		const keyId = String(payload?.key_id || "").trim();
		stateUpdater = (state) => ({
			...state,
			ssh_keys: (state.ssh_keys || []).filter((k) => String(k.id) !== keyId),
		});
		command = isWindows()
			? "powershell -NoProfile -Command \"Write-Output 'SSH key removed'\""
			: 'echo "ssh key removed"';
	} else if (name === "ssl.cert.issue" || name === "ssl.cert.renew" || name === "ssl.cert.revoke") {
		const domain = String(payload?.domain || "").trim();
		if (!domain) {
			response.result = { ok: false, message: "domain is required." };
			return response;
		}
		const status = name === "ssl.cert.revoke" ? "revoked" : "active";
		stateUpdater = (state) => {
			const certs = Array.isArray(state.ssl_certs) ? state.ssl_certs : [];
			const existing = certs.find((c) => String(c.domain) === domain);
			const entry = existing
				? { ...existing, status, updated_at: requestedAt }
				: {
						id: actionId,
						domain,
						status,
						issuer: "LetsEncrypt",
						issued_at: requestedAt,
						updated_at: requestedAt,
					};
			const next = existing
				? certs.map((c) => (String(c.domain) === domain ? entry : c))
				: [...certs, entry];
			return { ...state, ssl_certs: next };
		};
		if (isWindows()) {
			command = "powershell -NoProfile -Command \"Write-Output 'SSL action queued'\"";
		} else if (name === "ssl.cert.revoke") {
			command = `certbot revoke --cert-name ${domain} --reason cessationOfOperation`;
		} else if (name === "ssl.cert.renew") {
			command = `certbot renew --cert-name ${domain}`;
		} else {
			command = `certbot certonly --standalone -d ${domain} --agree-tos --non-interactive`;
		}
	} else if (name === "backup.retention") {
		const days = Number(payload?.retention_days || payload?.days || 7);
		stateUpdater = (state) => ({
			...state,
			backups: { ...(state.backups || {}), retention_days: days },
		});
		command = isWindows()
			? "powershell -NoProfile -Command \"Write-Output 'Backup retention updated'\""
			: 'echo "backup retention updated"';
	} else if (name === "backup.restore") {
		stateUpdater = (state) => {
			const history = Array.isArray(state.backups?.history) ? state.backups.history : [];
			const entry = {
				id: actionId,
				restored_at: requestedAt,
				status: "completed",
			};
			return {
				...state,
				backups: {
					...(state.backups || {}),
					history: [entry, ...history].slice(0, 20),
				},
			};
		};
		command = isWindows()
			? "powershell -NoProfile -Command \"Write-Output 'Restore started'\""
			: 'echo "restore started"';
	} else if (name === "network.interface.update") {
		const iface = String(payload?.interface || payload?.name || "").trim();
		const ip = String(payload?.ip || "").trim();
		stateUpdater = (state) => {
			const interfaces = Array.isArray(state.network_settings?.interfaces)
				? state.network_settings.interfaces
				: [];
			const next = interfaces.some((i) => String(i.name) === iface)
				? interfaces.map((i) =>
						String(i.name) === iface ? { ...i, ip, updated_at: requestedAt } : i,
					)
				: [...interfaces, { name: iface, ip, updated_at: requestedAt }];
			return {
				...state,
				network_settings: { ...state.network_settings, interfaces: next },
			};
		};
		command = isWindows()
			? `netsh interface ip set address name="${iface}" static ${ip}`
			: `ip addr add ${ip} dev ${iface}`;
	} else if (name === "network.dns.update") {
		const servers = Array.isArray(payload?.servers)
			? payload.servers
			: String(payload?.servers || "")
					.split(",")
					.map((v) => v.trim())
					.filter(Boolean);
		stateUpdater = (state) => ({
			...state,
			network_settings: { ...state.network_settings, dns_servers: servers },
		});
		command = isWindows()
			? "powershell -NoProfile -Command \"Write-Output 'DNS updated'\""
			: 'echo "dns updated"';
	} else if (name === "system.timezone.set") {
		const zone = String(payload?.timezone || "").trim();
		stateUpdater = (state) => ({
			...state,
			time_settings: {
				...state.time_settings,
				timezone: zone || state.time_settings.timezone,
			},
		});
		command = isWindows() ? `tzutil /s "${zone}"` : `timedatectl set-timezone ${zone}`;
	} else if (name === "system.ntp.sync") {
		stateUpdater = (state) => ({
			...state,
			time_settings: { ...state.time_settings, last_sync_at: requestedAt },
		});
		command = isWindows() ? "w32tm /resync" : "timedatectl timesync-status";
	} else if (name === "update.policy") {
		const enabled = payload?.auto_updates === undefined ? undefined : Boolean(payload.auto_updates);
		const window = String(payload?.patch_window || "").trim();
		stateUpdater = (state) => ({
			...state,
			update_policy: {
				auto_updates: enabled === undefined ? state.update_policy.auto_updates : enabled,
				patch_window: window || state.update_policy.patch_window,
			},
		});
		command = isWindows()
			? "powershell -NoProfile -Command \"Write-Output 'Update policy set'\""
			: 'echo "update policy set"';
	} else if (name === "service.restart") {
		const target = String(payload?.service || "").trim();
		command = isWindows()
			? `powershell -NoProfile -Command "Restart-Service -Name '${target}' -ErrorAction Stop"`
			: `systemctl restart ${target}`;
	} else if (name === "service.stop") {
		const target = String(payload?.service || "").trim();
		command = isWindows()
			? `powershell -NoProfile -Command "Stop-Service -Name '${target}' -ErrorAction Stop"`
			: `systemctl stop ${target}`;
	} else if (name === "service.start") {
		const target = String(payload?.service || "").trim();
		command = isWindows()
			? `powershell -NoProfile -Command "Start-Service -Name '${target}' -ErrorAction Stop"`
			: `systemctl start ${target}`;
	} else if (name === "process.kill") {
		const pid = Number(payload?.pid || 0);
		command = isWindows()
			? `powershell -NoProfile -Command "Stop-Process -Id ${pid} -Force"`
			: `kill -9 ${pid}`;
	} else if (name === "backup.run") {
		stateUpdater = (state) => ({
			...state,
			backups: {
				...(state.backups || {}),
				last_run_at: requestedAt,
				last_status: EXEC_ENABLED ? "started" : "queued",
				history: [
					{
						id: actionId,
						started_at: requestedAt,
						status: EXEC_ENABLED ? "started" : "queued",
					},
					...(state.backups?.history || []),
				].slice(0, 20),
			},
		});
		const backupDir = path.join(process.cwd(), "server", "backups");
		const backupName = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
		const backupPath = path.join(backupDir, backupName);
		await fs
			.mkdir(backupDir, { recursive: true })
			.catch((err) => logError("infraService: mkdir backup failed", err));
		command = isWindows()
			? `powershell -NoProfile -Command "Compress-Archive -Path '${path.join(process.cwd(), "server", "database", "*")}' -DestinationPath '${backupPath}' -Force"`
			: `tar -czf ${backupPath} -C ${path.join(process.cwd(), "server", "database")} .`;
	}

	if (stateUpdater) {
		response.state = await updateInfraState(stateUpdater);
	}

	if (!command) {
		response.result = {
			ok: Boolean(stateUpdater),
			message: "Unknown or unsupported action.",
		};
		return response;
	}

	if (EXEC_ENABLED) {
		response.result = await runCommand(command);
	} else {
		response.result = {
			ok: true,
			simulated: true,
			message: "Simulation mode: no system command executed.",
		};
	}

	response.state = response.state || (await getInfraState());
	await updateInfraState((state) =>
		appendAction(state, {
			id: actionId,
			action: name,
			at: requestedAt,
			status: response.result?.ok ? "ok" : "error",
			payload,
			message: response.result?.stderr || response.result?.stdout || "",
		}),
	);
	return response;
}
