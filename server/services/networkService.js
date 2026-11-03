import { exec } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
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

const STATE_FILE = "network_state.json";
const BACKUP_DIR = path.join(process.cwd(), "server", "network_backups");
const DEFAULT_INVENTORY = {
	devices: [],
	alerts: [],
	topology: { nodes: [], links: [] },
	vlans: [],
	ipam_reservations: [],
	dhcp_pools: [],
	vpn_tunnels: [],
	tunnels: [],
	qos_policies: [],
	traffic_shapes: [],
	config_backups: [],
	firmware_jobs: [],
	config_audit: [],
	clients: [],
	ids_alerts: [],
	auth_servers: [],
	rogue_aps: [],
	flow_stats: [],
	alert_integrations: [],
	firewall_policies: [],
	bulk_config_jobs: [],
	config_restore_jobs: [],
	discovery_jobs: [],
};

function mergeInventory(current = {}) {
	const merged = { ...DEFAULT_INVENTORY, ...current };
	merged.devices = Array.isArray(current.devices) ? current.devices : DEFAULT_INVENTORY.devices;
	merged.alerts = Array.isArray(current.alerts) ? current.alerts : DEFAULT_INVENTORY.alerts;
	merged.topology = current.topology || DEFAULT_INVENTORY.topology;
	merged.vlans = Array.isArray(current.vlans) ? current.vlans : DEFAULT_INVENTORY.vlans;
	merged.ipam_reservations = Array.isArray(current.ipam_reservations)
		? current.ipam_reservations
		: [];
	merged.dhcp_pools = Array.isArray(current.dhcp_pools) ? current.dhcp_pools : [];
	merged.vpn_tunnels = Array.isArray(current.vpn_tunnels) ? current.vpn_tunnels : [];
	merged.tunnels = Array.isArray(current.tunnels) ? current.tunnels : [];
	merged.qos_policies = Array.isArray(current.qos_policies) ? current.qos_policies : [];
	merged.traffic_shapes = Array.isArray(current.traffic_shapes) ? current.traffic_shapes : [];
	merged.config_backups = Array.isArray(current.config_backups) ? current.config_backups : [];
	merged.firmware_jobs = Array.isArray(current.firmware_jobs) ? current.firmware_jobs : [];
	merged.config_audit = Array.isArray(current.config_audit) ? current.config_audit : [];
	merged.clients = Array.isArray(current.clients) ? current.clients : [];
	merged.ids_alerts = Array.isArray(current.ids_alerts) ? current.ids_alerts : [];
	merged.auth_servers = Array.isArray(current.auth_servers) ? current.auth_servers : [];
	merged.rogue_aps = Array.isArray(current.rogue_aps) ? current.rogue_aps : [];
	merged.flow_stats = Array.isArray(current.flow_stats) ? current.flow_stats : [];
	merged.alert_integrations = Array.isArray(current.alert_integrations)
		? current.alert_integrations
		: [];
	merged.firewall_policies = Array.isArray(current.firewall_policies)
		? current.firewall_policies
		: [];
	merged.bulk_config_jobs = Array.isArray(current.bulk_config_jobs) ? current.bulk_config_jobs : [];
	merged.config_restore_jobs = Array.isArray(current.config_restore_jobs)
		? current.config_restore_jobs
		: [];
	merged.discovery_jobs = Array.isArray(current.discovery_jobs) ? current.discovery_jobs : [];
	return merged;
}

async function getDynamicInterfaces() {
	const interfaces = os.networkInterfaces();
	return Object.entries(interfaces).flatMap(([name, entries]) => {
		const rows = Array.isArray(entries) ? entries : [];
		return rows.map((entry, idx) => ({
			id: `${name}-${idx}`,
			name,
			type: "interface",
			ip: entry.address,
			mac: entry.mac,
			status: entry.internal ? "internal" : "up",
			family: entry.family,
		}));
	});
}

