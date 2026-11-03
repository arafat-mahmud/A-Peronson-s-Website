import { appStateGeneration, getCachedAppState, setCachedAppState } from "./appStateCache.js";
import prisma from "./prisma.js";

const _mem = new Map();

function isTestEnv() {
	return process.env.NODE_ENV === "test";
}

function toSerializable(value) {
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (Array.isArray(value)) {
		return value.map(toSerializable);
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toSerializable(v)]));
	}
	return value;
}

async function ensureStateRow(key, fallback) {
	const existing = await prisma.appState.findUnique({ where: { key } });
	if (existing) {
		return existing;
	}
	try {
		const created = await prisma.appState.create({
			data: {
				key,
				data: toSerializable(fallback),
			},
		});
		return created;
	} catch (e) {
		if (e.code === "P2002") {
			return await prisma.appState.findUnique({ where: { key } });
		}
		throw e;
	}
}

export async function readLocalJson(fileName, fallback = []) {
	if (isTestEnv()) {
		return _mem.has(fileName) ? _mem.get(fileName) : fallback;
	}
	const key = String(fileName);
	const cached = getCachedAppState(key);
	if (cached !== undefined) return cached;
	const startedAt = appStateGeneration();
	const row = await ensureStateRow(key, fallback);
	const data = row?.data ?? fallback;
	setCachedAppState(key, data, startedAt);
	return data;
}

export async function writeLocalJson(fileName, data) {
	if (isTestEnv()) {
		_mem.set(fileName, data);
		return data;
	}
	const key = String(fileName);
	const payload = toSerializable(data);
	await prisma.appState.upsert({
		where: { key },
		create: { key, data: payload },
		update: { data: payload, updated_at: new Date() },
	});
	return data;
}

export async function updateLocalJson(fileName, updater, fallback = []) {
	if (isTestEnv()) {
		const current = _mem.has(fileName) ? _mem.get(fileName) : fallback;
		const next = await updater(current);
		_mem.set(fileName, next);
		return next;
	}
	const current = await readLocalJson(fileName, fallback);
	const next = await updater(current);
	await writeLocalJson(fileName, next);
	return next;
}
