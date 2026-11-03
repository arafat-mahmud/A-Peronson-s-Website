#!/usr/bin/env node
import "dotenv/config";
import { Client } from "@opensearch-project/opensearch";

const OPENSEARCH_URL = process.env.OPENSEARCH_URL || "http://localhost:9200";
const RESET = process.argv.includes("--reset");
const STRICT_MODE =
	String(process.env.CI || "").toLowerCase() === "true" ||
	String(process.env.OPENSEARCH_REQUIRED || "").toLowerCase() === "true";

const auth =
	process.env.OPENSEARCH_USERNAME && process.env.OPENSEARCH_PASSWORD
		? {
				username: process.env.OPENSEARCH_USERNAME,
				password: process.env.OPENSEARCH_PASSWORD,
			}
		: undefined;
const ssl = OPENSEARCH_URL.startsWith("https://") ? { rejectUnauthorized: false } : undefined;
const client = new Client({ node: OPENSEARCH_URL, auth, ssl });

function productMappings() {
	return {
		properties: {
			id: { type: "keyword" },
			title: { type: "text" },
			category: { type: "keyword" },
			industry: { type: "keyword" },
			material: {
				type: "text",
				fields: { keyword: { type: "keyword", ignore_above: 256 } },
			},
			size_range: { type: "keyword" },
			color_pantone_codes: { type: "keyword" },
			customization: { type: "keyword" },
			sample_available: { type: "boolean" },
			sample_lead_time_days: { type: "double" },
			moq_value: { type: "double" },
			price_base_min: { type: "double" },
			price_base_max: { type: "double" },
			base_currency: { type: "keyword" },
			lead_time_days: { type: "double" },
			fabric_gsm: { type: "double" },
			created_at: { type: "date" },
			verified: { type: "boolean" },
			org_type: { type: "keyword" },
			country: { type: "keyword" },
			certifications: { type: "keyword" },
			incoterms: { type: "keyword" },
			payment_terms: { type: "keyword" },
			document_ready: { type: "keyword" },
			language_support: { type: "keyword" },
			processes: { type: "keyword" },
			export_ports: { type: "keyword" },
			monthly_capacity: { type: "double" },
			years_in_business: { type: "double" },
			team_seats: { type: "double" },
			handles_multiple_factories: { type: "boolean" },
			avg_response_hours: { type: "double" },
			audit_date: { type: "keyword" },
			role_seats: { type: "object" },
			location: { type: "geo_point" },
		},
	};
}

function requirementMappings() {
	return {
		properties: {
			id: { type: "keyword" },
			title: { type: "text" },
			category: { type: "keyword" },
			industry: { type: "keyword" },
			material: {
				type: "text",
				fields: { keyword: { type: "keyword", ignore_above: 256 } },
			},
			size_range: { type: "keyword" },
			color_pantone_codes: { type: "keyword" },
			customization: { type: "keyword" },
			sample_available: { type: "boolean" },
			sample_lead_time_days: { type: "double" },
			capacity_min: { type: "double" },
			moq_value: { type: "double" },
			price_base_min: { type: "double" },
			price_base_max: { type: "double" },
			base_currency: { type: "keyword" },
			lead_time_days: { type: "double" },
			fabric_gsm: { type: "double" },
			created_at: { type: "date" },
			certifications: { type: "keyword" },
			incoterms: { type: "keyword" },
			payment_terms: { type: "keyword" },
			document_ready: { type: "keyword" },
			audit_date: { type: "keyword" },
			language_support: { type: "keyword" },
			verified: { type: "boolean" },
			org_type: { type: "keyword" },
			country: { type: "keyword" },
			processes: { type: "keyword" },
			export_ports: { type: "keyword" },
			years_in_business: { type: "double" },
			team_seats: { type: "double" },
			handles_multiple_factories: { type: "boolean" },
			avg_response_hours: { type: "double" },
			role_seats: { type: "object" },
			location: { type: "geo_point" },
		},
	};
}

async function ensureIndex(indexName, mappings) {
	const exists = await client.indices.exists({ index: indexName });
	if (exists?.body === true) {
		if (RESET) {
			await client.indices.delete({ index: indexName });
		} else {
			return;
		}
	}
	await client.indices.create({
		index: indexName,
		body: {
			settings: { number_of_shards: 1, number_of_replicas: 0 },
			mappings,
		},
	});
}

async function run() {
	try {
		await client.ping();

		const productsIndex = "gartexhub_products";
		const requirementsIndex = "gartexhub_requirements";

		await ensureIndex(productsIndex, productMappings());
		await ensureIndex(requirementsIndex, requirementMappings());

		// sample documents to validate filters (role_seats + team_seats)
		const products = [
			{
				id: "prod-1",
				title: "5000 Cotton T-Shirts",
				category: "tshirts",
				industry: "garments",
				material: "cotton",
				team_seats: 10,
				role_seats: { manager: 2, admin: 1 },
				price_base_min: 2.5,
				price_base_max: 3.0,
				base_currency: "USD",
				verified: true,
				org_type: "factory",
				created_at: new Date().toISOString(),
			},
			{
				id: "prod-2",
				title: "Handmade Dresses",
				category: "dresses",
				industry: "garments",
				material: "silk",
				team_seats: 1,
				role_seats: { manager: 0 },
				price_base_min: 12.0,
				price_base_max: 20.0,
				base_currency: "USD",
				verified: false,
				org_type: "factory",
				created_at: new Date().toISOString(),
			},
		];

		const requirements = [
			{
				id: "req-1",
				title: "Looking for 5000 cotton t-shirts",
				category: "tshirts",
				industry: "garments",
				capacity_min: 5000,
				price_base_min: 2.0,
				price_base_max: 3.5,
				base_currency: "USD",
				created_at: new Date().toISOString(),
			},
		];

		// bulk index products
		const ops = [];
		for (const p of products) {
			ops.push({ index: { _index: productsIndex, _id: p.id } });
			ops.push(p);
		}
		if (ops.length > 0) {
			await client.bulk({ refresh: true, body: ops });
		}

		const opsReq = [];
		for (const r of requirements) {
			opsReq.push({ index: { _index: requirementsIndex, _id: r.id } });
			opsReq.push(r);
		}
		if (opsReq.length > 0) {
			await client.bulk({ refresh: true, body: opsReq });
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

if (process.argv[1]?.endsWith("reindex-opensearch.mjs")) {
	run();
}

export { run };
