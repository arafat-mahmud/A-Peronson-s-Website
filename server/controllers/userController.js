import path from "node:path";
import { ACTIONS, authorize, buildCapabilityPayload } from "../services/authorizationService.js";
import { ensureEntitlement, getEntitlements } from "../services/entitlementService.js";
import { isImageFile } from "../services/imageProcessor.js";
import { addImageToQueue } from "../services/imageQueue.js";
import {
	adminForceLogout as adminForceLogoutUser,
	adminLockMessaging as adminLockMessagingUser,
	adminSetPassword as adminSetPasswordUser,
	adminUpdateUser as adminUpdateUserRecord,
	blockUser as blockUserService,
	deleteUser,
	deleteUserWithPassword,
	findUserById,
	followUser,
	getBlockedUsers,
	isUserBlocked,
	listEarlyVerifiedFactories,
	listUsers,
	lookupPublicUsers,
	searchUsers,
	selfLockAccount,
	selfUnlockAccount,
	sendFriendRequest,
	setUserVerification,
	unblockUser as unblockUserService,
	updateProfile,
} from "../services/userService.js";
import prisma from "../utils/prisma.js";
import { sanitizeSvgFile } from "../utils/svgSanitizer.js";

export async function me(req, res) {
	const user = req.authUser?.id === req.user.id ? req.authUser : await findUserById(req.user.id);
	if (!user) {
		return res.status(404).json({ error: "User not found" });
	}
	const { password_hash: _passwordHash, ...safeUser } = user;
	const entitlements = await getEntitlements(user);
	const capabilities = buildCapabilityPayload(user);
	return res.json({ ...safeUser, entitlements, capabilities });
}

export async function updateMyProfile(req, res) {
	const actor = await findUserById(req.user.id);
	if (!actor) {
		return res.status(404).json({ error: "User not found" });
	}
	const profilePatch = req.body || {};
	const orgSettingFields = [
		"brand_logo_url",
		"brand_cover_url",
		"brand_color",
		"brand_accent",
		"brand_tagline",
		"brand_website",
		"brand_name",
		"account_manager_name",
		"account_manager_email",
		"account_manager_phone",
	];
	const touchesOrgSettings = Object.keys(profilePatch).some((field) =>
		orgSettingFields.includes(field),
	);
	if (touchesOrgSettings) {
		await authorize(actor, ACTIONS.ORG_SETTINGS_MANAGE, {
			section: "branding",
			org_id: actor.org_owner_id || actor.id,
		});
	}
	const user = await updateProfile(req.user.id, profilePatch);
	if (!user) {
		return res.status(404).json({ error: "User not found" });
	}
	return res.json(user);
}

export async function searchUsersController(req, res) {
	const q = String(req.query?.q || "");
	const cursor = Number.isFinite(Number(req.query.cursor))
		? Math.max(0, Math.floor(Number(req.query.cursor)))
		: 0;
	const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
	res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
	res.set("Pragma", "no-cache");
	res.set("Expires", "0");
	res.set("Surrogate-Control", "no-store");
	const result = await searchUsers(req.user.id, q, cursor, limit);
	return res.status(200).json(result);
}

export async function lookupUsers(req, res) {
	const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
	return res.status(200).json(await lookupPublicUsers(req.user, ids));
}

export async function listEarlyVerifiedFactoriesController(req, res) {
	await ensureEntitlement(
		req.user,
		"early_access_verified_factories",
		"Premium plan required for early access to verified factories.",
	);
	const days = Number(req.query?.days || 30);
	const limit = Number(req.query?.limit || 20);
	const factories = await listEarlyVerifiedFactories({ days, limit });
	return res.status(200).json({ items: factories });
}

export async function followUserController(req, res) {
	const targetId = String(req.params.userId || "");
	if (!targetId || targetId === req.user.id) {
		return res.status(400).json({ error: "Invalid target user" });
	}

	const target = await findUserById(targetId);
	if (!target) {
		return res.status(404).json({ error: "Target user not found" });
	}

	const relation = await followUser(req.user.id, targetId);
	return res.status(201).json({ relation });
}

export async function friendRequestController(req, res) {
	const targetId = String(req.params.userId || "");
	if (!targetId || targetId === req.user.id) {
		return res.status(400).json({ error: "Invalid target user" });
	}

	const target = await findUserById(targetId);
	if (!target) {
		return res.status(404).json({ error: "Target user not found" });
	}

	const relation = await sendFriendRequest(req.user.id, targetId);
	return res.status(201).json({ relation });
}

