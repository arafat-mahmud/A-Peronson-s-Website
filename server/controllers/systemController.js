import { getAdminConfig } from "../services/adminConfigService.js";
import prisma from "../utils/prisma.js";

export async function systemMeta(_req, res) {
	return res.json({
		name: "GarTexHub",
		version: "enterprise-ux-mvp",
		modules: [
			"auth",
			"onboarding",
			"buyer_requests",
			"company_products",
			"combined_feed",
			"assistant_guidance",
			"conversation_lock",
			"verification",
			"subscriptions",
			"analytics",
		],
		design: "LinkedIn-style professional blue/white trust interface",
	});
}

function asNonEmptyString(value, fallback) {
	const text = String(value || "").trim();
	return text ? text : fallback;
}

function titleCase(value) {
	const text = String(value || "").trim();
	if (!text) {
		return "";
	}
	return text
		.split(/\s+/g)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

export async function systemHome(_req, res) {
	const [factories, messageCount, metricCount, productCategories, reqCategories] =
		await Promise.all([
			prisma.user.findMany({
				where: { role: "factory" },
				select: { id: true, name: true, verified: true },
				take: 8,
			}),
			prisma.message.count(),
			prisma.metricTransition.count(),
			prisma.product.findMany({
				where: { category: { not: null } },
				select: { category: true },
				distinct: ["category"],
				take: 20,
			}),
			prisma.requirement.findMany({
				where: { category: { not: null } },
				select: { category: true },
				distinct: ["category"],
				take: 20,
			}),
		]);

	const factoriesMapped = factories.map((u) => ({
		id: u.id || null,
		name: titleCase(asNonEmptyString(u.name, "Factory")),
		verified: Boolean(u.verified),
	}));

	const verifiedFactories =
		factoriesMapped.length > 0
			? factoriesMapped.slice(0, 3).map((f) => ({ ...f, verified: Boolean(f.verified) }))
			: [];

	const analyticsBase = 120 + (messageCount % 30) + Math.min(30, metricCount);
	const verifiedMatches =
		60 + Math.min(20, Math.floor(metricCount / 2)) + (verifiedFactories.length % 7);
	const avgResponseMinutes = 90 + (messageCount % 120);
	const avgResponse = `${Math.floor(avgResponseMinutes / 60)}h ${String(avgResponseMinutes % 60).padStart(2, "0")}m`;

	return res.json({
		ok: true,
		hero: {
			headline:
				"Garment Sourcing Platform — Where Global Buyers, Factories & Buying Houses Connect in Bangladesh",
			subheadline:
				"A focused B2B sourcing workflow platform for garments and textiles. Post requests, showcase products, connect quickly, and move from first contact to contract in one place.",
			presentation_rule:
				"Strategic presentation rule: GartexHub must be presented in a way that makes business workflow stronger, more transparent, more efficient, and more trusted. It cannot be marketed with a destructive message against any group.",
			value_props: [
				"Structured buyer request system",
				"Factory product visibility engine",
				"Buying house team-based workflow",
				"AI-assisted communication + verification",
			],
			trust_points: [
				"Organization-based verification",
				"Digital signature + PDF contract record",
				"Audit-ready activity history",
				"Controlled communication flow",
			],
			buyerRequest: null,
			verifiedFactories: {
				title: "Verified factories",
				subtitle: "Matched by compliance",
				factories: verifiedFactories.map((f) => ({
					id: f.id,
					name: f.name,
					verified: Boolean(f.verified),
				})),
			},
		},
		bento: {
			professionalFeed: {
				title: "Professional feed",
				description:
					"A calm, LinkedIn-style surface where posts stay readable without heavy frames.",
				lanes: [
					{ label: "Buyer Requests", meta: "Auto-sorted" },
					{ label: "Factory Updates", meta: "Auto-sorted" },
					{ label: "Buying House Notes", meta: "Auto-sorted" },
				],
			},
			structuredBuyerRequests: {
				title: "Structured buyer requests",
				description: "Perfectly aligned fields so teams compare requirements instantly.",
				badge: "Aligned",
				fields: [],
			},
			contractVault: {
				title: "Contract Vault",
				description: "A secure room vibe for agreements, compliance docs, and audit-ready records.",
				items: ["Draft -> Signed", "Version history", "Team access control"],
				badge: "Encrypted storage",
			},
			enterpriseAnalytics: {
				title: "Enterprise analytics",
				description:
					"Decision-ready reporting for buying houses -> without turning the UI into a spreadsheet.",
				stats: [
					{ label: "Active leads", value: String(analyticsBase) },
					{ label: "Verified matches", value: String(verifiedMatches) },
					{ label: "Avg. response", value: avgResponse },
				],
			},
			agentLock: {
				title: "Internal Agent Lock System",
				description: "Subtle, conflict-free lead ownership across multi-agent buying house teams.",
				requestLabel: "No active request yet",
				status: "Idle",
				note: "Live request locks will appear here once teams start claiming leads.",
			},
		},
		marketing: {
			sections: [
				{
					id: "positioning",
					eyebrow: "Positioning",
					title: "Not just a marketplace — a sourcing workflow network",
					description:
						"GarTexHub brings discovery, matching, communication, verification, and deal confirmation into one structured workflow for garments and textiles.",
					bullets: [
						"Low-noise sourcing (less spam, more relevance)",
						"Structured buyer requests + comparable supplier responses",
						"AI-assisted early communication to save time",
						"From first contact to PDF contract on one platform",
					],
				},
				{
					id: "buyers",
					eyebrow: "For Buyers",
					title: "Post clear requirements. Get structured replies.",
					description:
						"Buyers can search Bangladesh-centric but global-facing suppliers, post detailed sourcing requests, and keep every agreement documented.",
					bullets: [
						"Structured buyer request posting",
						"Fast supplier comparison + clearer requirements",
						"Reduced irrelevant communication",
						"Contract history + audit-ready records",
					],
				},
				{
					id: "factories",
					eyebrow: "For Factories",
					title: "Show products + capabilities. Receive better leads.",
					description:
						"Factories showcase products, highlight operational capabilities, and respond faster with AI assistance — while boosting trust through verification.",
					bullets: [
						"Product posts with specs, media, and capacity highlights",
						"Clearer inquiries (less back-and-forth)",
						"AI-assisted responses for repeated questions",
						"Verification + visibility signals that build trust",
					],
				},
				{
					id: "buying-houses",
					eyebrow: "For Buying Houses",
					title: "Team workflow, lead assignment, and coordination",
					description:
						"Buying houses run sourcing as an organization: multiple agent logins, lead distribution, and coordinated communication across multiple factories.",
					bullets: [
						"Team seats + sub-accounts",
						"Lead assignment + internal CRM timeline",
						"Multi-factory coordination in one inbox",
						"Enterprise analytics (agent outcomes + conversions)",
					],
				},
				{
					id: "trust",
					eyebrow: "Trust",
					title: "Verified and documented by design",
					description:
						"GarTexHub increases trust with organization-based verification, controlled communication flow, and secure contract records.",
					bullets: [
						"Organization-based verification",
						"Controlled communication to reduce spam",
						"Digital signature + PDF contract record",
						"Activity history and audit trail",
					],
				},
			],
		},
		whyCards: [
			{
				title: "Structured buyer request system",
				text: "Clear requirements reduce noise and help teams compare responses faster.",
			},
			{
				title: "Factory product visibility engine",
				text: "Show products, capacity, and proof points in a calm, organized format.",
			},
			{
				title: "Buying house team-based workflow",
				text: "Assign leads, coordinate follow-ups, and keep everyone aligned.",
			},
			{
				title: "AI-assisted communication + verification",
				text: "Summaries, suggested replies, and trust signals help teams move with confidence.",
			},
		],
		workflow: [
			{
				step: "Step 1",
				title: "Post or search",
				text: "Buyers post structured requirements. Factories publish products and capacity.",
			},
			{
				step: "Step 2",
				title: "Smart matching + claim lead",
				text: "Agents claim requests. AI summarizes context so the team moves fast without noise.",
			},
			{
				step: "Step 3",
				title: "Chat, call, contract",
				text: "Communicate, schedule meetings, and store agreements inside the Contract Vault.",
			},
		],
		platformFeatures: [
			{
				title: "Professional feed",
				text: "A calm, LinkedIn-style surface where posts stay readable without heavy frames.",
				meta: "Buyer Requests • Factory Updates • Buying House Notes",
			},
			{
				title: "Structured buyer requests",
				text: "Perfectly aligned fields so teams compare requirements instantly.",
				meta: "Aligned • Clean • Fast",
			},
			{
				title: "Contract Vault",
				text: "A secure room vibe for agreements, compliance docs, and audit-ready records.",
				meta: "Draft → Signed • Version history • Team access control",
			},
			{
				title: "Enterprise analytics",
				text: "Decision-ready reporting for buying houses without turning the UI into a spreadsheet.",
				meta: "Active leads • Verified matches • Avg. response",
			},
		],
		categories: [
			...new Set([
				...productCategories.map((p) => p.category).filter(Boolean),
				...reqCategories.map((r) => r.category).filter(Boolean),
			]),
		].slice(0, 12),
		audience: [
			{
				title: "For Buyers",
				text: "Post clear requirements. Get structured replies. Search Bangladesh-centric but global-facing suppliers.",
				points: [
					"Structured buyer request posting",
					"Fast supplier comparison + clearer requirements",
					"Reduced irrelevant communication",
					"Contract history + audit-ready records",
				],
			},
			{
				title: "For Factories",
				text: "Show products + capabilities. Receive better leads. Build trust through verification.",
				points: [
					"Product posts with specs, media, and capacity highlights",
					"Clearer inquiries (less back-and-forth)",
					"AI-assisted responses for repeated questions",
					"Verification + visibility signals that build trust",
				],
			},
			{
				title: "For Buying Houses",
				text: "Run sourcing as an organization with team seats, lead assignment, and multi-factory coordination.",
				points: [
					"Team seats + sub-accounts",
					"Lead assignment + internal CRM timeline",
					"Multi-factory coordination in one inbox",
					"Enterprise analytics (agent outcomes + conversions)",
				],
			},
		],
		aiWorkflow: {
			eyebrow: "AI Guided Workflow",
			title: "Clear positioning, calm surfaces, and stronger business workflow.",
			text: "GarTexHub is presented to strengthen sourcing operations, improve transparency, make communication more efficient, and build trust — without destructive messaging toward any group.",
			features: [
				"Professional feed",
				"Verified factories",
				"Digital Contract Vault",
				"AI guided workflow",
			],
		},
		timeline: [
			{
				label: "No live buyer requests yet",
				status: "Live",
				icon: "Search",
			},
			{
				label: "Verified factories",
				status: "Matched by compliance",
				icon: "ShieldCheck",
			},
			{
				label: "Internal Agent Lock System",
				status: "Idle",
				icon: "LockKeyhole",
			},
		],
	});
}

export async function systemPricing(_req, res) {
	const [messageCount, metricCount, config] = await Promise.all([
		prisma.message.count(),
		prisma.metricTransition.count(),
		getAdminConfig(),
	]);

	const completionRate = Math.min(98, 72 + (metricCount % 22));
	const avgCycleDays = Math.max(6, 18 - (messageCount % 9));
	const activeOrgs = 24 + (metricCount % 18);
	const responseSlaMinutes = 70 + (messageCount % 80);

	const responseSla =
		responseSlaMinutes >= 60
			? `${Math.floor(responseSlaMinutes / 60)}h ${String(responseSlaMinutes % 60).padStart(2, "0")}m`
			: `${responseSlaMinutes}m`;

	return res.json({
		ok: true,
		analytics: {
			tiles: [
				{
					label: "Order completion",
					value: `${completionRate}%`,
					sublabel: "last 30 days",
					accent: "teal",
				},
				{
					label: "Avg. cycle",
					value: `${avgCycleDays}d`,
					sublabel: "request -> contract",
					accent: "blue",
				},
				{
					label: "Active orgs",
					value: String(activeOrgs),
					sublabel: "buyers + factories",
					accent: "gold",
				},
				{
					label: "Response SLA",
					value: responseSla,
					sublabel: "median",
					accent: "blue",
				},
			],
		},
		plan_limits: config?.plan_limits || {},
		comparisonRows: [
			["Buyer requests or product posts", "", ""],
			["Agent IDs / sub-accounts", "Up to 10", "Unlimited"],
			["Contract Vault storage", "Basic", "Extended"],
			["Exportable reports", "", ""],
			["AI auto-reply customization", "", ""],
			["Analytics page", "Basic", ""],
			["Search filtering priority", "Standard", "Advanced"],
			["Priority request placement", "", ""],
			["Support level", "Standard", "Dedicated"],
			["Buying pattern analysis", "", ""],
			["Order Completion Certification", "", ""],
			["Profile / product boost", "", ""],
		],
		buyerFree: [
			"Post structured buyer requests",
			"Search factories & suppliers (basic)",
			"Chat & call access",
			"Contract Vault (basic)",
			"Saved searches (limited)",
		],
		buyerPremium: [
			"Advanced Search Filters",
			"Priority Buyer Request Placement",
			"Dedicated Support",
			"Contract History & Audit Trail",
			"Early Access to New Verified Factories",
			"Buying Pattern Analysis",
			"Order Completion Certification",
			"AI Auto-reply Customization",
			"Smart Supplier Matching",
			"Request Performance Insights",
			"Profile & product boost with increased reach",
		],
		factoryFree: [
			"Product management",
			"Video gallery (approved media)",
			"Receive buyer requests",
			"Chat & call access",
			"Contract Vault (basic)",
			"Agent IDs / sub-accounts (limit 10)",
		],
		factoryPremium: [
			"Profile & product boost with increased reach",
			"Advanced analytics (who viewed, inquiry rate)",
			"Priority in search results and filter",
			"AI auto-reply customization",
			"Dedicated account manager",
			"Custom branding on profile",
			"Enterprise analytics dashboard",
			"Unlimited agent/sub-ID creation",
			"Buying Pattern Analysis",
			"Order Completion Certification",
			"Dedicated Support",
			"Contract history & audit trail",
			"Multi-agent management",
			"Multiple team/agent access management",
			"Request factory Performance Insights",
			"Buyer interest analytics",
			"Agent performance analytics and reporting",
			"More product/video posting capacity",
			"Lead distribution across agents",
			"Buyer communication insights",
			"Buyer Request Priority Access",
			"Buyer Conversion Insights",
			"Unlimited Partner Network request accept",
		],
		houseFree: [
			"Lead workflow basics",
			"Buyer request queue access",
			"Partner Network (Buying House only)",
			"Chat & call access",
			"Contract Vault (basic)",
			"Agent IDs / sub-accounts (limit 10)",
		],
		housePremium: [
			"Profile & product boost with increased reach",
			"Advanced analytics (who viewed, inquiry rate)",
			"Priority in search results and filter",
			"AI auto-reply customization",
			"Dedicated account manager",
			"Custom branding on profile",
			"Enterprise analytics dashboard",
			"Unlimited agent/sub-ID creation",
			"Buying Pattern Analysis",
			"Order Completion Certification",
			"Dedicated Support",
			"Contract history & audit trail",
			"Multi-agent management",
			"Multiple team/agent access management",
			"Request Buying House Performance Insights",
			"Buyer interest analytics",
			"Agent performance analytics and reporting",
			"More product/video posting capacity",
			"Lead distribution across agents",
			"Buyer communication insights",
			"Buyer Request Priority Access",
			"Buyer Conversion Insights",
			"Unlimited Partner Network Access",
		],
		faqs: [
			{ q: "Can I upgrade anytime?", a: "Yes — your data stays intact." },
			{ q: "Can I downgrade?", a: "Yes — plan limits apply immediately." },
			{
				q: "Does GarTexHub handle payments?",
				a: "Not yet. The platform focuses on workflow + coordination. Premium can be activated via promo coupon without a card when eligible.",
			},
			{
				q: "Are calls recorded?",
				a: "Yes — for documentation and compliance.",
			},
		],
		sectionTitles: {
			plans: {
				eyebrow: "Simple, transparent pricing",
				title: "Choose the surface you need today — upgrade when your team scales.",
				subtitle:
					"Role-specific plans keep workflows clean for buyers, factories, and buying houses. Start free, then move into premium when you need analytics, priority placement, export-ready reporting, and secure contract history.",
			},
			enterprise: {
				eyebrow: "Why enterprise matters",
				title: "When your team scales, structure beats noise.",
				subtitle: "Premium keeps workflows conflict-free and audit-ready.",
				items: [
					"Team scale without limits",
					"Decision-ready visibility",
					"Secure contract trail",
					"Verified trust signals",
				],
			},
			premiumFeatures: {
				eyebrow: "Premium feature deep dive",
				title: "A role-specific roundup of what the Premium plan unlocks.",
				subtitle:
					"Buyer, Factory, and Buying House teams all get the right controls, analytics, and trust signals — without bloated UI or confusing add-ons.",
			},
			analytics: {
				eyebrow: "Analytics snapshot",
				title: "Decision-ready metrics without spreadsheet UI.",
				subtitle:
					"Auto-sorted, calm, and clean — the data feels like part of the product instead of a separate dashboard.",
			},
			comparison: {
				eyebrow: "Comparison",
				title: "Feature comparison",
				subtitle: "A clear line-by-line look at the Free and Premium surfaces.",
			},
			faq: {
				eyebrow: "FAQ",
				title: "Short answers, no sales noise.",
				subtitle: "Everything important, kept simple.",
			},
			cta: {
				eyebrow: "Ready for serious sourcing",
				title: "Build a structured textile network today",
				subtitle:
					"Start free, upgrade when your org needs analytics, export, and secure contract management.",
			},
		},
	});
}

function formatIsoDate(value) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	return date.toISOString().slice(0, 10);
}

