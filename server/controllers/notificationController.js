import {
	deleteSearchAlertForUser,
	getNotificationPreferences,
	listMySearchAlerts,
	listNotifications,
	markAllNotificationsRead,
	markNotificationRead,
	saveSearchAlert,
	updateNotificationPreferences,
} from "../services/notificationService.js";
import {
	buildLimitError,
	buildSearchAccessPayload,
	consumeQuota,
	getUserPlan,
} from "../services/searchAccessService.js";

export async function createSearchAlert(req, res) {
	const plan = await getUserPlan(req.user.id);
	const quotaUse = await consumeQuota(req.user.id, "search_alerts_create", plan);

	if (!quotaUse.allowed) {
		return res.status(429).json(
			buildLimitError({
				code: "limit_reached",
				message: "Daily alert creation limit reached",
				quota: quotaUse.quota,
			}),
		);
	}

	const row = await saveSearchAlert(req.user.id, req.body?.query, req.body?.filters || {});
	if (!row) {
		return res.status(400).json({ error: "Query is required" });
	}
	return res.status(201).json({
		...row,
		...buildSearchAccessPayload({
			action: "search_alerts_create",
			plan,
			quota: quotaUse.quota,
		}),
	});
}

export async function getSearchAlerts(req, res) {
	return res.json(await listMySearchAlerts(req.user.id));
}

export async function getNotifications(req, res) {
	return res.json(await listNotifications(req.user.id));
}

export async function readNotification(req, res) {
	const row = await markNotificationRead(req.user.id, req.params.notificationId);
	if (!row) {
		return res.status(404).json({ error: "Notification not found" });
	}
	return res.json(row);
}

export async function readAllNotifications(req, res) {
	await markAllNotificationsRead(req.user.id);
	return res.json({ ok: true });
}

export async function deleteSearchAlert(req, res) {
	const ok = await deleteSearchAlertForUser(req.user.id, req.params.alertId);
	if (!ok) {
		return res.status(404).json({ error: "Search alert not found" });
	}
	return res.json({ ok: true });
}

export async function getPreferences(req, res) {
	return res.json(await getNotificationPreferences(req.user.id));
}

export async function updatePreferences(req, res) {
	const prefs = await updateNotificationPreferences(req.user.id, req.body || {});
	return res.json(prefs);
}
