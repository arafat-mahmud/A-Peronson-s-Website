const presence = new Map();

export function setUserOnline(userId) {
	if (!userId) {
		return;
	}
	presence.set(String(userId), { status: "online", last_seen: Date.now() });
}

export function setUserOffline(userId) {
	if (!userId) {
		return;
	}
	presence.set(String(userId), { status: "offline", last_seen: Date.now() });
}

export function getPresenceSnapshot(userIds = []) {
	const ids =
		Array.isArray(userIds) && userIds.length > 0
			? userIds.map(String)
			: Array.from(presence.keys());
	const snapshot = {};
	ids.forEach((id) => {
		const entry = presence.get(id);
		snapshot[id] = entry || { status: "offline", last_seen: null };
	});
	return snapshot;
}

export function touchUser(userId) {
	if (!userId) {
		return;
	}
	const existing = presence.get(String(userId));
	if (existing?.status === "online") {
		presence.set(String(userId), {
			status: "online",
			last_seen: existing.last_seen || Date.now(),
		});
	}
}
