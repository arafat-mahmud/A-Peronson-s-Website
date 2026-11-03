import { exec } from "node:child_process";
import util from "node:util";
import { getAdminConfig } from "./adminConfigService.js";
import { getEmailDeliveryStatus } from "./emailService.js";
import {
	ensureOpenSearchIndices,
	getOpenSearchStatus,
	reindexAll as opensearchReindexAll,
	reindexOrg as opensearchReindexOrg,
} from "./openSearchService.js";

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

function isConfigured(value) {
	return Boolean(value && String(value).trim());
}

async function runCommand(command) {
	if (!EXEC_ENABLED) {
		return { ok: false, stdout: "", stderr: "exec_disabled" };
	}
	if (!EXEC_ALLOW_ANY && EXEC_ALLOWLIST.size > 0) {
		const allowed = [...EXEC_ALLOWLIST].some((prefix) => command.startsWith(prefix));
		if (!allowed) {
			return { ok: false, stdout: "", stderr: "not_allowlisted" };
		}
	}
	try {
		const { stdout } = await execAsync(command, {
			timeout: EXEC_TIMEOUT_MS,
			windowsHide: true,
		});
		return { ok: true, stdout: String(stdout || "").trim(), stderr: "" };
	} catch (error) {
		return {
			ok: false,
			stdout: String(error?.stdout || "").trim(),
			stderr: String(error?.stderr || error?.message || ""),
		};
	}
}

async function detectInstallerSource() {
	if (process.platform === "win32") {
		return { os: "windows", source: "winget", available: true };
	}
	const dnf = await runCommand("command -v dnf");
	if (dnf.ok && dnf.stdout) {
		return { os: "linux", source: "dnf", available: true };
	}
	const yum = await runCommand("command -v yum");
	if (yum.ok && yum.stdout) {
		return { os: "linux", source: "yum", available: true };
	}
	const apt = await runCommand("command -v apt");
	if (apt.ok && apt.stdout) {
		return { os: "linux", source: "apt", available: true };
	}
	return { os: process.platform, source: "unknown", available: false };
}

export async function getIntegrationStatus() {
	const config = await getAdminConfig();
	const installer = await detectInstallerSource();
	const emailStatus = await getEmailDeliveryStatus();
	const opensearchConfig = config?.integrations?.opensearch || {};
	const opensearchUrl = String(opensearchConfig?.url || "");
	const opensearchEnabled = Boolean(opensearchConfig?.enabled);
	const opensearchUrlSet = isConfigured(opensearchUrl);

	return {
		signature: {
			provider: process.env.SIGNATURE_PROVIDER || "",
			configured:
				isConfigured(process.env.SIGNATURE_CLIENT_ID) &&
				isConfigured(process.env.SIGNATURE_CLIENT_SECRET),
		},
		bank_validation: {
			provider: process.env.BANK_API_BASE || "",
			configured: isConfigured(process.env.BANK_API_KEY),
		},
		ids_ips: {
			source: process.env.IDS_SOURCE || "",
			configured: isConfigured(process.env.IDS_LOG_PATH) || isConfigured(process.env.IDS_API_URL),
		},
		radius: {
			configured: isConfigured(process.env.RADIUS_HOST) && isConfigured(process.env.RADIUS_SECRET),
		},
		tacacs: {
			configured: isConfigured(process.env.TACACS_HOST) && isConfigured(process.env.TACACS_SECRET),
		},
		rogue_ap: {
			configured: isConfigured(process.env.WIFI_CONTROLLER_API),
		},
		netflow: {
			configured:
				isConfigured(process.env.NETFLOW_COLLECTOR) || isConfigured(process.env.NETFLOW_API),
		},
		alert_delivery: {
			slack:
				isConfigured(process.env.SLACK_WEBHOOK_URL) ||
				(config.integrations?.webhooks || []).length > 0,
			sms: isConfigured(process.env.SMS_PROVIDER) && isConfigured(process.env.SMS_API_KEY),
			email: isConfigured(process.env.SMTP_HOST) && isConfigured(process.env.SMTP_USER),
		},
		backups: {
			s3: isConfigured(process.env.S3_BUCKET) && isConfigured(process.env.S3_ACCESS_KEY),
			gcs: isConfigured(process.env.GCS_BUCKET) && isConfigured(process.env.GCS_ACCESS_KEY),
			spaces:
				isConfigured(process.env.SPACES_BUCKET) && isConfigured(process.env.SPACES_ACCESS_KEY),
		},
		phpmyadmin: {
			url: process.env.PHPMYADMIN_URL || "",
			configured: isConfigured(process.env.PHPMYADMIN_URL),
		},
		installers: installer,
		registrar: {
			provider: process.env.REGISTRAR_PROVIDER || "",
			configured: isConfigured(process.env.REGISTRAR_API_TOKEN),
		},
		opensearch: {
			enabled: opensearchEnabled,
			url_set: opensearchUrlSet,
			configured: Boolean(opensearchEnabled && opensearchUrlSet),
			index_prefix: String(opensearchConfig?.index_prefix || ""),
		},
		email_notifications: emailStatus,
	};
}

export async function runIntegrationAction(action = "", payload = {}) {
	const safeAction = String(action || "").trim();
	const data = payload && typeof payload === "object" ? payload : {};

	if (!safeAction) {
		return { ok: false, action: safeAction, error: "action_required" };
	}

	if (safeAction === "opensearch.test_connection") {
		const status = await getOpenSearchStatus();
		return { ok: Boolean(status?.reachable), action: safeAction, status };
	}

	if (safeAction === "opensearch.ensure_indices") {
		const result = await ensureOpenSearchIndices();
		return { ok: Boolean(result?.ok), action: safeAction, result };
	}

	if (safeAction === "opensearch.reindex_all") {
		const reset = data.reset === true || String(data.reset || "").toLowerCase() === "true";
		const result = await opensearchReindexAll({ reset });
		return { ok: Boolean(result?.ok), action: safeAction, result };
	}

	if (safeAction === "opensearch.reindex_org") {
		const orgId = String(data.org_id || data.orgId || "").trim();
		const result = await opensearchReindexOrg(orgId);
		return { ok: Boolean(result?.ok), action: safeAction, result };
	}

	return {
		ok: false,
		action: safeAction,
		error: "unsupported_action",
		status: await getIntegrationStatus(),
	};
}
