import { logError } from "../utils/logger.js";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";
import { sendEmail } from "./emailService.js";
import { trackEvent } from "./eventTrackingService.js";
import { createNotification } from "./notificationService.js";

let sweepActive = false;

function buildRecipientSet({ reminder, lead }) {
	const recipients = new Set();
	if (reminder?.created_by) {
		recipients.add(String(reminder.created_by));
	}
	if (lead?.assigned_agent_id) {
		recipients.add(String(lead.assigned_agent_id));
	}
	if (lead?.org_owner_id) {
		recipients.add(String(lead.org_owner_id));
	}
	return recipients;
}

function formatLeadLabel(lead, usersById) {
	if (!lead) {
		return "Lead reminder";
	}
	const counterparty = usersById.get(String(lead.counterparty_id || ""));
	const counterpartyName = counterparty?.name || counterparty?.email || lead.counterparty_id || "";
	return counterpartyName ? `Lead with ${counterpartyName}` : "Lead reminder";
}

export async function runLeadReminderSweep() {
	if (sweepActive) {
		return { ok: false, skipped: true };
	}
	sweepActive = true;

	try {
		const [reminders, leads, users] = await Promise.all([
			prisma.leadReminder.findMany(),
			prisma.lead.findMany(),
			prisma.user.findMany(),
		]);

		const usersById = new Map(users.map((u) => [String(u.id), u]));
		const leadsById = new Map(leads.map((l) => [String(l.id), l]));

		const now = Date.now();
		let processed = 0;

		const sideEffects = [];
		const updates = [];

		for (const reminder of reminders) {
			const remindAt = new Date(reminder.remind_at || "").getTime();
			if (!Number.isFinite(remindAt)) {
				continue;
			}
			if (reminder.done) {
				continue;
			}
			if (remindAt > now) {
				continue;
			}

			const lead = leadsById.get(String(reminder.lead_id || ""));
			const recipients = [...buildRecipientSet({ reminder, lead })];
			const label = formatLeadLabel(lead, usersById);
			const message = sanitizeString(String(reminder.message || "Follow up"), 200);

			recipients.forEach((recipientId) => {
				sideEffects.push(
					createNotification(recipientId, {
						type: "lead_reminder_due",
						entity_type: "lead",
						entity_id: reminder.lead_id,
						message: `${label}: ${message}`,
						meta: {
							lead_id: reminder.lead_id,
							remind_at: reminder.remind_at,
						},
					}),
				);

				const user = usersById.get(String(recipientId));
				if (user?.email) {
					sideEffects.push(
						sendEmail({
							to: user.email,
							subject: "GarTexHub reminder",
							text: `${label}\n\nReminder: ${message}\nDue: ${reminder.remind_at}`,
						}),
					);
				}
			});

			sideEffects.push(
				trackEvent({
					type: "lead_reminder_due",
					actor_id: reminder.created_by || reminder.org_owner_id || null,
					entity_id: reminder.lead_id,
					metadata: {
						reminder_id: reminder.id,
						lead_id: reminder.lead_id,
						recipients,
					},
				}),
			);

			updates.push(
				prisma.leadReminder.update({
					where: { id: reminder.id },
					data: {
						done: true,
						notified_at: new Date(),
					},
				}),
			);

			processed += 1;
		}

		if (updates.length > 0) {
			await prisma.$transaction(updates);
		}

		if (sideEffects.length > 0) {
			try {
				await Promise.allSettled(sideEffects);
			} catch {
				void 0;
			}
		}

		return { ok: true, processed };
	} catch (error) {
		logError("lead_reminder_sweep_failed", error);
		return { ok: false, error: error?.message || "lead_reminder_sweep_failed" };
	} finally {
		sweepActive = false;
	}
}