async function getDynamicClients() {
	if (process.platform === "win32") {
		const result = await runCommand(
			'powershell -NoProfile -Command "Get-NetNeighbor -AddressFamily IPv4 | Select-Object -First 40 IPAddress,LinkLayerAddress,State,InterfaceAlias | ConvertTo-Json"',
		);
		if (!(result.ok && result.stdout)) {
			return [];
		}
		try {
			const parsed = JSON.parse(result.stdout);
			const rows = Array.isArray(parsed) ? parsed : [parsed];
			return rows.map((row) => ({
				id: `${row?.IPAddress}`,
				ip: row?.IPAddress,
				mac: row?.LinkLayerAddress,
				status: row?.State,
				interface: row?.InterfaceAlias,
			}));
		} catch {
			return [];
		}
	}
	const result = await runCommand("ip neigh show | head -n 40");
	if (!(result.ok && result.stdout)) {
		return [];
	}
	return result.stdout
		.split("\n")
		.filter(Boolean)
		.map((line, idx) => ({
			id: `neigh-${idx}`,
			ip: line.split(" ")[0],
			mac: line.split(" ")[4] || "",
			status: line.split(" ")[5] || "",
		}));
}

async function getDynamicTopology(devices = []) {
	const nodes = devices.map((device) => ({
		id: device.id,
		label: device.name || device.id,
	}));
	const gateway = await getDefaultGateway();
	if (gateway) {
		nodes.unshift({ id: `gateway-${gateway}`, label: `Gateway ${gateway}` });
	}
	const links = [];
	if (nodes.length > 1) {
		for (let i = 1; i < nodes.length; i += 1) {
			links.push({ source: nodes[0].id, target: nodes[i].id });
		}
	}
	return { nodes, links };
}

async function listConfigBackups() {
	try {
		const entries = await fs.readdir(BACKUP_DIR, { withFileTypes: true });
		const files = entries.filter((entry) => entry.isFile()).slice(0, 50);
		const rows = await Promise.all(
			files.map(async (file) => {
				const filePath = path.join(BACKUP_DIR, file.name);
				const stats = await fs.stat(filePath);
				const parts = file.name.split("-");
				const deviceId = parts.length >= 2 ? parts[1] : "host";
				return {
					id: file.name,
					device_id: deviceId,
					file: file.name,
					size_bytes: stats.size,
					created_at: stats.mtime ? new Date(stats.mtime).toISOString() : "",
					status: "available",
				};
			}),
		);
		return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
	} catch {
		return [];
	}
}

async function listFirmwareJobs() {
	if (!EXEC_ENABLED) {
		return [];
	}
	if (process.platform === "win32") {
		const result = await runCommand(
			'powershell -NoProfile -Command "Get-WmiObject Win32_PnPSignedDriver | Select-Object -First 25 DeviceName,DriverVersion,DriverDate | ConvertTo-Json"',
		);
		if (!(result.ok && result.stdout)) {
			return [];
		}
		try {
			const parsed = JSON.parse(result.stdout);
			const rows = Array.isArray(parsed) ? parsed : [parsed];
			return rows.map((row) => ({
				id: crypto.randomUUID(),
				device_id: String(row?.DeviceName || "driver"),
				version: String(row?.DriverVersion || ""),
				status: "installed",
				created_at: row?.DriverDate
					? new Date(row.DriverDate).toISOString()
					: new Date().toISOString(),
			}));
		} catch {
			return [];
		}
	}
	const fwup = await runCommand("command -v fwupdmgr");
	if (fwup.ok && fwup.stdout) {
		const result = await runCommand("fwupdmgr get-updates");
		if (!(result.ok && result.stdout)) {
			return [];
		}
		return result.stdout
			.split("\n")
			.filter(Boolean)
			.slice(0, 20)
			.map((line) => ({
				id: crypto.randomUUID(),
				device_id: line.trim().slice(0, 60),
				version: "",
				status: "available",
				created_at: new Date().toISOString(),
			}));
	}
	return [];
}

