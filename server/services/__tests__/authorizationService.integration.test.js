import assert from "node:assert/strict";
import test from "node:test";

import { ACTIONS, authorize, buildCapabilityPayload } from "../authorizationService.js";

function actor(overrides = {}) {
	return {
		id: "u-1",
		role: "owner",
		subscription_status: "premium",
		profile: { team: "alpha", sub_team: "east" },
		...overrides,
	};
}

test("denies cross-role action: agent cannot assign leads", async () => {
	const agent = actor({ id: "agent-1", role: "agent", org_owner_id: "org-1" });
	await assert.rejects(
		() => authorize(agent, ACTIONS.LEADS_ASSIGN, { lead_id: "lead-1" }),
		/cannot perform leads.assign/,
	);
});

test("denies advanced filters for free plan", async () => {
	const freeBuyer = actor({ role: "buyer", subscription_status: "free" });
	await assert.rejects(
		() => authorize(freeBuyer, ACTIONS.FILTERS_ADVANCED_ACCESS, {}),
		/Advanced filters require premium\/enterprise plan/,
	);
});

test("allows enterprise member management flow under seat cap", async () => {
	const manager = actor({ role: "admin" });
	const decision = await authorize(manager, ACTIONS.MEMBERS_MANAGE, {
		org_id: "org-1",
		active_seats: 4,
		requested_seats: 1,
		seat_cap: 10,
	});
	assert.equal(decision.allowed, true);
	assert.equal(decision.action, ACTIONS.MEMBERS_MANAGE);
});

test("denies team-restricted analytics outside actor team", async () => {
	const scopedAgent = actor({
		id: "agent-7",
		role: "agent",
		org_owner_id: "org-7",
		profile: { team: "alpha", sub_team: "east" },
	});
	await assert.rejects(
		() =>
			authorize(scopedAgent, ACTIONS.ANALYTICS_VIEW_AGENT, {
				team: "beta",
				sub_team: "west",
				target_agent_id: "agent-7",
			}),
		/Restricted visibility outside your team\/sub-team/,
	);
});

test("capability payload exposes module matrix", () => {
	const capabilities = buildCapabilityPayload(actor({ role: "factory" }));
	assert.equal(capabilities.leads.assign, true);
	assert.equal(capabilities.filters.advanced_access, true);
	assert.equal(capabilities.members.manage, true);
});
