import crypto from "node:crypto";
import { isCrmSqlEnabled, readLegacyJson } from "../utils/crmFallbackStore.js";
import {
	canManageLeadAssignments,
	canManageOrgPolicies,
	canManageOrgQueue,
	forbiddenError,
	isAgent,
} from "../utils/permissions.js";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";
import { trackEvent } from "./eventTrackingService.js";

const USE_SQL_CRM = isCrmSqlEnabled();

const _POLICIES_FILE = "org_policies.json";
const _ASSIGNMENTS_FILE = "lead_assignments.json";
const CAPACITY_FILE = "agent_capacity.json";
const LEADS_FILE = "leads.json";
const USERS_FILE = "users.json";

const DEFAULT_POLICY = {
	assignment_strategy: "least_loaded",
	sla_targets: {
		response_minutes: 60,
		contact_minutes: 240,
		resolution_minutes: 2880,
	},
	escalation_windows: {
		warning_minutes: 30,
		breach_minutes: 60,
	},
};

async function readStore(fileName) {
	if (USE_SQL_CRM) {
		switch (fileName) {
			case "org_policies.json":
				return prisma.orgPolicy.findMany();
			case "lead_assignments.json":
				return prisma.leadAssignment.findMany();
			case "agent_capacity.json":
				return prisma.agentCapacity.findMany();
			case "leads.json":
				return prisma.lead.findMany();
			case "users.json":
				return prisma.user.findMany();
			default:
				return [];
		}
	}
	return readLegacyJson(fileName);
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

function toIso(value, fallback = new Date().toISOString()) {
	if (!value) {
		return fallback;
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return fallback;
	}
	return date.toISOString();
}

function normalizePolicyInput(input = {}) {
	const assignmentStrategy = sanitizeString(
		String(input.assignment_strategy || DEFAULT_POLICY.assignment_strategy),
		80,
	);
	const slaTargets =
		input?.sla_targets && typeof input.sla_targets === "object" ? input.sla_targets : {};
	const escalationWindows =
		input?.escalation_windows && typeof input.escalation_windows === "object"
			? input.escalation_windows
			: {};

	return {
		assignment_strategy: assignmentStrategy || DEFAULT_POLICY.assignment_strategy,
		sla_targets: {
			response_minutes: Math.max(
				1,
				Number(slaTargets.response_minutes ?? DEFAULT_POLICY.sla_targets.response_minutes),
			),
			contact_minutes: Math.max(
				1,
				Number(slaTargets.contact_minutes ?? DEFAULT_POLICY.sla_targets.contact_minutes),
			),
			resolution_minutes: Math.max(
				1,
				Number(slaTargets.resolution_minutes ?? DEFAULT_POLICY.sla_targets.resolution_minutes),
			),
		},
		escalation_windows: {
			warning_minutes: Math.max(
				1,
				Number(
					escalationWindows.warning_minutes ?? DEFAULT_POLICY.escalation_windows.warning_minutes,
				),
			),
			breach_minutes: Math.max(
				1,
				Number(
					escalationWindows.breach_minutes ?? DEFAULT_POLICY.escalation_windows.breach_minutes,
				),
			),
		},
	};
}

function computeLoad(leads = [], agentId = "") {
	return leads.filter((lead) => String(lead.assigned_agent_id || "") === String(agentId)).length;
}

function computeSlaStatus(lead, policy) {
	const referenceAt = new Date(
		lead?.last_interaction_at || lead?.updated_at || lead?.created_at || Date.now(),
	);
	const elapsedMinutes = Math.max(0, Math.floor((Date.now() - referenceAt.getTime()) / 60_000));
	const breachAt = Number(
		policy?.escalation_windows?.breach_minutes || DEFAULT_POLICY.escalation_windows.breach_minutes,
	);
	const warningAt = Number(
		policy?.escalation_windows?.warning_minutes ||
			DEFAULT_POLICY.escalation_windows.warning_minutes,
	);

	if (elapsedMinutes >= breachAt) {
		return { status: "breached", elapsed_minutes: elapsedMinutes };
	}
	if (elapsedMinutes >= warningAt) {
		return { status: "warning", elapsed_minutes: elapsedMinutes };
	}
	return { status: "healthy", elapsed_minutes: elapsedMinutes };
}

async function ensurePolicy(orgOwnerId) {
	const existing = await prisma.orgPolicy.findFirst({
		where: { org_id: String(orgOwnerId), code: "operations" },
	});
	if (existing) {
		return existing;
	}

	const created = await prisma.orgPolicy.create({
		data: {
			id: crypto.randomUUID(),
			org_id: String(orgOwnerId),
			code: "operations",
			description: "Org operations policy",
			config: {},
			assignment_strategy: DEFAULT_POLICY.assignment_strategy,
			sla_targets: DEFAULT_POLICY.sla_targets,
			escalation_windows: DEFAULT_POLICY.escalation_windows,
			active: true,
			created_at: new Date(),
			updated_at: new Date(),
		},
	});
	return created;
}

export async function getOrgPolicies(actor) {
	const orgOwnerId = actorOrgOwnerId(actor);
	if (!orgOwnerId) {
		throw forbiddenError();
	}
	return ensurePolicy(orgOwnerId);
}

export async function updateOrgPolicies(actor, payload = {}) {
	if (!canManageOrgPolicies(actor)) {
		throw forbiddenError("Policy admin permission required");
	}
	const orgOwnerId = actorOrgOwnerId(actor);
	if (!orgOwnerId) {
		throw forbiddenError();
	}

	const input = normalizePolicyInput(payload);
	const existing = await prisma.orgPolicy.findFirst({
		where: { org_id: String(orgOwnerId), code: "operations" },
	});

	const next = existing
		? await prisma.orgPolicy.update({
				where: { id: existing.id },
				data: {
					...input,
					updated_at: new Date(),
				},
			})
		: await prisma.orgPolicy.create({
				data: {
					id: crypto.randomUUID(),
					org_id: String(orgOwnerId),
					code: "operations",
					description: "Org operations policy",
					config: {},
					...input,
					active: true,
					created_at: new Date(),
					updated_at: new Date(),
				},
			});
	return next;
}

export async function getOrgQueue(actor) {
	if (!(canManageOrgQueue(actor) || isAgent(actor))) {
		throw forbiddenError("Queue manager permission required");
	}

	const orgOwnerId = actorOrgOwnerId(actor);
	if (!orgOwnerId) {
		throw forbiddenError();
	}

	const [leads, users, policy, capacityRows] = await Promise.all([
		readStore(LEADS_FILE),
		readStore(USERS_FILE),
		ensurePolicy(orgOwnerId),
		readStore(CAPACITY_FILE),
	]);

	const agents = users.filter(
		(user) =>
			String(user.role || "").toLowerCase() === "agent" &&
			String(user.org_owner_id || "") === orgOwnerId,
	);

	const scopedLeads = leads
		.filter((lead) => String(lead.org_owner_id || "") === orgOwnerId)
		.filter(
			(lead) => !isAgent(actor) || String(lead.assigned_agent_id || "") === String(actor.id || ""),
		)
		.map((lead) => ({
			...lead,
			queue_owner_id: lead.assigned_agent_id || orgOwnerId,
			sla: computeSlaStatus(lead, policy),
		}));

	const agentCapacity = agents.map((agent) => {
		const existing = capacityRows.find((row) => String(row.agent_id || "") === String(agent.id));
		const currentLoad = computeLoad(scopedLeads, agent.id);
		return {
			id: existing?.id || crypto.randomUUID(),
			org_owner_id: orgOwnerId,
			agent_id: agent.id,
			max_concurrent_leads: Number(existing?.max_concurrent_leads || 10),
			current_load: currentLoad,
			updated_at: new Date().toISOString(),
		};
	});

	return {
		queue: scopedLeads,
		team_queues: agents.map((agent) => ({
			agent_id: agent.id,
			agent_name: agent.name,
			current_load: computeLoad(scopedLeads, agent.id),
			leads: scopedLeads.filter(
				(lead) => String(lead.assigned_agent_id || "") === String(agent.id),
			),
		})),
		agent_capacity: agentCapacity,
	};
}

export async function rebalanceOrgQueue(actor, payload = {}) {
	if (!canManageLeadAssignments(actor)) {
		throw forbiddenError("Assignment manager permission required");
	}

	const orgOwnerId = actorOrgOwnerId(actor);
	const [users, leads, capacityRows] = await Promise.all([
		readStore(USERS_FILE),
		readStore(LEADS_FILE),
		readStore(CAPACITY_FILE),
	]);

	const strategy = sanitizeString(String(payload.strategy || "least_loaded"), 60) || "least_loaded";
	const agents = users.filter(
		(user) =>
			String(user.role || "").toLowerCase() === "agent" &&
			String(user.org_owner_id || "") === orgOwnerId,
	);

	if (agents.length === 0) {
		return { moved: 0, strategy, assignments: [] };
	}

	const leadsInScope = leads.filter((lead) => String(lead.org_owner_id || "") === orgOwnerId);
	const loadByAgent = new Map(
		agents.map((agent) => [agent.id, computeLoad(leadsInScope, agent.id)]),
	);
	const capacityByAgent = new Map(
		agents.map((agent) => {
			const cap = capacityRows.find((row) => String(row.agent_id || "") === String(agent.id));
			return [agent.id, Number(cap?.max_concurrent_leads || 10)];
		}),
	);

	const updatedAssignments = [];
	const now = new Date().toISOString();

	function pickAgent() {
		const ranked = agents
			.map((agent) => ({
				agent_id: agent.id,
				load: Number(loadByAgent.get(agent.id) || 0),
				capacity: Number(capacityByAgent.get(agent.id) || 10),
			}))
			.filter((agent) => agent.load < agent.capacity)
			.sort((a, b) => a.load - b.load);
		return ranked[0]?.agent_id || "";
	}

	const _nextLeads = leads.map((lead) => {
		if (String(lead.org_owner_id || "") !== orgOwnerId) {
			return lead;
		}
		const hasAssignee = Boolean(lead.assigned_agent_id);
		if (hasAssignee && strategy === "fill_unassigned") {
			return lead;
		}

		const targetAgentId = pickAgent();
		if (!targetAgentId || String(lead.assigned_agent_id || "") === String(targetAgentId)) {
			return lead;
		}

		const previousAgentId = String(lead.assigned_agent_id || "");
		if (previousAgentId) {
			loadByAgent.set(
				previousAgentId,
				Math.max(0, Number(loadByAgent.get(previousAgentId) || 0) - 1),
			);
		}
		loadByAgent.set(targetAgentId, Number(loadByAgent.get(targetAgentId) || 0) + 1);

		updatedAssignments.push({
			id: crypto.randomUUID(),
			lead_id: lead.id,
			org_owner_id: orgOwnerId,
			assigned_by: actor.id,
			assigned_to: targetAgentId,
			previous_assignee: previousAgentId,
			reason: "queue_rebalanced",
			assigned_at: now,
			created_at: now,
		});

		return {
			...lead,
			assigned_agent_id: targetAgentId,
			updated_at: now,
		};
	});

	if (updatedAssignments.length > 0) {
		await prisma.$transaction(async (tx) => {
			await tx.lead.updateMany({
				where: {
					id: { in: updatedAssignments.map((a) => a.lead_id) },
					org_owner_id: orgOwnerId,
				},
				data: {
					assigned_agent_id: undefined,
					updated_at: new Date(),
				},
			});
			for (const assignment of updatedAssignments) {
				await tx.leadAssignment.create({ data: assignment });
			}
			for (const agent of agents) {
				await tx.agentCapacity.upsert({
					where: {
						agent_capacity_org_owner_id_agent_id: {
							org_owner_id: String(orgOwnerId),
							agent_id: String(agent.id),
						},
					},
					update: {
						max_concurrent_leads: Number(capacityByAgent.get(agent.id) || 10),
						current_load: Number(loadByAgent.get(agent.id) || 0),
						updated_at: new Date(),
					},
					create: {
						id: crypto.randomUUID(),
						org_owner_id: String(orgOwnerId),
						agent_id: String(agent.id),
						max_concurrent_leads: Number(capacityByAgent.get(agent.id) || 10),
						current_load: Number(loadByAgent.get(agent.id) || 0),
						updated_at: new Date(),
					},
				});
			}

			for (const assignment of updatedAssignments) {
				await tx.lead.update({
					where: { id: assignment.lead_id },
					data: {
						assigned_agent_id: assignment.assigned_to || null,
						updated_at: new Date(),
					},
				});
			}
		});

		await trackEvent({
			type: "queue_rebalanced",
			actor_id: actor.id,
			entity_id: orgOwnerId,
			entityType: "org_operations",
			metadata: {
				org_owner_id: orgOwnerId,
				moved: updatedAssignments.length,
				strategy,
			},
			allowUnknownTypes: true,
		});
	}

	return {
		moved: updatedAssignments.length,
		strategy,
		assignments: updatedAssignments,
	};
}

export async function escalateOrgLead(actor, leadId, payload = {}) {
	if (!(canManageLeadAssignments(actor) || canManageOrgQueue(actor))) {
		throw forbiddenError("Queue manager or assignment manager permission required");
	}

	const orgOwnerId = actorOrgOwnerId(actor);
	const [leads, policy] = await Promise.all([readStore(LEADS_FILE), ensurePolicy(orgOwnerId)]);
	const target = leads.find(
		(lead) =>
			String(lead.id || "") === String(leadId) && String(lead.org_owner_id || "") === orgOwnerId,
	);
	if (!target) {
		return null;
	}

	const now = new Date().toISOString();
	const reason = sanitizeString(String(payload.reason || "manual_escalation"), 180);
	const escalated = {
		...target,
		status: "escalated",
		escalated_at: now,
		escalation_reason: reason,
		updated_at: now,
	};
	await prisma.$transaction(async (tx) => {
		await tx.lead.update({
			where: { id: target.id },
			data: {
				status: "escalated",
				updated_at: new Date(),
			},
		});

		const assignmentEvent = {
			id: crypto.randomUUID(),
			lead_id: target.id,
			org_owner_id: orgOwnerId,
			assigned_by: actor.id,
			assigned_to: target.assigned_agent_id || "",
			previous_assignee: target.assigned_agent_id || "",
			reason: reason || "lead_escalated",
			assigned_at: new Date(),
			created_at: new Date(),
		};
		await tx.leadAssignment.create({ data: assignmentEvent });
	});

	const sla = computeSlaStatus(escalated, policy);
	if (sla.status === "breached") {
		await trackEvent({
			type: "sla_breached",
			actor_id: actor.id,
			entity_id: target.id,
			entityType: "lead",
			metadata: {
				org_owner_id: orgOwnerId,
				elapsed_minutes: sla.elapsed_minutes,
				breach_minutes: policy?.escalation_windows?.breach_minutes,
			},
			allowUnknownTypes: true,
		});
	}

	await trackEvent({
		type: "lead_escalated",
		actor_id: actor.id,
		entity_id: target.id,
		entityType: "lead",
		metadata: {
			org_owner_id: orgOwnerId,
			reason: reason || "manual_escalation",
		},
		allowUnknownTypes: true,
	});

	await trackEvent({
		type: "lead_reassigned",
		actor_id: actor.id,
		entity_id: target.id,
		entityType: "lead",
		metadata: {
			org_owner_id: orgOwnerId,
			reason: reason || "lead_escalated",
			assigned_to: target.assigned_agent_id || "",
		},
		allowUnknownTypes: true,
	});

	return escalated;
}

export async function listLeadAssignmentHistory(actor) {
	const orgOwnerId = actorOrgOwnerId(actor);
	const history = await prisma.leadAssignment.findMany({
		where: { org_owner_id: String(orgOwnerId) },
		orderBy: { assigned_at: "desc" },
	});
	return history;
}

export async function upsertAgentCapacity(actor, payload = {}) {
	if (!canManageLeadAssignments(actor)) {
		throw forbiddenError("Assignment manager permission required");
	}
	const orgOwnerId = actorOrgOwnerId(actor);
	const agentId = sanitizeString(String(payload.agent_id || ""), 120);
	if (!agentId) {
		throw new Error("agent_id is required");
	}

	const existing = await prisma.agentCapacity.findFirst({
		where: {
			agent_id: String(agentId),
			org_owner_id: String(orgOwnerId),
		},
	});

	const next = existing
		? await prisma.agentCapacity.update({
				where: { id: existing.id },
				data: {
					max_concurrent_leads: Math.max(
						1,
						Number(payload.max_concurrent_leads || existing.max_concurrent_leads || 10),
					),
					current_load: Math.max(0, Number(payload.current_load ?? existing.current_load ?? 0)),
					updated_at: new Date(),
				},
			})
		: await prisma.agentCapacity.create({
				data: {
					id: crypto.randomUUID(),
					org_owner_id: String(orgOwnerId),
					agent_id: String(agentId),
					max_concurrent_leads: Math.max(1, Number(payload.max_concurrent_leads || 10)),
					current_load: Math.max(0, Number(payload.current_load ?? 0)),
					updated_at: new Date(),
				},
			});
	return next;
}

export function getDefaultOrgPolicy(orgOwnerId) {
	return {
		id: crypto.randomUUID(),
		org_id: orgOwnerId,
		code: "operations",
		description: "Org operations policy",
		config: {},
		...DEFAULT_POLICY,
		active: true,
		created_at: toIso(),
		updated_at: toIso(),
	};
}
