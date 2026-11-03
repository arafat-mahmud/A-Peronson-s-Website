import { isCrmSqlEnabled, readLegacyJson } from "../utils/crmFallbackStore.js";
import { isOwnerOrAdmin } from "../utils/permissions.js";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";

function buildOrgMemberIds(users = [], orgId = "") {
	const members = new Set();
	if (!orgId) {
		return members;
	}
	members.add(String(orgId));
	users.forEach((u) => {
		if (String(u.org_owner_id || "") === String(orgId)) {
			members.add(String(u.id));
		}
	});
	return members;
}
const USE_SQL_CRM = isCrmSqlEnabled();

async function readStore(fileName) {
	if (USE_SQL_CRM) {
		switch (fileName) {
			case "users.json":
				return prisma.user.findMany();
			case "messages.json":
				return prisma.message.findMany();
			case "call_sessions.json":
				return prisma.callSession.findMany();
			case "documents.json":
				return prisma.document.findMany();
			case "leads.json":
				return prisma.lead.findMany();
			default:
				return [];
		}
	}
	return readLegacyJson(fileName);
}

function canViewCrm(actor, targetUser) {
	if (!(actor && targetUser)) {
		return false;
	}
	if (isOwnerOrAdmin(actor)) {
		return true;
	}
	const actorId = String(actor.id || "");
	if (actorId && actorId === String(targetUser.id || "")) {
		return true;
	}
	if (actor.role === "agent" && String(actor.org_owner_id || "") === String(targetUser.id || "")) {
		return true;
	}
	return false;
}

function parseMarketplaceMatchId(matchId = "") {
	const parts = String(matchId).split(":");
	if (parts.length !== 2) {
		return null;
	}
	return {
		requirementId: sanitizeString(parts[0], 120),
		supplierId: sanitizeString(parts[1], 120),
	};
}

function parseTimestamp(value) {
	if (!value) {
		return null;
	}
	const ts = new Date(value).getTime();
	return Number.isFinite(ts) ? ts : null;
}

function withinRange(value, range = {}) {
	const ts = parseTimestamp(value);
	if (!Number.isFinite(ts)) {
		return false;
	}
	if (range.from && ts < range.from) {
		return false;
	}
	if (range.to && ts > range.to) {
		return false;
	}
	return true;
}

function buildThreadTimeline(messages = [], usersById = new Map(), leadByMatch = new Map()) {
	const byMatch = new Map();
	messages.forEach((msg) => {
		const matchId = String(msg.match_id || "");
		if (!matchId) {
			return;
		}
		if (!byMatch.has(matchId)) {
			byMatch.set(matchId, {
				match_id: matchId,
				counterparty_id: leadByMatch.get(matchId)?.counterparty_id || "",
				last_message_at: msg.timestamp || msg.created_at || "",
				message_count: 0,
				messages: [],
			});
		}
		const entry = byMatch.get(matchId);
		entry.message_count += 1;
		const ts = String(msg.timestamp || msg.created_at || "");
		if (!entry.last_message_at || ts > entry.last_message_at) {
			entry.last_message_at = ts;
		}
		const sender = usersById.get(String(msg.sender_id || ""));
		entry.messages.push({
			...msg,
			sender_name: sender?.name || sender?.email || msg.sender_name || "",
			sender_role: sender?.role || msg.sender_role || "",
		});
	});

	for (const thread of byMatch.values()) {
		thread.messages.sort((a, b) =>
			String(a.timestamp || "").localeCompare(String(b.timestamp || "")),
		);
	}

	return [...byMatch.values()].sort((a, b) =>
		String(b.last_message_at || "").localeCompare(String(a.last_message_at || "")),
	);
}

