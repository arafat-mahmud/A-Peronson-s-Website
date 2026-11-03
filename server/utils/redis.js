import { logger } from "./logger.js";

let client = null;
let isConnected = false;

export async function initRedis() {
	const redisUrl = process.env.REDIS_URL;

	if (!redisUrl) {
		logger.warn("[redis] REDIS_URL not set - caching disabled");
		return null;
	}

	try {
		// Loaded only when Redis is configured: the client library alone is
		// ~20 MB of heap, paid on every boot of an instance that has no Redis.
		const { createClient } = await import("redis");
		client = createClient({
			url: redisUrl,
			socket: {
				reconnectStrategy: (retries) => {
					logger.warn(`[redis] Reconnecting (attempt ${retries})...`);
					return 30_000;
				},
			},
		});

		client.on("error", (err) => {
			logger.error("[redis] Client error:", err);
			isConnected = false;
		});

		client.on("connect", () => {
			logger.info("[redis] Connected to Redis");
			isConnected = true;
		});

		client.on("disconnect", () => {
			logger.warn("[redis] Disconnected from Redis");
			isConnected = false;
		});

		await client.connect();
		return client;
	} catch (err) {
		logger.error("[redis] Failed to connect:", err);
		return null;
	}
}

export function getRedisClient() {
	return client;
}

export function isRedisConnected() {
	return isConnected && client?.isOpen;
}

export async function cacheGet(key) {
	if (!isRedisConnected()) {
		return null;
	}
	try {
		const value = await client.get(key);
		return value ? JSON.parse(value) : null;
	} catch (err) {
		logger.error("[redis] cacheGet error:", err);
		return null;
	}
}

export async function cacheSet(key, value, ttlSeconds = 3600) {
	if (!isRedisConnected()) {
		return false;
	}
	try {
		await client.setEx(key, ttlSeconds, JSON.stringify(value));
		return true;
	} catch (err) {
		logger.error("[redis] cacheSet error:", err);
		return false;
	}
}

export async function cacheDelete(key) {
	if (!isRedisConnected()) {
		return false;
	}
	try {
		await client.del(key);
		return true;
	} catch (err) {
		logger.error("[redis] cacheDelete error:", err);
		return false;
	}
}

export async function cacheInvalidatePattern(pattern) {
	if (!isRedisConnected()) {
		return false;
	}
	try {
		const keys = [];
		let cursor = "0";
		do {
			const [nextCursor, found] = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
			cursor = nextCursor;
			keys.push(...found);
		} while (cursor !== "0");
		if (keys.length > 0) {
			await client.del(keys);
		}
		return true;
	} catch (err) {
		logger.error("[redis] cacheInvalidatePattern error:", err);
		return false;
	}
}

export async function closeRedis() {
	if (client) {
		await client.quit();
		client = null;
		isConnected = false;
	}
}
