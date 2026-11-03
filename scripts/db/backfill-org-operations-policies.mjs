import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_POLICY = {
	assignment_strategy: "least_loaded",
	sla_targets: {
		response_minutes: 60,
		contact_minutes: 240,
		resolution_minutes: 2880,
	},
	escalation_windows: {
		warning_minutes: 30,
		breach_minutes: 60,
	},
};

async function run() {
	const orgOwners = await prisma.user.findMany({
		where: {
			role: { in: ["owner", "admin", "buying_house", "factory"] },
		},
		select: { id: true },
	});

	let inserted = 0;
	for (const owner of orgOwners) {
		const exists = await prisma.orgPolicy.findUnique({
			where: { org_id_policy_code: { org_id: owner.id, code: "operations" } },
			select: { id: true },
		});
		if (exists) {
			continue;
		}

		await prisma.orgPolicy.create({
			data: {
				id: crypto.randomUUID(),
				org_id: owner.id,
				code: "operations",
				description: "Org operations policy",
				config: {},
				active: true,
				assignment_strategy: DEFAULT_POLICY.assignment_strategy,
				sla_targets: DEFAULT_POLICY.sla_targets,
				escalation_windows: DEFAULT_POLICY.escalation_windows,
			},
		});
		inserted += 1;
	}
}

run()
	.catch((_error) => {
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
