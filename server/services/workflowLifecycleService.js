import crypto from "node:crypto";
import {
	normalizeWorkflowLifecycleState,
	validateWorkflowLifecycleTransition,
	WORKFLOW_LIFECYCLE_STATES,
} from "../../shared/workflowLifecycle.js";
import { readLocalJson, writeLocalJson } from "../utils/localStore.js";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";

const JOURNEYS_FILE = "workflow_journeys.json";
const TRANSITIONS_FILE = "workflow_transitions.json";
const AUDIT_FILE = "workflow_audit_logs.json";

function nowIso() {
	return new Date().toISOString();
}

function supportsPrismaWorkflow() {
	if (process.env.NODE_ENV === "test") {
		return false;
	}
	return Boolean(prisma?.workflowJourney && prisma?.workflowTransition);
}

function normalizeJourney(journey = {}) {
	return {
		id: sanitizeString(journey.id, 120) || crypto.randomUUID(),
		match_id: sanitizeString(journey.match_id, 120),
		requirement_id: sanitizeString(journey.requirement_id, 120),
		product_id: sanitizeString(journey.product_id, 120),
		contract_id: sanitizeString(journey.contract_id, 120),
		current_state: normalizeWorkflowLifecycleState(journey.current_state, "discovered"),
		created_at: sanitizeString(journey.created_at, 80) || nowIso(),
		updated_at: sanitizeString(journey.updated_at, 80) || nowIso(),
	};
}

function normalizeTransition(transition = {}) {
	return {
		id: sanitizeString(transition.id, 120) || crypto.randomUUID(),
		journey_id: sanitizeString(transition.journey_id, 120),
		from_state: normalizeWorkflowLifecycleState(transition.from_state, "discovered"),
		to_state: normalizeWorkflowLifecycleState(transition.to_state, "discovered"),
		event_type: sanitizeString(transition.event_type, 80) || "state_transition",
		actor_id: sanitizeString(transition.actor_id, 120),
		source: sanitizeString(transition.source, 80),
		metadata:
			transition.metadata && typeof transition.metadata === "object" ? transition.metadata : {},
		created_at: sanitizeString(transition.created_at, 80) || nowIso(),
		accepted: Boolean(transition.accepted),
		error_code: sanitizeString(transition.error_code, 80),
		error_message: sanitizeString(transition.error_message, 260),
	};
}

async function appendAuditLog(entry = {}) {
	const rows = await readLocalJson(AUDIT_FILE, []);
	const next = [
		...(Array.isArray(rows) ? rows : []),
		{ id: crypto.randomUUID(), created_at: nowIso(), ...entry },
	];
	await writeLocalJson(AUDIT_FILE, next);
}

async function readJourneys() {
	if (supportsPrismaWorkflow()) {
		const rows = await prisma.workflowJourney.findMany();
		return rows.map(normalizeJourney);
	}
	const rows = await readLocalJson(JOURNEYS_FILE, []);
	return (Array.isArray(rows) ? rows : []).map(normalizeJourney);
}

async function writeJourneys(rows = []) {
	const safeRows = (Array.isArray(rows) ? rows : []).map(normalizeJourney);
	if (supportsPrismaWorkflow()) {
		const existing = await prisma.workflowJourney.findMany({
			select: { id: true },
		});
		const keepIds = new Set(safeRows.map((row) => row.id));
		const deleteIds = existing.map((row) => row.id).filter((id) => !keepIds.has(id));
		if (deleteIds.length > 0) {
			await prisma.workflowJourney.deleteMany({
				where: { id: { in: deleteIds } },
			});
		}

		for (const row of safeRows) {
			await prisma.workflowJourney.upsert({
				where: { id: row.id },
				create: row,
				update: row,
			});
		}
		return safeRows;
	}
	await writeLocalJson(JOURNEYS_FILE, safeRows);
	return safeRows;
}

async function readTransitions(journeyId = "") {
	const id = sanitizeString(journeyId, 120);
	if (supportsPrismaWorkflow()) {
		const where = id ? { journey_id: id } : undefined;
		const rows = await prisma.workflowTransition.findMany({
			where,
			orderBy: { created_at: "asc" },
		});
		return rows.map(normalizeTransition);
	}
	const rows = await readLocalJson(TRANSITIONS_FILE, []);
	const safe = (Array.isArray(rows) ? rows : []).map(normalizeTransition);
	return id ? safe.filter((row) => row.journey_id === id) : safe;
}

