import crypto from "node:crypto";

function parseUrlList(raw) {
	return String(raw || "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
}

function buildTurnRestCredential(sharedSecret, username) {
	return crypto.createHmac("sha1", String(sharedSecret)).update(String(username)).digest("base64");
}

export function buildIceServers({ userId = "" } = {}) {
	const iceServers = [];

	const stunUrls = parseUrlList(process.env.STUN_URLS);
	const stunFallback = ["stun:stun.l.google.com:19302"];
	const resolvedStunUrls = stunUrls.length > 0 ? stunUrls : stunFallback;
	if (resolvedStunUrls.length > 0) {
		iceServers.push({ urls: resolvedStunUrls });
	}

	const turnUrls = parseUrlList(process.env.TURN_URLS);
	if (turnUrls.length === 0) {
		return iceServers;
	}

	const sharedSecret = String(process.env.TURN_SHARED_SECRET || "").trim();
	const staticUsername = String(process.env.TURN_USERNAME || "").trim();
	const staticCredential = String(process.env.TURN_CREDENTIAL || "").trim();
	const ttlSeconds = Math.max(60, Number(process.env.TURN_TTL_SECONDS || 3600));

	if (sharedSecret) {
		const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
		const username = `${expiresAt}:${userId || "user"}`;
		const credential = buildTurnRestCredential(sharedSecret, username);
		iceServers.push({
			urls: turnUrls,
			username,
			credential,
			credentialType: "password",
		});
		return iceServers;
	}

	if (staticUsername && staticCredential) {
		iceServers.push({
			urls: turnUrls,
			username: staticUsername,
			credential: staticCredential,
			credentialType: "password",
		});
	}

	return iceServers;
}