export async function adminListUsers(_req, res) {
	return res.json(await listUsers());
}

export async function adminVerifyUser(req, res) {
	const user = await setUserVerification(req.params.userId, req.body?.verified);
	if (!user) {
		return res.status(404).json({ error: "User not found" });
	}
	return res.json(user);
}

export async function adminDeleteUser(req, res) {
	const deleted = await deleteUser(req.params.userId);
	if (!deleted) {
		return res.status(404).json({ error: "User not found" });
	}
	return res.json({ ok: true });
}

export async function adminUpdateUser(req, res) {
	const updated = await adminUpdateUserRecord(req.params.userId, req.body || {});
	if (!updated) {
		return res.status(404).json({ error: "User not found" });
	}
	return res.json(updated);
}

export async function adminResetPassword(req, res) {
	const newPassword = String(req.body?.new_password || "");
	if (!newPassword || newPassword.length < 6) {
		return res.status(400).json({ error: "new_password must be at least 6 characters" });
	}
	const updated = await adminSetPasswordUser(req.params.userId, newPassword);
	if (!updated) {
		return res.status(404).json({ error: "User not found" });
	}
	return res.json({ ok: true });
}

export async function adminForceLogout(req, res) {
	const updated = await adminForceLogoutUser(req.params.userId);
	if (!updated) {
		return res.status(404).json({ error: "User not found" });
	}
	return res.json({ ok: true });
}

export async function lockMyAccount(req, res) {
	try {
		const { password } = req.body || {};
		if (!password) {
			return res.status(400).json({ error: "Password is required to lock your account" });
		}
		// bcryptjs is the hashing library the project uses; "bcrypt" (native) is
		// not installed, so this import failed and locking always answered 500.
		const bcrypt = await import("bcryptjs");
		const user = await prisma.user.findUnique({ where: { id: req.user.id } });
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}
		const valid = await bcrypt.default.compare(password, user.password_hash || "");
		if (!valid) {
			return res.status(401).json({ error: "Incorrect password" });
		}
		const locked = await selfLockAccount(req.user.id);
		if (!locked) {
			return res.status(404).json({ error: "User not found" });
		}
		return res.json({ ok: true, status: "locked" });
	} catch (err) {
		return res.status(500).json({ error: err.message || "Lock failed" });
	}
}

export async function unlockMyAccount(req, res) {
	try {
		const user = await selfUnlockAccount(req.user.id);
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}
		return res.json({ ok: true, status: "unlocked" });
	} catch (err) {
		return res.status(500).json({ error: err.message || "Unlock failed" });
	}
}

export async function blockUserController(req, res) {
	try {
		const targetId = req.params.targetId;
		if (!targetId) {
			return res.status(400).json({ error: "targetId required" });
		}
		const user = await blockUserService(req.user.id, targetId);
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}
		return res.json({ ok: true });
	} catch (err) {
		return res.status(err.status || 500).json({ error: err.message || "Block failed" });
	}
}

export async function unblockUserController(req, res) {
	try {
		const targetId = req.params.targetId;
		if (!targetId) {
			return res.status(400).json({ error: "targetId required" });
		}
		const user = await unblockUserService(req.user.id, targetId);
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}
		return res.json({ ok: true });
	} catch (err) {
		return res.status(err.status || 500).json({ error: err.message || "Unblock failed" });
	}
}

export async function getMyBlockedUsers(req, res) {
	try {
		const blocked = await getBlockedUsers(req.user.id);
		return res.json({ blocked });
	} catch (err) {
		return res.status(500).json({ error: err.message || "Failed to get blocked users" });
	}
}

export async function checkBlocked(req, res) {
	try {
		const targetId = req.params.targetId;
		if (!targetId) {
			return res.status(400).json({ error: "targetId required" });
		}
		const blocked = await isUserBlocked(req.user.id, targetId);
		return res.json({ blocked });
	} catch (err) {
		return res.status(500).json({ error: err.message || "Check failed" });
	}
}

export async function adminCleanupTestAccounts(req, res) {
	try {
		const pattern = String(req.body?.pattern || "").toLowerCase();
		if (!pattern) {
			return res.status(400).json({ error: "pattern required (e.g., 'test', 'demo')" });
		}
		const users = await prisma.user.findMany({
			where: {
				OR: [
					{ email: { contains: pattern, mode: "insensitive" } },
					{ name: { contains: pattern, mode: "insensitive" } },
				],
				status: { not: "deleted" },
			},
			select: { id: true, name: true, email: true, role: true, created_at: true },
		});
		return res.json({ users, total: users.length });
	} catch (err) {
		return res.status(500).json({ error: err.message || "Search failed" });
	}
}

