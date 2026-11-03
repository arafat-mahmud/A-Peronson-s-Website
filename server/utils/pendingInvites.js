const pendingInvitesByUser = new Map();

export function enqueuePendingInvites(userIds, invites = []) {
	if (!userIds || invites.length === 0) {
		return;
	}
	const ids = Array.isArray(userIds) ? userIds : [userIds];
	ids.forEach((userId) => {
		if (!userId) {
			return;
		}
		const existing = pendingInvitesByUser.get(userId) || [];
		const next = [...existing];
		invites.forEach((invite) => {
			const callId = invite?.call_id;
			if (!callId) {
				next.push(invite);
				return;
			}
			const alreadyQueued = next.some(
				(entry) => entry?.call_id === callId && entry?.type === invite?.type,
			);
			if (!alreadyQueued) {
				next.push(invite);
			}
		});
		pendingInvitesByUser.set(userId, next);
	});
}

export function consumePendingInvites(userId) {
	if (!userId) {
		return [];
	}
	const queued = pendingInvitesByUser.get(userId) || [];
	if (queued.length > 0) {
		pendingInvitesByUser.delete(userId);
	}
	return queued;
}
