import crypto from "node:crypto";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";
import { createNotification } from "./notificationService.js";
import { moderateTextOrRedact } from "./policyService.js";
import { createReport } from "./reportService.js";
import { getRequirementById } from "./requirementService.js";

export async function addComment(user, entityType, entityId, text, parentId = "") {
	let safeText = sanitizeString(text, 800);
	const safeParentId = sanitizeString(parentId, 120);
	let parent = null;
	let _rootId = "";
	let _depth = 0;

	try {
		const moderated = await moderateTextOrRedact({
			actor: user,
			text: safeText,
			entity_type: "comment",
			entity_id: `${sanitizeString(entityType, 60)}:${sanitizeString(entityId, 120)}`,
		});
		safeText = moderated.text;
	} catch {
		// silent
	}

	if (safeParentId) {
		parent = await prisma.socialInteraction.findFirst({
			where: { id: safeParentId, interaction_type: "comment" },
		});
		if (!parent) {
			const err = new Error("Parent comment not found");
			err.status = 400;
			throw err;
		}
		if (
			parent.entity_type !== sanitizeString(entityType, 60) ||
			parent.entity_id !== sanitizeString(entityId, 120)
		) {
			const err = new Error("Parent comment must belong to the same entity");
			err.status = 400;
			throw err;
		}

		_rootId = parent.id;
		_depth = 1;
	}

	const row = await prisma.socialInteraction.create({
		data: {
			id: crypto.randomUUID(),
			interaction_type: "comment",
			entity_type: sanitizeString(entityType, 60),
			entity_id: sanitizeString(entityId, 120),
			actor_id: user.id,
			actor_name: user.name || "",
			actor_verified: Boolean(user.verified),
			text: safeText,
			created_at: new Date(),
		},
	});

	if (String(entityType || "").toLowerCase() === "buyer_request") {
		try {
			const requirement = await getRequirementById(entityId);
			const users = await prisma.user.findMany();
			const category = String(requirement?.category || "").toLowerCase();
			const industry = String(requirement?.industry || "").toLowerCase();
			const targets = users.filter((u) => {
				const role = String(u?.role || "").toLowerCase();
				if (!u?.verified) {
					return false;
				}
				if (!(role === "factory" || role === "buying_house")) {
					return false;
				}
				if (!(category || industry)) {
					return true;
				}
				const profile = u?.profile || {};
				const categories = Array.isArray(profile?.categories)
					? profile.categories.map((c) => String(c || "").toLowerCase())
					: [];
				const profileIndustry = String(profile?.industry || "").toLowerCase();
				return (
					(category && categories.includes(category)) || (industry && profileIndustry === industry)
				);
			});
			await Promise.all(
				targets.map((target) =>
					createNotification(target.id, {
						type: "buyer_request_comment",
						entity_type: "buyer_request",
						entity_id: entityId,
						message: `New comment on buyer request "${requirement?.title || requirement?.category || "Request"}".`,
						meta: {
							request_id: entityId,
							category: requirement?.category || "",
							industry: requirement?.industry || "",
							actor_id: user?.id,
							comment_id: row.id,
						},
					}),
				),
			);
		} catch {
			// non-blocking
		}
	}

	return row;
}

export async function addAction(user, entityType, entityId, action, reason = "") {
	const row = await prisma.socialInteraction.create({
		data: {
			id: crypto.randomUUID(),
			interaction_type: action,
			entity_type: sanitizeString(entityType, 60),
			entity_id: sanitizeString(entityId, 120),
			actor_id: user.id,
			actor_name: user.name || "",
			actor_verified: Boolean(user.verified),
			text: sanitizeString(reason, 800),
			created_at: new Date(),
		},
	});

	if (String(action || "").toLowerCase() === "report") {
		await createReport({
			actor: user,
			entity_type: sanitizeString(entityType, 60),
			entity_id: sanitizeString(entityId, 120),
			reason: reason || "Reported content",
			metadata: { interaction_id: row.id },
		});
	}

	return row;
}

export async function listInteractions(entityType, entityId) {
	const rows = await prisma.socialInteraction.findMany({
		where: {
			entity_type: sanitizeString(entityType, 60),
			entity_id: sanitizeString(entityId, 120),
		},
	});

	const comments = rows.filter((x) => x.interaction_type === "comment");
	const commentActorIds = [...new Set(comments.filter((c) => c.actor_id).map((c) => c.actor_id))];
	if (commentActorIds.length > 0) {
		const users = await prisma.user.findMany({
			where: { id: { in: commentActorIds } },
			select: { id: true, name: true, profile: true },
		});
		const userMap = Object.fromEntries(
			users.map((u) => [
				u.id,
				{
					name: u.name || "",
					avatar: u.profile?.avatar_url || u.profile?.avatar || "",
				},
			]),
		);
		for (const c of comments) {
			const entry = userMap[c.actor_id];
			if (entry) {
				if (!c.actor_name) {
					c.actor_name = entry.name;
				}
				c.actor_avatar = entry.avatar;
			}
		}
	}
	return {
		comments,
		share_count: rows.filter((x) => x.interaction_type === "share").length,
		report_count: rows.filter((x) => x.interaction_type === "report").length,
	};
}
