import {
	formatProductionCapacity,
	industryLabel,
} from "../../shared/config/platformTaxonomy.js";
import prisma from "../utils/prisma.js";
import { redactPhoneFromProfile } from "../utils/privacy.js";
import { sanitizeString } from "../utils/validators.js";
import { getPlanForUser } from "./entitlementService.js";
import { listProducts } from "./productService.js";
import { findUserById } from "./userService.js";
import { getVerification, getVerificationPublicSummary } from "./verificationService.js";

function cleanUserPublic(user) {
	if (!user) {
		return null;
	}
	const profile = user.profile || {};
	// Signup stores the sector as factory_sector; older rows carry industry.
	const industry = profile.industry || profile.factory_sector || "";

	return {
		id: user.id,
		name: user.name,
		role: user.role,
		verified: Boolean(user.verified),
		subscription_status: user.subscription_status || "free",
		created_at: user.created_at || "",
		profile: {
			country: profile.country || "",
			industry,
			industry_label: industryLabel(industry),
			organization_name: profile.organization_name || profile.organization || "",
			profile_image: profile.profile_image || "",
			cover_image_url: profile.cover_image_url || "",
			headline: sanitizeString(profile.headline || "", 160),
			certifications: Array.isArray(profile.certifications) ? profile.certifications : [],
			categories: Array.isArray(profile.categories) ? profile.categories : [],
			employee_count: Number.isFinite(Number(profile.employee_count))
				? Number(profile.employee_count)
				: null,
			production_capacity:
				profile.production_capacity && typeof profile.production_capacity === "object"
					? profile.production_capacity
					: null,
			production_capacity_label:
				formatProductionCapacity(profile.production_capacity) || profile.monthly_capacity || "",
			monthly_capacity: profile.monthly_capacity || "",
			moq: profile.moq || "",
			lead_time_days: profile.lead_time_days || "",
			about: sanitizeString(profile.about || profile.bio || "", 1200),
			tags: Array.isArray(profile.tags) ? profile.tags : [],
		},
		flags: {
			has_bank_proof: Boolean(profile.bank_proof),
			has_export_license: Boolean(profile.export_license),
		},
	};
}

const BRAND_FIELDS = [
	"brand_name",
	"brand_logo_url",
	"brand_tagline",
	"brand_website",
	"brand_cover_url",
	"brand_color",
	"brand_accent",
	"account_manager_name",
	"account_manager_email",
	"account_manager_phone",
];

function extendProfileForOwner(profile, user) {
	const src = user.profile || {};
	for (const field of BRAND_FIELDS) {
		if (src[field]) {
			profile[field] = src[field];
		}
	}
	return profile;
}

function connectionSnapshot(connections, viewerId, targetId) {
	const following = connections.some(
		(row) =>
			row.type === "follow" &&
			row.requester_id === viewerId &&
			row.receiver_id === targetId &&
			row.status === "active",
	);

	const friends = connections.some((row) => {
		const samePair =
			(row.requester_id === viewerId && row.receiver_id === targetId) ||
			(row.requester_id === targetId && row.receiver_id === viewerId);
		if (!samePair) {
			return false;
		}
		const status = String(row.status || "").toLowerCase();
		if (row.type === "friend" && ["active", "accepted"].includes(status)) {
			return true;
		}
		if (row.type === "friend_request" && ["active", "accepted"].includes(status)) {
			return true;
		}
		return false;
	});

	if (friends) {
		return { following, friend_status: "friends" };
	}

	const outgoingPending = connections.some(
		(row) =>
			row.type === "friend_request" &&
			row.requester_id === viewerId &&
			row.receiver_id === targetId &&
			row.status === "pending",
	);
	if (outgoingPending) {
		return { following, friend_status: "requested" };
	}

	const incomingPending = connections.some(
		(row) =>
			row.type === "friend_request" &&
			row.requester_id === targetId &&
			row.receiver_id === viewerId &&
			row.status === "pending",
	);
	if (incomingPending) {
		return { following, friend_status: "incoming" };
	}

	return { following, friend_status: "none" };
}

function sortNewest(a, b) {
	return String(b.created_at || "").localeCompare(String(a.created_at || ""));
}

