import crypto from "node:crypto";
import { isCrmSqlEnabled } from "../utils/crmFallbackStore.js";
import { logError } from "../utils/logger.js";
import { trackTransition } from "../utils/metrics.js";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";
import { autoSummarizeMatch, resolveOrgOwnerFromMatch } from "./aiConversationService.js";
import { hasCompletedCallByMatch } from "./callSessionService.js";
import { attachMessageToQueue, evaluateMessagePolicy } from "./communicationPolicyService.js";
import {
	buildFriendMatchId,
	hasFriendRelationship,
	isFriendConnected,
	listFriendConnectionsForUser,
} from "./friendService.js";
import { upsertLeadFromMessage } from "./leadService.js";
import { getOrgAiSettings } from "./orgAiService.js";
import { assertMessagingAllowed, moderateTextOrRedactWithContext } from "./policyService.js";
import { hasPendingRatingForCounterparty } from "./ratingsService.js";
import { getRequirementById } from "./requirementService.js";
import { recordWorkflowEvent } from "./workflowLifecycleService.js";

const _USE_SQL_CRM = isCrmSqlEnabled();

function buildUsersById(users = []) {
	return new Map((Array.isArray(users) ? users : []).map((user) => [user.id, user]));
}

function enrichMessage(message = {}, usersById = new Map()) {
	const sender = usersById.get(message.sender_id) || null;
	const senderName = sanitizeString(sender?.name || "", 120);
	return {
		...message,
		sender_name: senderName || message.sender_name || "",
		sender_email: sender?.email || message.sender_email || "",
		sender_verified: Boolean(sender?.verified),
		sender_role: sender?.role || message.sender_role || "",
	};
}

function parseFriendMatchId(matchId = "") {
	const parts = String(matchId).split(":");
	if (parts.length !== 3 || parts[0] !== "friend") {
		return null;
	}
	const first = sanitizeString(parts[1], 120);
	const second = sanitizeString(parts[2], 120);
	if (!(first && second)) {
		return null;
	}
	return [first, second];
}

export async function canAccessMatch(matchId, userId) {
	const pair = parseFriendMatchId(matchId);
	if (!pair) {
		return true;
	}
	if (!pair.includes(userId)) {
		return false;
	}
	return hasFriendRelationship(pair[0], pair[1], { includePending: true });
}

export async function postFriendMessage(senderId, targetUserId, message, type = "text") {
	const targetId = sanitizeString(String(targetUserId || ""), 120);
	if (!targetId || senderId === targetId) {
		const err = new Error("Invalid friend target");
		err.status = 400;
		throw err;
	}

	const connected = await isFriendConnected(senderId, targetId);
	if (!connected) {
		const err = new Error("Only friends can send direct messages");
		err.status = 403;
		throw err;
	}

	const matchId = buildFriendMatchId(senderId, targetId);
	const entry = await postMessage(matchId, senderId, message, type);
	return { match_id: matchId, message: entry };
}

export async function listFriendMatchIdsForUser(userId) {
	const connections = await listFriendConnectionsForUser(userId);
	const ids = new Set(connections.map((row) => row.match_id).filter(Boolean));

	const messages = await prisma.message.findMany({
		where: {
			match_id: {
				startsWith: "friend:",
			},
		},
		select: { match_id: true },
	});
	messages.forEach(({ match_id }) => {
		const pair = parseFriendMatchId(match_id);
		if (Array.isArray(pair) && pair.includes(userId)) {
			ids.add(match_id);
		}
	});

	return [...ids];
}

function upsertRequestState(requests, threadId, updates = {}) {
	const existingIndex = requests.findIndex((request) => request.thread_id === threadId);
	const nextEntry = {
		thread_id: threadId,
		status: "pending",
		acted_by: null,
		acted_at: null,
		...updates,
	};

	if (existingIndex === -1) {
		requests.push(nextEntry);
		return nextEntry;
	}

	requests[existingIndex] = {
		...requests[existingIndex],
		...updates,
	};
	return requests[existingIndex];
}

