export function isValidEmail(email) {
	if (!email) {
		return false;
	}
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUrl(url) {
	if (!url) {
		return false;
	}
	try {
		const u = new URL(url);
		return u.protocol === "http:" || u.protocol === "https:";
	} catch {
		return false;
	}
}

export function isValidPhone(phone) {
	if (!phone) {
		return false;
	}
	return /^\+?[\d\s\-().]{7,20}$/.test(phone);
}

export function isValidIp(ip) {
	if (!ip) {
		return false;
	}
	const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
	const match = ip.match(ipv4);
	if (!match) {
		return false;
	}
	return match.slice(1).every((octet) => {
		const n = Number(octet);
		return n >= 0 && n <= 255;
	});
}

export function isValidPort(port) {
	if (port === undefined || port === null || port === "") {
		return false;
	}
	const n = Number(port);
	return Number.isFinite(n) && Number.isInteger(n) && n >= 1 && n <= 65_535;
}

export function isValidDomain(domain) {
	if (!domain) {
		return false;
	}
	return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(
		domain,
	);
}

export function isValidNumericRange(value, min, max) {
	if (value === undefined || value === null || value === "") {
		return false;
	}
	const n = Number(value);
	return Number.isFinite(n) && n >= min && n <= max;
}

export function isValidOrgName(name) {
	if (!name || typeof name !== "string") {
		return "Organization name is required";
	}
	if (name.length < 2) {
		return "Must be at least 2 characters";
	}
	if (name.length > 100) {
		return "Must be less than 100 characters";
	}
	if (!/^[a-zA-Z0-9\s\-._()&',]+$/.test(name)) {
		return "Contains invalid characters";
	}
	return null;
}

export const ERRORS = {
	email: "Please enter a valid email address",
	url: "Please enter a valid URL (http:// or https://)",
	phone: "Please enter a valid phone number",
	ip: "Please enter a valid IP address",
	port: "Please enter a valid port (1-65535)",
	domain: "Please enter a valid domain name",
	required: "This field is required",
};
