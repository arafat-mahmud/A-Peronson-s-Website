import crypto from "node:crypto";
import prisma from "./prisma.js";

export async function trackTransition(requirementId, fromStatus, toStatus, context = {}) {
	await prisma.metricTransition.create({
		data: {
			id: crypto.randomUUID(),
			requirement_id: requirementId,
			from_status: fromStatus,
			to_status: toStatus,
			context,
			created_at: new Date(),
		},
	});
}