async function listQosPolicies() {
	if (!EXEC_ENABLED) {
		return [];
	}
	if (process.platform === "win32") {
		const result = await runCommand(
			'powershell -NoProfile -Command "Get-NetQosPolicy | Select-Object -First 25 Name,AppPathNameMatchCondition,IPDstPortStart,IPDstPortEnd,DSCPAction | ConvertTo-Json"',
		);
		if (!(result.ok && result.stdout)) {
			return [];
		}
		try {
			const parsed = JSON.parse(result.stdout);
			const rows = Array.isArray(parsed) ? parsed : [parsed];
			return rows.map((row) => ({
				id: crypto.randomUUID(),
				name: String(row?.Name || "policy"),
				app: String(row?.AppPathNameMatchCondition || ""),
				ports: row?.IPDstPortStart
					? `${row.IPDstPortStart}-${row.IPDstPortEnd || row.IPDstPortStart}`
					: "",
				dscp: row?.DSCPAction ?? "",
				created_at: new Date().toISOString(),
			}));
		} catch {
			return [];
		}
	}
	const result = await runCommand("tc qdisc show");
	if (!(result.ok && result.stdout)) {
		return [];
	}
	return result.stdout
		.split("\n")
		.filter(Boolean)
		.slice(0, 25)
		.map((line) => ({
			id: crypto.randomUUID(),
			name: line.trim().split(/\s+/g).slice(0, 3).join(" "),
			policy: line.trim(),
			created_at: new Date().toISOString(),
		}));
}

async function listTrafficShapes() {
	if (!EXEC_ENABLED) {
		return [];
	}
	if (process.platform === "win32") {
		const result = await runCommand(
			'powershell -NoProfile -Command "Get-NetQosPolicy | Select-Object -First 25 Name,ThrottleRateAction | ConvertTo-Json"',
		);
		if (!(result.ok && result.stdout)) {
			return [];
		}
		try {
			const parsed = JSON.parse(result.stdout);
			const rows = Array.isArray(parsed) ? parsed : [parsed];
			return rows.map((row) => ({
				id: crypto.randomUUID(),
				name: String(row?.Name || "shape"),
				limit: row?.ThrottleRateAction ?? "",
				created_at: new Date().toISOString(),
			}));
		} catch {
			return [];
		}
	}
	const result = await runCommand("tc -s qdisc show");
	if (!(result.ok && result.stdout)) {
		return [];
	}
	return result.stdout
		.split("\n")
		.filter(Boolean)
		.slice(0, 25)
		.map((line) => ({
			id: crypto.randomUUID(),
			name: line.trim().split(/\s+/g).slice(0, 3).join(" "),
			limit: line.trim(),
			created_at: new Date().toISOString(),
		}));
}

async function getDefaultGateway() {
	if (!EXEC_ENABLED) {
		return "";
	}
	if (process.platform === "win32") {
		const result = await runCommand(
			'powershell -NoProfile -Command "Get-NetRoute -DestinationPrefix 0.0.0.0/0 | Sort-Object RouteMetric | Select-Object -First 1 -ExpandProperty NextHop"',
		);
		return result.ok ? String(result.stdout || "").trim() : "";
	}
	const result = await runCommand("ip route | grep '^default' | head -n 1");
	if (!(result.ok && result.stdout)) {
		return "";
	}
	const parts = result.stdout.trim().split(/\s+/g);
	const idx = parts.indexOf("via");
	return idx >= 0 ? parts[idx + 1] || "" : "";
}

async function sendAlertIntegrations(inventory, alert) {
	const integrations = Array.isArray(inventory.alert_integrations)
		? inventory.alert_integrations
		: [];
	if (integrations.length === 0 || typeof fetch !== "function") {
		return [];
	}
	const results = [];
	for (const integration of integrations) {
		const type = String(integration.type || "").toLowerCase();
		if (!integration.target) {
			continue;
		}
		if (type === "webhook" || type === "slack") {
			try {
				const payload = {
					id: alert.id,
					message: alert.message,
					severity: alert.severity,
					created_at: alert.created_at,
				};
				const res = await fetch(integration.target, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload),
				});
				results.push({
					id: integration.id,
					status: res.ok ? "sent" : "failed",
					code: res.status,
				});
			} catch (error) {
				results.push({
					id: integration.id,
					status: "failed",
					error: String(error?.message || "error"),
				});
			}
		}
	}
	return results;
}

