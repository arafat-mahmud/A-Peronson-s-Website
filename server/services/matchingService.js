import { trackTransition } from "../utils/metrics.js";
import prisma from "../utils/prisma.js";
import { recordWorkflowEvent } from "./workflowLifecycleService.js";

function scoreFactory(requirement, factory) {
	let score = 0;
	const reqQty = Number(requirement.quantity || 0);
	const moq = Number(factory.profile?.moq || 0);
	const lead = Number(factory.profile?.lead_time_days || 0);
	const timeline = Number(requirement.timeline_days || 0);

	const categories = factory.profile?.categories || [];
	if (
		categories
			.map((c) => c.toLowerCase())
			.includes(String(requirement.category || "").toLowerCase())
	) {
		score += 40;
	}
	if (reqQty > 0 && moq > 0 && moq <= reqQty) {
		score += 25;
	}

	const factoryCerts = (factory.profile?.certifications || []).map((c) => c.toLowerCase());
	const reqCerts = (requirement.certifications_required || []).map((c) => c.toLowerCase());
	const certHits = reqCerts.filter((c) => factoryCerts.includes(c)).length;
	score += certHits * 10;

	if (timeline > 0 && lead > 0 && lead <= timeline) {
		score += 20;
	}

	return Math.min(100, score);
}

export async function generateMatchesForRequirement(requirement) {
	const users = await prisma.user.findMany({ where: { role: "factory" } });

	const ranked = users
		.map((factory) => ({
			requirement_id: requirement.id,
			factory_id: factory.id,
			score: scoreFactory(requirement, factory),
			status: "pending",
		}))
		.filter((m) => m.score > 0)
		.sort((a, b) => b.score - a.score);

	await prisma.match.deleteMany({
		where: { requirement_id: requirement.id },
	});

	if (ranked.length > 0) {
		await prisma.match.createMany({
			data: ranked,
		});
	}

	if (ranked.length > 0) {
		await recordWorkflowEvent(
			"match_confirmed",
			{ requirement_id: requirement.id },
			{ match_count: ranked.length },
		).catch(() => null);
	}

	return ranked;
}

export async function updateMatchStatus(requirementId, factoryId, status) {
	const match = await prisma.match.findUnique({
		where: {
			requirement_id_factory_id: {
				requirement_id: requirementId,
				factory_id: factoryId,
			},
		},
	});
	if (!match) {
		return null;
	}
	const prev = match.status;
	const updated = await prisma.match.update({
		where: {
			requirement_id_factory_id: {
				requirement_id: requirementId,
				factory_id: factoryId,
			},
		},
		data: { status },
	});
	if (status === "accepted") {
		await trackTransition(requirementId, prev, "accepted", {
			factory_id: factoryId,
		});
	}
	return updated;
}

export async function listMatchesForRequirement(requirementId) {
	return prisma.match.findMany({
		where: { requirement_id: requirementId },
		orderBy: { score: "desc" },
	});
}

export async function listMatchesForRequirements(requirementIds) {
	if (!Array.isArray(requirementIds) || requirementIds.length === 0) {
		return [];
	}
	return prisma.match.findMany({
		where: { requirement_id: { in: requirementIds } },
		orderBy: { score: "desc" },
	});
}

export async function listMatchesForFactory(factoryId) {
	return prisma.match.findMany({
		where: { factory_id: factoryId },
		orderBy: { score: "desc" },
	});
}
