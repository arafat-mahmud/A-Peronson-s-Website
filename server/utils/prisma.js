import prismaClientPkg from "@prisma/client";
import { invalidateAppState } from "./appStateCache.js";
import { invalidateSessions, invalidateUser } from "./authCache.js";
import { recordQuery } from "./requestContext.js";

let prisma;

// Guard: when running unit tests we use a lightweight Proxy that
// intercepts model access and returns mock CRUD methods (all
// resolving to []/null/{}). This prevents runtime crashes when
// test code calls prisma.user.findMany() etc. Tests can still
// override individual delegates via spyOn/override if needed.
if (process.env.NODE_ENV === "test") {
	const mockResolved =
		(val) =>
		(..._args) =>
			Promise.resolve(val);
	prisma = new Proxy(
		{},
		{
			get: (target, prop) => {
				if (
					prop === "$on" ||
					prop === "$connect" ||
					prop === "$disconnect" ||
					prop === "$use" ||
					prop === "$extends" ||
					prop === "$transaction"
				) {
					return mockResolved(undefined);
				}
				if (typeof prop === "string" && !prop.startsWith("_") && prop[0] !== "$") {
					if (!target[prop]) {
						target[prop] = {
							findMany: mockResolved([]),
							findUnique: mockResolved(null),
							findFirst: mockResolved(null),
							count: mockResolved(0),
							create: mockResolved({}),
							update: mockResolved({}),
							delete: mockResolved({}),
							upsert: mockResolved({}),
							createMany: mockResolved({ count: 0 }),
							deleteMany: mockResolved({ count: 0 }),
							updateMany: mockResolved({ count: 0 }),
							aggregate: mockResolved({}),
							groupBy: mockResolved([]),
						};
					}
					return target[prop];
				}
				return target[prop];
			},
		},
	);
} else {
	const PrismaClient = prismaClientPkg?.PrismaClient ?? prismaClientPkg?.default?.PrismaClient;
	const globalForPrisma = globalThis;
	prisma = globalForPrisma.__gartex_prisma__ || createClient(PrismaClient);
	if (process.env.NODE_ENV !== "production") {
		globalForPrisma.__gartex_prisma__ = prisma;
	}
}

/**
 * The pool size and wait time can be set without editing DATABASE_URL (which
 * holds the credentials): DATABASE_CONNECTION_LIMIT and DATABASE_POOL_TIMEOUT
 * (seconds) override the URL's `connection_limit` / `pool_timeout`.
 */
export function databaseUrlWithPool(rawUrl = process.env.DATABASE_URL, env = process.env) {
	if (!rawUrl) return rawUrl;
	const limit = Number(env.DATABASE_CONNECTION_LIMIT);
	const timeout = Number(env.DATABASE_POOL_TIMEOUT);
	if (!(limit > 0 || timeout > 0)) return rawUrl;
	try {
		const url = new URL(rawUrl);
		if (limit > 0) url.searchParams.set("connection_limit", String(Math.floor(limit)));
		if (timeout > 0) url.searchParams.set("pool_timeout", String(Math.floor(timeout)));
		return url.toString();
	} catch {
		return rawUrl;
	}
}

// DB_QUERY_TRACE=1 prints every query with its duration (local diagnosis).
const TRACE_QUERIES = process.env.DB_QUERY_TRACE === "1";
const TRACE_T0 = performance.now();
const USER_WRITES = new Set(["update", "updateMany", "upsert", "delete", "deleteMany"]);
const APP_STATE_WRITES = new Set([...USER_WRITES, "create", "createMany"]);

function invalidateAppStateWrite(args) {
	const key = typeof args?.where?.key === "string" ? args.where.key : undefined;
	invalidateAppState(key);
	// Once more after a transaction has had time to commit (see appStateCache.js).
	setTimeout(() => invalidateAppState(key), 2000).unref?.();
}

function createClient(PrismaClient) {
	const datasourceUrl = databaseUrlWithPool();
	const base = datasourceUrl ? new PrismaClient({ datasourceUrl }) : new PrismaClient();
	return base.$extends({
		query: {
			async $allOperations({ model, operation, args, query }) {
				const started = performance.now();
				try {
					return await query(args);
				} finally {
					const elapsed = performance.now() - started;
					recordQuery(elapsed);
					if (TRACE_QUERIES) {
						process.stdout.write(
							`[db] ${model || "raw"}.${operation} ${elapsed.toFixed(0)}ms (+${(started - TRACE_T0).toFixed(0)})\n`,
						);
					}
					// Every write to a user or a session clears the auth cache, so a
					// logout, revoke, lock or role change is seen by the next request.
					if (model === "AppState" && APP_STATE_WRITES.has(operation)) {
						invalidateAppStateWrite(args);
					}
					if (USER_WRITES.has(operation)) {
						if (model === "User") {
							const id = args?.where?.id;
							invalidateUser(typeof id === "string" ? id : undefined);
						} else if (model === "UserSession") invalidateSessions();
					}
				}
			},
		},
	});
}

export default prisma;
