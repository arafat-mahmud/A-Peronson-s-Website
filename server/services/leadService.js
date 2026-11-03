import crypto from "node:crypto";
import { isCrmSqlEnabled, readLegacyJson } from "../utils/crmFallbackStore.js";
import { forbiddenError, isAgent, isOwnerOrAdmin } from "../utils/permissions.js";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";
import {
	applyLeadOpsOnCreateOrUpdate,
	evaluateAndEscalateLeadIfBreached,
} from "./enterpriseOpsService.js";
import { getPlanForUser } from "./entitlementService.js";
import { trackEvent } from "./eventTrackingService.js";

const LEADS_FILE = "leads.json";
const USERS_FILE = "users.json";
const _NOTES_FILE = "lead_notes.json";
const _REMINDERS_FILE = "lead_reminders.json";
const _ASSIGNMENTS_FILE = "lead_assignments.json";
const _REQUIREMENTS_FILE = "requirements.json";
const USE_SQL_CRM = isCrmSqlEnabled();

async function readStore(fileName) {
	if (USE_SQL_CRM) {
		switch (fileName) {
			case "leads.json":
				return prisma.lead.findMany();
			case "lead_notes.json":
				return prisma.leadNote.findMany();
			case "lead_reminders.json":
				return prisma.leadReminder.findMany();
			case "lead_assignments.json":
				return prisma.leadAssignment.findMany();
			case "users.json":
				return prisma.user.findMany();
			case "requirements.json":
				return prisma.requirement.findMany();
			default:
				return [];
		}
	}
	return readLegacyJson(fileName);
}

const LEAD_STATUSES = new Set([
	"new",
	"contacted",
	"negotiating",
	"sample_sent",
	"order_confirmed",
	"closed",
]);

export const LEAD_STATUS_LABELS = {
	new: "New",
	contacted: "Contacted",
	negotiating: "Negotiating",
	sample_sent: "Sample Sent",
	order_confirmed: "Order Confirmed",
	closed: "Closed",
};

function normalizeStatus(value, fallback = "new") {
	const status = sanitizeString(String(value || ""), 40)
		.toLowerCase()
		.replace(/\s+/g, "_");
	return LEAD_STATUSES.has(status) ? status : fallback;
}

function parseFriendMatchId(matchId = "") {
	const parts = String(matchId).split(":");
	if (parts.length !== 3 || parts[0] !== "friend") {
		return null;
	}
	const first = sanitizeString(parts[1], 120);
	const second = sanitizeString(parts[2], 120);
	if (!(first && second)) {
		return null;
	}
	return [first, second];
}

function parseMarketplaceMatchId(matchId = "") {
	const parts = String(matchId).split(":");
	if (parts.length !== 2) {
		return null;
	}
	const requirementId = sanitizeString(parts[0], 120);
	const supplierId = sanitizeString(parts[1], 120);
	if (!(requirementId && supplierId)) {
		return null;
	}
	return { requirementId, supplierId };
}

async function resolveBuyerId(requirementId) {
	if (!requirementId) {
		return "";
	}
	const requirement = await prisma.requirement.findFirst({
		where: { id: String(requirementId) },
		select: { buyer_id: true },
	});
	return sanitizeString(requirement?.buyer_id || "", 120);
}

function actorOrgOwnerId(actor) {
	if (!actor) {
		return "";
	}
	if (isAgent(actor)) {
		return sanitizeString(actor.org_owner_id || "", 120);
	}
	return sanitizeString(actor.id || "", 120);
}

const LEAD_SOURCE_TYPES = new Set([
	"buyer_request",
	"product",
	"feed_post",
	"search",
	"direct",
	"message",
]);

function normalizeLeadSourceType(value, fallback = "") {
	const normalized = sanitizeString(String(value || ""), 40)
		.toLowerCase()
		.replace(/\s+/g, "_");
	if (LEAD_SOURCE_TYPES.has(normalized)) {
		return normalized;
	}
	return fallback;
}

function canAccessLead(actor, lead) {
	if (!(actor && lead)) {
		return false;
	}
	if (isOwnerOrAdmin(actor)) {
		return true;
	}

	const actorId = String(actor.id || "");
	const orgId = actorOrgOwnerId(actor);
	if (orgId && String(lead.org_owner_id || "") !== orgId) {
		return false;
	}

	if (isAgent(actor)) {
		return String(lead.assigned_agent_id || "") === actorId;
	}

	return true;
}

function ensureLeadAccess(actor, lead) {
	if (canAccessLead(actor, lead)) {
		return;
	}
	throw forbiddenError();
}

