import { readLocalJson, writeLocalJson } from "../utils/localStore.js";

const DEFAULT_CONFIG = {
	feature_flags: {
		ai_summaries: true,
		auto_credit: true,
		bulk_approvals: false,
		system_broadcasts: true,
	},
	plan_limits: {
		free: {
			partner_limit: 5,
			search_daily: 20,
			request_limit: 3,
			product_limit: 20,
			video_limit: 2,
			agent_limit: 3,
		},
		premium: {
			partner_limit: 50,
			search_daily: 200,
			request_limit: 50,
			product_limit: 500,
			video_limit: 200,
			agent_limit: 999,
		},
	},
	pricing: {
		free_usd: 0,
		premium_usd: 29,
	},
	policies: {
		tos: "Standard platform terms apply.",
		privacy: "Standard privacy policy applies.",
	},
	retention: {
		audit_days: 365,
		logs_days: 90,
	},
	integrations: {
		payment_gateways: [],
		webhooks: [],
		api_keys: [],
		crm_exports: [],
		opensearch: {
			enabled: false,
			url: "",
			username: "",
			password: "",
			index_prefix: "gartexhub_",
			timeout_ms: 3000,
			verify_tls: true,
		},
	},
	notifications: {
		templates: [],
		monthly_summary_enabled: true,
		email: {
			enabled: false,
			provider: "smtp",
			from_name: "GarTexHub",
			from_email: "",
			test_recipient: "",
		},
	},
	analytics: {
		search_min_events: 25,
		governance: {
			enabled: true,
			min_cohort_size: 10,
			geo_granularity: "country",
			retention_days: 365,
			allow_raw_exports: false,
			export_allowed_roles: ["admin", "owner"],
			view_allowed_roles: ["admin", "owner"],
		},
	},
	support: {
		sla_targets: {
			response_minutes: 60,
			resolution_hours: 72,
		},
	},
	search_limits: {
		advanced_filter_gate: true,
		abusive_search_threshold: 120,
	},
	partner_controls: {
		blacklist: [],
		whitelist: [],
	},
	moderation: {
		clothing_rules: {
			forbidden_terms: [],
			flag_terms: [],
			allowed_terms: [],
			context_exceptions: [],
			reason_templates: {
				rejected:
					"This listing appears to include indecent or revealing clothing. Please adjust images or description to match our content standards for modest apparel.",
				pending_review:
					"This listing needs a manual review to confirm it follows our content standards.",
				fix_guidance:
					"Update images, title, or description to describe modest apparel. Innerwear or under-layer items must be clearly labeled.",
			},
		},
	},
	org_quotas: {},
	feed_page: {
		enabled: true,
		tabs: ["All", "Buyer Requests", "Company Products", "Posts", "Unique OFF"],
		labels: {
			feed_center: "Feed Center",
			premium_badge: "Premium moderation dashboard",
			quick_actions: "Quick actions",
			live_status: "Live",
			search: "Search",
			search_placeholder: "Search posts, buyers...",
			categories: "All categories",
			premium_experience: "Premium feed experience",
			hero_title: "Modern buyer and company feed, tuned for clarity and speed.",
			hero_description:
				"Browse buyer requests, company products, and posts from one polished admin-friendly workspace with a clean blue-sky visual system.",
			stats: {
				buyer_requests: "Buyer Requests",
				company_products: "Company Products",
				feed_posts: "Feed Posts",
			},
		},
		messages: {
			share_copied: "Share link copied to clipboard.",
			report_submitted: "Report submitted. Thank you.",
			interest_expressed: "Interest expressed.",
			rate_limited: "Please wait a few seconds before reporting again.",
			all_caught_up: "You're all caught up.",
			no_results: "No posts matched your filters.",
			load_failed: "Failed to load feed",
		},
	},
	ui: {
		admin_panel: {
			allowed_roles: ["owner", "admin"],
			fallback_inventory: [
				{
					id: "platform",
					label: "Core Platform & Business Control",
					icon_name: "ShieldCheck",
				},
				{
					id: "infra",
					label: "Server / System / Infrastructure Management",
					icon_name: "Server",
				},
				{
					id: "network",
					label: "Network Monitoring & Management",
					icon_name: "Network",
				},
				{
					id: "server-admin",
					label: "Server Admin + App Management",
					icon_name: "Database",
				},
				{ id: "cms", label: "CMS + Content Management", icon_name: "Settings" },
				{
					id: "ultra-security",
					label: "Ultra Security Layer",
					icon_name: "Lock",
				},
			],
			theme: {
				pie_palette: ["#38bdf8", "#60a5fa", "#0f172a"],
			},
			fallbacks: {
				cms: {
					weekly_trend: [
						{ name: "Mon", value: 24 },
						{ name: "Tue", value: 38 },
						{ name: "Wed", value: 29 },
						{ name: "Thu", value: 57 },
						{ name: "Fri", value: 44 },
						{ name: "Sat", value: 66 },
						{ name: "Sun", value: 52 },
					],
				},
				ultra_security: {
					mini_chart_points: [22, 28, 24, 34, 30, 46, 40, 54, 50, 66, 58, 72],
					mini_chart_kpis: [
						{ label: "Requests", value: "12.8k" },
						{ label: "Integrity", value: "99.98%" },
						{ label: "Latency", value: "148ms" },
					],
					capabilities: [
						"Zero-trust access controls",
						"Mandatory MFA for admin",
						"Session timeout + device fingerprinting",
						"IP whitelisting + geo-fencing",
						"Tamper-proof audit logs",
						"Encryption key rotation",
						"Incident response dashboard",
						"Data-export approvals with dual confirmation",
						"Forensic logs + immutable backups",
					],
				},
				contract_status: {
					no_data_label: "No Data",
				},
			},
			copy: {
				empty_states: {
					"verification.pending.short": "No pending verifications.",
					"verification.pending": "No pending verifications in queue.",
					"disputes.none": "No active disputes.",
					"firewall.rules.none": "No rules yet.",
					"cron.jobs.none": "No cron jobs yet.",
				},
			},
		},
	},
};

export async function getAdminConfig() {
	const parsed = await readLocalJson("admin_config.json", DEFAULT_CONFIG);
	return mergeDeep(DEFAULT_CONFIG, parsed || {});
}

export async function readConfig() {
	return getAdminConfig();
}

export async function writeConfig(config) {
	await writeLocalJson("admin_config.json", config);
}

export async function updateAdminConfig(patch = {}) {
	const current = await getAdminConfig();
	const next = mergeDeep(current, patch);
	await writeLocalJson("admin_config.json", next);
	return next;
}

function mergeDeep(target, source) {
	if (!source || typeof source !== "object") {
		return target;
	}
	const output = { ...target };
	Object.entries(source).forEach(([key, value]) => {
		if (value && typeof value === "object" && !Array.isArray(value)) {
			output[key] = mergeDeep(output[key] || {}, value);
		} else {
			output[key] = value;
		}
	});
	return output;
}
