const STORAGE_KEY = "gt_lead_source";
const DEFAULT_MAX_AGE_MS = 30 * 60 * 1000;

function now() {
	return Date.now();
}

function safeString(value) {
	return String(value || "").trim();
}

export function recordLeadSource({ type, id, label } = {}) {
	const entry = {
		type: safeString(type),
		id: safeString(id),
		label: safeString(label),
		ts: now(),
	};

	if (!(entry.type && entry.id)) {
		return false;
	}

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
		return true;
	} catch {
		return false;
	}
}

export function peekLeadSource({ maxAgeMs = DEFAULT_MAX_AGE_MS } = {}) {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return null;
		}
		const entry = JSON.parse(raw);
		if (!(entry?.type && entry?.id && entry?.ts)) {
			return null;
		}
		if (now() - Number(entry.ts) > maxAgeMs) {
			return null;
		}
		return entry;
	} catch {
		return null;
	}
}

export function consumeLeadSource(options = {}) {
	const entry = peekLeadSource(options);
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// ignore
	}
	return entry;
}