function ensureLeadWriteAccess(actor, lead) {
	if (!(actor && lead)) {
		throw forbiddenError();
	}
	if (isOwnerOrAdmin(actor)) {
		return;
	}

	const orgId = actorOrgOwnerId(actor);
	if (!orgId || String(lead.org_owner_id || "") !== orgId) {
		throw forbiddenError();
	}

	if (isAgent(actor) && String(lead.assigned_agent_id || "") !== String(actor.id || "")) {
		throw forbiddenError();
	}
}

function pickCounterparty({ buyerId, supplierId, orgOwnerId, friendPair }) {
	if (Array.isArray(friendPair)) {
		return friendPair.find((id) => id !== orgOwnerId) || "";
	}

	if (orgOwnerId === supplierId) {
		return buyerId || "";
	}
	if (orgOwnerId === buyerId) {
		return supplierId || "";
	}
	return buyerId || supplierId || "";
}

export async function upsertLeadFromMessage({
	match_id,
	sender_id,
	timestamp,
	source_type,
	source_id,
	source_label,
}) {
	const matchId = sanitizeString(match_id || "", 240);
	const senderId = sanitizeString(sender_id || "", 120);
	if (!matchId) {
		return null;
	}

	const users = await readStore(USERS_FILE);
	const usersById = new Map(users.map((u) => [u.id, u]));
	const sender = usersById.get(senderId) || null;

	const friendPair = parseFriendMatchId(matchId);
	const marketplace = friendPair ? null : parseMarketplaceMatchId(matchId);
	const buyerId = marketplace ? await resolveBuyerId(marketplace.requirementId) : "";
	const supplierId = marketplace ? marketplace.supplierId : "";
	const derivedSourceType = marketplace ? "buyer_request" : friendPair ? "direct" : "message";
	const derivedSourceId = marketplace?.requirementId || matchId || "";
	const overrideSourceType = normalizeLeadSourceType(source_type, "");
	const overrideSourceId = sanitizeString(source_id || "", 200);
	const overrideSourceLabel = sanitizeString(source_label || "", 160);
	const leadSourceType = overrideSourceType || derivedSourceType;
	const leadSourceId = overrideSourceId || derivedSourceId;

	const orgTargets = new Map();

	if (sender?.role === "agent" && sender.org_owner_id) {
		orgTargets.set(sender.org_owner_id, { assigned_agent_id: sender.id });
	}

	const supplierUser = supplierId ? usersById.get(supplierId) : null;
	if (
		supplierUser &&
		["factory", "buying_house"].includes(String(supplierUser.role || "").toLowerCase())
	) {
		orgTargets.set(supplierUser.id, orgTargets.get(supplierUser.id) || {});
	}

	const buyerUser = buyerId ? usersById.get(buyerId) : null;
	if (
		buyerUser &&
		["factory", "buying_house"].includes(String(buyerUser.role || "").toLowerCase())
	) {
		orgTargets.set(buyerUser.id, orgTargets.get(buyerUser.id) || {});
	}

	if (Array.isArray(friendPair)) {
		friendPair.forEach((id) => {
			const u = usersById.get(id);
			if (!u) {
				return;
			}
			const role = String(u.role || "").toLowerCase();
			if (role === "factory" || role === "buying_house") {
				orgTargets.set(u.id, orgTargets.get(u.id) || {});
			}
		});
	}

	if (orgTargets.size === 0) {
		return null;
	}

	const leads = await readStore(LEADS_FILE);
	const now = new Date().toISOString();
	const interactionAt = sanitizeString(timestamp || now, 64) || now;
	const updated = [];

	const leadCountsByAgent = leads.reduce((acc, row) => {
		const agentId = String(row.assigned_agent_id || "");
		if (!agentId) {
			return acc;
		}
		acc[agentId] = (acc[agentId] || 0) + 1;
		return acc;
	}, {});

	const agentsByOrg = users.reduce((acc, u) => {
		if (String(u.role || "").toLowerCase() !== "agent") {
			return acc;
		}
		const ownerId = String(u.org_owner_id || "");
		if (!ownerId) {
			return acc;
		}
		if (!acc.has(ownerId)) {
			acc.set(ownerId, []);
		}
		acc.get(ownerId).push(u);
		return acc;
	}, new Map());

	function pickLeastLoadedAgent(orgOwnerId) {
		const agents = agentsByOrg.get(String(orgOwnerId || "")) || [];
		if (agents.length === 0) {
			return "";
		}
		const sorted = agents.slice().sort((a, b) => {
			const aCount = (leadCountsByAgent[String(a.id)] || 0) + Number(a.assigned_requests || 0);
			const bCount = (leadCountsByAgent[String(b.id)] || 0) + Number(b.assigned_requests || 0);
			return aCount - bCount;
		});
		return String(sorted[0]?.id || "");
	}

	for (const [orgOwnerId, extras] of orgTargets.entries()) {
		const orgId = sanitizeString(String(orgOwnerId || ""), 120);
		if (!orgId) {
			continue;
		}

		const orgOwner = usersById.get(orgId);
		const plan = orgOwner ? await getPlanForUser(orgOwner) : "free";
		const allowAutoAssign = plan === "premium";

		const existingIndex = leads.findIndex(
			(lead) =>
				String(lead.org_owner_id || "") === orgId && String(lead.match_id || "") === matchId,
		);
		const counterpartyId = pickCounterparty({
			buyerId,
			supplierId,
			orgOwnerId: orgId,
			friendPair,
		});
		const autoAssignedAgent =
			!extras.assigned_agent_id && allowAutoAssign ? pickLeastLoadedAgent(orgId) : "";

		if (existingIndex >= 0) {
			const current = leads[existingIndex];
			const nextLead = {
				...current,
				counterparty_id: current.counterparty_id || counterpartyId,
				assigned_agent_id:
					extras.assigned_agent_id || current.assigned_agent_id || autoAssignedAgent || "",
				source_type: current.source_type || leadSourceType,
				source_id: current.source_id || leadSourceId,
				source_label: current.source_label || overrideSourceLabel || "",
				last_interaction_at: interactionAt,
				updated_at: now,
			};
			leads[existingIndex] = await applyLeadOpsOnCreateOrUpdate({
				actor: sender || { id: orgId, org_owner_id: orgId, role: "owner" },
				lead: nextLead,
				trigger: "update",
			});
			updated.push(leads[existingIndex]);
			if (!current.source_type && leadSourceType) {
				await trackEvent({
					type: "lead_source_attached",
					actor_id: senderId || orgId,
					entity_id: current.id,
					metadata: { source_type: leadSourceType, source_id: leadSourceId },
				});
			}
			continue;
		}

		const baseRow = {
			id: crypto.randomUUID(),
			org_owner_id: orgId,
			match_id: matchId,
			counterparty_id: counterpartyId,
			source: "message",
			source_type: leadSourceType,
			source_id: leadSourceId,
			source_label: overrideSourceLabel || "",
			status: "new",
			assigned_agent_id: extras.assigned_agent_id || autoAssignedAgent || "",
			created_at: now,
			updated_at: now,
			last_interaction_at: interactionAt,
			conversion_at: "",
		};
		const row = await applyLeadOpsOnCreateOrUpdate({
			actor: sender || { id: orgId, org_owner_id: orgId, role: "owner" },
			lead: baseRow,
			trigger: "create",
		});
		leads.push(row);
		updated.push(row);
		await trackEvent({
			type: "lead_created",
			actor_id: senderId || orgId,
			entity_id: row.id,
			metadata: { source_type: leadSourceType, source_id: leadSourceId },
		});
		if (leadSourceType) {
			await trackEvent({
				type: "lead_source_attached",
				actor_id: senderId || orgId,
				entity_id: row.id,
				metadata: { source_type: leadSourceType, source_id: leadSourceId },
			});
		}
	}

	await prisma.lead.createMany({
		data: leads
			.filter((l) => !l._persisted)
			.map((l) => ({
				id: l.id,
				org_owner_id: l.org_owner_id,
				match_id: l.match_id,
				counterparty_id: l.counterparty_id || null,
				source: l.source || null,
				status: l.status || "new",
				assigned_agent_id: l.assigned_agent_id || null,
				created_at: new Date(l.created_at),
				updated_at: new Date(l.updated_at),
				last_interaction_at: l.last_interaction_at ? new Date(l.last_interaction_at) : null,
				source_type: l.source_type || null,
				source_id: l.source_id || null,
				source_label: l.source_label || null,
				conversion_at: l.conversion_at ? new Date(l.conversion_at) : null,
			})),
		skipDuplicates: true,
	});

	await Promise.all(
		updated.map((lead) =>
			evaluateAndEscalateLeadIfBreached({
				actor: sender || {
					id: lead.org_owner_id,
					org_owner_id: lead.org_owner_id,
					role: "owner",
				},
				lead,
			}),
		),
	);
	return updated;
}