async function getDynamicTunnels() {
	if (!EXEC_ENABLED) {
		return [];
	}
	if (process.platform === "win32") {
		const result = await runCommand(
			'powershell -NoProfile -Command "Get-Process -Name ngrok,cloudflared -ErrorAction SilentlyContinue | Select-Object Name,Id,Path | ConvertTo-Json"',
		);
		if (!(result.ok && result.stdout)) {
			return [];
		}
		try {
			const parsed = JSON.parse(result.stdout);
			const rows = Array.isArray(parsed) ? parsed : [parsed];
			return rows.map((row) => ({
				id: String(row?.Id || ""),
				name: String(row?.Name || ""),
				status: "running",
				path: row?.Path || "",
				provider: String(row?.Name || "")
					.toLowerCase()
					.includes("cloudflared")
					? "cloudflared"
					: "ngrok",
			}));
		} catch {
			return [];
		}
	}
	const result = await runCommand("ps -eo pid,comm | grep -E 'ngrok|cloudflared' | head -n 10");
	if (!(result.ok && result.stdout)) {
		return [];
	}
	return result.stdout
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			const parts = line.trim().split(/\s+/g);
			const name = parts[1] || "";
			return {
				id: parts[0] || crypto.randomUUID(),
				name,
				status: "running",
				provider: name.includes("cloudflared") ? "cloudflared" : "ngrok",
			};
		});
}

function parsePingStats(output = "") {
	if (!output) {
		return null;
	}
	if (process.platform === "win32") {
		const avgMatch = output.match(/Average = (\d+)ms/i);
		const lossMatch = output.match(/(\d+)%\s*loss/i);
		const avg = avgMatch ? Number(avgMatch[1]) : null;
		const loss = lossMatch ? Number(lossMatch[1]) : null;
		return {
			latency_ms: Number.isFinite(avg) ? avg : null,
			jitter_ms: null,
			packet_loss_pct: Number.isFinite(loss) ? loss : null,
		};
	}
	const statMatch = output.match(/rtt .* = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/);
	const lossMatch = output.match(/(\d+)% packet loss/i);
	const avg = statMatch ? Number(statMatch[2]) : null;
	const jitter = statMatch ? Number(statMatch[4]) : null;
	const loss = lossMatch ? Number(lossMatch[1]) : null;
	return {
		latency_ms: Number.isFinite(avg) ? avg : null,
		jitter_ms: Number.isFinite(jitter) ? jitter : null,
		packet_loss_pct: Number.isFinite(loss) ? loss : null,
	};
}

async function getTrafficSummary() {
	if (!EXEC_ENABLED) {
		return {
			bandwidth_mbps: null,
			latency_ms: null,
			jitter_ms: null,
			packet_loss_pct: null,
		};
	}
	const pingCmd = process.platform === "win32" ? "ping -n 4 8.8.8.8" : "ping -c 4 8.8.8.8";
	const result = await runCommand(pingCmd);
	const stats = result.ok ? parsePingStats(result.stdout) : null;
	return {
		bandwidth_mbps: null,
		latency_ms: stats?.latency_ms ?? null,
		jitter_ms: stats?.jitter_ms ?? null,
		packet_loss_pct: stats?.packet_loss_pct ?? null,
	};
}

async function getState() {
	return readLocalJson(STATE_FILE, DEFAULT_INVENTORY);
}

async function updateInventory(updater) {
	const current = await getState();
	const next = mergeInventory(await updater(current));
	await updateLocalJson(STATE_FILE, () => next, DEFAULT_INVENTORY);
	return next;
}

