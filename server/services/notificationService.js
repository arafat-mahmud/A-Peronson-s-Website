import crypto from "node:crypto";
import { emitNotificationCreated, emitNotificationRead } from "../realtime/realtimeBus.js";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";

export async function createNotification(userId, payload = {}) {
	const row = {
		id: sanitizeString(String(payload.id || crypto.randomUUID()), 120),
		user_id: sanitizeString(String(userId || ""), 120),
		type: sanitizeString(payload.type || "system", 64),
		entity_type: sanitizeString(payload.entity_type || "", 64),
		entity_id: sanitizeString(payload.entity_id || "", 120),
		message: sanitizeString(payload.message || "Notification", 240),
		meta: payload.meta && typeof payload.meta === "object" ? payload.meta : {},
		read: false,
		created_at: new Date(),
	};
	await prisma.notification.create({ data: row });
	emitNotificationCreated(userId, row);
	return row;
}

export async function saveSearchAlert(userId, query, filters = {}) {
	const normalizedQuery = sanitizeString(query || "", 160).toLowerCase();
	if (!normalizedQuery) {
		return null;
	}

	const existing = await prisma.searchAlert.findFirst({
		where: { user_id: userId, query: normalizedQuery },
	});
	if (existing) {
		const updated = await prisma.searchAlert.update({
			where: { id: existing.id },
			data: { filters, updated_at: new Date() },
		});
		return updated;
	}

	const row = {
		id: crypto.randomUUID(),
		user_id: userId,
		query: normalizedQuery,
		filters,
		created_at: new Date(),
		updated_at: new Date(),
	};
	await prisma.searchAlert.create({ data: row });
	return row;
}

export async function listMySearchAlerts(userId) {
	return prisma.searchAlert.findMany({ where: { user_id: userId } });
}

export async function deleteSearchAlertForUser(userId, alertId) {
	const existing = await prisma.searchAlert.findFirst({
		where: { id: alertId, user_id: userId },
	});
	if (!existing) {
		return false;
	}
	await prisma.searchAlert.delete({ where: { id: alertId } });
	return true;
}

function normalizeFilters(filters = {}) {
	return filters && typeof filters === "object" ? filters : {};
}

function scoreMatch(alert, entityType, entity, payloadText) {
	const hay = String(payloadText || "").toLowerCase();
	const queryParts = String(alert.query || "")
		.split(/\s+/)
		.map((p) => p.trim())
		.filter(Boolean);

	if (queryParts.length === 0) {
		return 0;
	}

	let score = 0;
	const title = String(entity?.title || "").toLowerCase();

	for (const part of queryParts) {
		if (!part) {
			continue;
		}
		if (title.includes(part)) {
			score += 25;
		} else if (hay.includes(part)) {
			score += 15;
		}
	}

	const filters = normalizeFilters(alert.filters);
	if (filters.verifiedOnly && !entity?.verified) {
		return 0;
	}
	if (
		filters.category &&
		String(entity?.category || "").toLowerCase() !== String(filters.category || "").toLowerCase()
	) {
		return 0;
	}

	// orgType is only meaningful for company products (factory/buying_house).
	if (
		filters.orgType &&
		entityType === "company_product" &&
		String(entity?.company_role || "").toLowerCase() !== String(filters.orgType || "").toLowerCase()
	) {
		return 0;
	}

	// Give a small bonus when core filters match.
	if (filters.category && score > 0) {
		score += 10;
	}
	if (filters.verifiedOnly && score > 0) {
		score += 10;
	}

	return score;
}

export async function emitNotificationsForEntity(entityType, entity) {
	const alerts = await prisma.searchAlert.findMany();
	const payloadText = `${entity.title || ""} ${entity.category || ""} ${entity.material || ""} ${entity.description || ""} ${entity.custom_description || ""}`;

	const newNotifications = [];
	for (const alert of alerts) {
		const score = scoreMatch(alert, entityType, entity, payloadText);
		if (score < 50) {
			continue;
		}
		const row = {
			id: crypto.randomUUID(),
			user_id: alert.user_id,
			type: "smart_search_match",
			entity_type: entityType,
			entity_id: entity.id,
			message: `New ${entityType.replace("_", " ")} matches your search: "${alert.query}"`,
			meta: { score },
			read: false,
			created_at: new Date(),
		};
		newNotifications.push(prisma.notification.create({ data: row }));
	}

	if (newNotifications.length > 0) {
		await Promise.all(newNotifications);
	}
}

