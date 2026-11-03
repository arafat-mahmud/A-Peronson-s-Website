import { readAuditLog } from "../utils/auditStore.js";
import { readLocalJson } from "../utils/localStore.js";
import prisma from "../utils/prisma.js";
import { getAdminConfig } from "./adminConfigService.js";
import { getDashboardAnalytics } from "./analyticsService.js";
import { getAdminAuthConfig } from "./securityService.js";

const ADMIN_INVENTORY = [
	{
		id: "platform",
		label: "Core Platform & Business Control",
		sections: [
			{
				id: "users",
				title: "User & Account Oversight",
				features: [
					"Buyer / Factory / Buying House list",
					"Search + filter by role, status, region, verification, premium",
					"Role change, premium override, verify/unverify",
					"Suspend/reactivate, force logout, lock messaging",
					"Reset password, strike counts, fraud flags",
					"Signup list + email list export",
				],
			},
			{
				id: "orgs",
				title: "Org & Ownership",
				features: [
					"Org ownership transfer",
					"Merge accounts / split orgs",
					"Org staff list + staff limits",
					"Buying house staff IDs",
					"Agent create/deactivate",
					"Permission matrix + org quotas",
				],
			},
			{
				id: "verification",
				title: "Verification & Compliance",
				features: [
					"EU/USA doc review (Business registration, VAT/EIN, EORI, Bank proof)",
					"Approve / reject with reasons",
					"Badge lifecycle + audit trail",
					"Duplicate/fraud detection",
					"Expiring verification reminders",
					"Subscription-verification sync enforcement",
				],
			},
			{
				id: "finance",
				title: "Financial Management",
				features: [
					"Subscription overview + renewal tracking",
					"Failed renewals list",
					"Upgrade/downgrade history",
					"Invoice log (future)",
					"Revenue summary + earnings per plan",
					"Payout ledger (future)",
				],
			},
			{
				id: "wallet",
				title: "Wallet & Credits",
				features: [
					"Wallet balances (cash + restricted)",
					"Coupon redemptions ledger",
					"Transaction history",
					"Auto-credit toggle",
					"Manual credit/debit (future)",
					"Refund log (future)",
				],
			},
			{
				id: "coupons",
				title: "Coupons & Campaigns",
				features: [
					"Create/disable/expire codes",
					"Marketing attribution + redemption caps",
					"Early adopter campaigns",
					"Per-role coupons",
					"Campaign performance report",
				],
			},
			{
				id: "partners",
				title: "Partner Network",
				features: [
					"View all requests",
					"Force accept/reject/cancel",
					"Connected factory list",
					"Free-tier enforcement (5 limit)",
					"Manual overrides",
					"Blacklist/whitelist",
				],
			},
			{
				id: "requests",
				title: "Requests & Matching",
				features: [
					"Buyer request moderation",
					"Verified-only flags",
					"Request lifecycle control",
					"Match quality audit",
					"Spam filters + expiry overrides",
				],
			},
			{
				id: "contracts",
				title: "Contracts & Proofs",
				features: [
					"Contract vault",
					"Signature status",
					"Lock/unlock contracts",
					"Bank transfer / LC proof review",
					"Dispute review",
					"Full audit trail + export",
				],
			},
			{
				id: "calls",
				title: "Calls & Recordings",
				features: [
					"Call logs + recording status",
					"Failure reasons",
					"Escalation notes",
					"Proof-of-call enforcement",
				],
			},
			{
				id: "messages",
				title: "Messages & Moderation",
				features: [
					"Takedown tools",
					"Violation log",
					"Strike escalation",
					"Chat transfer audit",
					"Spam/irrelevant flags",
					"Content redaction",
				],
			},
			{
				id: "media",
				title: "Content & Media Review",
				features: [
					"Product video review",
					"Document/media review",
					"Content flags + re-review",
					"Bulk approval",
				],
			},
			{
				id: "support",
				title: "Reports & Support",
				features: [
					"Support tickets + user reports",
					"Resolution tracking",
					"Internal notes",
					"SLA targets (future)",
					"Priority escalation",
				],
			},
			{
				id: "notifications",
				title: "Notifications & Broadcasts",
				features: [
					"System announcements",
					"Targeted alerts",
					"Monthly summary triggers",
					"Batch sends",
					"Template library",
				],
			},
			{
				id: "analytics",
				title: "Analytics & KPIs",
				features: [
					"Platform metrics",
					"Buying house analytics",
					"Funnel stats (signup -> request -> match -> deal)",
					"Agent performance report",
					"Conversion trends + response speed",
				],
			},
			{
				id: "search",
				title: "Search & Filters",
				features: [
					"Advanced filter gating",
					"Daily quota limits",
					"Search alert audit",
					"Abusive search detection",
				],
			},
			{
				id: "ai",
				title: "AI & Knowledge Base",
				features: [
					"Assistant knowledge entries",
					"Chatbot toggles",
					"AI summary/negotiation logs",
					"AI response audit",
				],
			},
			{
				id: "system",
				title: "System Settings",
				features: [
					"Feature flags",
					"Plan limits",
					"Pricing tables",
					"Policy text editor",
					"TOS/privacy publishing",
				],
			},
			{
				id: "security",
				title: "Security & Audit",
				features: [
					"Admin action logs",
					"Access history + IP/device logs",
					"Data export",
					"Retention controls",
				],
			},
			{
				id: "integrations",
				title: "Integrations",
				features: ["Payment gateways", "Webhooks", "API keys", "CRM export"],
			},
			{
				id: "traffic",
				title: "Domain + Traffic",
				features: ["Domain clicks", "Site visits", "Traffic source analytics"],
			},
			{
				id: "emails",
				title: "Email List",
				features: ["Full email export CSV", "Segmented email lists (future)"],
			},
		],
	},
	{
		id: "infra",
		label: "Server / System / Infrastructure Management",
		sections: [
			{
				id: "health",
				title: "System Health & Performance Monitoring (Real-Time)",
				features: [
					"CPU load, RAM usage, disk I/O, bandwidth",
					"Storage visualization (partitions, mount points)",
					"Running process list + kill/restart",
					"Service/daemon control (Nginx, MySQL, SSH, etc.)",
					"Zombie process detection",
				],
			},
			{
				id: "maintenance",
				title: "OS & Software Maintenance",
				features: [
					"OS update/patch manager",
					"Package install/upgrade/remove (apt/yum)",
					"Centralized system logs (syslog/auth/error)",
					"Cron job scheduler + monitoring",
				],
			},
			{
				id: "sys-security",
				title: "User & Security Administration (System-Level)",
				features: [
					"OS user accounts (create/delete/reset)",
					"Firewall rules (iptables/ufw/firewalld)",
					"Security audit log (who changed what)",
					"SSH key management + sudo privileges",
					"SSL certificate management (Let's Encrypt)",
				],
			},
			{
				id: "backup",
				title: "Backup & Disaster Recovery",
				features: [
					"Automated backups (daily/weekly)",
					"Backup retention rules",
					"One-click restore",
				],
			},
			{
				id: "networking",
				title: "Networking & System Settings",
				features: ["Interface/IP/VLAN/DNS management", "System time/timezone (NTP)"],
			},
		],
	},
	{
		id: "network",
		label: "Network Monitoring & Management (Enterprise Level)",
		sections: [
			{
				id: "visibility",
				title: "Real-Time Monitoring & Visibility",
				features: [
					"Network dashboard + alerts",
					"Topology map (routers/switches/APs)",
					"Device up/down status",
					"Bandwidth, latency, jitter, packet loss",
				],
			},
			{
				id: "config",
				title: "Configuration & Management",
				features: [
					"Config backup/restore",
					"Bulk config deploy",
					"Firmware/patch management",
					"VLAN management",
					"IPAM + DHCP control",
				],
			},
			{
				id: "net-security",
				title: "Security Management",
				features: [
					"Firewall policy manager",
					"IDS/IPS monitoring",
					"RADIUS/TACACS+ access control",
					"Rogue AP detection",
					"VPN configuration",
				],
			},
			{
				id: "traffic",
				title: "Traffic & Bandwidth Analysis",
				features: ["NetFlow/sFlow analyzer", "QoS policies", "Traffic shaping"],
			},
			{
				id: "alerting",
				title: "Troubleshooting & Alerting",
				features: [
					"Alert center (email/SMS/Slack)",
					"Audit log of config changes",
					"Diagnostic tools (Ping/Traceroute/SNMP)",
				],
			},
			{
				id: "assets",
				title: "Asset & User Management",
				features: [
					"Inventory of devices + versions + locations",
					"Auto device discovery",
					"Client monitoring (IP/MAC/connected users)",
				],
			},
		],
	},
	{
		id: "server-admin",
		label: "Server Admin + App Management (Full Stack)",
		sections: [
			{
				id: "srv-monitor",
				title: "Real-Time Monitoring & Analytics",
				features: [
					"Resource dashboards",
					"Service monitoring (Apache/Nginx/MySQL/PHP)",
					"Log + alert center",
					"Process tracking",
				],
			},
			{
				id: "srv-security",
				title: "Security Management",
				features: [
					"Firewall GUI",
					"SSL/TLS manager",
					"IDS (Fail2ban/malware scan)",
					"RBAC + MFA + SSH key control",
				],
			},
			{
				id: "srv-config",
				title: "Server Config & Optimization",
				features: [
					"Web server config editor",
					"PHP version manager",
					"Database admin (phpMyAdmin)",
					"Cron job UI",
				],
			},
			{
				id: "srv-backup",
				title: "Backup & Data Protection",
				features: ["Automated backups", "Cloud storage (S3/GCS/Spaces)", "One-click restore"],
			},
			{
				id: "srv-apps",
				title: "Website/App Management",
				features: ["Domain & DNS management", "One-click app installers", "File manager + editor"],
			},
			{
				id: "srv-users",
				title: "User Account Management (System Admin)",
				features: ["RBAC roles (Admin/Manager/Viewer)", "Audit logs"],
			},
			{
				id: "srv-auto",
				title: "Automation",
				features: ["Auto updates + patches", "Task queues"],
			},
		],
	},
	{
		id: "cms",
		label: "CMS + Content Management",
		sections: [
			{
				id: "cms-headless",
				title: "Headless CMS Integration",
				features: ["Article/page editor", "Media uploads + gallery", "Version control + rollback"],
			},
			{
				id: "cms-frontend",
				title: "Frontend Configuration",
				features: [
					"Theme switcher",
					"SEO/meta tags",
					"Cache clearing",
					"Environment variable manager",
				],
			},
			{
				id: "cms-deploy",
				title: "Deployment & Automation",
				features: ["One-click deployments", "Backup/restore automation", "Cron scripts"],
			},
		],
	},
	{
		id: "ultra-security",
		label: "Ultra Security Layer (Advanced)",
		sections: [
			{
				id: "zero-trust",
				title: "Zero-Trust & Incident Response",
				features: [
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
		],
	},
];

function countBy(items = [], key = "role") {
	return items.reduce((acc, item) => {
		const value = String(item?.[key] || "unknown");
		acc[value] = (acc[value] || 0) + 1;
		return acc;
	}, {});
}

function isPendingVerification(row) {
	const status = String(row?.review_status || row?.verification_status || "").toLowerCase();
	return status.includes("pending");
}

export async function getAdminMasterSummary(user) {
	const [
		users,
		verifications,
		subscriptions,
		walletHistory,
		couponCodes,
		couponRedemptions,
		partnerRequests,
		requirements,
		matches,
		documents,
		paymentProofs,
		callSessions,
		messages,
		violations,
		notifications,
		searchAlerts,
		searchUsage,
		assistantKnowledge,
		products,
		analytics,
		subscriptionHistory,
		refundLog,
		supportTickets,
	] = await Promise.all([
		prisma.user.findMany(),
		prisma.verification.findMany(),
		prisma.subscription.findMany(),
		prisma.walletHistory.findMany(),
		prisma.couponCode.findMany(),
		prisma.couponRedemption.findMany(),
		prisma.partnerRequest.findMany(),
		prisma.requirement.findMany(),
		prisma.match.findMany(),
		prisma.document.findMany(),
		prisma.paymentProof.findMany(),
		prisma.callSession.findMany(),
		prisma.message.findMany(),
		prisma.policyViolation.findMany(),
		prisma.notification.findMany(),
		prisma.searchAlert.findMany(),
		prisma.searchUsageCounter.findMany(),
		prisma.assistantKnowledge.findMany(),
		prisma.product.findMany(),
		prisma.analyticsEvent.findMany(),
		readLocalJson("subscription_history.json", []),
		readLocalJson("refund_log.json", []),
		prisma.supportTicket.findMany(),
	]);

	const userRows = Array.isArray(users) ? users : [];
	const verificationRows = Array.isArray(verifications) ? verifications : [];
	const subscriptionRows = Array.isArray(subscriptions) ? subscriptions : [];
	const walletRows = Array.isArray(walletHistory) ? walletHistory : [];
	const couponRows = Array.isArray(couponCodes) ? couponCodes : [];
	const couponRedemptionsRows = Array.isArray(couponRedemptions) ? couponRedemptions : [];
	const partnerRows = Array.isArray(partnerRequests) ? partnerRequests : [];
	const requirementRows = Array.isArray(requirements) ? requirements : [];
	const matchRows = Array.isArray(matches) ? matches : [];
	const documentRows = Array.isArray(documents) ? documents : [];
	const paymentProofRows = Array.isArray(paymentProofs) ? paymentProofs : [];
	const callRows = Array.isArray(callSessions) ? callSessions : [];
	const messageRows = Array.isArray(messages) ? messages : [];
	const violationRows = Array.isArray(violations) ? violations : [];
	const notificationRows = Array.isArray(notifications) ? notifications : [];
	const searchAlertRows = Array.isArray(searchAlerts) ? searchAlerts : [];
	const searchUsageRows = Array.isArray(searchUsage) ? searchUsage : [];
	const knowledgeRows = Array.isArray(assistantKnowledge) ? assistantKnowledge : [];
	const productRows = Array.isArray(products) ? products : [];
	const historyRows = Array.isArray(subscriptionHistory) ? subscriptionHistory : [];
	const refundRows = Array.isArray(refundLog) ? refundLog : [];
	const supportTicketRows = Array.isArray(supportTickets) ? supportTickets : [];

	const roleCounts = countBy(userRows, "role");
	const premiumUsers = userRows.filter(
		(u) => String(u.subscription_status || "").toLowerCase() === "premium",
	).length;
	const suspendedUsers = userRows.filter(
		(u) => String(u.status || "").toLowerCase() === "suspended",
	).length;
	const pendingVerifications = verificationRows.filter(isPendingVerification).length;
	const expiringVerifications = verificationRows.filter((v) => Boolean(v.expiring_soon)).length;
	const activeSubscriptions = subscriptionRows.filter((s) => {
		const end = new Date(s.end_date || 0).getTime();
		return Number.isFinite(end) && end >= Date.now();
	}).length;
	const failedRenewals = subscriptionRows.filter((s) => {
		const end = new Date(s.end_date || 0).getTime();
		return Number.isFinite(end) && end < Date.now() && Boolean(s.auto_renew);
	}).length;

	const contractDocs = documentRows.filter(
		(d) =>
			String(d.entity_type || "")
				.toLowerCase()
				.includes("contract") || Boolean(d.contract_number),
	);
	const pendingSignatures = contractDocs.filter(
		(d) =>
			String(d.buyer_signature_state || "").toLowerCase() !== "signed" ||
			String(d.factory_signature_state || "").toLowerCase() !== "signed",
	).length;

	const walletBalance = userRows.reduce((sum, u) => sum + Number(u.wallet_balance_usd || 0), 0);
	const walletRestricted = userRows.reduce(
		(sum, u) => sum + Number(u.wallet_restricted_usd || 0),
		0,
	);
	const totalCreditsIssued = walletRows.reduce((sum, w) => sum + Number(w.amount_usd || 0), 0);

	const config = await getAdminConfig();
	const abuseThreshold = Number(config?.search_limits?.abusive_search_threshold || 100);
	const searchAbuse = searchUsageRows.filter(
		(row) => Number(row.count || 0) >= abuseThreshold,
	).length;
	const auditLog = await readAuditLog();

	let dashboard = null;
	try {
		dashboard = await getDashboardAnalytics(user);
	} catch {
		dashboard = null;
	}

	const clicks = dashboard?.interaction_summary?.total_clicks || 0;
	const visits = dashboard?.interaction_summary?.total_page_views || 0;

	const trafficStored = await readLocalJson("traffic_analytics.json", {
		summary: { clicks: 0, visits: 0, spend: 0 },
		sources: [],
		domains: [],
	});
	const storedSummary = trafficStored?.summary || {};
	const storedClicks = Number(storedSummary.clicks || 0);
	const storedVisits = Number(storedSummary.visits || 0);
	const storedSpend = Number(storedSummary.spend || 0);

	const trafficClicks = storedClicks || clicks;
	const trafficVisits = storedVisits || visits;
	const trafficCpc = trafficClicks > 0 ? storedSpend / trafficClicks : null;

	const adminAuth = await getAdminAuthConfig();
	return {
		generated_at: new Date().toISOString(),
		security_context: {
			mfa_required: Boolean(String(adminAuth.mfa_code || "").trim()),
			ip_allowlist: Array.isArray(adminAuth.ip_allowlist) ? adminAuth.ip_allowlist : [],
			device_allowlist: Array.isArray(adminAuth.device_allowlist) ? adminAuth.device_allowlist : [],
			step_up_required: Boolean(String(process.env.ADMIN_STEPUP_CODE || "").trim()),
			export_dual_confirm:
				Boolean(String(process.env.ADMIN_EXPORT_CODE_PRIMARY || "").trim()) ||
				Boolean(String(process.env.ADMIN_EXPORT_CODE_SECONDARY || "").trim()),
			exec_enabled: ["true", "1", "yes"].includes(
				String(process.env.ADMIN_EXEC_ENABLED || "").toLowerCase(),
			),
		},
		summary: {
			users: {
				total: userRows.length,
				premium: premiumUsers,
				suspended: suspendedUsers,
				role_counts: roleCounts,
			},
			orgs: {
				total: userRows.filter((u) =>
					["buyer", "factory", "buying_house"].includes(String(u.role || "").toLowerCase()),
				).length,
				staff: userRows.filter((u) => Boolean(u.org_owner_id)).length,
				agents: userRows.filter((u) => String(u.role || "").toLowerCase() === "agent").length,
			},
			verification: {
				total: verificationRows.length,
				pending: pendingVerifications,
				expiring: expiringVerifications,
			},
			finance: {
				subscriptions: subscriptionRows.length,
				active_subscriptions: activeSubscriptions,
				failed_renewals: failedRenewals,
				revenue_estimate_usd: premiumUsers * Number(config.pricing?.premium_usd || 0),
				upgrade_events: historyRows.filter((row) => row.action === "upgrade").length,
				downgrade_events: historyRows.filter((row) => row.action === "downgrade").length,
			},
			wallet: {
				total_balance_usd: Math.round(walletBalance * 100) / 100,
				restricted_usd: Math.round(walletRestricted * 100) / 100,
				credits_issued_usd: Math.round(totalCreditsIssued * 100) / 100,
				redemptions: couponRedemptionsRows.length,
				refunds: refundRows.length,
			},
			coupons: {
				total: couponRows.length,
				active: couponRows.filter((c) => Boolean(c.active)).length,
				redemptions: couponRedemptionsRows.length,
			},
			partners: {
				requests: partnerRows.length,
				active: partnerRows.filter((r) => String(r.status || "").toLowerCase() === "active").length,
			},
			requests: {
				total: requirementRows.length,
				verified_only: requirementRows.filter((r) => Boolean(r.verified_only)).length,
				matches: matchRows.length,
			},
			contracts: {
				total: contractDocs.length,
				pending_signatures: pendingSignatures,
				payment_proofs: paymentProofRows.length,
			},
			calls: {
				total: callRows.length,
				recordings: callRows.filter(
					(c) =>
						Boolean(c.recording_url) ||
						String(c.recording_status || "").toLowerCase() === "available",
				).length,
			},
			messages: {
				total: messageRows.length,
				violations: violationRows.length,
				strikes: userRows.reduce((sum, u) => sum + Number(u.policy_strikes || 0), 0),
			},
			media: {
				videos_pending: productRows.filter(
					(p) =>
						Boolean(p.video_url) &&
						String(p.video_review_status || "").toLowerCase() !== "approved",
				).length,
				docs_pending: documentRows.filter(
					(d) => String(d.moderation_status || "").toLowerCase() === "pending_review",
				).length,
			},
			support: {
				tickets: supportTicketRows.length,
				open: supportTicketRows.filter((r) => String(r.status || "").toLowerCase() !== "resolved")
					.length,
			},
			notifications: {
				total: notificationRows.length,
			},
			analytics: {
				total_events: Array.isArray(analytics) ? analytics.length : 0,
			},
			search: {
				alerts: searchAlertRows.length,
				abuse_flags: searchAbuse,
			},
			ai: {
				knowledge_entries: knowledgeRows.length,
				chatbot_enabled: userRows.filter((u) => Boolean(u.chatbot_enabled)).length,
			},
			system: {
				feature_flags: Object.keys(config.feature_flags || {}).length,
				plan_limits: Object.keys(config.plan_limits || {}).length,
			},
			security: {
				audit_entries: auditLog.length,
			},
			integrations: {
				payment_gateways: (config.integrations?.payment_gateways || []).length,
				webhooks: (config.integrations?.webhooks || []).length,
				api_keys: (config.integrations?.api_keys || []).length,
			},
			traffic: {
				clicks: trafficClicks,
				visits: trafficVisits,
				spend: storedSpend,
				cpc: trafficCpc,
			},
			emails: {
				total: userRows.length,
			},
		},
		dashboard,
		config,
		inventory: ADMIN_INVENTORY,
	};
}

export { ADMIN_INVENTORY };
