import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// One-time migration: free agent limit 10 -> 3 (buyer decision, Oct 2026).
// Only rewrites a stored value of 10. A missing key already falls back to the
// code default of 3, and any value an admin set on purpose is left untouched.
async function run() {
	const row = await prisma.appState.findUnique({ where: { key: "admin_config.json" } });
	if (!row) {
		console.log("no stored admin_config.json; code default (3) applies. nothing to do.");
		return;
	}
	const data = row.data || {};
	const current = data?.plan_limits?.free?.agent_limit;
	if (current === undefined) {
		console.log("stored config has no free.agent_limit; code default (3) applies. nothing to do.");
		return;
	}
	if (Number(current) !== 10) {
		console.log(`stored free.agent_limit is ${current}; leaving untouched.`);
		return;
	}
	await prisma.appState.update({
		where: { key: "admin_config.json" },
		data: {
			data: {
				...data,
				plan_limits: {
					...(data.plan_limits || {}),
					free: { ...(data.plan_limits?.free || {}), agent_limit: 3 },
				},
			},
		},
	});
	console.log("migrated stored free.agent_limit 10 -> 3.");
}

run()
	.then(() => prisma.$disconnect())
	.catch((err) => {
		console.error(err);
		return prisma.$disconnect().then(() => process.exit(1));
	});
