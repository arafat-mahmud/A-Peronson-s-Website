import { logError, logInfo } from "./utils/logger.js";
import prisma from "./utils/prisma.js";

async function main() {
	const user = await prisma.user.findUnique({
		where: { email: "admin@gmail.com" },
		select: { id: true, name: true, email: true, role: true, status: true },
	});

	if (user) {
		logInfo("User found", user);
	} else {
		logInfo("User not found");
	}

	await prisma.$disconnect();
}

main().catch((err) => logError("check-user failed", err));