export async function adminDeleteTestAccounts(req, res) {
	try {
		const userIds = req.body?.userIds;
		if (!Array.isArray(userIds) || userIds.length === 0) {
			return res.status(400).json({ error: "userIds array required" });
		}
		if (userIds.length > 100) {
			return res.status(400).json({ error: "Max 100 accounts at a time" });
		}
		let deleted = 0;
		for (const id of userIds) {
			try {
				await deleteUser(id);
				deleted++;
			} catch {
				// skip individual failures
			}
		}
		return res.json({ ok: true, deleted });
	} catch (err) {
		return res.status(500).json({ error: err.message || "Delete failed" });
	}
}

export async function adminLockMessaging(req, res) {
	const hours = Number(req.body?.lock_hours || 0);
	const updated = await adminLockMessagingUser(req.params.userId, hours);
	if (!updated) {
		return res.status(404).json({ error: "User not found" });
	}
	return res.json({ ok: true });
}

export async function deleteMyAccount(req, res) {
	try {
		const password = String(req.body?.password || "");
		if (!password) {
			return res.status(400).json({ error: "password is required" });
		}
		const deleted = await deleteUserWithPassword(req.user.id, password);
		if (!deleted) {
			return res.status(404).json({ error: "User not found" });
		}
		return res.json({ ok: true });
	} catch (err) {
		return res.status(err.status || 400).json({ error: err.message || "Unable to delete account" });
	}
}

export async function uploadAvatar(req, res) {
	try {
		if (!req.file) {
			return res.status(400).json({ error: "No file uploaded" });
		}
		const avatarUrl = `/uploads/profile/${req.file.filename}`;
		const fullPath = req.file.path ? path.resolve(req.file.path) : null;
		if (fullPath) {
			await sanitizeSvgFile(fullPath).catch(() => null);
		}
		const user = await updateProfile(req.user.id, {
			profile_image: avatarUrl,
			avatar_url: avatarUrl,
		});
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		if (fullPath && isImageFile(req.file.mimetype, req.file.originalname)) {
			addImageToQueue({ filePath: fullPath, documentId: null });
		}

		return res.json({ avatar_url: avatarUrl, profile_image: avatarUrl });
	} catch (err) {
		return res.status(err.status || 400).json({ error: err.message || "Unable to upload avatar" });
	}
}

export async function exportMyData(req, res) {
	try {
		const userId = req.user.id;
		const [user, feedPosts, messages, products, requirements, documents] = await Promise.all([
			prisma.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					name: true,
					email: true,
					role: true,
					country: true,
					timezone: true,
					locale: true,
					plan: true,
					verified: true,
					profile: true,
					created_at: true,
				},
			}),
			prisma.feedPost.findMany({ where: { user_id: userId }, orderBy: { created_at: "desc" } }),
			prisma.message.findMany({
				where: { sender_id: userId },
				orderBy: { created_at: "desc" },
				take: 500,
			}),
			prisma.product.findMany({ where: { company_id: userId }, orderBy: { created_at: "desc" } }),
			prisma.requirement.findMany({ where: { buyer_id: userId }, orderBy: { created_at: "desc" } }),
			prisma.document.findMany({ where: { uploaded_by: userId }, orderBy: { created_at: "desc" } }),
		]);

		const exportData = {
			exported_at: new Date().toISOString(),
			user,
			feed_posts: feedPosts,
			messages: messages.map((m) => ({
				id: m.id,
				match_id: m.match_id,
				message: m.message,
				created_at: m.created_at,
				sender_id: m.sender_id,
				receiver_id: m.receiver_id,
			})),
			products,
			requirements,
			documents: documents.map((d) => ({
				id: d.id,
				filename: d.filename,
				filetype: d.filetype,
				filesize: d.filesize,
				created_at: d.created_at,
			})),
		};

		res.setHeader("Content-Type", "application/json");
		res.setHeader(
			"Content-Disposition",
			`attachment; filename="gartexhub_export_${userId}_${Date.now()}.json"`,
		);
		return res.json(exportData);
	} catch (err) {
		return res.status(500).json({ error: err.message || "Export failed" });
	}
}