export async function getNetworkInventory() {
	const state = await getState();
	const devices = await getDynamicInterfaces();
	const clients = await getDynamicClients();
	const tunnels = await getDynamicTunnels();
	const topology = await getDynamicTopology(devices);
	const [configBackups, firmwareJobs, qosPolicies, trafficShapes] = await Promise.all([
		listConfigBackups(),
		listFirmwareJobs(),
		listQosPolicies(),
		listTrafficShapes(),
	]);
	return mergeInventory({
		...state,
		devices,
		clients,
		topology,
		tunnels,
		config_backups: configBackups.length > 0 ? configBackups : state.config_backups || [],
		firmware_jobs: firmwareJobs.length > 0 ? firmwareJobs : state.firmware_jobs || [],
		qos_policies: qosPolicies.length > 0 ? qosPolicies : state.qos_policies || [],
		traffic_shapes: trafficShapes.length > 0 ? trafficShapes : state.traffic_shapes || [],
	});
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

function appendConfigAudit(inventory, entry) {
	const audit = Array.isArray(inventory.config_audit) ? inventory.config_audit : [];
	inventory.config_audit = [entry, ...audit].slice(0, 50);
	return inventory;
}

export async function getNetworkOverview() {
	const inventory = await getNetworkInventory();
	const devices = inventory.devices || [];
	const alerts = inventory.alerts || [];
	const up = devices.filter((d) => d.status === "up").length;
	const down = devices.filter((d) => d.status !== "up").length;
	const trafficSummary = await getTrafficSummary();

	return {
		generated_at: new Date().toISOString(),
		device_total: devices.length,
		device_up: up,
		device_down: down,
		alert_count: alerts.length,
		alerts,
		traffic_summary: trafficSummary,
	};
}

export async function performNetworkAction(action = "", payload = {}) {
	const actionId = crypto.randomUUID();
	const requestedAt = new Date().toISOString();
	const response = {
		action_id: actionId,
		action,
		requested_at: requestedAt,
		payload,
		simulated: !EXEC_ENABLED,
		status: EXEC_ENABLED ? "executed" : "queued",
		result: null,
		inventory: null,
	};

	let command = "";
	if (action === "diagnostic.ping") {
		const target = String(payload?.target || "").trim();
		command = process.platform === "win32" ? `ping -n 4 ${target}` : `ping -c 4 ${target}`;
	} else if (action === "diagnostic.traceroute") {
		const target = String(payload?.target || "").trim();
		command = process.platform === "win32" ? `tracert ${target}` : `traceroute ${target}`;
	} else if (action === "vlan.create") {
		const vlanId = Number(payload?.vlan_id || payload?.id);
		const name = String(payload?.name || `VLAN ${vlanId}`).trim();
		const subnet = String(payload?.subnet || "").trim();
		const gateway = String(payload?.gateway || "").trim();
		if (!Number.isFinite(vlanId)) {
			response.result = { ok: false, message: "vlan_id is required." };
			return response;
		}
		response.inventory = await updateInventory((inventory) => {
			const vlans = Array.isArray(inventory.vlans) ? inventory.vlans : [];
			const exists = vlans.find((v) => Number(v.id) === vlanId);
			const next = exists
				? vlans.map((v) =>
						Number(v.id) === vlanId ? { ...v, name, subnet, gateway, updated_at: requestedAt } : v,
					)
				: [
						...vlans,
						{
							id: vlanId,
							name,
							subnet,
							gateway,
							status: "active",
							created_at: requestedAt,
						},
					];
			return appendConfigAudit(
				{ ...inventory, vlans: next },
				{
					id: actionId,
					action: "vlan.create",
					created_at: requestedAt,
					payload: { vlanId, name, subnet },
				},
			);
		});
	} else if (action === "vlan.delete") {
		const vlanId = Number(payload?.vlan_id || payload?.id);
		response.inventory = await updateInventory((inventory) =>
			appendConfigAudit(
				{
					...inventory,
					vlans: (inventory.vlans || []).filter((v) => Number(v.id) !== vlanId),
				},
				{
					id: actionId,
					action: "vlan.delete",
					created_at: requestedAt,
					payload: { vlanId },
				},
			),
		);
	} else if (action === "ipam.reserve") {
		const ip = String(payload?.ip || "").trim();
		const owner = String(payload?.owner || payload?.user || "").trim();
		if (!ip) {
			response.result = { ok: false, message: "ip is required." };
			return response;
		}
		response.inventory = await updateInventory((inventory) => {
			const reservations = Array.isArray(inventory.ipam_reservations)
				? inventory.ipam_reservations
				: [];
			const next = [
				...reservations,
				{
					id: actionId,
					ip,
					owner,
					note: payload?.note || "",
					created_at: requestedAt,
				},
			];
			return appendConfigAudit(
				{ ...inventory, ipam_reservations: next },
				{
					id: actionId,
					action: "ipam.reserve",
					created_at: requestedAt,
					payload: { ip, owner },
				},
			);
		});
	} else if (action === "ipam.release") {
		const ip = String(payload?.ip || "").trim();
		response.inventory = await updateInventory((inventory) =>
			appendConfigAudit(
				{
					...inventory,
					ipam_reservations: (inventory.ipam_reservations || []).filter((row) => row.ip !== ip),
				},
				{
					id: actionId,
					action: "ipam.release",
					created_at: requestedAt,
					payload: { ip },
				},
			),
		);
	} else if (action === "dhcp.pool.add") {
		const name = String(payload?.name || `Pool ${actionId.slice(0, 6)}`).trim();
		const start = String(payload?.start_ip || "").trim();
		const end = String(payload?.end_ip || "").trim();
		const subnet = String(payload?.subnet || "").trim();
		response.inventory = await updateInventory((inventory) =>
			appendConfigAudit(
				{
					...inventory,
					dhcp_pools: [
						...(inventory.dhcp_pools || []),
						{
							id: actionId,
							name,
							start_ip: start,
							end_ip: end,
							subnet,
							status: "active",
							created_at: requestedAt,
						},
					],
				},
				{
					id: actionId,
					action: "dhcp.pool.add",
					created_at: requestedAt,
					payload: { name, start, end },
				},
			),
		);
	} else if (action === "dhcp.pool.remove") {
		const poolId = String(payload?.pool_id || payload?.id || "").trim();
		response.inventory = await updateInventory((inventory) =>
			appendConfigAudit(
				{
					...inventory,
					dhcp_pools: (inventory.dhcp_pools || []).filter((pool) => String(pool.id) !== poolId),
				},
				{
					id: actionId,
					action: "dhcp.pool.remove",
					created_at: requestedAt,
					payload: { poolId },
				},
			),
		);
	} else if (action === "config.backup") {
		const deviceId = String(payload?.device_id || "").trim();
		const backupId = deviceId || "host";
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const fileName = `config-${backupId}-${timestamp}.txt`;
		await fs
			.mkdir(BACKUP_DIR, { recursive: true })
			.catch((err) => logError("networkService: mkdir backup dir failed", err));
		let snapshot = "snapshot unavailable";
		if (EXEC_ENABLED) {
			const cmd =
				process.platform === "win32"
					? 'powershell -NoProfile -Command "ipconfig /all; route print"'
					: "ip addr show; ip route";
			const result = await runCommand(cmd);
			snapshot = result.ok ? result.stdout : result.stderr || "snapshot failed";
		}
		await fs
			.writeFile(path.join(BACKUP_DIR, fileName), String(snapshot || ""), "utf8")
			.catch((err) => logError("networkService: writeFile backup failed", err));
		response.inventory = await updateInventory((inventory) =>
			appendConfigAudit(
				{
					...inventory,
					config_backups: [
						{
							id: actionId,
							device_id: deviceId || "host",
							file: fileName,
							created_at: requestedAt,
							status: EXEC_ENABLED ? "completed" : "queued",
						},
						...(inventory.config_backups || []),
					].slice(0, 30),
				},
				{
					id: actionId,
					action: "config.backup",
					created_at: requestedAt,
					payload: { deviceId },
				},
			),
		);
	} else if (action === "firmware.update") {
		const deviceId = String(payload?.device_id || "").trim();
		const version = String(payload?.version || "").trim();
		response.inventory = await updateInventory((inventory) =>
			appendConfigAudit(
				{
					...inventory,
					firmware_jobs: [
						{
							id: actionId,
							device_id: deviceId,
							version,
							status: "scheduled",
							created_at: requestedAt,
						},
						...(inventory.firmware_jobs || []),
					].slice(0, 40),
				},
				{
					id: actionId,
					action: "firmware.update",
					created_at: requestedAt,
					payload: { deviceId, version },
				},
			),
		);
	} else if (action === "device.reboot") {
		const deviceId = String(payload?.device_id || "").trim();
		response.inventory = await updateInventory((inventory) =>
			appendConfigAudit(
				{
					...inventory,
					devices: (inventory.devices || []).map((device) =>
						String(device.id) === deviceId
							? { ...device, status: "restarting", updated_at: requestedAt }
							: device,
					),
				},
				{
					id: actionId,
					action: "device.reboot",
					created_at: requestedAt,
					payload: { deviceId },
				},
			),
		);
	} else if (action === "vpn.create") {
		const name = String(payload?.name || `VPN ${actionId.slice(0, 4)}`).trim();
		const endpoint = String(payload?.endpoint || "").trim();
		response.inventory = await updateInventory((inventory) =>
			appendConfigAudit(
				{
					...inventory,
					vpn_tunnels: [
						...(inventory.vpn_tunnels || []),
						{
							id: actionId,
							name,
							endpoint,
							status: "active",
							created_at: requestedAt,
						},
					],
				},
				{
					id: actionId,
					action: "vpn.create",
					created_at: requestedAt,
					payload: { name, endpoint },
				},
			),
		);
	} else if (action === "vpn.delete") {
		const tunnelId = String(payload?.tunnel_id || payload?.id || "").trim();
		response.inventory = await updateInventory((inventory) =>
			appendConfigAudit(
				{
					...inventory,
					vpn_tunnels: (inventory.vpn_tunnels || []).filter(
						(tunnel) => String(tunnel.id) !== tunnelId,
					),
				},
				{
					id: actionId,
					action: "vpn.delete",
					created_at: requestedAt,
					payload: { tunnelId },
				},
			),
		);
	} else if (action === "qos.update") {
		const name = String(payload?.name || `QoS ${actionId.slice(0, 4)}`).trim();
		const policy = String(payload?.policy || "").trim();
		response.inventory = await updateInventory((inventory) =>
			appendConfigAudit(
				{
					...inventory,
					qos_policies: [
						...(inventory.qos_policies || []),
						{ id: actionId, name, policy, created_at: requestedAt },
					],
				},
				{
					id: actionId,
					action: "qos.update",
					created_at: requestedAt,
					payload: { name, policy },
				},
			),
		);
	} else if (action === "traffic.shape") {
		const name = String(payload?.name || `Shape ${actionId.slice(0, 4)}`).trim();
		const limit = String(payload?.limit || "").trim();
		response.inventory = await updateInventory((inventory) =>
			appendConfigAudit(
				{
					...inventory,
					traffic_shapes: [
						...(inventory.traffic_shapes || []),
						{ id: actionId, name, limit, created_at: requestedAt },
					],
				},
				{
					id: actionId,
					action: "traffic.shape",
					created_at: requestedAt,
					payload: { name, limit },
				},
			),
		);
	} else if (action === "alert.create") {
		const severity = String(payload?.severity || "medium").trim();
		const message = String(payload?.message || "Network alert").trim();
		response.inventory = await updateInventory((inventory) => ({
			...inventory,
			alerts: [
				{ id: actionId, severity, message, created_at: requestedAt },
				...(inventory.alerts || []),
			].slice(0, 50),
		}));
		const results = await sendAlertIntegrations(response.inventory, {
			id: actionId,
			severity,
			message,
			created_at: requestedAt,
		});
		response.result = { ok: true, integrations: results };
	} else if (action === "alert.resolve") {
		const alertId = String(payload?.alert_id || "").trim();
		response.inventory = await updateInventory((inventory) => ({
			...inventory,
			alerts: (inventory.alerts || []).filter((alert) => String(alert.id) !== alertId),
		}));
	} else if (action === "security.ids.scan") {
		response.inventory = await updateInventory((inventory) =>
			appendConfigAudit(
				{
					...inventory,
					ids_alerts: [
						{
							id: actionId,
							severity: "low",
							message: "IDS scan completed",
							created_at: requestedAt,
						},
						...(inventory.ids_alerts || []),
					].slice(0, 50),
				},
				{
					id: actionId,
					action: "security.ids.scan",
					created_at: requestedAt,
					payload: {},
				},
			),
		);
	} else if (action === "security.rogue_scan") {
		response.inventory = await updateInventory((inventory) =>
			appendConfigAudit(
				{
					...inventory,
					rogue_aps: [
						{
							id: actionId,
							ssid: payload.ssid || "Unknown AP",
							mac: payload.mac || "00:00:00:00:00:00",
							detected_at: requestedAt,
						},
						...(inventory.rogue_aps || []),
					].slice(0, 50),
				},
				{
					id: actionId,
					action: "security.rogue_scan",
					created_at: requestedAt,
					payload: { ssid: payload.ssid },
				},
			),
		);
	} else if (action === "security.auth_server.add") {
		const server = {
			id: actionId,
			type: payload.type || "radius",
			host: payload.host || "10.0.0.10",
			status: "active",
			created_at: requestedAt,
		};
		response.inventory = await updateInventory((inventory) =>
			appendConfigAudit(
				{
					...inventory,
					auth_servers: [...(inventory.auth_servers || []), server],
				},
				{
					id: actionId,
					action: "security.auth_server.add",
					created_at: requestedAt,
					payload: server,
				},
			),
		);
	} else if (action === "security.firewall.policy.add") {
		const policy = {
			id: actionId,
			name: payload.name || "policy",
			action: payload.action || "allow",
			source: payload.source || "any",
			destination: payload.destination || "any",
			created_at: requestedAt,
		};
		response.inventory = await updateInventory((inventory) =>
			appendConfigAudit(
				{
					...inventory,
					firewall_policies: [...(inventory.firewall_policies || []), policy],
				},
				{
					id: actionId,
					action: "security.firewall.policy.add",
					created_at: requestedAt,
					payload: policy,
				},
			),
		);
	} else if (action === "netflow.refresh") {
		const stat = {
			id: actionId,
			top_talkers: payload.top_talkers || ["10.0.0.12", "10.0.0.15"],
			total_flows: Number(payload.total_flows || 1200),
			created_at: requestedAt,
		};
		response.inventory = await updateInventory((inventory) => ({
			...inventory,
			flow_stats: [stat, ...(inventory.flow_stats || [])].slice(0, 20),
		}));
	} else if (action === "diagnostic.snmp") {
		const target = String(payload?.target || "").trim();
		command =
			process.platform === "win32"
				? `snmpwalk -v2c -c public ${target}`
				: `snmpwalk -v2c -c public ${target}`;
	} else if (action === "config.deploy") {
		const job = {
			id: actionId,
			name: payload.name || "bulk-config",
			status: "scheduled",
			created_at: requestedAt,
		};
		response.inventory = await updateInventory((inventory) =>
			appendConfigAudit(
				{
					...inventory,
					bulk_config_jobs: [job, ...(inventory.bulk_config_jobs || [])].slice(0, 20),
				},
				{
					id: actionId,
					action: "config.deploy",
					created_at: requestedAt,
					payload: job,
				},
			),
		);
	} else if (action === "config.restore") {
		const job = {
			id: actionId,
			device_id: payload.device_id || "",
			status: "queued",
			created_at: requestedAt,
		};
		response.inventory = await updateInventory((inventory) =>
			appendConfigAudit(
				{
					...inventory,
					config_restore_jobs: [job, ...(inventory.config_restore_jobs || [])].slice(0, 20),
				},
				{
					id: actionId,
					action: "config.restore",
					created_at: requestedAt,
					payload: job,
				},
			),
		);
	} else if (action === "device.discovery") {
		const device = {
			id: payload.device_id || `dev-${actionId.slice(0, 4)}`,
			type: payload.type || "switch",
			name: payload.name || "Discovered device",
			ip: payload.ip || "10.0.0.50",
			status: "up",
			firmware: payload.firmware || "v1.0",
			location: payload.location || "Unknown",
		};
		response.inventory = await updateInventory((inventory) => ({
			...inventory,
			devices: [...(inventory.devices || []), device],
			discovery_jobs: [
				{
					id: actionId,
					status: "completed",
					created_at: requestedAt,
					device_id: device.id,
				},
				...(inventory.discovery_jobs || []),
			].slice(0, 20),
		}));
	} else if (action === "alert.integration.add") {
		const integration = {
			id: actionId,
			type: payload.type || "email",
			target: payload.target || "ops@example.com",
			status: "active",
		};
		response.inventory = await updateInventory((inventory) => ({
			...inventory,
			alert_integrations: [...(inventory.alert_integrations || []), integration],
		}));
	}

	if (!command) {
		response.result = response.inventory
			? { ok: true, message: "Network action applied." }
			: { ok: false, message: "Unsupported network action." };
		return response;
	}

	if (!EXEC_ENABLED) {
		response.result = {
			ok: true,
			simulated: true,
			message: "Simulation mode: network action queued.",
		};
		return response;
	}

	response.result = await runCommand(command);
	return response;
}