export async function markLeadConvertedFromContract({ buyerId, factoryId, contractId }) {
	const safeBuyer = sanitizeString(String(buyerId || ""), 120);
	const safeFactory = sanitizeString(String(factoryId || ""), 120);
	const safeContract = sanitizeString(String(contractId || ""), 120);
	if (!(safeBuyer && safeFactory && safeContract)) {
		return [];
	}

	const updated = await prisma.lead.updateMany({
		where: {
			OR: [
				{ org_owner_id: safeFactory, counterparty_id: safeBuyer },
				{ org_owner_id: safeBuyer, counterparty_id: safeFactory },
			],
			conversion_at: null,
		},
		data: {
			conversion_at: new Date(),
			updated_at: new Date(),
		},
	});

	if (updated.count > 0) {
		await trackEvent({
			type: "lead_converted",
			actor_id: safeFactory || safeBuyer,
			entity_id: safeContract,
			metadata: { buyer_id: safeBuyer, factory_id: safeFactory },
		});
	}

	const leads = await prisma.lead.findMany({
		where: {
			OR: [
				{ org_owner_id: safeFactory, counterparty_id: safeBuyer },
				{ org_owner_id: safeBuyer, counterparty_id: safeFactory },
			],
			conversion_at: { not: null },
		},
	});
	return leads;
}

