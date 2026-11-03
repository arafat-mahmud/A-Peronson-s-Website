export function sortByNewest(a, b) {
	return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
}

export function sortByOldest(a, b) {
	return new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime();
}

export function formatDisplayName(name, fallbackId) {
	if (name && String(name).trim()) {
		return String(name).trim();
	}
	const cleaned = String(fallbackId || "")
		.replace(/^friend:/i, "")
		.replace(/[_:.@-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return cleaned || "Unknown contact";
}

export function normalizeThreads(messages = [], currentUserId = "") {
	const byMatchId = new Map();
	const latestByOther = new Map();

	messages.forEach((message) => {
		if (!message?.match_id) {
			return;
		}
		const existing = byMatchId.get(message.match_id);
		const lock = message.conversation_lock || existing?.lock || null;
		const isOther = currentUserId && message.sender_id && message.sender_id !== currentUserId;
		const otherCandidate = isOther ? message : null;

		if (!existing) {
			byMatchId.set(message.match_id, {
				id: message.match_id,
				matchId: message.match_id,
				requestId: message.request_id || String(message.match_id).split(":")[0],
				name: formatDisplayName(
					message.sender_name || message.company_name || message.sender_company_name,
					message.sender_id,
				),
				avatar: message.sender_avatar_url || message.sender_avatar || "",
				senderId: message.sender_id,
				verified: Boolean(message.sender_verified),
				last: String(message.message || "").trim(),
				unread: Number(message.unread_count || 0),
				lastReadAt: message.last_read_at || null,
				timestamp: message.timestamp,
				lock,
				isFriendThread: String(message.match_id || "").startsWith("friend:"),
				friendRequestStatus: message.friend_request_status || null,
				friendRequestDirection: message.friend_request_direction || null,
				policyStatus: message.policy_status || "delivered",
				policyPriority: message.policy_priority || null,
				policyReason: message.policy_reason || "",
				retryAfterSeconds: Number(message.retry_after_seconds || 0),
			});
			if (otherCandidate) {
				latestByOther.set(message.match_id, otherCandidate);
			}
			return;
		}

		if (new Date(message.timestamp || 0).getTime() > new Date(existing.timestamp || 0).getTime()) {
			byMatchId.set(message.match_id, {
				...existing,
				last: String(message.message || "").trim() || existing.last,
				timestamp: message.timestamp,
				lock,
				isFriendThread:
					existing.isFriendThread || String(message.match_id || "").startsWith("friend:"),
				friendRequestStatus: message.friend_request_status || existing.friendRequestStatus || null,
				friendRequestDirection:
					message.friend_request_direction || existing.friendRequestDirection || null,
				unread: Number(message.unread_count || existing.unread || 0),
				lastReadAt: message.last_read_at || existing.lastReadAt || null,
				policyStatus: message.policy_status || existing.policyStatus || "delivered",
				policyPriority: message.policy_priority || existing.policyPriority || null,
				policyReason: message.policy_reason || existing.policyReason || "",
				retryAfterSeconds: Number(message.retry_after_seconds || existing.retryAfterSeconds || 0),
			});
		}

		const existingOther = latestByOther.get(message.match_id);
		if (
			otherCandidate &&
			(!existingOther ||
				new Date(message.timestamp || 0).getTime() >
					new Date(existingOther.timestamp || 0).getTime())
		) {
			latestByOther.set(message.match_id, otherCandidate);
		}
	});

	const normalized = [...byMatchId.values()].map((thread) => {
		const other = latestByOther.get(thread.matchId);
		if (!other) {
			return thread;
		}
		return {
			...thread,
			name: formatDisplayName(
				other.sender_name || other.company_name || other.sender_company_name,
				other.sender_id,
			),
			avatar: other.sender_avatar_url || other.sender_avatar || thread.avatar,
			senderId: other.sender_id,
			verified: Boolean(other.sender_verified),
		};
	});

	return normalized.sort(sortByNewest);
}

export function lockStatusLabel(lock, thread = null) {
	if (thread?.isFriendThread) {
		if (thread.friendRequestStatus === "pending" && thread.friendRequestDirection === "incoming") {
			return "Incoming friend request";
		}
		if (thread.friendRequestStatus === "pending" && thread.friendRequestDirection === "outgoing") {
			return "Friend request pending";
		}
		return "Direct friend chat";
	}

	if (!lock || lock.status === "unclaimed") {
		return "Unclaimed";
	}
	if (lock.lock_type === "verified_first" && lock.status !== "granted") {
		return `Verified first message by ${lock.claimed_by_name || "supplier"}`;
	}
	if (lock.status === "claimed") {
		return `Claimed by ${lock.claimed_by_name || "you"}`;
	}
	if (lock.status === "granted") {
		return "Access granted";
	}
	return `Claimed by ${lock.claimed_by_name || (lock.lock_type === "verified_first" ? "another supplier" : "another agent")}`;
}

export const IMAGE_ATTACHMENT_EXTS = new Set([
	"jpg",
	"jpeg",
	"png",
	"webp",
	"avif",
	"gif",
	"apng",
	"bmp",
	"tiff",
	"tif",
	"heic",
	"heif",
	"dcm",
	"tga",
	"svg",
	"eps",
	"pdf",
	"dng",
	"cr2",
	"cr3",
	"nef",
	"arw",
	"sr2",
	"orf",
	"raf",
	"psd",
	"ai",
	"xcf",
	"cdr",
]);
export const VIDEO_ATTACHMENT_EXTS = new Set([
	"mp4",
	"webm",
	"mkv",
	"flv",
	"vob",
	"ogv",
	"ogg",
	"rrc",
	"gifv",
	"mng",
	"mov",
	"avi",
	"qt",
	"wmv",
	"yuv",
	"rm",
	"asf",
	"amv",
	"m4p",
	"m4v",
	"mpg",
	"mp2",
	"mpeg",
	"mpe",
	"mpv",
	"svi",
	"3gp",
	"3g2",
	"mxf",
	"roq",
	"nsv",
	"f4v",
	"f4p",
	"f4a",
	"f4b",
	"mod",
]);

export function safeAttachmentExt(attachment) {
	const candidates = [attachment?.name, attachment?.url]
		.map((value) => String(value || "").trim())
		.filter(Boolean);
	if (candidates.length === 0) {
		return "";
	}

	const raw = candidates[0];
	const cleaned = raw.split("*")[0].split("#")[0];
	const tail = cleaned.split("/").pop() || cleaned;
	const match = tail.match(/\.([a-z0-9]+)$/i);
	return match ? match[1].toLowerCase() : "";
}

export function isImageExt(attachment) {
	const ext = safeAttachmentExt(attachment);
	return IMAGE_ATTACHMENT_EXTS.has(ext);
}

export function isVideoExt(attachment) {
	const ext = safeAttachmentExt(attachment);
	return VIDEO_ATTACHMENT_EXTS.has(ext);
}

export function isImageMessage(message) {
	return (
		message?.type === "image" ||
		String(message?.attachment?.mime_type || "").startsWith("image/") ||
		isImageExt(message?.attachment)
	);
}

export function isVideoMessage(message) {
	return (
		message?.type === "video" ||
		String(message?.attachment?.mime_type || "").startsWith("video/") ||
		isVideoExt(message?.attachment)
	);
}

export function toAbsoluteAssetUrl(url = "") {
	if (!url) {
		return "";
	}
	if (url.startsWith("http://") || url.startsWith("https://")) {
		return url;
	}
	const apiUrl = import.meta.env.VITE_API_URL || "/api";
	const base = apiUrl.replace(/\/api\/*$/, "");
	return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function truncateId(value = "", size = 8) {
	const normalized = String(value || "");
	if (normalized.length <= size) {
		return normalized;
	}
	return `${normalized.slice(0, size)}...`;
}

export function getInitials(label = "") {
	const words = String(label).trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) {
		return "U";
	}
	if (words.length === 1) {
		return words[0].slice(0, 2).toUpperCase();
	}
	return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}

export function formatTime(iso) {
	if (!iso) {
		return "--:--";
	}
	return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }).toLowerCase();
}

export function getTimezoneLabel() {
	try {
		const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
		return tz ? tz.split("/").pop().replace(/_/g, " ") : "";
	} catch {
		return "";
	}
}

export function getTimezoneAbbr() {
	try {
		const parts = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(
			new Date(),
		);
		const tzPart = parts.find((p) => p.type === "timeZoneName");
		return tzPart?.value || "";
	} catch {
		return "";
	}
}

export function extractFirstUrl(text = "") {
	const match = String(text).match(/https*:\/\/[^\s]+/i);
	return match ? match[0] : "";
}

export function avatarUrl(avatar = "") {
	return String(avatar || "").trim();
}

export function dateDividerLabel(iso) {
	if (!iso) {
		return "Recent";
	}
	const date = new Date(iso);
	const now = new Date();
	const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
	const dayDiff = Math.floor((startToday - startDate) / 86_400_000);
	if (dayDiff <= 0) {
		return "Today";
	}
	if (dayDiff === 1) {
		return "Yesterday";
	}
	return date.toLocaleDateString();
}

export function formatPresence(iso) {
	if (!iso) {
		return "No recent activity";
	}
	const ms = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(ms / 60_000);
	if (mins < 2) {
		return "Online";
	}
	if (mins < 60) {
		return `Last seen ${mins}m ago`;
	}
	const hours = Math.floor(mins / 60);
	if (hours < 24) {
		return `Last seen ${hours}h ago`;
	}
	return `Last seen ${new Date(iso).toLocaleDateString()}`;
}

export function extractLatestNote(notes = [], prefix = "") {
	const matches = (Array.isArray(notes) ? notes : [])
		.filter((note) => String(note.note || "").startsWith(prefix))
		.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
	return matches[0] || null;
}

export function splitSuggestedReply(noteText = "") {
	const raw = String(noteText || "");
	const marker = "Suggested reply:";
	if (!raw.includes(marker)) {
		return { text: raw.trim(), suggested: "" };
	}
	const parts = raw.split(marker);
	return {
		text: parts[0].trim(),
		suggested: parts.slice(1).join(marker).trim(),
	};
}

export function friendCounterpartyId(matchId = "", currentUserId = "") {
	if (!matchId.startsWith("friend:")) {
		return "";
	}
	const parts = String(matchId).split(":");
	if (parts.length !== 3) {
		return "";
	}
	const a = parts[1];
	const b = parts[2];
	if (!currentUserId) {
		return "";
	}
	if (a === currentUserId) {
		return b;
	}
	if (b === currentUserId) {
		return a;
	}
	return "";
}

export function linkPreviewMeta(url = "") {
	try {
		const parsed = new URL(url);
		const host = parsed.hostname.replace(/^www\./i, "");
		const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
		return { host, path };
	} catch {
		return { host: "link", path: "" };
	}
}