export async function listNotifications(userId) {
	const notifications = await prisma.notification.findMany({
		where: { user_id: userId },
		orderBy: { created_at: "desc" },
	});
	const ensured = await ensureMonthlySummary(userId, notifications);
	return ensured
		.filter((n) => n.user_id === userId)
		.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function markNotificationRead(userId, id) {
	const existing = await prisma.notification.findFirst({
		where: { id, user_id: userId },
	});
	if (!existing) {
		return null;
	}
	const updated = await prisma.notification.update({
		where: { id },
		data: { read: true },
	});
	emitNotificationRead(userId, id);
	return updated;
}

export async function markAllNotificationsRead(userId) {
	await prisma.notification.updateMany({
		where: { user_id: userId, read: false },
		data: { read: true },
	});
	return { ok: true };
}

function monthKey(date = new Date()) {
	const month = String(date.getMonth() + 1).padStart(2, "0");
	return `${date.getFullYear()}-${month}`;
}

async function ensureMonthlySummary(userId, userNotifications = []) {
	const key = monthKey();
	const already = userNotifications.some(
		(n) => n.type === "monthly_summary" && String(n?.meta?.month || "") === key,
	);
	if (already) {
		return userNotifications;
	}

	const monthStart = new Date(`${key}-01T00:00:00.000Z`);

	const [reqCount, msgCount, contractCount] = await Promise.all([
		prisma.requirement.count({
			where: { buyer_id: userId, created_at: { gte: monthStart } },
		}),
		prisma.message.count({
			where: { sender_id: userId, timestamp: { gte: monthStart } },
		}),
		prisma.document.count({
			where: { entity_type: "contract", created_at: { gte: monthStart } },
		}),
	]);

	const summary = {
		id: crypto.randomUUID(),
		user_id: sanitizeString(String(userId || ""), 120),
		type: "monthly_summary",
		entity_type: "summary",
		entity_id: key,
		message: `Monthly summary (${key}): ${reqCount} requests, ${msgCount} messages, ${contractCount} contracts.`,
		meta: {
			month: key,
			requests: reqCount,
			messages: msgCount,
			contracts: contractCount,
		},
		read: false,
		created_at: new Date(),
	};

	await prisma.notification.create({ data: summary });
	const all = await prisma.notification.findMany({
		where: { user_id: userId },
		orderBy: { created_at: "desc" },
	});
	return all;
}

export async function getNotificationPreferences(userId) {
	let prefs = await prisma.notificationPreferences.findUnique({
		where: { user_id: userId },
	});
	if (!prefs) {
		prefs = await prisma.notificationPreferences.create({
			data: { user_id: userId },
		});
	}
	return prefs;
}

export async function updateNotificationPreferences(userId, payload = {}) {
	const data = {};
	if (typeof payload.email_enabled === "boolean") {
		data.email_enabled = payload.email_enabled;
	}
	if (typeof payload.push_enabled === "boolean") {
		data.push_enabled = payload.push_enabled;
	}
	if (typeof payload.message_notifs === "boolean") {
		data.message_notifs = payload.message_notifs;
	}
	if (typeof payload.requirement_notifs === "boolean") {
		data.requirement_notifs = payload.requirement_notifs;
	}
	if (typeof payload.contract_notifs === "boolean") {
		data.contract_notifs = payload.contract_notifs;
	}
	if (typeof payload.smart_match_notifs === "boolean") {
		data.smart_match_notifs = payload.smart_match_notifs;
	}
	if (typeof payload.monthly_summary === "boolean") {
		data.monthly_summary = payload.monthly_summary;
	}

	const prefs = await prisma.notificationPreferences.upsert({
		where: { user_id: userId },
		update: data,
		create: { user_id: userId, ...data },
	});
	return prefs;
}
