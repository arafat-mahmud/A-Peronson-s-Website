const DEFAULT_TTL_MINUTES = 60;

function getStore() {
	try {
		return sessionStorage;
	} catch {
		return null;
	}
}

export const secureStorage = {
	getItem(key) {
		const store = getStore();
		if (!store) {
			return null;
		}
		try {
			const raw = store.getItem(key);
			if (!raw) {
				return null;
			}
			const { value, expiry } = JSON.parse(raw);
			if (Date.now() > expiry) {
				store.removeItem(key);
				return null;
			}
			return value;
		} catch {
			return null;
		}
	},

	setItem(key, value, ttlMinutes = DEFAULT_TTL_MINUTES) {
		const store = getStore();
		if (!store) {
			return;
		}
		const expiry = Date.now() + ttlMinutes * 60 * 1000;
		try {
			store.setItem(key, JSON.stringify({ value, expiry }));
		} catch {
			/* storage full or unavailable */
		}
	},

	removeItem(key) {
		const store = getStore();
		if (!store) {
			return;
		}
		try {
			store.removeItem(key);
		} catch {
			/* unavailable */
		}
	},
};