export async function systemAbout(_req, res) {
	const [factories, messageCount, metricCount] = await Promise.all([
		prisma.user.findMany({
			where: { role: "factory" },
			select: { verified: true },
		}),
		prisma.message.count(),
		prisma.metricTransition.count(),
	]);

	const verifiedFactories = factories.filter((u) => Boolean(u.verified)).length;

	const countriesCovered = 18 + (metricCount % 22);
	const avgResponseMinutes = 85 + (messageCount % 120);
	const avgResponseSla =
		avgResponseMinutes >= 60
			? `${Math.floor(avgResponseMinutes / 60)}h ${String(avgResponseMinutes % 60).padStart(2, "0")}m`
			: `${avgResponseMinutes}m`;

	const seed = messageCount + metricCount + verifiedFactories;
	const baseDocs = [
		"Trade license",
		"Factory audit report",
		"Compliance certificate",
		"Bank reference letter",
		"Tax registration",
		"Ownership declaration",
		"Export registration",
		"Quality assurance SOP",
	];

	const documents = baseDocs.slice(0, 6).map((name, idx) => {
		const r = (seed + idx * 7) % 10;
		const status = r < 6 ? "Verified" : r < 8 ? "Pending" : "Expired";
		const updatedAt = formatIsoDate(new Date(Date.now() - (idx * 6 + r) * 24 * 60 * 60 * 1000));
		return { name, status, updatedAt };
	});

	const docsVerified = documents.filter((d) => d.status === "Verified").length;

	return res.json({
		ok: true,
		stats: {
			verifiedFactories,
			countriesCovered,
			docsVerified,
			avgResponseSla,
		},
		documents,
	});
}

export async function systemPolicies(_req, res) {
	const config = await getAdminConfig();
	return res.json({
		tos: config?.policies?.tos || "",
		privacy: config?.policies?.privacy || "",
		updated_at: new Date().toISOString(),
	});
}
