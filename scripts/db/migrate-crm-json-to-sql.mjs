import fs from "node:fs/promises";
import path from "node:path";
import prisma from "../../server/utils/prisma.js";

const ROOT = process.cwd();
const LEGACY_DB_DIR = path.join(ROOT, "server", "database");

function toIso(value, fallback = null) {
	if (!value) {
		return fallback;
	}
	const d = new Date(value);
	return Number.isFinite(d.getTime()) ? d.toISOString() : fallback;
}

async function readLegacyJson(fileName) {
	const filePath = path.join(LEGACY_DB_DIR, fileName);
	const raw = await fs.readFile(filePath, "utf8").catch(() => null);
	if (!raw) {
		return [];
	}
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function sanitizeId(value, fallbackPrefix) {
	const str = String(value || "").trim();
	if (str) {
		return str;
	}
	return `${fallbackPrefix}_${Math.random().toString(36).slice(2, 10)}`;
}

async function migrateLeads(leads) {
	for (const lead of leads) {
		const id = sanitizeId(lead.id, "lead");
		const orgOwnerId = String(lead.org_owner_id || "");
		if (!orgOwnerId) {
			continue;
		}
		await prisma.lead.upsert({
			where: { id },
			update: {
				org_owner_id: orgOwnerId,
				match_id: String(lead.match_id || ""),
				counterparty_id: lead.counterparty_id || null,
				status: lead.status || "new",
				assigned_agent_id: lead.assigned_agent_id || null,
				source: lead.source || null,
				source_type: lead.source_type || null,
				source_id: lead.source_id || null,
				source_label: lead.source_label || null,
				conversion_at: toIso(lead.conversion_at),
				last_interaction_at: toIso(lead.last_interaction_at),
				updated_at: toIso(lead.updated_at, new Date().toISOString()),
			},
			create: {
				id,
				org_owner_id: orgOwnerId,
				match_id: String(lead.match_id || ""),
				counterparty_id: lead.counterparty_id || null,
				status: lead.status || "new",
				assigned_agent_id: lead.assigned_agent_id || null,
				source: lead.source || null,
				source_type: lead.source_type || null,
				source_id: lead.source_id || null,
				source_label: lead.source_label || null,
				conversion_at: toIso(lead.conversion_at),
				last_interaction_at: toIso(lead.last_interaction_at),
				created_at: toIso(lead.created_at, new Date().toISOString()),
				updated_at: toIso(lead.updated_at),
			},
		});
	}
}

async function migrateLeadNotes(notes) {
	for (const note of notes) {
		const id = sanitizeId(note.id, "lead_note");
		if (!(note.lead_id && note.org_owner_id && note.author_id)) {
			continue;
		}
		await prisma.leadNote.upsert({
			where: { id },
			update: {
				lead_id: String(note.lead_id),
				org_owner_id: String(note.org_owner_id),
				author_id: String(note.author_id),
				note: note.note || "",
				created_at: toIso(note.created_at, new Date().toISOString()),
			},
			create: {
				id,
				lead_id: String(note.lead_id),
				org_owner_id: String(note.org_owner_id),
				author_id: String(note.author_id),
				note: note.note || "",
				created_at: toIso(note.created_at, new Date().toISOString()),
			},
		});
	}
}

async function migrateLeadReminders(reminders) {
	for (const reminder of reminders) {
		const id = sanitizeId(reminder.id, "lead_reminder");
		if (!(reminder.lead_id && reminder.org_owner_id && reminder.created_by)) {
			continue;
		}
		await prisma.leadReminder.upsert({
			where: { id },
			update: {
				lead_id: String(reminder.lead_id),
				org_owner_id: String(reminder.org_owner_id),
				created_by: String(reminder.created_by),
				remind_at: toIso(reminder.remind_at, new Date().toISOString()),
				message: reminder.message || "",
				done: Boolean(reminder.done),
				notified_at: toIso(reminder.notified_at),
				created_at: toIso(reminder.created_at, new Date().toISOString()),
			},
			create: {
				id,
				lead_id: String(reminder.lead_id),
				org_owner_id: String(reminder.org_owner_id),
				created_by: String(reminder.created_by),
				remind_at: toIso(reminder.remind_at, new Date().toISOString()),
				message: reminder.message || "",
				done: Boolean(reminder.done),
				notified_at: toIso(reminder.notified_at),
				created_at: toIso(reminder.created_at, new Date().toISOString()),
			},
		});
	}
}

async function migrateEventLogs(eventLogs) {
	for (const eventLog of eventLogs) {
		const id = sanitizeId(eventLog.id, "event_log");
		const orgOwnerId = String(eventLog.org_owner_id || eventLog.actor_id || "");
		if (!orgOwnerId) {
			continue;
		}

		await prisma.eventLog.upsert({
			where: { id },
			update: {
				org_owner_id: orgOwnerId,
				actor_id: String(eventLog.actor_id || "") || null,
				event_type: String(eventLog.event_type || eventLog.type || "event"),
				entity_type: String(eventLog.entity_type || "") || null,
				entity_id: String(eventLog.entity_id || "") || null,
				payload: eventLog.payload || eventLog.metadata || {},
				occurred_at: toIso(eventLog.occurred_at || eventLog.created_at, new Date().toISOString()),
			},
			create: {
				id,
				org_owner_id: orgOwnerId,
				actor_id: String(eventLog.actor_id || "") || null,
				event_type: String(eventLog.event_type || eventLog.type || "event"),
				entity_type: String(eventLog.entity_type || "") || null,
				entity_id: String(eventLog.entity_id || "") || null,
				payload: eventLog.payload || eventLog.metadata || {},
				occurred_at: toIso(eventLog.occurred_at || eventLog.created_at, new Date().toISOString()),
				created_at: toIso(eventLog.created_at, new Date().toISOString()),
			},
		});
	}
}

async function migrateInteractions(messages, calls) {
	for (const message of messages) {
		const id = sanitizeId(message.id, "il_msg");
		const matchId = String(message.match_id || "");
		const senderId = String(message.sender_id || "") || null;
		if (!senderId) {
			continue;
		}
		const eventAt = toIso(message.timestamp || message.created_at, new Date().toISOString());
		await prisma.interactionLog
			.upsert({
				where: { id },
				update: {
					org_owner_id: senderId,
					actor_id: senderId,
					channel: "chat",
					interaction_type: "message",
					entity_type: "message",
					entity_id: String(message.id || ""),
					match_id: matchId || null,
					message_id: String(message.id || "") || null,
					metadata: {
						type: message.type || "text",
						has_attachment: Boolean(message.attachment),
					},
					occurred_at: eventAt,
				},
				create: {
					id,
					org_owner_id: senderId,
					actor_id: senderId,
					channel: "chat",
					interaction_type: "message",
					entity_type: "message",
					entity_id: String(message.id || ""),
					match_id: matchId || null,
					message_id: String(message.id || "") || null,
					metadata: {
						type: message.type || "text",
						has_attachment: Boolean(message.attachment),
					},
					occurred_at: eventAt,
				},
			})
			.catch(() => {});
	}

	for (const call of calls) {
		const id = `il_call_${sanitizeId(call.id, "call")}`;
		const actorId = String(call.created_by || "") || null;
		if (!actorId) {
			continue;
		}
		await prisma.interactionLog
			.upsert({
				where: { id },
				update: {
					org_owner_id: actorId,
					actor_id: actorId,
					channel: "call",
					interaction_type: "call",
					entity_type: "call_session",
					entity_id: String(call.id || ""),
					match_id: String(call.match_id || call?.context?.chat_thread_id || "") || null,
					call_session_id: String(call.id || "") || null,
					metadata: {
						status: call.status || null,
						duration_minutes: call.duration_minutes || null,
					},
					occurred_at: toIso(call.started_at || call.created_at, new Date().toISOString()),
				},
				create: {
					id,
					org_owner_id: actorId,
					actor_id: actorId,
					channel: "call",
					interaction_type: "call",
					entity_type: "call_session",
					entity_id: String(call.id || ""),
					match_id: String(call.match_id || call?.context?.chat_thread_id || "") || null,
					call_session_id: String(call.id || "") || null,
					metadata: {
						status: call.status || null,
						duration_minutes: call.duration_minutes || null,
					},
					occurred_at: toIso(call.started_at || call.created_at, new Date().toISOString()),
				},
			})
			.catch(() => {});
	}
}

async function main() {
	const [leads, notes, reminders, messages, callSessions, eventLogs] = await Promise.all([
		readLegacyJson("leads.json"),
		readLegacyJson("lead_notes.json"),
		readLegacyJson("lead_reminders.json"),
		readLegacyJson("messages.json"),
		readLegacyJson("call_sessions.json"),
		readLegacyJson("event_logs.json"),
	]);

	await migrateLeads(leads);
	await migrateLeadNotes(notes);
	await migrateLeadReminders(reminders);
	await migrateEventLogs(eventLogs);
	await migrateInteractions(messages, callSessions);
}

main()
	.catch((_error) => {
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