function requestIdFromMatchId(matchId = "") {
	return String(matchId).split(":")[0] || "";
}

async function enforceConversationLock(matchId, sender) {
	if (String(matchId || "").startsWith("friend:")) {
		return null;
	}
	if (!sender) {
		return null;
	}

	const requestId = requestIdFromMatchId(matchId);
	if (!requestId) {
		return null;
	}

	const role = String(sender.role || "").toLowerCase();
	if (["owner", "admin"].includes(role)) {
		return null;
	}
	if (role !== "agent") {
		return null;
	}

	const requirement = await getRequirementById(requestId);
	if (requirement && String(requirement.buyer_id || "") === String(sender.id || "")) {
		return null;
	}

	const existing = await prisma.conversationLock.findUnique({
		where: { request_id: requestId },
	});
	const allowed = existing
		? [
				...new Set([
					...(Array.isArray(existing.allowed_users) ? existing.allowed_users : []),
					...(Array.isArray(existing.allowed_agents) ? existing.allowed_agents : []),
				]),
			]
		: [];

	if (!existing) {
		const row = {
			request_id: requestId,
			locked_by: sender.id,
			allowed_agents: [sender.id],
			allowed_users: [sender.id],
			lock_type: "agent_claim",
			lock_status: "claimed",
			lock_reason: "agent_claim",
			created_at: new Date(),
			updated_at: new Date(),
		};
		await prisma.conversationLock.create({ data: row });
		return row;
	}

	if (existing.lock_type !== "agent_claim") {
		return existing;
	}
	if (existing.locked_by === sender.id || allowed.includes(sender.id)) {
		return existing;
	}

	const err = new Error("Conversation locked by another agent. Request access to proceed.");
	err.status = 403;
	err.code = "CONVERSATION_LOCKED";
	err.lock = existing;
	throw err;
}

function buildLockMeta(lock, usersById, currentUserId) {
	if (!lock) {
		return {
			status: "unclaimed",
			can_request_access: true,
			claimed_by: null,
			claimed_by_name: "",
			lock_type: null,
			lock_reason: null,
		};
	}

	const claimedByName = usersById.get(lock.locked_by)?.name || lock.locked_by;
	const isOwner = lock.locked_by === currentUserId;
	const allowed = [
		...(Array.isArray(lock.allowed_users) ? lock.allowed_users : []),
		...(Array.isArray(lock.allowed_agents) ? lock.allowed_agents : []),
	].map(String);
	const isGranted = allowed.includes(currentUserId);
	const lockType = lock.lock_type || null;
	const lockReason = lock.lock_reason || null;

	if (isOwner) {
		return {
			status: lock.lock_status || "claimed",
			can_request_access: false,
			claimed_by: lock.locked_by,
			claimed_by_name: claimedByName,
			lock_type: lockType,
			lock_reason: lockReason,
		};
	}

	if (isGranted) {
		return {
			status: "granted",
			can_request_access: false,
			claimed_by: lock.locked_by,
			claimed_by_name: claimedByName,
			lock_type: lockType,
			lock_reason: lockReason,
		};
	}

	return {
		status: lock.lock_status === "locked" ? "request_access" : "request_access",
		can_request_access: true,
		claimed_by: lock.locked_by,
		claimed_by_name: claimedByName,
		lock_type: lockType,
		lock_reason: lockReason,
	};
}

function withConversationMeta(message, usersById, lock, currentUserId) {
	return {
		...message,
		request_id: requestIdFromMatchId(message.match_id),
		conversation_lock: buildLockMeta(lock, usersById, currentUserId),
	};
}

function buildReadMap(reads = [], userId = "") {
	const normalized = String(userId || "");
	const map = new Map();
	(Array.isArray(reads) ? reads : []).forEach((row) => {
		if (String(row.user_id) !== normalized) {
			return;
		}
		const matchId = String(row.match_id || "");
		if (!matchId) {
			return;
		}
		map.set(matchId, row);
	});
	return map;
}

