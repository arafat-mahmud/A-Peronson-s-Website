export const WORKFLOW_LIFECYCLE_STATES = [
	"discovered",
	"matched",
	"contacted",
	"meeting_scheduled",
	"negotiating",
	"contract_drafted",
	"contract_signed",
	"closed",
];

export const WORKFLOW_LIFECYCLE_TRANSITIONS = {
	discovered: ["matched"],
	matched: ["contacted"],
	contacted: ["meeting_scheduled", "negotiating"],
	meeting_scheduled: ["negotiating"],
	negotiating: ["contract_drafted"],
	contract_drafted: ["contract_signed"],
	contract_signed: ["closed"],
	closed: [],
};

export function isWorkflowLifecycleState(state) {
	return WORKFLOW_LIFECYCLE_STATES.includes(String(state || "").trim());
}

export function nextWorkflowLifecycleStates(fromState) {
	const from = String(fromState || "").trim();
	if (!isWorkflowLifecycleState(from)) {
		return [];
	}
	return [...(WORKFLOW_LIFECYCLE_TRANSITIONS[from] || [])];
}

export function validateWorkflowLifecycleTransition(fromState, toState) {
	const from = String(fromState || "").trim();
	const to = String(toState || "").trim();

	if (!isWorkflowLifecycleState(from)) {
		return {
			ok: false,
			code: "INVALID_FROM_STATE",
			message: `Unknown workflow state: ${from || "empty"}`,
			allowed_next_states: [],
		};
	}

	if (!isWorkflowLifecycleState(to)) {
		return {
			ok: false,
			code: "INVALID_TO_STATE",
			message: `Unknown workflow state: ${to || "empty"}`,
			allowed_next_states: nextWorkflowLifecycleStates(from),
		};
	}

	const allowed = nextWorkflowLifecycleStates(from);
	if (!allowed.includes(to)) {
		return {
			ok: false,
			code: "INVALID_TRANSITION",
			message: `Cannot transition workflow from ${from} to ${to}`,
			allowed_next_states: allowed,
		};
	}

	return {
		ok: true,
		code: "OK",
		message: "Transition accepted",
		allowed_next_states: allowed,
	};
}

export function normalizeWorkflowLifecycleState(state, fallback = "discovered") {
	const normalized = String(state || "").trim();
	return isWorkflowLifecycleState(normalized) ? normalized : fallback;
}
