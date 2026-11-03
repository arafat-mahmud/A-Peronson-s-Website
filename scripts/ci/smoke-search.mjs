#!/usr/bin/env node
import { Client } from "@opensearch-project/opensearch";

const OPENSEARCH_URL = process.env.OPENSEARCH_URL || "http://localhost:9200";
const auth =
	process.env.OPENSEARCH_USERNAME && process.env.OPENSEARCH_PASSWORD
		? {
				username: process.env.OPENSEARCH_USERNAME,
				password: process.env.OPENSEARCH_PASSWORD,
			}
		: undefined;
const ssl = OPENSEARCH_URL.startsWith("https://") ? { rejectUnauthorized: false } : undefined;
const client = new Client({ node: OPENSEARCH_URL, auth, ssl });
const STRICT_MODE =
	String(process.env.CI || "").toLowerCase() === "true" ||
	String(process.env.OPENSEARCH_REQUIRED || "").toLowerCase() === "true";

async function run() {
	try {
		await client.ping();
		const productsIndex = "gartexhub_products";

		const body = {
			query: {
				bool: {
					filter: [
						{
							bool: {
								should: [
									{ range: { "role_seats.manager": { gte: 2 } } },
									{ range: { team_seats: { gte: 2 } } },
								],
							},
						},
					],
				},
			},
		};

		const res = await client.search({ index: productsIndex, body });
		const hits = res?.body?.hits?.hits || [];
		if (hits.length === 0) {
			process.exit(3);
		}
		const ids = hits.map((h) => h._id);
		if (!ids.includes("prod-1")) {
			process.exit(4);
		}
		process.exit(0);
	} catch (err) {
		const message = err?.message || String(err);
		if (!STRICT_MODE) {
			process.exit(0);
			return;
		}
		process.exit(2);
	}
}

if (process.argv[1]?.endsWith("smoke-search.mjs")) {
	run();
}

export { run };