export async function listLeads(actor) {
	if (isOwnerOrAdmin(actor)) {
		return prisma.lead.findMany({ orderBy: { updated_at: "desc" } });
	}
	const orgId = actorOrgOwnerId(actor);
	if (!orgId) {
		return [];
	}
	if (isAgent(actor)) {
		return prisma.lead.findMany({
			where: {
				org_owner_id: orgId,
				assigned_agent_id: String(actor.id || ""),
			},
			orderBy: { updated_at: "desc" },
		});
	}
	return prisma.lead.findMany({
		where: { org_owner_id: orgId },
		orderBy: { updated_at: "desc" },
	});
}

export async function getLeadById(actor, leadId) {
	const id = sanitizeString(String(leadId || ""), 120);
	const actorOrgId = actorOrgOwnerId(actor);
	const lead = await prisma.lead.findFirst({
		where: isOwnerOrAdmin(actor) ? { id } : { id, org_owner_id: actorOrgId },
	});
	if (!lead) {
		return null;
	}
	ensureLeadAccess(actor, lead);
	const [notes, reminders] = await Promise.all([
		prisma.leadNote.findMany({
			where: { lead_id: id },
			orderBy: { created_at: "desc" },
		}),
		prisma.leadReminder.findMany({
			where: { lead_id: id },
			orderBy: { remind_at: "asc" },
		}),
	]);
	return { ...lead, notes, reminders };
}

export async function getLeadByMatch(actor, matchId) {
	const id = sanitizeString(String(matchId || ""), 160);
	if (!id) {
		return null;
	}
	const actorOrgId = actorOrgOwnerId(actor);
	const lead = await prisma.lead.findFirst({
		where: isOwnerOrAdmin(actor) ? { match_id: id } : { match_id: id, org_owner_id: actorOrgId },
	});
	if (!lead) {
		return null;
	}
	ensureLeadAccess(actor, lead);
	const [notes, reminders] = await Promise.all([
		prisma.leadNote.findMany({
			where: { lead_id: String(lead.id) },
			orderBy: { created_at: "desc" },
		}),
		prisma.leadReminder.findMany({
			where: { lead_id: String(lead.id) },
			orderBy: { remind_at: "asc" },
		}),
	]);
	return { ...lead, notes, reminders };
}

