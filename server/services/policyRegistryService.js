import crypto from "node:crypto";
import prisma from "../utils/prisma.js";

function normalizeScopes(scopes = {}) {
	const role = Array.isArray(scopes?.role) ? scopes.role : [];
	const plan = Array.isArray(scopes?.plan) ? scopes.plan : [];
	const region = Array.isArray(scopes?.region) ? scopes.region : [];
	return {
		role: [...new Set(role.map((v) => String(v || "").trim()).filter(Boolean))],
		plan: [...new Set(plan.map((v) => String(v || "").trim()).filter(Boolean))],
		region: [...new Set(region.map((v) => String(v || "").trim()).filter(Boolean))],
	};
}

export async function upsertPolicyDefinition({ code, name, description = "", actorId }) {
	const normalizedCode = String(code || "")
		.trim()
		.toLowerCase();
	if (!(normalizedCode && String(name || "").trim())) {
		const error = new Error("code and name are required");
		error.status = 400;
		throw error;
	}

	const existing = await prisma.policyDefinition.findUnique({
		where: { code: normalizedCode },
	});
	if (existing) {
		return prisma.policyDefinition.update({
			where: { id: existing.id },
			data: {
				name: String(name).trim(),
				description: String(description || "").trim(),
				updated_at: new Date(),
			},
		});
	}

	return prisma.policyDefinition.create({
		data: {
			id: crypto.randomUUID(),
			code: normalizedCode,
			name: String(name).trim(),
			description: String(description || "").trim(),
			created_by: actorId || null,
		},
	});
}

export async function createPolicyVersion({
	policyId,
	status = "draft",
	effectiveFrom,
	effectiveTo = null,
	rules = {},
	scopes = {},
	actorId,
}) {
	const policy = await prisma.policyDefinition.findUnique({
		where: { id: String(policyId || "") },
	});
	if (!policy) {
		const error = new Error("policy definition not found");
		error.status = 404;
		throw error;
	}

	const last = await prisma.policyVersion.findFirst({
		where: { policy_definition_id: policy.id },
		orderBy: { version: "desc" },
	});

	const nextVersion = (last?.version || 0) + 1;
	const normalizedScopes = normalizeScopes(scopes);

	const created = await prisma.policyVersion.create({
		data: {
			id: crypto.randomUUID(),
			policy_definition_id: policy.id,
			version: nextVersion,
			status: String(status || "draft").toLowerCase(),
			effective_from: effectiveFrom ? new Date(effectiveFrom) : new Date(),
			effective_to: effectiveTo ? new Date(effectiveTo) : null,
			rules: rules && typeof rules === "object" ? rules : {},
			created_by: actorId || null,
			scopes: {
				create: [
					...normalizedScopes.role.map((value) => ({
						id: crypto.randomUUID(),
						scope_type: "role",
						scope_value: value,
					})),
					...normalizedScopes.plan.map((value) => ({
						id: crypto.randomUUID(),
						scope_type: "plan",
						scope_value: value,
					})),
					...normalizedScopes.region.map((value) => ({
						id: crypto.randomUUID(),
						scope_type: "region",
						scope_value: value,
					})),
				],
			},
		},
		include: { scopes: true },
	});

	return created;
}

export async function listPolicyRegistry() {
	return prisma.policyDefinition.findMany({
		orderBy: { created_at: "desc" },
		include: {
			versions: {
				orderBy: { version: "desc" },
				include: { scopes: true },
			},
		},
	});
}

export async function simulatePolicy({ policyVersionId, actor = {} }) {
	const version = await prisma.policyVersion.findUnique({
		where: { id: String(policyVersionId || "") },
		include: { scopes: true, policy: true },
	});
	if (!version) {
		const error = new Error("policy version not found");
		error.status = 404;
		throw error;
	}

	const role = String(actor.role || "").toLowerCase();
	const plan = String(actor.plan || "").toLowerCase();
	const region = String(actor.region || "").toLowerCase();

	const roleScopes = version.scopes
		.filter((s) => s.scope_type === "role")
		.map((s) => s.scope_value.toLowerCase());
	const planScopes = version.scopes
		.filter((s) => s.scope_type === "plan")
		.map((s) => s.scope_value.toLowerCase());
	const regionScopes = version.scopes
		.filter((s) => s.scope_type === "region")
		.map((s) => s.scope_value.toLowerCase());

	const roleHit = roleScopes.length === 0 || roleScopes.includes(role);
	const planHit = planScopes.length === 0 || planScopes.includes(plan);
	const regionHit = regionScopes.length === 0 || regionScopes.includes(region);

	return {
		policy: {
			id: version.policy.id,
			code: version.policy.code,
			name: version.policy.name,
		},
		version: {
			id: version.id,
			version: version.version,
			status: version.status,
			effective_from: version.effective_from,
			effective_to: version.effective_to,
			rules: version.rules || {},
		},
		actor: { role, plan, region },
		matched: roleHit && planHit && regionHit,
		checks: {
			role: roleHit,
			plan: planHit,
			region: regionHit,
		},
	};
}