export async function getProfileOverview(viewerId, profileUserId) {
	const user = await findUserById(profileUserId);
	if (!user) {
		return "not_found";
	}

	const isSelf = Boolean(viewerId) && viewerId === profileUserId;
	const viewer = isSelf ? user : viewerId ? await findUserById(viewerId) : null;
	const isAdmin = Boolean(viewer && ["admin", "owner"].includes(viewer.role));

	// Every figure is scoped to this profile: the relationship only depends on
	// the rows between viewer and profile, and the counts are COUNT queries.
	const [connections, requestCount, productCount, connectedFactories, effectivePlan, verificationRecord] =
		await Promise.all([
			viewerId && !isSelf
				? prisma.userConnection.findMany({
						where: {
							OR: [
								{ requester_id: viewerId, receiver_id: profileUserId },
								{ requester_id: profileUserId, receiver_id: viewerId },
							],
						},
					})
				: [],
			prisma.requirement.count({ where: { buyer_id: profileUserId } }),
			prisma.product.count({ where: { company_id: profileUserId } }),
			user.role === "buying_house"
				? prisma.partnerRequest.count({
						where: {
							status: "connected",
							OR: [{ requester_id: profileUserId }, { target_id: profileUserId }],
						},
					})
				: null,
			getPlanForUser(user),
			getVerification(profileUserId),
		]);

	const safeUser = cleanUserPublic(user);

	if (effectivePlan === "premium" && user.role === "agent" && !safeUser.verified) {
		safeUser.verified = true;
	}

	// The relationship must exist before the visibility rules read it: a
	// stranger's view used to reach `relationship` before its declaration and
	// every non-admin visit to another company's profile failed with HTTP 500.
	const relationship = isSelf
		? { following: false, friend_status: "self" }
		: connectionSnapshot(connections, viewerId, profileUserId);

	let extendedProfile = null;
	if (isSelf || isAdmin || relationship.friend_status === "friends") {
		extendedProfile = extendProfileForOwner({}, user);
	}

	if (!(isSelf || isAdmin)) {
		safeUser.profile = redactPhoneFromProfile(safeUser.profile);
	}

	const verification_summary = getVerificationPublicSummary(user, verificationRecord);

	const counts = {
		requests: requestCount,
		products: productCount,
		connected_factories: connectedFactories,
	};

	return {
		user: safeUser,
		effective_plan: effectivePlan,
		rating_key: `user:${profileUserId}`,
		relationship,
		verification_summary,
		counts,
		viewer_permissions: {
			is_self: viewerId === profileUserId,
			is_admin: isAdmin,
		},
		...(extendedProfile ? { profile_private: extendedProfile } : {}),
	};
}

export async function getProfileRequestsPage(
	_viewerId,
	profileUserId,
	{ cursor = 0, limit = 12 } = {},
) {
	const user = await findUserById(profileUserId);
	if (!user) {
		return "not_found";
	}
	if (user.role !== "buyer") {
		return "invalid_role";
	}

	const [all, total] = await Promise.all([
		prisma.requirement.findMany({
			where: { buyer_id: profileUserId },
			orderBy: { created_at: "desc" },
			skip: cursor,
			take: limit,
		}),
		prisma.requirement.count({ where: { buyer_id: profileUserId } }),
	]);

	const nextCursor = cursor + limit < total ? cursor + limit : null;

	return {
		items: all,
		cursor,
		next_cursor: nextCursor,
		total,
	};
}

export async function getProfileProductsPage(
	_viewerId,
	profileUserId,
	{ cursor = 0, limit = 12 } = {},
) {
	const user = await findUserById(profileUserId);
	if (!user) {
		return "not_found";
	}
	if (!["factory", "buying_house"].includes(user.role)) {
		return "invalid_role";
	}

	const viewer = _viewerId ? await findUserById(_viewerId) : null;
	const isAdmin = viewer && ["admin", "owner"].includes(viewer.role);
	const includeDrafts = _viewerId === profileUserId || isAdmin;

	const products = await listProducts({
		companyId: profileUserId,
		includeDrafts,
		viewerId: viewer?.id || "",
		viewerRole: viewer?.role || "",
	});
	const all = products.sort(sortNewest);
	const pageItems = all.slice(cursor, cursor + limit);
	const nextCursor = cursor + limit < all.length ? cursor + limit : null;

	return {
		items: pageItems,
		cursor,
		next_cursor: nextCursor,
		total: all.length,
	};
}

export async function getProfilePartnerNetworkSummary(viewerId, profileUserId) {
	const user = await findUserById(profileUserId);
	if (!user) {
		return "not_found";
	}
	if (user.role !== "buying_house") {
		return "invalid_role";
	}

	const requests = await prisma.partnerRequest.findMany({
		where: {
			status: "connected",
			OR: [{ requester_id: profileUserId }, { target_id: profileUserId }],
		},
	});
	const partnerIds = requests.map((r) =>
		r.requester_id === profileUserId ? r.target_id : r.requester_id,
	);
	const users = await prisma.user.findMany({
		where: { id: { in: [...new Set([...partnerIds, viewerId].filter(Boolean))] } },
	});
	const usersById = new Map(users.map((u) => [u.id, u]));

	const factories = partnerIds
		.map((id) => usersById.get(id))
		.filter((u) => u && u.role === "factory")
		.map((u) => ({ id: u.id, name: u.name, verified: Boolean(u.verified) }));

	const viewer = usersById.get(viewerId);
	const isAdmin = viewer && ["admin", "owner"].includes(viewer.role);
	const showList = viewerId === profileUserId || isAdmin;

	if (!showList) {
		return { total_connected: factories.length };
	}

	return { total_connected: factories.length, factories };
}