function countUnread(messages = [], userId = "", lastReadAt = null) {
	const cutoff = lastReadAt ? new Date(lastReadAt).getTime() : 0;
	let count = 0;
	for (const msg of messages) {
		if (String(msg.sender_id || "") === String(userId || "")) {
			continue;
		}
		const ts = new Date(msg.timestamp || 0).getTime();
		if (!Number.isFinite(ts)) {
			continue;
		}
		if (!cutoff || ts > cutoff) {
			count += 1;
		}
	}
	return count;
}

function applyFriendThreadMeta(message, fallbackFriend, currentUserId) {
	if (!fallbackFriend) {
		return message;
	}

	const direction = fallbackFriend.requester_id === currentUserId ? "outgoing" : "incoming";
	return {
		...message,
		friend_request_status:
			fallbackFriend.type === "friend_request"
				? String(fallbackFriend.status || "pending")
				: "accepted",
		friend_request_direction: fallbackFriend.type === "friend_request" ? direction : "accepted",
	};
}

export async function postMessage(
	matchId,
	senderId,
	message,
	type = "text",
	attachment = null,
	options = {},
) {
	const sender = await prisma.user.findUnique({ where: { id: senderId } });
	if (!sender) {
		const err = new Error("Sender not found");
		err.status = 404;
		throw err;
	}

	let recipientId = null;
	if (String(matchId).startsWith("friend:")) {
		const pair = parseFriendMatchId(matchId);
		if (pair) {
			recipientId = String(pair[0]) === String(senderId) ? pair[1] : pair[0];
		}
	} else {
		const parts = String(matchId).split(":");
		if (parts.length === 2) {
			const supplierId = parts[1];
			const requestId = parts[0];
			if (requestId) {
				const requirement = await getRequirementById(requestId);
				if (requirement) {
					if (String(senderId) === supplierId) {
						recipientId = requirement.buyer_id;
					} else if (String(senderId) === (requirement.buyer_id || "")) {
						recipientId = supplierId;
					}
				}
			}
		}
	}

	const usersById = new Map();
	usersById.set(sender.id, sender);
	if (sender.org_owner_id) {
		const owner = await prisma.user.findUnique({
			where: { id: String(sender.org_owner_id) },
		});
		if (owner) {
			usersById.set(owner.id, owner);
		}
	}

	const [recentMatchMessages, existingRequest] = await Promise.all([
		prisma.message.findMany({
			where: { match_id: matchId },
			orderBy: { timestamp: "desc" },
			take: 5,
			select: { message: true, sender_id: true, timestamp: true },
		}),
		prisma.messageRequest.findUnique({ where: { thread_id: matchId } }),
	]);

	const recentContext = recentMatchMessages.map((m) => m.message).reverse();
	const messageRequests = existingRequest ? [existingRequest] : [];

	const safeAttachment = attachment
		? {
				name: sanitizeString(attachment?.name, 220),
				url: sanitizeString(attachment?.url, 600),
				mime_type: sanitizeString(attachment?.mime_type, 120),
				size: Number(attachment?.size || 0),
			}
		: null;

	const entry = {
		id: crypto.randomUUID(),
		match_id: matchId,
		sender_id: senderId,
		message: "",
		timestamp: new Date(),
		type,
		attachment: safeAttachment?.url ? safeAttachment : null,
		policy_status: "delivered",
		policy_reason: "policy_allow",
		policy_priority: null,
		retry_after_seconds: 0,
		requires_human_review: false,
		queue_id: null,
	};

	// Enforce per-org AI auto-reply settings for messages originating from AI flows
	const sourceLabel = String(options?.source_label || "");
	if (sourceLabel.startsWith("ai:")) {
		const orgOwnerId = (await resolveOrgOwnerFromMatch(matchId, senderId)) || "";
		if (orgOwnerId) {
			const orgSettings = await getOrgAiSettings(orgOwnerId);
			if (!orgSettings.auto_reply_enabled) {
				const err = new Error("Auto-reply disabled by organization settings.");
				err.status = 403;
				err.code = "AI_AUTO_REPLY_DISABLED";
				throw err;
			}

			const cutoff = new Date(Date.now() - 60 * 60 * 1000);
			const recentCount = await prisma.message.count({
				where: {
					sender_id: senderId,
					timestamp: { gte: cutoff },
				},
			});
			if (recentCount >= Number(orgSettings.auto_reply_rate_limit_per_hour || 20)) {
				const err = new Error("Auto-reply rate limit exceeded for this organization.");
				err.status = 429;
				err.code = "AI_AUTO_REPLY_RATE_LIMIT";
				throw err;
			}
		}
	}

	assertMessagingAllowed(sender);

	if (!String(matchId || "").startsWith("friend:")) {
		const requestId = requestIdFromMatchId(matchId);
		if (requestId) {
			const requirement = await getRequirementById(requestId);
			if (requirement?.verified_only) {
				const role = String(sender?.role || "").toLowerCase();
				const isBuyer = String(requirement?.buyer_id || "") === String(sender?.id || "");
				const isAdmin = ["owner", "admin"].includes(role);
				let isVerifiedSupplier = Boolean(sender?.verified);
				if (!isVerifiedSupplier && role === "agent" && sender?.org_owner_id) {
					const owner = usersById.get(String(sender.org_owner_id)) || null;
					isVerifiedSupplier = Boolean(owner?.verified);
				}
				if (!(isBuyer || isAdmin || isVerifiedSupplier)) {
					const err = new Error(
						"Verified-only: This buyer accepts messages only from verified suppliers. Verify your account to unlock direct access.",
					);
					err.status = 403;
					err.code = "VERIFIED_ONLY";
					throw err;
				}
			}
		}
	}

	await enforceConversationLock(matchId, sender);

	if (!String(matchId).startsWith("friend:") && recipientId) {
		const callCompleted = await hasCompletedCallByMatch(matchId, sender.id);
		if (!callCompleted) {
			const err = new Error(
				"A completed video call is required before sending messages. Schedule a call with the supplier first.",
			);
			err.status = 403;
			err.code = "VIDEO_CALL_REQUIRED";
			throw err;
		}
	}

	if (!String(matchId).startsWith("friend:") && recipientId) {
		const parts = String(matchId).split(":");
		if (parts.length === 2) {
			const [requestId, supplierId] = parts;
			if (requestId) {
				const requirement = await getRequirementById(requestId);
				if (requirement && requirement.buyer_id) {
					const buyerId = requirement.buyer_id;
					const signedContract = await prisma.document.findFirst({
						where: {
							entity_type: "contract",
							OR: [
								{ buyer_id: buyerId, factory_id: supplierId },
								{ buyer_id: supplierId, factory_id: buyerId },
							],
							buyer_signature_state: "signed",
							factory_signature_state: "signed",
						},
					});
					if (signedContract) {
						const hasPending = await hasPendingRatingForCounterparty(buyerId, supplierId);
						if (!hasPending) {
							const err = new Error(
								"Rating required before sending messages after a completed transaction",
							);
							err.status = 403;
							err.code = "RATING_REQUIRED";
							throw err;
						}
					}
				}
			}
		}
	}

	const policyResult = await evaluateMessagePolicy({
		sender,
		matchId,
		text: sanitizeString(message, 2000),
		type,
		orgId: sender?.org_owner_id || sender?.id || "",
	});

	if (policyResult.action === "soft_block" || policyResult.action === "hard_block") {
		const err = new Error(
			policyResult.rejection_message || "Message rejected by communication policy",
		);
		err.status = 429;
		err.code = policyResult.action === "hard_block" ? "POLICY_HARD_BLOCK" : "POLICY_SOFT_BLOCK";
		err.policy = policyResult;
		throw err;
	}

	if (policyResult.action === "queue") {
		entry.policy_status = "queued";
		entry.policy_reason = policyResult.reason;
		entry.policy_priority = policyResult?.decision?.queue_priority_label || null;
		entry.retry_after_seconds = Number(policyResult.retry_after_seconds || 0);
		entry.queue_id = policyResult?.queue?.id || null;
	}

	const moderation = await moderateTextOrRedactWithContext({
		actor: sender,
		text: sanitizeString(message, 2000),
		context_texts: recentContext,
		entity_type: "message",
		entity_id: matchId,
	});

	entry.message = moderation.text;
	entry.moderated = Boolean(moderation.moderated);
	entry.moderation_reason = moderation.reason || "";

	await prisma.$transaction(async (tx) => {
		await tx.message.create({ data: entry });

		if (!sender?.verified) {
			const reqState = upsertRequestState(messageRequests, matchId, {
				status: "pending",
				acted_by: null,
				acted_at: null,
			});
			await tx.messageRequest.upsert({
				where: { thread_id: reqState.thread_id },
				update: reqState,
				create: reqState,
			});
		}
	});

	if (entry.queue_id) {
		await attachMessageToQueue(entry.queue_id, entry.id);
	}

	// CRM (project.md): Every inquiry/message becomes a lead for Buying House / Factory org accounts.
	// Best-effort: never block the message if lead upsert fails.
	try {
		await upsertLeadFromMessage({
			match_id: matchId,
			sender_id: senderId,
			timestamp: entry.timestamp,
			source_type: options?.source_type,
			source_id: options?.source_id,
			source_label: options?.source_label,
		});
	} catch {
		void 0;
	}

	await trackTransition(matchId, "matched", "first_message_sent", {
		sender_id: senderId,
	});

	await recordWorkflowEvent(
		"chat_message_sent",
		{ match_id: matchId, chat_thread_id: matchId },
		{ sender_id: senderId },
	).catch(() => null);

	try {
		const orgOwnerId = await resolveOrgOwnerFromMatch(matchId, senderId);
		if (orgOwnerId) {
			autoSummarizeMatch({ matchId, orgOwnerId }).catch((err) =>
				logError("messageService: autoSummarizeMatch failed", err),
			);
		}
	} catch {
		void 0;
	}

	return enrichMessage(entry, usersById);
}

