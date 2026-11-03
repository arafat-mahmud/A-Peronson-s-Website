import crypto from "node:crypto";
import {
	DEAL_LIFECYCLE_STATES,
	normalizeDealLifecycleState,
	validateDealLifecycleTransition,
} from "../../shared/dealLifecycle.js";
import { readLocalJson, writeLocalJson } from "../utils/localStore.js";
import { sanitizeString } from "../utils/validators.js";

const FILE = "deal_journeys.json";

function nowIso() {
	return new Date().toISOString();
}

function normalizeArrayIds(values = []) {
	return [
		...new Set(
			(Array.isArray(values) ? values : []).map((id) => sanitizeString(id, 120)).filter(Boolean),
		),
	];
}

function sanitizeJourney(journey = {}) {
	return {
		id: sanitizeString(journey.id, 120) || crypto.randomUUID(),
		current_state: normalizeDealLifecycleState(journey.current_state, "discovered"),
		search_source: sanitizeString(journey.search_source, 120),
		requirement_id: sanitizeString(journey.requirement_id, 120),
		product_id: sanitizeString(journey.product_id, 120),
		chat_thread_id: sanitizeString(journey.chat_thread_id, 120),
		call_ids: normalizeArrayIds(journey.call_ids),
		contract_id: sanitizeString(journey.contract_id, 120),
		final_conversion_status: sanitizeString(journey.final_conversion_status, 80) || "in_progress",
		interrupted: Boolean(journey.interrupted),
		interrupted_reason: sanitizeString(journey.interrupted_reason, 240),
		rollback_logs: Array.isArray(journey.rollback_logs) ? journey.rollback_logs : [],
		invalid_transitions: Array.isArray(journey.invalid_transitions)
			? journey.invalid_transitions
			: [],
		transitions: Array.isArray(journey.transitions) ? journey.transitions : [],
		created_at: sanitizeString(journey.created_at, 80) || nowIso(),
		updated_at: sanitizeString(journey.updated_at, 80) || nowIso(),
	};
}

async function readJourneys() {
	const rows = await readLocalJson(FILE, []);
	return (Array.isArray(rows) ? rows : []).map(sanitizeJourney);
}

async function writeJourneys(rows = []) {
	return writeLocalJson(FILE, (Array.isArray(rows) ? rows : []).map(sanitizeJourney));
}

function findJourneyByContext(rows = [], context = {}) {
	const contextMatchId = sanitizeString(context.chat_thread_id || context.match_id, 120);
	const contextContractId = sanitizeString(context.contract_id, 120);
	const contextRequirementId = sanitizeString(context.requirement_id, 120);
	const contextProductId = sanitizeString(context.product_id, 120);

	return (
		rows.find((row) => {
			if (contextMatchId && String(row.chat_thread_id || "") === contextMatchId) {
				return true;
			}
			if (contextContractId && String(row.contract_id || "") === contextContractId) {
				return true;
			}
			if (contextRequirementId && String(row.requirement_id || "") === contextRequirementId) {
				return true;
			}
			if (contextProductId && String(row.product_id || "") === contextProductId) {
				return true;
			}
			return false;
		}) || null
	);
}

function pushTransition(journey, toState, eventType, metadata = {}) {
	const fromState = journey.current_state;
	const validation = validateDealLifecycleTransition(fromState, toState);
	const createdAt = nowIso();

	if (!validation.ok) {
		return {
			...journey,
			interrupted: true,
			interrupted_reason: validation.message,
			invalid_transitions: [
				...(journey.invalid_transitions || []),
				{
					id: crypto.randomUUID(),
					event_type: sanitizeString(eventType, 80) || "unknown_event",
					from_state: fromState,
					to_state: toState,
					code: validation.code,
					message: validation.message,
					allowed_next_states: validation.allowed_next_states,
					metadata,
					created_at: createdAt,
				},
			],
			updated_at: createdAt,
		};
	}

	return {
		...journey,
		current_state: toState,
		interrupted: false,
		interrupted_reason: "",
		transitions: [
			...(journey.transitions || []),
			{
				id: crypto.randomUUID(),
				event_type: sanitizeString(eventType, 80) || "state_transition",
				from_state: fromState,
				to_state: toState,
				metadata,
				created_at: createdAt,
			},
		],
		updated_at: createdAt,
	};
}

function advanceJourneyToState(journey, targetState, eventType, metadata = {}) {
	const currentIndex = DEAL_LIFECYCLE_STATES.indexOf(journey.current_state);
	const targetIndex = DEAL_LIFECYCLE_STATES.indexOf(targetState);
	if (currentIndex < 0 || targetIndex < 0) {
		return pushTransition(journey, targetState, eventType, metadata);
	}

	if (targetIndex <= currentIndex) {
		return journey;
	}

	let next = journey;
	for (let idx = currentIndex + 1; idx <= targetIndex; idx += 1) {
		const state = DEAL_LIFECYCLE_STATES[idx];
		next = pushTransition(next, state, eventType, metadata);
	}
	return next;
}