async function appendTransition(transition) {
	const safe = normalizeTransition(transition);
	if (supportsPrismaWorkflow()) {
		await prisma.workflowTransition.create({ data: safe });
		return safe;
	}
	const rows = await readLocalJson(TRANSITIONS_FILE, []);
	const next = [...(Array.isArray(rows) ? rows : []), safe];
	await writeLocalJson(TRANSITIONS_FILE, next);
	return safe;
}

function resolveJourneyContext(journey, context = {}) {
	return {
		...journey,
		match_id: sanitizeString(context.match_id, 120) || journey.match_id,
		requirement_id: sanitizeString(context.requirement_id, 120) || journey.requirement_id,
		product_id: sanitizeString(context.product_id, 120) || journey.product_id,
		contract_id: sanitizeString(context.contract_id, 120) || journey.contract_id,
		updated_at: nowIso(),
	};
}

function findJourneyByContext(rows = [], context = {}) {
	const matchId = sanitizeString(context.match_id, 120);
	const requirementId = sanitizeString(context.requirement_id, 120);
	const productId = sanitizeString(context.product_id, 120);
	const contractId = sanitizeString(context.contract_id, 120);

	return (
		rows.find((row) => {
			if (matchId && row.match_id === matchId) {
				return true;
			}
			if (contractId && row.contract_id === contractId) {
				return true;
			}
			if (requirementId && row.requirement_id === requirementId) {
				return true;
			}
			if (productId && row.product_id === productId) {
				return true;
			}
			return false;
		}) || null
	);
}

export async function createWorkflowJourney(payload = {}) {
	const rows = await readJourneys();
	const existing = findJourneyByContext(rows, payload);
	if (existing) {
		const merged = resolveJourneyContext(existing, payload);
		await writeJourneys(rows.map((row) => (row.id === merged.id ? merged : row)));
		return merged;
	}

	const initialState = normalizeWorkflowLifecycleState(payload.initial_state, "discovered");
	const journey = normalizeJourney({
		id: payload.id,
		match_id: payload.match_id,
		requirement_id: payload.requirement_id,
		product_id: payload.product_id,
		contract_id: payload.contract_id,
		current_state: initialState,
	});

	await writeJourneys([...rows, journey]);
	await appendTransition({
		journey_id: journey.id,
		from_state: initialState,
		to_state: initialState,
		event_type: "journey_created",
		actor_id: sanitizeString(payload.actor_id, 120),
		source: sanitizeString(payload.source, 80) || "workflow_api",
		metadata: { initial_state: initialState },
		accepted: true,
	});

	return journey;
}

export async function getWorkflowJourneyById(journeyId) {
	const id = sanitizeString(journeyId, 120);
	if (!id) {
		return null;
	}
	const rows = await readJourneys();
	const journey = rows.find((row) => row.id === id) || null;
	if (!journey) {
		return null;
	}
	const transitions = await readTransitions(journey.id);
	return { ...journey, transitions };
}

export async function getWorkflowJourneyByMatchId(matchId) {
	const id = sanitizeString(matchId, 120);
	if (!id) {
		return null;
	}
	const rows = await readJourneys();
	const journey = rows.find((row) => row.match_id === id) || null;
	if (!journey) {
		return null;
	}
	const transitions = await readTransitions(journey.id);
	return { ...journey, transitions };
}

