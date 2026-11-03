import assert from "node:assert/strict";
import test from "node:test";

function buildPrismaStub() {
	const leads = [
		{
			id: "lead-1",
			org_owner_id: "org-1",
			match_id: "m-1",
			counterparty_id: "buyer-1",
			status: "new",
			assigned_agent_id: "agent-1",
			updated_at: new Date("2026-04-04T00:00:00.000Z"),
			created_at: new Date("2026-04-01T00:00:00.000Z"),
		},
	];
	const notes = [];
	const reminders = [];

	return {
		leads,
		notes,
		reminders,
		lead: {
			findMany: async ({ where } = {}) => {
				if (!where) {
					return leads;
				}
				return leads.filter((row) =>
					Object.entries(where).every(([k, v]) => String(row[k] || "") === String(v || "")),
				);
			},
			findFirst: async ({ where } = {}) =>
				leads.find((row) =>
					Object.entries(where || {}).every(([k, v]) => String(row[k] || "") === String(v || "")),
				) || null,
			update: async ({ where, data }) => {
				const idx = leads.findIndex((row) => row.id === where.id);
				if (idx < 0) {
					return null;
				}
				leads[idx] = { ...leads[idx], ...data };
				return leads[idx];
			},
		},
		leadNote: {
			findMany: async ({ where } = {}) =>
				notes.filter((row) => String(row.lead_id) === String(where?.lead_id || "")),
			create: async ({ data }) => {
				notes.push(data);
				return data;
			},
		},
		leadReminder: {
			findMany: async ({ where } = {}) =>
				reminders.filter((row) => String(row.lead_id) === String(where?.lead_id || "")),
			create: async ({ data }) => {
				reminders.push(data);
				return data;
			},
		},
		user: {
			findFirst: async ({ where } = {}) => {
				if (where?.id === "agent-1" && where?.role === "agent" && where?.org_owner_id === "org-1") {
					return { id: "agent-1" };
				}
				return null;
			},
		},
	};
}

test("lead CRUD/detail + note/reminder flows via SQL path", async () => {
	process.env.USE_SQL_CRM = "true";

	const prismaModule = await import("../../utils/prisma.js");
	const prisma = prismaModule.default;
	const stub = buildPrismaStub();

	prisma.lead = stub.lead;
	prisma.leadNote = stub.leadNote;
	prisma.leadReminder = stub.leadReminder;
	prisma.user = stub.user;

	const leadService = await import("../leadService.js");
	const actor = { id: "org-1", role: "factory" };

	const listed = await leadService.listLeads(actor);
	assert.equal(listed.length, 1);

	const updated = await leadService.updateLead(actor, "lead-1", {
		status: "contacted",
		assigned_agent_id: "agent-1",
	});
	assert.equal(updated.status, "contacted");

	const note = await leadService.addLeadNote(actor, "lead-1", "Call scheduled");
	assert.equal(note.lead_id, "lead-1");

	const reminder = await leadService.addLeadReminder(actor, "lead-1", {
		message: "Follow up tomorrow",
	});
	assert.equal(reminder.lead_id, "lead-1");

	const detail = await leadService.getLeadById(actor, "lead-1");
	assert.equal(detail.notes.length, 1);
	assert.equal(detail.reminders.length, 1);
});