export async function listMessagesByMatch(matchId) {
	const messages = await prisma.message.findMany({
		where: { match_id: matchId },
	});
	const senderIds = [...new Set(messages.map((m) => m.sender_id).filter(Boolean))];
	const users =
		senderIds.length > 0 ? await prisma.user.findMany({ where: { id: { in: senderIds } } }) : [];
	const usersById = buildUsersById(users);
	return messages.map((message) => enrichMessage(message, usersById));
}

export async function tieredInbox(matchIds, currentUserId) {
	const requestIds = [...new Set(matchIds.map(requestIdFromMatchId).filter(Boolean))];

	const [messages, messageRequests, conversationLocks, messageReads] = await Promise.all([
		prisma.message.findMany({ where: { match_id: { in: matchIds } } }),
		prisma.messageRequest.findMany({
			where: { thread_id: { in: matchIds } },
		}),
		prisma.conversationLock.findMany({
			where: { request_id: { in: requestIds } },
		}),
		prisma.messageRead.findMany({
			where: { match_id: { in: matchIds }, user_id: currentUserId },
		}),
	]);

	const senderIds = [...new Set(messages.map((m) => m.sender_id).filter(Boolean))];
	const lockOwnerIds = [...new Set(conversationLocks.map((l) => l.locked_by).filter(Boolean))];
	const allUserIds = [...new Set([...senderIds, ...lockOwnerIds])];
	const users =
		allUserIds.length > 0 ? await prisma.user.findMany({ where: { id: { in: allUserIds } } }) : [];
	const usersById = buildUsersById(users);
	const lockByRequestId = new Map(conversationLocks.map((lock) => [lock.request_id, lock]));
	const readByMatch = buildReadMap(messageReads, currentUserId);

	const filtered = messages
		.filter((m) => matchIds.includes(m.match_id))
		.map((message) => enrichMessage(message, usersById));
	const requestMap = new Map(messageRequests.map((request) => [request.thread_id, request]));
	const messagesByMatchId = new Map();
	for (const message of filtered) {
		if (!messagesByMatchId.has(message.match_id)) {
			messagesByMatchId.set(message.match_id, []);
		}
		messagesByMatchId.get(message.match_id).push(message);
	}
	const latestByThread = new Map();
	const friendConnections = await listFriendConnectionsForUser(currentUserId);
	const friendConnectionByMatchId = new Map(friendConnections.map((row) => [row.match_id, row]));

	for (const message of filtered) {
		const existing = latestByThread.get(message.match_id);
		if (
			!existing ||
			new Date(message.timestamp || 0).getTime() > new Date(existing.timestamp || 0).getTime()
		) {
			latestByThread.set(message.match_id, message);
		}
	}

	const priority = [];
	const requestPool = [];
	for (const matchId of matchIds) {
		const fallbackFriend = friendConnectionByMatchId.get(matchId);
		const m =
			latestByThread.get(matchId) ||
			(fallbackFriend
				? enrichMessage(
						{
							id: `friend-thread-${matchId}`,
							match_id: matchId,
							sender_id: fallbackFriend.other_user_id,
							message:
								fallbackFriend.type === "friend_request"
									? fallbackFriend.requester_id === currentUserId
										? "Friend request sent. Start chatting after acceptance."
										: "Incoming friend request. Accept to start chatting."
									: "You are now friends. Say hello!",
							timestamp:
								fallbackFriend.updated_at || fallbackFriend.created_at || new Date().toISOString(),
							type: "system",
							attachment: null,
						},
						usersById,
					)
				: null);
		if (!m) {
			continue;
		}

		const request = requestMap.get(m.match_id);
		if (request?.status === "rejected") {
			continue;
		}

		const sender = usersById.get(m.sender_id);
		const requestId = requestIdFromMatchId(m.match_id);
		const lock = lockByRequestId.get(requestId);
		const readRow = readByMatch.get(m.match_id);
		const lastReadAt = readRow?.last_read_at || null;
		const unreadCount = countUnread(
			messagesByMatchId.get(m.match_id) || [],
			currentUserId,
			lastReadAt,
		);
		const withMeta = applyFriendThreadMeta(
			{
				...withConversationMeta(m, usersById, lock, currentUserId),
				unread_count: unreadCount,
				last_read_at: lastReadAt,
			},
			fallbackFriend,
			currentUserId,
		);

		const isPendingFriend =
			fallbackFriend?.type === "friend_request" && fallbackFriend?.status === "pending";

		if (isPendingFriend) {
			requestPool.push(withMeta);
			continue;
		}

		if (request?.status === "accepted" || sender?.verified || fallbackFriend?.type === "friend") {
			priority.push(withMeta);
		} else {
			requestPool.push(withMeta);
		}
	}
	return { priority, request_pool: requestPool };
}

