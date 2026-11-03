import { useCallback, useEffect, useState } from "react";
import { apiRequest, getCurrentUser, getToken } from "../lib/auth.js";

export function useCoreMetrics() {
	const [metrics, setMetrics] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const fetch = useCallback(async () => {
		const user = getCurrentUser();
		if (!user) {
			setLoading(false);
			return;
		}
		const token = getToken();
		if (!token) {
			setLoading(false);
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const data = await apiRequest("/analytics/core-metrics", { token });
			if (data?.ok && Array.isArray(data.metrics)) {
				setMetrics(data.metrics);
			} else {
				setMetrics([]);
			}
		} catch (err) {
			setError(err.message || "Failed to load metrics");
			setMetrics([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetch();
	}, [fetch]);

	return { metrics, loading, error, refetch: fetch };
}