export async function transitionWorkflowJourney(journeyId, payload = {}) {
	const id = sanitizeString(journeyId, 120);
	if (!id) {
		return {
			ok: false,
			status: 400,
			error: {
				code: "INVALID_JOURNEY_ID",
				message: "journey id is required",
				allowed_next_states: [],
			},
		};
	}

	const toState = normalizeWorkflowLifecycleState(payload.to_state, "");
	if (!toState) {
		return {
			ok: false,
			status: 400,
			error: {
				code: "INVALID_TO_STATE",
				message: "to_state is required",
				allowed_next_states: [],
			},
		};
	}

	const rows = await readJourneys();
	const current = rows.find((row) => row.id === id);
	if (!current) {
		return {
			ok: false,
			status: 404,
			error: {
				code: "WORKFLOW_JOURNEY_NOT_FOUND",
				message: "Workflow journey not found",
				allowed_next_states: [],
			},
		};
	}

	const merged = resolveJourneyContext(current, payload.context || {});
	const validation = validateWorkflowLifecycleTransition(merged.current_state, toState);

	if (!validation.ok) {
		const failed = await appendTransition({
			journey_id: id,
			from_state: merged.current_state,
			to_state: toState,
			event_type: sanitizeString(payload.event_type, 80) || "invalid_transition",
			actor_id: sanitizeString(payload.actor_id, 120),
			source: sanitizeString(payload.source, 80) || "workflow_api",
			metadata: payload.metadata || {},
			accepted: false,
			error_code: validation.code,
			error_message: validation.message,
		});

		await appendAuditLog({
			action: "workflow_transition_rejected",
			journey_id: id,
			from_state: merged.current_state,
			to_state: toState,
			error_code: validation.code,
			error_message: validation.message,
			actor_id: sanitizeString(payload.actor_id, 120),
			source: sanitizeString(payload.source, 80) || "workflow_api",
		});

		return {
			ok: false,
			status: 409,
			error: {
				code: validation.code,
				message: validation.message,
				allowed_next_states: validation.allowed_next_states,
			},
			transition: failed,
		};
	}

	const updated = {
		...merged,
		current_state: toState,
		updated_at: nowIso(),
	};

	await writeJourneys(rows.map((row) => (row.id === id ? updated : row)));

	const accepted = await appendTransition({
		journey_id: id,
		from_state: merged.current_state,
		to_state: toState,
		event_type: sanitizeString(payload.event_type, 80) || "state_transition",
		actor_id: sanitizeString(payload.actor_id, 120),
		source: sanitizeString(payload.source, 80) || "workflow_api",
		metadata: payload.metadata || {},
		accepted: true,
	});

	await appendAuditLog({
		action: "workflow_transition_accepted",
		journey_id: id,
		from_state: merged.current_state,
		to_state: toState,
		actor_id: sanitizeString(payload.actor_id, 120),
		source: sanitizeString(payload.source, 80) || "workflow_api",
	});

	return {
		ok: true,
		status: 200,
		journey: { ...updated, transitions: await readTransitions(id) },
		transition: accepted,
	};
}

export async function recordWorkflowEvent(eventType, context = {}, metadata = {}) {
	const safeType = sanitizeString(eventType, 80);
	if (!safeType) {
		return null;
	}

	const stateByEvent = {
		search_open: "discovered",
		match_confirmed: "matched",
		chat_started: "contacted",
		chat_message_sent: "contacted",
		call_scheduled: "meeting_scheduled",
		call_joined: "negotiating",
		call_ended: "negotiating",
		contract_created: "contract_drafted",
		contract_signed: "contract_signed",
		journey_closed: "closed",
	};

	const journey = await createWorkflowJourney({
		...context,
		source: "workflow_hook",
	});
	const targetState = stateByEvent[safeType];
	if (!targetState) {
		return journey;
	}

	if (journey.current_state === targetState) {
		return journey;
	}

	const fromIndex = WORKFLOW_LIFECYCLE_STATES.indexOf(journey.current_state);
	const targetIndex = WORKFLOW_LIFECYCLE_STATES.indexOf(targetState);
	if (fromIndex < 0 || targetIndex < 0) {
		return journey;
	}

	let currentJourney = journey;
	for (let idx = fromIndex + 1; idx <= targetIndex; idx += 1) {
		const nextState = WORKFLOW_LIFECYCLE_STATES[idx];
		const result = await transitionWorkflowJourney(currentJourney.id, {
			to_state: nextState,
			event_type: safeType,
			actor_id: sanitizeString(metadata?.actor_id || context?.actor_id, 120),
			source: "workflow_hook",
			metadata,
			context,
		});
		if (!result?.ok) {
			break;
		}
		currentJourney = result.journey;
	}

	return currentJourney;
}
