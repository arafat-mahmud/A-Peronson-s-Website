export const DEAL_LIFECYCLE_STATES = [
	"discovered",
	"matched",
	"contacted",
	"negotiating",
	"sample",
	"agreed",
	"signed",
	"closed",
];

export const DEAL_LIFECYCLE_TRANSITIONS = {
	discovered: ["matched"],
	matched: ["contacted"],
	contacted: ["negotiating"],
	negotiating: ["sample", "agreed"],
	sample: ["agreed", "negotiating"],
	agreed: ["signed", "negotiating"],
	signed: ["closed"],
	closed: [],
};

export function isDealLifecycleState(state) {
	return DEAL_LIFECYCLE_STATES.includes(String(state || "").trim());
}

export function canTransitionDealLifecycle(fromState, toState) {
	const from = String(fromState || "").trim();
	const to = String(toState || "").trim();
	if (!(isDealLifecycleState(from) && isDealLifecycleState(to))) {
		return false;
	}
	return (DEAL_LIFECYCLE_TRANSITIONS[from] || []).includes(to);
}

export function nextDealLifecycleStates(fromState) {
	const from = String(fromState || "").trim();
	if (!isDealLifecycleState(from)) {
		return [];
	}
	return [...(DEAL_LIFECYCLE_TRANSITIONS[from] || [])];
}

export function validateDealLifecycleTransition(fromState, toState) {
	const from = String(fromState || "").trim();
	const to = String(toState || "").trim();

	if (!isDealLifecycleState(from)) {
		return {
			ok: false,
			code: "INVALID_FROM_STATE",
			message: `Unknown deal lifecycle state: ${from || "empty"}`,
			allowed_next_states: [],
		};
	}

	if (!isDealLifecycleState(to)) {
		return {
			ok: false,
			code: "INVALID_TO_STATE",
			message: `Unknown deal lifecycle state: ${to || "empty"}`,
			allowed_next_states: nextDealLifecycleStates(from),
		};
	}

	const allowed = nextDealLifecycleStates(from);
	if (!allowed.includes(to)) {
		return {
			ok: false,
			code: "INVALID_TRANSITION",
			message: `Cannot transition deal lifecycle from ${from} to ${to}`,
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

export function normalizeDealLifecycleState(state, fallback = "discovered") {
	const normalized = String(state || "").trim();
	return isDealLifecycleState(normalized) ? normalized : fallback;
}
