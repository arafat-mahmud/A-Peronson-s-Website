export const ROUTE_MANIFEST = [
	"/",
	"/pricing",
	"/about",
	"/terms",
	"/privacy",
	"/help",
	"/login",
	"/signup",
	"/onboarding",
	"/access-denied",
	"/feed",
	"/feed/manage",
	"/search",
	"/partner-network",
	"/product-management",
	"/buyer-requests",
	"/notifications",
	"/chat",
	"/call",
	"/ratings/feedback",
	"/support",
	"/feedback",
	"/member-management",
	"/settings",
	"/org-settings",
	"/insights",
	"/owner",
	"/contracts",
	"/leads",
	"/agent",
	"/admin",
	"/admin/governance",
	"/tasks",
	"/verification",
	"/share/:entityType/:entityId",
	"/boosts/:id",
	"/orders",
	"/profile/:id",
];

const ROUTE_PATTERNS = [
	/^\/industry\/[^/]+$/,
	/^\/buyer\/[^/]+$/,
	/^\/factory\/[^/]+$/,
	/^\/buying-house\/[^/]+$/,
	/^\/profile\/[^/]+$/,
	/^\/share\/[^/]+\/[^/]+$/,
	/^\/boosts\/[^/]+$/,
	/^\/[^/]+\/meow\/[^/]+\/SignupUltra$/,
	/^\/settings\?.+$/,
	/^\/org-settings\?.+$/,
	/^\/join-requests\/[^/]+$/,
	/^\/verification$/,
];

export function isRouteValid(path) {
	if (!path) {
		return false;
	}

	if (path === "*") {
		return false;
	}

	if (ROUTE_MANIFEST.includes(path)) {
		return true;
	}

	for (const pattern of ROUTE_PATTERNS) {
		if (pattern.test(path)) {
			return true;
		}
	}

	return false;
}