export async function markThreadRead(matchId, userId) {
	const safeMatchId = sanitizeString(String(matchId || ""), 200);
	if (!safeMatchId) {
		const err = new Error("matchId is required");
		err.status = 400;
		throw err;
	}

	const now = new Date();
	const existing = await prisma.messageRead.findFirst({
		where: { match_id: safeMatchId, user_id: String(userId) },
	});

	if (existing) {
		await prisma.messageRead.update({
			where: { id: existing.id },
			data: { last_read_at: now, updated_at: now },
		});
	} else {
		await prisma.messageRead.create({
			data: {
				id: crypto.randomUUID(),
				match_id: safeMatchId,
				user_id: String(userId),
				last_read_at: now,
				updated_at: now,
			},
		});
	}

	return { match_id: safeMatchId, user_id: String(userId), last_read_at: now };
}

async function updateRequestStatus(threadId, status, actedBy) {
	const actedAt = new Date();
	const request = {
		thread_id: threadId,
		status,
		acted_by: actedBy,
		acted_at: actedAt,
	};
	await prisma.messageRequest.upsert({
		where: { thread_id: threadId },
		update: request,
		create: request,
	});
	return request;
}

export async function acceptMessageRequest(threadId, actedBy) {
	return updateRequestStatus(threadId, "accepted", actedBy);
}

export async function rejectMessageRequest(threadId, actedBy) {
	return updateRequestStatus(threadId, "rejected", actedBy);
}
