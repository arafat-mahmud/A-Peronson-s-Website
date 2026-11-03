import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getToken } from "../lib/auth.js";
import { fetchUser } from "../store/userSlice.js";

/**
 * @typedef {import('../lib/types').User} User
 */

/**
 * Hook to retrieve secure user information.
 * @returns {{user: User|null, loading: boolean, error: string|null}} User state.
 */
export function useSecureUser() {
	const dispatch = useDispatch();
	const { user, loading, error } = useSelector((s) => s.user);

	useEffect(() => {
		const token = getToken();
		if (token) {
			dispatch(fetchUser());
		}
	}, [dispatch]);

	return { user, loading, error };
}

/**
 * Hook to check if the current user has a premium subscription.
 * @returns {{isPremium: boolean, loading: boolean, user: User|null}} Premium status.
 */
export function usePremiumCheck() {
	const { user, loading } = useSecureUser();
	const isPremium =
		user?.subscription_status?.toLowerCase() === "premium" ||
		user?.entitlements?.plan?.toLowerCase() === "premium";
	return { isPremium, loading, user };
}

/**
 * Hook to check user entitlements.
 * @returns {{entitlements: Object|undefined, hasEntitlement: Function, loading: boolean, user: User|null}} Entitlements data.
 */
export function useEntitlements() {
	const { user, loading } = useSecureUser();
	const hasEntitlement = (feature) => {
		if (!user) {
			return false;
		}
		const entitlements = user.entitlements || {};
		if (entitlements?.features && Object.hasOwn(entitlements.features, feature)) {
			return Boolean(entitlements.features[feature]);
		}
		const plan = String(entitlements?.plan || user.subscription_status || "").toLowerCase();
		if (plan === "premium") {
			return true;
		}
		return false;
	};
	return { entitlements: user?.entitlements, hasEntitlement, loading, user };
}

export { clearUser } from "../store/userSlice.js";