export async function getCrmProfileSummary(actor, targetId, options = {}) {
	const safeTarget = sanitizeString(String(targetId || ""), 120);
	if (!safeTarget) {
		return { error: "Target id required" };
	}

	const [users, messages, calls, documents, leads] = await Promise.all([
		readStore("users.json"),
		readStore("messages.json"),
		readStore("call_sessions.json"),
		readStore("documents.json"),
		readStore("leads.json"),
	]);

	const targetUser =
		(Array.isArray(users) ? users : []).find((u) => String(u.id) === safeTarget) || null;
	if (!targetUser) {
		return { error: "Target user not found" };
	}
	if (!canViewCrm(actor, targetUser)) {
		return { error: "forbidden" };
	}

	const orgId = String(targetUser.id || "");
	const orgMembers = buildOrgMemberIds(users, orgId);

	const range = {
		from: parseTimestamp(options?.from),
		to: parseTimestamp(options?.to),
	};

	const messageRows = (Array.isArray(messages) ? messages : [])
		.filter((m) => {
			const matchId = String(m.match_id || "");
			const senderId = String(m.sender_id || "");
			if (orgMembers.has(senderId)) {
				return true;
			}
			if (matchId.endsWith(`:${orgId}`)) {
				return true;
			}
			if (matchId.startsWith("friend:") && orgMembers.has(senderId)) {
				return true;
			}
			return false;
		})
		.filter((m) =>
			options?.match_id ? String(m.match_id || "") === String(options.match_id) : true,
		)
		.filter((m) =>
			range.from || range.to ? withinRange(m.timestamp || m.created_at, range) : true,
		);

	const leadRows = (Array.isArray(leads) ? leads : [])
		.filter((l) => String(l.org_owner_id || "") === orgId)
		.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));

	const leadByMatch = new Map(leadRows.map((lead) => [String(lead.match_id || ""), lead]));
	const usersById = new Map((Array.isArray(users) ? users : []).map((u) => [String(u.id), u]));

	const threads = buildThreadTimeline(messageRows, usersById, leadByMatch);

	const callRows = (Array.isArray(calls) ? calls : [])
		.filter((c) => {
			const participants = Array.isArray(c.participant_ids) ? c.participant_ids.map(String) : [];
			return participants.some((id) => orgMembers.has(id));
		})
		.filter((c) =>
			options?.match_id
				? String(c.match_id || c?.context?.chat_thread_id || "") === String(options.match_id)
				: true,
		)
		.filter((c) =>
			range.from || range.to ? withinRange(c.created_at || c.started_at, range) : true,
		);

	const callItems = callRows
		.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
		.map((row) => ({
			...row,
			participants: Array.isArray(row.participant_ids)
				? row.participant_ids.map((id) => {
						const user = usersById.get(String(id));
						return { id, name: user?.name || user?.email || id };
					})
				: [],
		}));

	const contractRows = (Array.isArray(documents) ? documents : [])
		.filter((d) => String(d.entity_type || "").toLowerCase() === "contract")
		.filter((d) => String(d.buyer_id || "") === orgId || String(d.factory_id || "") === orgId)
		.filter((d) => {
			if (!options?.match_id) {
				return true;
			}
			const parsed = parseMarketplaceMatchId(String(options.match_id));
			if (!parsed) {
				return true;
			}
			return String(d.factory_id || "") === String(parsed.supplierId);
		})
		.filter((d) =>
			range.from || range.to ? withinRange(d.updated_at || d.created_at, range) : true,
		);
	const contractItems = contractRows
		.sort((a, b) =>
			String(b.updated_at || b.created_at || "").localeCompare(
				String(a.updated_at || a.created_at || ""),
			),
		)
		.map((row) => ({
			...row,
			signed_at: row.buyer_signed_at || row.factory_signed_at || "",
		}));

	const leadStatusCounts = leadRows.reduce((acc, lead) => {
		const key = String(lead.status || "new");
		acc[key] = (acc[key] || 0) + 1;
		return acc;
	}, {});

	const agentOutcomes = (Array.isArray(users) ? users : [])
		.filter(
			(u) =>
				String(u.org_owner_id || "") === orgId && String(u.role || "").toLowerCase() === "agent",
		)
		.map((agent) => {
			const assigned = leadRows.filter(
				(l) => String(l.assigned_agent_id || "") === String(agent.id),
			);
			const closed = assigned.filter((l) => String(l.status || "") === "closed").length;
			const confirmed = assigned.filter((l) => String(l.status || "") === "order_confirmed").length;
			const converted = assigned.filter((l) => Boolean(l.conversion_at)).length;
			return {
				agent_id: agent.id,
				name: agent.name || agent.email || agent.id,
				assigned_leads: assigned.length,
				closed_leads: closed,
				orders_confirmed: confirmed,
				conversions: converted,
			};
		});

	const previousOrders = contractItems
		.filter((row) => String(row.lifecycle_status || "").toLowerCase() === "signed")
		.sort((a, b) => String(b.signed_at || "").localeCompare(String(a.signed_at || "")));

	return {
		org_id: orgId,
		role: targetUser.role || "",
		leads: {
			total: leadRows.length,
			by_status: leadStatusCounts,
			latest: leadRows.slice(0, 6),
		},
		messages: {
			total_threads: threads.length,
			total_messages: messageRows.length,
			threads,
		},
		calls: {
			total: callRows.length,
			items: callItems,
		},
		contracts: {
			total: contractRows.length,
			items: contractItems,
		},
		previous_orders: previousOrders,
		agent_outcomes: agentOutcomes,
	};
}

