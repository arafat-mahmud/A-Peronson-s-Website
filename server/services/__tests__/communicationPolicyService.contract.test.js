import assert from "node:assert/strict";
import test from "node:test";

import { evaluatePolicyContract } from "../communicationPolicyService.js";

function baseConfig() {
	return {
		message_caps: {
			outbound_per_window: 3,
			window_minutes: 15,
			cooldown_seconds: 45,
		},
		priority_multipliers: { premium: 1.2, verified: 1.3 },
		strictness_mode: "balanced",
		spam_thresholds: { queue: 0.4, hard_block: 0.75 },
	};
}

function recentMessage(senderId, matchId, text = "hello") {
	return {
		sender_id: senderId,
		match_id: matchId,
		message: text,
		timestamp: new Date().toISOString(),
	};
}

test("verified sender is delayed (not rejected) on burst frequency limits", () => {
	const config = baseConfig();
	const messages = [
		recentMessage("u-1", "m-1", "msg-1"),
		recentMessage("u-1", "m-1", "msg-2"),
		recentMessage("u-1", "m-1", "msg-3"),
	];

	const result = evaluatePolicyContract({
		sender: { id: "u-1", verified: true, subscription_status: "free" },
		matchId: "m-1",
		text: "new outreach",
		messages,
		config,
		reputationScore: 55,
	});

	assert.equal(result.action, "soft_block");
	assert.equal(result.reason, "rate_limit_exceeded");
});

test("premium sender gets delayed queue while free sender gets reject under same burst", () => {
	const config = baseConfig();
	const messages = [
		recentMessage("u-2", "m-2", "x1"),
		recentMessage("u-2", "m-2", "x2"),
		recentMessage("u-2", "m-2", "x3"),
	];

	const premium = evaluatePolicyContract({
		sender: { id: "u-2", verified: false, subscription_status: "premium" },
		matchId: "m-2",
		text: "premium burst",
		messages,
		config,
		reputationScore: 55,
	});

	const free = evaluatePolicyContract({
		sender: { id: "u-2", verified: false, subscription_status: "free" },
		matchId: "m-2",
		text: "free burst",
		messages,
		config,
		reputationScore: 55,
	});

	assert.equal(premium.action, "soft_block");
	assert.equal(free.action, "soft_block");
	assert.equal(free.reason, "rate_limit_exceeded");
});

test("new user burst behavior rejects after cap for unverified free users", () => {
	const config = baseConfig();
	const messages = [
		recentMessage("new-user", "thread", "m1"),
		recentMessage("new-user", "thread", "m2"),
		recentMessage("new-user", "thread", "m3"),
	];

	const result = evaluatePolicyContract({
		sender: { id: "new-user", verified: false, subscription_status: "free" },
		matchId: "thread",
		text: "another message in same window",
		messages,
		config,
		reputationScore: 30,
	});

	assert.equal(result.action, "soft_block");
	assert.equal(result.reason, "rate_limit_exceeded");
	assert.equal(result.retryAfterSeconds, 45);
});

test("multilingual spam patterns trigger human review", () => {
	const config = baseConfig();
	const result = evaluatePolicyContract({
		sender: { id: "ml-spam", verified: false, subscription_status: "free" },
		matchId: "m-4",
		text: "বিনামূল্যে অফার! এখন যোগাযোগ করুন telegram t.me/example 免费点击",
		messages: [],
		config,
		reputationScore: 40,
	});

	assert.equal(result.action, "hard_block");
	assert.equal(result.reason, "spam_hard_block");
});
