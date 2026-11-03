import prisma from "./prisma.js";

const AUDIT_CACHE_TTL = 10_000;
let auditCache = { data: null, timestamp: 0 };

function getAuditCache() {
	if (auditCache.data && Date.now() - auditCache.timestamp < AUDIT_CACHE_TTL) {
		return auditCache.data;
	}
	return null;
}

function setAuditCache(data) {
	auditCache = { data, timestamp: Date.now() };
}

export function invalidateAuditCache() {
	auditCache = { data: null, timestamp: 0 };
}

export async function readAuditLog() {
	const cached = getAuditCache();
	if (cached !== null) {
		return cached;
	}

	try {
		const rows = await prisma.adminAudit.findMany({
			orderBy: { created_at: "desc" },
			take: 500,
		});
		const data = rows.map((r) => ({
			id: r.id,
			admin_id: r.admin_id,
			action: r.action,
			entity_type: r.entity_type,
			entity_id: r.entity_id,
			details: r.details,
			ip_address: r.ip_address,
			user_agent: r.user_agent,
			created_at: r.created_at.toISOString(),
		}));
		setAuditCache(data);
		return data;
	} catch {
		return [];
	}
}

const REDACTED_KEYS = new Set([
	"password",
	"new_password",
	"token",
	"authorization",
	"jwt",
	"secret",
]);

export function sanitizeAuditPayload(payload = {}) {
	if (!payload || typeof payload !== "object") {
		return payload;
	}
	return Object.fromEntries(
		Object.entries(payload).map(([key, value]) => {
			if (REDACTED_KEYS.has(String(key).toLowerCase())) {
				return [key, "[redacted]"];
			}
			return [key, value];
		}),
	);
}

export async function appendAuditLog(entry) {
	try {
		const record = await prisma.adminAudit.create({
			data: {
				admin_id: entry.admin_id || entry.adminId || "system",
				action: entry.action || "unknown",
				entity_type: entry.entity_type || entry.entityType || null,
				entity_id: entry.entity_id || entry.entityId || null,
				details: entry.details || entry.payload || {},
				ip_address: entry.ip_address || entry.ipAddress || null,
				user_agent: entry.user_agent || entry.userAgent || null,
			},
		});
		invalidateAuditCache();
		return record;
	} catch {
		return null;
	}
}