export async function getCrmRelationshipTimeline(actor, counterpartyId, options = {}) {
	const safeCounterparty = sanitizeString(String(counterpartyId || ""), 120);
	if (!safeCounterparty) {
		return { error: "Counterparty id required" };
	}

	const actorOrgId =
		String(actor?.role || "").toLowerCase() === "agent"
			? sanitizeString(actor?.org_owner_id || "", 120)
			: sanitizeString(actor?.id || "", 120);
	if (!actorOrgId) {
		return { error: "forbidden" };
	}

	const [users, messages, calls, documents, leads] = await Promise.all([
		readStore("users.json"),
		readStore("messages.json"),
		readStore("call_sessions.json"),
		readStore("documents.json"),
		readStore("leads.json"),
	]);

	const allUsers = Array.isArray(users) ? users : [];
	const orgUser = allUsers.find((u) => String(u.id) === actorOrgId) || null;
	if (!orgUser) {
		return { error: "Organization not found" };
	}
	if (!canViewCrm(actor, orgUser)) {
		return { error: "forbidden" };
	}

	const counterparty = allUsers.find((u) => String(u.id) === safeCounterparty) || null;

	const orgMembers = buildOrgMemberIds(allUsers, actorOrgId);
	const range = {
		from: parseTimestamp(options?.from),
		to: parseTimestamp(options?.to),
	};

	const leadRows = (Array.isArray(leads) ? leads : [])
		.filter((l) => String(l.org_owner_id || "") === actorOrgId)
		.filter((l) => String(l.counterparty_id || "") === safeCounterparty)
		.filter((l) =>
			options?.match_id ? String(l.match_id || "") === String(options.match_id) : true,
		)
		.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));

	const matchIds = new Set(leadRows.map((lead) => String(lead.match_id || "")).filter(Boolean));
	const messageRows = (Array.isArray(messages) ? messages : [])
		.filter((m) => matchIds.has(String(m.match_id || "")))
		.filter((m) =>
			range.from || range.to ? withinRange(m.timestamp || m.created_at, range) : true,
		);

	const leadByMatch = new Map(leadRows.map((lead) => [String(lead.match_id || ""), lead]));
	const usersById = new Map(allUsers.map((u) => [String(u.id), u]));
	const threads = buildThreadTimeline(messageRows, usersById, leadByMatch);

	const callRows = (Array.isArray(calls) ? calls : [])
		.filter((c) => {
			const participants = Array.isArray(c.participant_ids) ? c.participant_ids.map(String) : [];
			if (!participants.some((id) => orgMembers.has(id))) {
				return false;
			}
			if (!participants.includes(safeCounterparty)) {
				return false;
			}
			return true;
		})
		.filter((c) =>
			options?.match_id
				? String(c.match_id || c?.context?.chat_thread_id || "") === String(options.match_id)
				: true,
		)
		.filter((c) =>
			range.from || range.to ? withinRange(c.created_at || c.started_at, range) : true,
		);

	const callItems = callRows
		.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
		.map((row) => ({
			...row,
			participants: Array.isArray(row.participant_ids)
				? row.participant_ids.map((id) => {
						const user = usersById.get(String(id));
						return { id, name: user?.name || user?.email || id };
					})
				: [],
		}));

	const contractRows = (Array.isArray(documents) ? documents : [])
		.filter((d) => String(d.entity_type || "").toLowerCase() === "contract")
		.filter((d) => {
			const buyerId = String(d.buyer_id || "");
			const factoryId = String(d.factory_id || "");
			return (
				(buyerId === actorOrgId && factoryId === safeCounterparty) ||
				(factoryId === actorOrgId && buyerId === safeCounterparty)
			);
		})
		.filter((d) =>
			range.from || range.to ? withinRange(d.updated_at || d.created_at, range) : true,
		);

	const contractItems = contractRows
		.sort((a, b) =>
			String(b.updated_at || b.created_at || "").localeCompare(
				String(a.updated_at || a.created_at || ""),
			),
		)
		.map((row) => ({
			...row,
			signed_at: row.buyer_signed_at || row.factory_signed_at || "",
		}));

	const previousOrders = contractItems
		.filter((row) => String(row.lifecycle_status || "").toLowerCase() === "signed")
		.sort((a, b) => String(b.signed_at || "").localeCompare(String(a.signed_at || "")));

	const leadStatusCounts = leadRows.reduce((acc, lead) => {
		const key = String(lead.status || "new");
		acc[key] = (acc[key] || 0) + 1;
		return acc;
	}, {});

	const agentOutcomes = allUsers
		.filter(
			(u) =>
				String(u.org_owner_id || "") === actorOrgId &&
				String(u.role || "").toLowerCase() === "agent",
		)
		.map((agent) => {
			const assigned = leadRows.filter(
				(l) => String(l.assigned_agent_id || "") === String(agent.id),
			);
			const closed = assigned.filter((l) => String(l.status || "") === "closed").length;
			const confirmed = assigned.filter((l) => String(l.status || "") === "order_confirmed").length;
			const converted = assigned.filter((l) => Boolean(l.conversion_at)).length;
			return {
				agent_id: agent.id,
				name: agent.name || agent.email || agent.id,
				assigned_leads: assigned.length,
				closed_leads: closed,
				orders_confirmed: confirmed,
				conversions: converted,
			};
		});

	return {
		org_id: actorOrgId,
		role: orgUser.role || "",
		counterparty_id: safeCounterparty,
		counterparty: counterparty
			? {
					id: counterparty.id,
					name: counterparty.name || "",
					role: counterparty.role || "",
					verified: Boolean(counterparty.verified),
					country: counterparty?.profile?.country || "",
				}
			: null,
		leads: {
			total: leadRows.length,
			by_status: leadStatusCounts,
			latest: leadRows.slice(0, 6),
		},
		messages: {
			total_threads: threads.length,
			total_messages: messageRows.length,
			threads,
		},
		calls: {
			total: callRows.length,
			items: callItems,
		},
		contracts: {
			total: contractRows.length,
			items: contractItems,
		},
		previous_orders: previousOrders,
		agent_outcomes: agentOutcomes,
	};
}