function mergeContext(journey, context = {}) {
	return {
		...journey,
		search_source: sanitizeString(context.search_source, 120) || journey.search_source,
		requirement_id: sanitizeString(context.requirement_id, 120) || journey.requirement_id,
		product_id: sanitizeString(context.product_id, 120) || journey.product_id,
		chat_thread_id:
			sanitizeString(context.chat_thread_id || context.match_id, 120) || journey.chat_thread_id,
		contract_id: sanitizeString(context.contract_id, 120) || journey.contract_id,
		call_ids: normalizeArrayIds([
			...(journey.call_ids || []),
			...(Array.isArray(context.call_ids) ? context.call_ids : []),
			context.call_id,
		]),
	};
}

export async function ensureDealJourney(context = {}) {
	const rows = await readJourneys();
	const existing = findJourneyByContext(rows, context);
	if (existing) {
		const updated = {
			...mergeContext(existing, context),
			updated_at: nowIso(),
		};
		const nextRows = rows.map((row) => (row.id === updated.id ? updated : row));
		await writeJourneys(nextRows);
		return updated;
	}

	const journey = sanitizeJourney({
		search_source: context.search_source,
		requirement_id: context.requirement_id,
		product_id: context.product_id,
		chat_thread_id: context.chat_thread_id || context.match_id,
		contract_id: context.contract_id,
		call_ids: context.call_ids || (context.call_id ? [context.call_id] : []),
		current_state: context.initial_state || "discovered",
		transitions: [
			{
				id: crypto.randomUUID(),
				event_type: "journey_initialized",
				from_state: "",
				to_state: normalizeDealLifecycleState(context.initial_state || "discovered", "discovered"),
				metadata: {
					source: sanitizeString(context.search_source, 120) || "unknown",
				},
				created_at: nowIso(),
			},
		],
	});

	await writeJourneys([...rows, journey]);
	return journey;
}

export async function recordJourneyEvent(eventType, context = {}, metadata = {}) {
	const safeEventType = sanitizeString(eventType, 80);
	if (!safeEventType) {
		return null;
	}

	let journey = await ensureDealJourney(context);
	journey = mergeContext(journey, context);

	const targetStateByEvent = {
		search_open: "discovered",
		match_confirmed: "matched",
		message_start: "contacted",
		call_scheduled: "negotiating",
		call_completed: "sample",
		contract_draft: "agreed",
		contract_signed: "signed",
		deal_closed: "closed",
	};

	const targetState = targetStateByEvent[safeEventType];
	if (targetState) {
		journey = advanceJourneyToState(journey, targetState, safeEventType, metadata);
	}

	if (safeEventType === "conversion_closed_won") {
		journey.final_conversion_status = "won";
		journey = advanceJourneyToState(journey, "closed", safeEventType, metadata);
	}

	if (safeEventType === "conversion_closed_lost") {
		journey.final_conversion_status = "lost";
		journey.interrupted = true;
		journey.interrupted_reason = sanitizeString(metadata?.reason, 240) || "Closed as lost";
	}

	journey.updated_at = nowIso();

	const rows = await readJourneys();
	const nextRows = rows.map((row) => (row.id === journey.id ? journey : row));
	await writeJourneys(nextRows);
	return journey;
}

export async function rollbackDealJourney(journeyId, toState, reason, actorId = "") {
	const id = sanitizeString(journeyId, 120);
	const rollbackState = normalizeDealLifecycleState(toState, "");
	if (!(id && rollbackState)) {
		return null;
	}

	const rows = await readJourneys();
	const current = rows.find((row) => String(row.id) === id);
	if (!current) {
		return null;
	}

	const log = {
		id: crypto.randomUUID(),
		actor_id: sanitizeString(actorId, 120),
		from_state: current.current_state,
		to_state: rollbackState,
		reason: sanitizeString(reason, 260) || "manual_rollback",
		created_at: nowIso(),
	};

	const updated = {
		...current,
		current_state: rollbackState,
		interrupted: true,
		interrupted_reason: `Rollback requested: ${log.reason}`,
		rollback_logs: [...(current.rollback_logs || []), log],
		updated_at: nowIso(),
	};

	const nextRows = rows.map((row) => (row.id === id ? updated : row));
	await writeJourneys(nextRows);
	return updated;
}

export async function getDealJourneyById(journeyId) {
	const id = sanitizeString(journeyId, 120);
	if (!id) {
		return null;
	}
	const rows = await readJourneys();
	return rows.find((row) => String(row.id) === id) || null;
}

export async function getDealJourneyByContext(context = {}) {
	const rows = await readJourneys();
	return findJourneyByContext(rows, context);
}
