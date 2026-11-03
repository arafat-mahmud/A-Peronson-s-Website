import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";

export function buildFriendMatchId(userA, userB) {
	const ids = [sanitizeString(String(userA || ""), 120), sanitizeString(String(userB || ""), 120)]
		.filter(Boolean)
		.sort();
	if (ids.length !== 2) {
		return "";
	}
	return `friend:${ids[0]}:${ids[1]}`;
}

export async function listFriendConnectionsForUser(userId) {
	const actorId = sanitizeString(String(userId || ""), 120);
	if (!actorId) {
		return [];
	}

	const rows = await prisma.userConnection.findMany({
		where: {
			OR: [{ requester_id: actorId }, { receiver_id: actorId }],
			type: { in: ["friend", "friend_request"] },
		},
	});

	return rows
		.map((row) => {
			const otherUserId = row.requester_id === actorId ? row.receiver_id : row.requester_id;
			return {
				...row,
				other_user_id: otherUserId,
				match_id: buildFriendMatchId(actorId, otherUserId),
			};
		})
		.filter((row) => row.match_id);
}

function isLegacyFriendActive(row) {
	return (
		row.type === "friend_request" &&
		["accepted", "active"].includes(String(row.status || "").toLowerCase())
	);
}

export async function hasFriendRelationship(userA, userB, { includePending = false } = {}) {
	if (!(userA && userB) || userA === userB) {
		return false;
	}

	const row = await prisma.userConnection.findFirst({
		where: {
			OR: [
				{ requester_id: userA, receiver_id: userB },
				{ requester_id: userB, receiver_id: userA },
			],
		},
	});

	if (!row) {
		return false;
	}

	const status = String(row.status || "").toLowerCase();
	if (row.type === "friend" && ["active", "accepted"].includes(status)) {
		return true;
	}
	if (isLegacyFriendActive(row)) {
		return true;
	}
	if (includePending && row.type === "friend_request" && status === "pending") {
		return true;
	}
	return false;
}

export async function isFriendConnected(userA, userB) {
	return hasFriendRelationship(userA, userB);
}