export async function updateLead(actor, leadId, patch = {}) {
	const id = sanitizeString(String(leadId || ""), 120);
	const actorOrgId = actorOrgOwnerId(actor);
	const current = await prisma.lead.findFirst({
		where: isOwnerOrAdmin(actor) ? { id } : { id, org_owner_id: actorOrgId },
	});
	if (!current) {
		return null;
	}
	ensureLeadWriteAccess(actor, current);

	const assignedAgentId =
		patch.assigned_agent_id === undefined
			? current.assigned_agent_id
			: sanitizeString(String(patch.assigned_agent_id || ""), 120) || null;
	if (!isAgent(actor) && assignedAgentId) {
		const assignedAgent = await prisma.user.findFirst({
			where: {
				id: assignedAgentId,
				role: "agent",
				org_owner_id: current.org_owner_id,
			},
		});
		if (!assignedAgent) {
			throw forbiddenError();
		}
	}

	const [updatedLead] = await prisma.$transaction(async (tx) => {
		const first = await tx.lead.update({
			where: { id },
			data: {
				status:
					patch.status === undefined
						? current.status
						: normalizeStatus(patch.status, current.status || "new"),
				...(isAgent(actor) ? {} : { assigned_agent_id: assignedAgentId }),
				updated_at: new Date(),
			},
		});
		return [first];
	});
	let updated = updatedLead;
	const opsLead = await applyLeadOpsOnCreateOrUpdate({
		actor,
		lead: updated,
		trigger: "update",
	});
	if (String(updated.assigned_agent_id || "") === String(opsLead.assigned_agent_id || "")) {
		updated = opsLead;
	} else {
		const [next] = await prisma.$transaction(async (tx) => {
			const u = await tx.lead.update({
				where: { id },
				data: {
					assigned_agent_id: opsLead.assigned_agent_id || null,
					updated_at: new Date(),
				},
			});
			return [u];
		});
		updated = next;
	}
	if (
		!isAgent(actor) &&
		patch.assigned_agent_id !== undefined &&
		String(current.assigned_agent_id || "") !== String(updated.assigned_agent_id || "")
	) {
		const now = new Date();
		await prisma.$transaction(async (tx) => {
			await tx.leadAssignment.create({
				data: {
					id: crypto.randomUUID(),
					lead_id: updated.id,
					org_owner_id: updated.org_owner_id,
					assigned_by: String(actor.id || ""),
					assigned_to: updated.assigned_agent_id || null,
					previous_assignee: current.assigned_agent_id || null,
					reason:
						sanitizeString(String(patch.assignment_reason || "manual_assignment"), 180) ||
						"manual_assignment",
					assigned_at: now,
					created_at: now,
				},
			});
		});
		await trackEvent({
			type: "lead_reassigned",
			actor_id: String(actor.id || ""),
			entity_id: updated.id,
			entityType: "lead",
			metadata: {
				org_owner_id: updated.org_owner_id,
				assigned_to: updated.assigned_agent_id || "",
			},
			allowUnknownTypes: true,
		});
	}
	await evaluateAndEscalateLeadIfBreached({ actor, lead: updated });
	return updated;
}

export async function addLeadNote(actor, leadId, noteText) {
	const id = sanitizeString(String(leadId || ""), 120);
	const actorOrgId = actorOrgOwnerId(actor);
	const lead = await prisma.lead.findFirst({
		where: isOwnerOrAdmin(actor) ? { id } : { id, org_owner_id: actorOrgId },
	});
	if (!lead) {
		return null;
	}
	ensureLeadWriteAccess(actor, lead);

	return prisma.leadNote.create({
		data: {
			id: crypto.randomUUID(),
			lead_id: id,
			org_owner_id: lead.org_owner_id,
			author_id: String(actor.id || ""),
			note: sanitizeString(String(noteText || ""), 1600),
			created_at: new Date(),
		},
	});
}

export async function addLeadReminder(actor, leadId, payload = {}) {
	const id = sanitizeString(String(leadId || ""), 120);
	const actorOrgId = actorOrgOwnerId(actor);
	const lead = await prisma.lead.findFirst({
		where: isOwnerOrAdmin(actor) ? { id } : { id, org_owner_id: actorOrgId },
	});
	if (!lead) {
		return null;
	}
	ensureLeadWriteAccess(actor, lead);

	const remindAtRaw = payload?.remind_at
		? new Date(payload.remind_at)
		: new Date(Date.now() + 24 * 60 * 60 * 1000);
	const remindAt = Number.isNaN(remindAtRaw.getTime())
		? new Date(Date.now() + 24 * 60 * 60 * 1000)
		: remindAtRaw;

	return prisma.leadReminder.create({
		data: {
			id: crypto.randomUUID(),
			lead_id: id,
			org_owner_id: lead.org_owner_id,
			created_by: String(actor.id || ""),
			remind_at: remindAt,
			message: sanitizeString(String(payload?.message || "Follow up"), 240),
			done: false,
			created_at: new Date(),
		},
	});
}

export async function addLeadNoteForMatch({ matchId, orgOwnerId, note, authorId = "system" }) {
	const safeMatchId = sanitizeString(String(matchId || ""), 200);
	const safeOrgId = sanitizeString(String(orgOwnerId || ""), 120);
	const safeNote = sanitizeString(String(note || ""), 1600);
	const safeAuthor = sanitizeString(String(authorId || "system"), 120);
	if (!(safeMatchId && safeOrgId && safeNote)) {
		return null;
	}

	const lead = await prisma.lead.findFirst({
		where: {
			match_id: safeMatchId,
			org_owner_id: safeOrgId,
		},
	});
	if (!lead) {
		return null;
	}

	return prisma.leadNote.create({
		data: {
			id: crypto.randomUUID(),
			lead_id: lead.id,
			org_owner_id: lead.org_owner_id,
			author_id: safeAuthor || lead.org_owner_id,
			note: safeNote,
			created_at: new Date(),
		},
	});
}
