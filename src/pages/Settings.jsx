import { Monitor, Moon, Settings as SettingsIcon, Sun } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mosaic, ThreeDot } from "react-loading-indicators";
import { useNavigate, useSearchParams } from "react-router-dom";
import { passwordProblems } from "../../shared/config/passwordPolicy.js";
import { COUNTRY_OPTIONS, FACTORY_SECTOR_OPTIONS } from "../../shared/config/platformTaxonomy.js";
import OfflineStorageSection from "../components/OfflineStorageSection.jsx";
import LazyImage from "../components/ui/LazyImage.jsx";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import ProfileImageUpload from "../components/ui/ProfileImageUpload.jsx";
import UploadProgressBar from "../components/ui/UploadProgressBar.jsx";
import { useEntitlements } from "../hooks/useSecureUser.js";
import { apiRequest, clearSession, getCurrentUser, getToken, hasEntitlement } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { useTheme } from "../lib/ThemeProvider.jsx";
import { uploadFile } from "../lib/upload.js";
import { ERRORS, isValidEmail, isValidPhone, isValidUrl } from "../lib/validation.js";

function cx(...classes) {
	return classes.filter(Boolean).join(" ");
}

function SectionCard({ title, subtitle, children, className = "" }) {
	return (
		<section
			class={cx(
				"rounded-3xl border border-sky-200/60 bg-white/80 p-5 shadow-[0_20px_60px_-30px_rgba(51,122,176,0.45)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75",
				className,
			)}
		>
			<div class="mb-4">
				<h3 class="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
				{subtitle ? (
					<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
				) : null}
			</div>
			{children}
		</section>
	);
}

function Label({ children }) {
	return (
		<label class="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
			{children}
		</label>
	);
}

function _TogglePref({ label, description, checked, onChange }) {
	return (
		<div class="flex items-center justify-between py-3">
			<div>
				<div class="font-medium text-slate-900 dark:text-white">{label}</div>
				{description && <div class="text-sm text-slate-500">{description}</div>}
			</div>
			<button
				type="button"
				onClick={onChange}
				class={cx(
					"relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
					checked ? "bg-sky-500" : "bg-slate-300 dark:bg-slate-600",
				)}
			>
				<span
					class={cx(
						"inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
						checked ? "translate-x-6" : "translate-x-1",
					)}
				/>
			</button>
		</div>
	);
}

function Input(props) {
	return (
		<input
			{...props}
			class={cx(
				"w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-200/60 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:ring-sky-950/50",
				props.className,
			)}
		/>
	);
}

function Textarea(props) {
	return (
		<textarea
			{...props}
			class={cx(
				"w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-200/60 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:ring-sky-950/50",
				props.className,
			)}
		/>
	);
}

function Select({ children, ...props }) {
	return (
		<select
			{...props}
			class={cx(
				"w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-200/60 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-sky-500 dark:focus:ring-sky-950/50",
				props.className,
			)}
		>
			{children}
		</select>
	);
}

function Toggle({ checked, onChange, label, hint }) {
	return (
		<button
			type="button"
			onClick={() => onChange(!checked)}
			class="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-sky-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900"
		>
			<div>
				<div class="text-sm font-medium text-slate-900 dark:text-white">{label}</div>
				{hint ? <div class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</div> : null}
			</div>
			<div
				class={cx(
					"relative h-7 w-12 rounded-full transition",
					checked ? "bg-sky-500" : "bg-slate-300 dark:bg-slate-700",
				)}
			>
				<div
					class={cx(
						"absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
						checked ? "translate-x-5" : "translate-x-0.5",
					)}
				/>
			</div>
		</button>
	);
}

function Badge({ children, tone = "slate" }) {
	const tones = {
		slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
		green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
		yellow: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
		red: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
		sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
		violet: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
	};
	return (
		<span
			class={cx(
				"inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
				tones[tone] || tones.slate,
			)}
		>
			{children}
		</span>
	);
}

function PrimaryButton({ children, className = "", ...props }) {
	return (
		<button
			{...props}
			class={cx(
				"inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60",
				className,
			)}
		>
			{children}
		</button>
	);
}

function SecondaryButton({ children, className = "", ...props }) {
	return (
		<button
			{...props}
			class={cx(
				"inline-flex items-center justify-center rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
				className,
			)}
		>
			{children}
		</button>
	);
}

function Icon({ children, className = "" }) {
	return (
		<div
			class={cx(
				"flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-500/20",
				className,
			)}
		>
			{children}
		</div>
	);
}

const ROLE_HIERARCHY = [
	"observer",
	"agent",
	"viewer",
	"editor",
	"manager",
	"factory",
	"buying_house",
	"admin",
	"owner",
];

const hasRoleAccess = (userRole, requiredRole) => {
	if (!(userRole && requiredRole)) {
		return false;
	}
	// A buyer is a company account like a factory (verification, Premium,
	// billing). "buyer" was missing from the hierarchy, so a buyer failed every
	// check and Settings rendered no tabs and no content at all.
	const normalizedRole = userRole.toLowerCase() === "buyer" ? "factory" : userRole.toLowerCase();
	const userIndex = ROLE_HIERARCHY.indexOf(normalizedRole);
	const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole.toLowerCase());
	return userIndex >= requiredIndex && userIndex !== -1;
};

// Order and names follow the client's final decision (26/09/2026): My Profile
// first, account settings (notifications, security, theme) last; "General Info"
// is named for what it controls.
const TABS = [
	{ id: "profile", label: "My Profile", requiredRole: "observer" },
	{ id: "verification", label: "Verification", requiredRole: "factory" },
	{ id: "general", label: "Chatbot & Auto-reply", requiredRole: "viewer" },
	{ id: "branding", label: "Branding", requiredRole: "factory" },
	{ id: "members", label: "Members", requiredRole: "factory" },
	{ id: "subscription", label: "Subscription & Billing", requiredRole: "factory" },
	{
		id: "assistant_knowledge",
		label: "Assistant Knowledge",
		requiredRole: "admin",
	},
	{ id: "privacy", label: "Privacy", requiredRole: "observer" },
	{ id: "notifications", label: "Notifications", requiredRole: "viewer" },
	{ id: "security", label: "Security", requiredRole: "factory" },
	{ id: "theme", label: "Theme", requiredRole: "viewer" },
];

// What each tab needs from the API. Org-only data is loaded for org managers.
const TAB_LOADERS = {
	profile: ["profile"],
	privacy: ["profile"],
	notifications: ["profile"],
	theme: [],
	security: ["profile", "sessions", "passkeys"],
	verification: ["billing"],
	subscription: ["billing"],
	general: ["chatbot", "policy"],
	assistant_knowledge: ["faqs"],
	branding: ["profile"],
	members: ["members"],
};
const ORG_ONLY_LOADERS = new Set(["chatbot", "policy", "faqs", "members"]);
const ORG_ONLY_TABS = new Set(["general", "assistant_knowledge", "branding", "members"]);

const STANDALONE_TAB_IDS = ["profile", "theme", "security", "notifications", "verification"];

export default function Settings({ embedded = false, initialTabProp = "", tabIds = null }) {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const tabParamName = embedded ? "settingsTab" : "tab";
	// Inside the Owner Dashboard each section shows only its own tabs: the
	// dashboard menu already lists the others, and repeating every tab here
	// duplicated them (client rule: nothing in two places).
	const visibleTabs = embedded
		? TABS.filter((t) => !Array.isArray(tabIds) || tabIds.includes(t.id))
		: TABS.filter((t) => STANDALONE_TAB_IDS.includes(t.id));
	const initialTab = useMemo(() => {
		const candidate = searchParams.get(tabParamName) || initialTabProp || "profile";
		return visibleTabs.some((t) => t.id === candidate) ? candidate : visibleTabs[0]?.id || "profile";
	}, [searchParams, tabParamName, initialTabProp]);

	const [tab, setTab] = useState(initialTab);
	const goSettingsTab = useCallback(
		(id) => {
			setTab(id);
			if (embedded) {
				setSearchParams(
					(prev) => {
						const next = new URLSearchParams(prev);
						next.set("settingsTab", id);
						return next;
					},
					{ replace: true },
				);
			}
		},
		[embedded, setSearchParams],
	);
	const { theme, themeMode, toggleTheme, setTheme } = useTheme();
	const [statusMessage, setStatusMessage] = useState("Ready.");

	const currentUser = useMemo(() => getCurrentUser(), []);
	const { entitlements: secureEntitlements } = useEntitlements();
	const currentUserRole = useMemo(
		() => String(currentUser?.role || "").toLowerCase(),
		[currentUser],
	);
	const isOrgManager = ["owner", "admin", "buying_house", "factory"].includes(currentUserRole);

	const accessibleTabs = useMemo(
		() =>
			visibleTabs.filter((t) => t.requiredRole && hasRoleAccess(currentUserRole, t.requiredRole)),
		[currentUserRole],
	);

	const activeTab = useMemo(
		() => (accessibleTabs.some((t) => t.id === tab) ? tab : accessibleTabs[0]?.id || "profile"),
		[tab, accessibleTabs],
	);

	// General tab state
	const [chatbotEnabled, setChatbotEnabled] = useState(() =>
		Boolean(currentUser?.chatbot_enabled || currentUser?.profile?.chatbot_enabled),
	);
	const [autoSaveSearchAlerts, setAutoSaveSearchAlerts] = useState(() => {
		const raw = currentUser?.profile?.auto_save_search_alerts;
		return raw === undefined || raw === null || raw === ""
			? true
			: raw === true || String(raw).toLowerCase() === "true";
	});
	const [handoffMode, setHandoffMode] = useState(() =>
		String(currentUser?.handoff_mode || currentUser?.profile?.handoff_mode || "notify_agent"),
	);
	const [autoReplyGreeting, setAutoReplyGreeting] = useState("");
	const [autoReplySignature, setAutoReplySignature] = useState("");
	const [autoReplyFallback, setAutoReplyFallback] = useState("");
	const [autoReplyTone, setAutoReplyTone] = useState("professional");
	const [autoReplyQualification, setAutoReplyQualification] = useState("");
	const [autoReplyFeedback, setAutoReplyFeedback] = useState("");
	const [pageLoading, setPageLoading] = useState(true);
	const [loadingAutoReply, setLoadingAutoReply] = useState(false);
	const [policyMessageCaps, setPolicyMessageCaps] = useState("12");
	const [policyWindowMinutes, setPolicyWindowMinutes] = useState("15");
	const [policyCooldownSeconds, setPolicyCooldownSeconds] = useState("30");
	const [policyStrictnessMode, setPolicyStrictnessMode] = useState("balanced");
	const [mainProcesses, setMainProcesses] = useState(() =>
		(currentUser?.profile?.main_processes || []).join(", "),
	);
	const [yearsInBusiness, setYearsInBusiness] = useState(() =>
		String(currentUser?.profile?.years_in_business || ""),
	);
	const [teamSeats, setTeamSeats] = useState(() => String(currentUser?.profile?.team_seats || ""));
	const [exportPorts, setExportPorts] = useState(() =>
		(currentUser?.profile?.export_ports || []).join(", "),
	);
	const [handlesMultipleFactories, setHandlesMultipleFactories] = useState(() =>
		Boolean(currentUser?.profile?.handles_multiple_factories),
	);
	const [locationLat, setLocationLat] = useState(() =>
		String(currentUser?.profile?.location_lat || ""),
	);
	const [locationLng, setLocationLng] = useState(() =>
		String(currentUser?.profile?.location_lng || ""),
	);

	// Profile tab state
	const [profileDisplayName, setProfileDisplayName] = useState(() =>
		String(
			currentUser?.profile?.organization_name || currentUser?.display_name || currentUser?.name || "",
		),
	);
	const [orgNameChangedAt, setOrgNameChangedAt] = useState(0);
	const [profileHeadline, setProfileHeadline] = useState(() =>
		String(currentUser?.profile?.headline || ""),
	);
	const [profileBio, setProfileBio] = useState(() => String(currentUser?.profile?.bio || ""));
	const [profileAvatarUrl, setProfileAvatarUrl] = useState(() =>
		String(currentUser?.avatar_url || currentUser?.profile?.avatar_url || ""),
	);
	const [profileCoverUrl, setProfileCoverUrl] = useState(() =>
		String(currentUser?.profile?.cover_image_url || ""),
	);
	const [profileCountry, setProfileCountry] = useState(() =>
		String(currentUser?.profile?.country || currentUser?.country || ""),
	);
	const [profileIndustry, setProfileIndustry] = useState(() =>
		String(currentUser?.profile?.industry || ""),
	);
	const [profilePhone, setProfilePhone] = useState(() =>
		String(currentUser?.phone || currentUser?.profile?.phone || ""),
	);

	const [profileEmail, setProfileEmail] = useState(() => String(currentUser?.email || ""));
	const [profileVisibility, setProfileVisibility] = useState(() =>
		String(currentUser?.profile?.visibility || "public"),
	);
	const [loadingProfile, setLoadingProfile] = useState(false);
	const [profileFeedback, setProfileFeedback] = useState("");
	const [searchIndexing, setSearchIndexing] = useState(() =>
		Boolean(currentUser?.profile?.search_indexing ?? true),
	);
	const [showActivityStatus, setShowActivityStatus] = useState(() =>
		Boolean(currentUser?.profile?.show_activity ?? true),
	);
	const [hideEmail, setHideEmail] = useState(() =>
		Boolean(currentUser?.profile?.hide_email ?? false),
	);
	const [hidePhone, setHidePhone] = useState(() =>
		Boolean(currentUser?.profile?.hide_phone ?? false),
	);

	// Password & Security state
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [passwordFeedback, setPasswordFeedback] = useState("");
	const [changingPassword, setChangingPassword] = useState(false);
	const [sessions, setSessions] = useState([]);
	const [loadingSessions, setLoadingSessions] = useState(false);
	const [revokingSession, setRevokingSession] = useState(null);
	const [totpEnabled, setTotpEnabled] = useState(() => Boolean(currentUser?.totp_enabled));
	const [passkeys, setPasskeys] = useState(() =>
		Array.isArray(currentUser?.passkeys) ? currentUser.passkeys : [],
	);
	const [passkeyName, setPasskeyName] = useState("");
	const [passkeyError, setPasskeyError] = useState("");

	// Notification state
	const [notifEmail, setNotifEmail] = useState(() => {
		const val = currentUser?.notification_prefs?.email;
		return val === undefined || val === null ? true : Boolean(val);
	});
	const [notifPush, setNotifPush] = useState(() => {
		const val = currentUser?.notification_prefs?.push;
		return val === undefined || val === null ? true : Boolean(val);
	});
	const [notifInApp, setNotifInApp] = useState(() => {
		const val = currentUser?.notification_prefs?.in_app;
		return val === undefined || val === null ? true : Boolean(val);
	});
	const [notifFeedback, setNotifFeedback] = useState("");

	// Data export state
	const [exportingData, setExportingData] = useState(false);
	const [exportFeedback, setExportFeedback] = useState("");

	// Delete account state
	const [deleteConfirmText, setDeleteConfirmText] = useState("");
	const [deletingProfile, setDeletingProfile] = useState(false);
	const [deleteProfileFeedback, setDeleteProfileFeedback] = useState("");

	// Billing/subscription state
	const [remainingDays, setRemainingDays] = useState(0);
	const [subscriptionPlan, setSubscriptionPlan] = useState("free");
	const [walletBalance, setWalletBalance] = useState(0);
	const [walletRestricted, setWalletRestricted] = useState(0);
	const [addingFunds, setAddingFunds] = useState(false);
	const [verification, setVerification] = useState(null);
	const [renewingVerification, setRenewingVerification] = useState(false);
	const [billingFeedback, setBillingFeedback] = useState("");
	const [cancellingSubscription, setCancellingSubscription] = useState(false);
	// Prices come from the API (GET /subscriptions/me): the amount shown is the amount charged.
	const [premiumPricing, setPremiumPricing] = useState(null);
	const [upgradingPremium, setUpgradingPremium] = useState(false);
	const [entitlements] = useState(() => secureEntitlements || currentUser?.entitlements || null);

	// Account lock state
	const [accountLocked, setAccountLocked] = useState(() => currentUser?.status === "locked");
	const [lockingAccount, setLockingAccount] = useState(false);
	const [lockModalOpen, setLockModalOpen] = useState(false);
	const [lockStep, setLockStep] = useState(1);
	const [lockPassword, setLockPassword] = useState("");
	const [lockConfirmText, setLockConfirmText] = useState("");
	const [lockError, setLockError] = useState("");

	// Members state
	const [entries, setEntries] = useState([]);
	const [members, setMembers] = useState([]);
	const [memberInviteEmail, setMemberInviteEmail] = useState("");
	const [memberInviteRole, setMemberInviteRole] = useState("Editor");
	const [invitingMember, setInvitingMember] = useState(false);
	const [memberFeedback, setMemberFeedback] = useState("");
	const [faqFeedback, setFaqFeedback] = useState("");
	const [knowledgeForm, setKnowledgeForm] = useState({
		type: "faq",
		question: "",
		answer: "",
		keywords: "",
	});

	// Boosts state
	const [boosts, setBoosts] = useState([]);
	const [boostScope, setBoostScope] = useState("feed");
	const [boostDuration, setBoostDuration] = useState("7");
	const [boostMultiplier, setBoostMultiplier] = useState("1.5");
	const [boostPrice, setBoostPrice] = useState("9.99");
	const [boostFeedback, setBoostFeedback] = useState("");
	const [loadingBoosts, setLoadingBoosts] = useState(false);
	const [creatingBoost, setCreatingBoost] = useState(false);

	// Branding state
	const [brandName, setBrandName] = useState(() => String(currentUser?.profile?.brand_name || ""));
	const [brandTagline, setBrandTagline] = useState(() =>
		String(currentUser?.profile?.brand_tagline || ""),
	);
	const [brandLogoUrl, setBrandLogoUrl] = useState(() =>
		String(currentUser?.profile?.brand_logo_url || ""),
	);
	const [brandCoverUrl, setBrandCoverUrl] = useState(() =>
		String(currentUser?.profile?.brand_cover_url || ""),
	);
	const [bannerUploading, setBannerUploading] = useState(false);
	const [bannerUploadProgress, setBannerUploadProgress] = useState(0);
	const [logoUploading, setLogoUploading] = useState(false);
	const [logoUploadProgress, setLogoUploadProgress] = useState(0);
	const bannerInputRef = useRef(null);
	const logoInputRef = useRef(null);

	const handleBannerUpload = async (e) => {
		const file = e.target.files?.[0];
		if (!file) {
			return;
		}

		const validTypes = [
			"image/jpeg",
			"image/png",
			"image/webp",
			"image/avif",
			"image/gif",
			"image/apng",
			"image/bmp",
			"image/x-ms-bmp",
			"image/tiff",
			"image/heic",
			"image/heif",
			"image/svg+xml",
			"image/x-tga",
			"image/vnd.adobe.photoshop",
			"image/x-photoshop",
			"image/x-xcf",
			"image/x-coreldraw",
			"image/x-adobe-dng",
			"image/x-canon-cr2",
			"image/x-canon-cr3",
			"image/x-nikon-nef",
			"image/x-sony-arw",
			"image/x-sony-sr2",
			"image/x-olympus-orf",
			"image/x-fuji-raf",
			"image/x-eps",
			"application/postscript",
			"application/pdf",
			"application/dicom",
			"application/x-coreldraw",
		];
		if (!validTypes.includes(file.type)) {
			setStatusMessage("Unsupported image format");
			return;
		}

		if (file.size > 10 * 1024 * 1024) {
			setStatusMessage("File size must be less than 10MB");
			return;
		}

		setBannerUploading(true);
		setBannerUploadProgress(0);
		try {
			const token = getToken();
			const data = await uploadFile("/users/me/avatar", {
				file,
				token,
				onProgress: setBannerUploadProgress,
			});
			const uploadedUrl = data.avatar_url || data.profile_image;
			setBrandCoverUrl(uploadedUrl);
			setStatusMessage("Banner uploaded successfully");
		} catch (err) {
			setStatusMessage(err.message || "Failed to upload banner");
		} finally {
			setBannerUploading(false);
			setBannerUploadProgress(0);
		}
	};

	const handleLogoUpload = async (e) => {
		const file = e.target.files?.[0];
		if (!file) {
			return;
		}

		const validTypes = [
			"image/jpeg",
			"image/png",
			"image/webp",
			"image/avif",
			"image/gif",
			"image/apng",
			"image/bmp",
			"image/x-ms-bmp",
			"image/tiff",
			"image/heic",
			"image/heif",
			"image/svg+xml",
			"image/x-tga",
			"image/vnd.adobe.photoshop",
			"image/x-photoshop",
			"image/x-xcf",
			"image/x-coreldraw",
			"image/x-adobe-dng",
			"image/x-canon-cr2",
			"image/x-canon-cr3",
			"image/x-nikon-nef",
			"image/x-sony-arw",
			"image/x-sony-sr2",
			"image/x-olympus-orf",
			"image/x-fuji-raf",
			"image/x-eps",
			"application/postscript",
			"application/pdf",
			"application/dicom",
			"application/x-coreldraw",
		];
		if (!validTypes.includes(file.type)) {
			setStatusMessage("Unsupported image format");
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			setStatusMessage("File size must be less than 5MB");
			return;
		}

		setLogoUploading(true);
		setLogoUploadProgress(0);
		try {
			const token = getToken();
			const data = await uploadFile("/users/me/avatar", {
				file,
				token,
				onProgress: setLogoUploadProgress,
			});
			const uploadedUrl = data.avatar_url || data.profile_image;
			setBrandLogoUrl(uploadedUrl);
			setStatusMessage("Logo uploaded successfully");
		} catch (err) {
			setStatusMessage(err.message || "Failed to upload logo");
		} finally {
			setLogoUploading(false);
			setLogoUploadProgress(0);
		}
	};

	const [brandAccent, setBrandAccent] = useState(() =>
		String(currentUser?.profile?.brand_accent || ""),
	);

	const canAutoReply = hasEntitlement(
		entitlements ? { entitlements } : null,
		"ai_auto_reply_customization",
	);
	const canBranding =
		hasEntitlement(entitlements ? { entitlements } : null, "custom_branding") ||
		currentUser?.role === "admin" ||
		currentUser?.role === "owner";

	const verificationStatus = useMemo(() => {
		if (remainingDays <= 0) {
			return "expired";
		}
		if (remainingDays <= 7) {
			return "expiring_soon";
		}
		return "verified_active";
	}, [remainingDays]);

	const planPrice = useMemo(() => {
		if (subscriptionPlan === "premium" && premiumPricing?.renewal_usd) {
			return Number(premiumPricing.renewal_usd).toFixed(2);
		}
		const prices = {
			free: "0.00",
			starter: "9.99",
			enterprise: "99.00",
		};
		return prices[subscriptionPlan] || "0.00";
	}, [subscriptionPlan, premiumPricing]);

	const walletShortfall = premiumPricing?.next_charge_usd
		? Math.max(0, Number(premiumPricing.next_charge_usd) - walletBalance - walletRestricted)
		: 0;

	const save = (msg) => setStatusMessage(msg || "Saved.");

	// Load billing data
	const loadBilling = useCallback(async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		try {
			const [sub, remaining, wallet, v] = await Promise.all([
				apiRequest("/subscriptions/me", { token }),
				apiRequest("/subscriptions/me/remaining-days", { token }),
				apiRequest("/wallet/me", { token }),
				apiRequest("/verification/me", { token }),
			]);
			setSubscriptionPlan(sub?.plan || "free");
			setPremiumPricing(sub?.pricing || null);
			setRemainingDays(Number(remaining?.remaining_days || 0));
			setWalletBalance(Number(wallet?.balance_usd || 0));
			setWalletRestricted(Number(wallet?.restricted_balance_usd || 0));
			setVerification(v || null);
		} catch (err) {
			setBillingFeedback(err.message || "Unable to load subscription status");
		}
	}, []);

	// Load user profile
	const loadUserProfile = useCallback(async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		try {
			const data = await apiRequest("/users/me", { token });
			if (data) {
				// The company name buyers see is profile.organization_name; the
				// field used to show (and save) the personal account name instead.
				setProfileDisplayName(
					String(data.profile?.organization_name || data.display_name || data.name || ""),
				);
				setOrgNameChangedAt(Date.parse(data.profile?.organization_name_changed_at || "") || 0);
				setProfileHeadline(String(data.profile?.headline || ""));
				setProfileBio(String(data.profile?.bio || ""));
				setProfileAvatarUrl(String(data.avatar_url || data.profile?.avatar_url || ""));
				setProfilePhone(String(data.phone || data.profile?.phone || ""));
				setProfileEmail(String(data.email || ""));
				setProfileVisibility(String(data.profile?.visibility || "public"));
				setNotifEmail(data.notification_prefs?.email !== false);
				setNotifPush(data.notification_prefs?.push !== false);
				setNotifInApp(data.notification_prefs?.in_app !== false);
				setTotpEnabled(Boolean(data.totp_enabled));
				setPasskeys(Array.isArray(data.passkeys) ? data.passkeys : []);
			}
		} catch {
			/* ignore */
		}
	}, []);

	// Load sessions
	const loadSessions = useCallback(async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		setLoadingSessions(true);
		try {
			const data = await apiRequest("/auth/sessions", { token });
			setSessions(Array.isArray(data?.sessions) ? data.sessions : []);
		} catch {
			setSessions([]);
		} finally {
			setLoadingSessions(false);
		}
	}, []);

	// Load FAQs
	const loadFaqs = useCallback(async () => {
		try {
			const token = getToken();
			if (!token) {
				return;
			}
			const data = await apiRequest("/assistant/knowledge", { token });
			setEntries(data.entries || []);
		} catch (err) {
			setFaqFeedback(err.status === 403 ? "Access denied" : err.message);
		}
	}, []);

	// Load members
	const loadMembers = useCallback(async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		try {
			const data = await apiRequest("/org/members", { token });
			setMembers(Array.isArray(data?.members) ? data.members : []);
		} catch {
			setMembers([]);
		}
	}, []);

	// Load boosts
	const loadBoosts = useCallback(async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		setLoadingBoosts(true);
		try {
			const data = await apiRequest("/boosts", { token });
			setBoosts(Array.isArray(data?.boosts) ? data.boosts : []);
		} catch {
			setBoosts([]);
		} finally {
			setLoadingBoosts(false);
		}
	}, []);

	// Create boost
	const createBoost = async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		setCreatingBoost(true);
		setBoostFeedback("");
		try {
			const data = await apiRequest("/boosts", {
				method: "POST",
				token,
				body: {
					scope: boostScope,
					duration_days: Number(boostDuration),
					multiplier: Number(boostMultiplier),
					price_usd: Number(boostPrice),
				},
			});
			setBoosts((prev) => [data?.boost, ...prev].filter(Boolean));
			setBoostFeedback("Boost created successfully.");
		} catch (err) {
			setBoostFeedback(err.message || "Failed to create boost");
		} finally {
			setCreatingBoost(false);
		}
	};

	// Invite member
	const inviteMember = async () => {
		const email = memberInviteEmail.trim();
		if (!email) {
			setMemberFeedback("Enter a member email");
			return;
		}
		if (!isValidEmail(email)) {
			setMemberFeedback(ERRORS.email);
			return;
		}
		const token = getToken();
		if (!token) {
			return;
		}
		setInvitingMember(true);
		setMemberFeedback("");
		try {
			await apiRequest("/org/members", {
				method: "POST",
				token,
				body: { email: memberInviteEmail, role: memberInviteRole },
			});
			setMemberFeedback("Member invited successfully.");
			setMemberInviteEmail("");
			setMemberInviteRole("Editor");
			loadMembers();
		} catch (err) {
			setMemberFeedback(err.message || "Failed to invite member");
		} finally {
			setInvitingMember(false);
		}
	};

	// Remove member
	const removeMember = async (memberId) => {
		const token = getToken();
		if (!(token && memberId)) {
			return;
		}
		try {
			await apiRequest(`/org/members/${encodeURIComponent(memberId)}?remove=true`, {
				method: "DELETE",
				token,
			});
			setMembers((m) => m.filter((x) => x.id !== memberId));
			save("Member removed from organization.");
		} catch {
			/* ignore */
		}
	};

	// Reactivate member
	const reactivateMember = async (memberId) => {
		const token = getToken();
		if (!(token && memberId)) {
			return;
		}
		try {
			await apiRequest(`/org/members/${encodeURIComponent(memberId)}`, {
				method: "PUT",
				token,
				body: { status: "active" },
			});
			setMembers((m) => m.map((x) => (x.id === memberId ? { ...x, status: "active" } : x)));
			save("Member reactivated.");
		} catch (err) {
			setStatusMessage(`Reactivation failed: ${err.message || "Unknown error"}`);
		}
	};

	// Load passkeys
	const loadPasskeys = useCallback(async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		try {
			const data = await apiRequest("/auth/passkeys", { token });
			setPasskeys(Array.isArray(data?.passkeys) ? data.passkeys : []);
		} catch {
			setPasskeys([]);
		}
	}, []);

	// Load chatbot settings
	const loadChatbotSettings = useCallback(async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		try {
			setLoadingAutoReply(true);
			const data = await apiRequest("/chatbot/settings", { token });
			const settings = data?.settings || {};
			setAutoReplyGreeting(String(settings?.auto_reply_greeting || ""));
			setAutoReplySignature(String(settings?.auto_reply_signature || ""));
			setAutoReplyFallback(String(settings?.auto_reply_fallback || ""));
			setAutoReplyTone(String(settings?.auto_reply_tone || "professional"));
			setAutoReplyQualification(String(settings?.auto_reply_qualification_prompt || ""));
		} catch {
			/* ignore */
		} finally {
			setLoadingAutoReply(false);
		}
	}, []);

	// Load communication policy
	const loadCommunicationPolicy = useCallback(async () => {
		const token = getToken();
		if (!(token && currentUser?.id)) {
			return;
		}
		try {
			const data = await apiRequest(
				`/messages/policy/config?org_id=${encodeURIComponent(currentUser.id)}`,
				{ token },
			);
			const policy = data?.config || {};
			setPolicyMessageCaps(String(policy?.message_caps?.outbound_per_window || 12));
			setPolicyWindowMinutes(String(policy?.message_caps?.window_minutes || 15));
			setPolicyCooldownSeconds(String(policy?.message_caps?.cooldown_seconds || 30));
			setPolicyStrictnessMode(String(policy?.strictness_mode || "balanced"));
		} catch {
			/* ignore */
		}
	}, [currentUser?.id]);

	// Save general settings
	const saveGeneralSettings = async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		try {
			await apiRequest("/org/settings", {
				method: "PUT",
				token,
				body: {
					chatbot_enabled: chatbotEnabled,
					auto_save_search_alerts: autoSaveSearchAlerts,
					handoff_mode: handoffMode,
					main_processes: mainProcesses
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean),
					years_in_business: yearsInBusiness,
					team_seats: teamSeats,
					export_ports: exportPorts
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean),
					handles_multiple_factories: handlesMultipleFactories,
					location_lat: locationLat,
					location_lng: locationLng,
				},
			});
			save("General settings saved.");
		} catch (err) {
			setBillingFeedback(err.message || "Failed to save settings");
		}
	};

	// Save chatbot settings
	const saveChatbotSettings = async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		setAutoReplyFeedback("Saving...");
		try {
			await apiRequest("/chatbot/settings", {
				method: "POST",
				token,
				body: {
					auto_reply_greeting: autoReplyGreeting,
					auto_reply_signature: autoReplySignature,
					auto_reply_fallback: autoReplyFallback,
					auto_reply_tone: autoReplyTone,
					auto_reply_qualification_prompt: autoReplyQualification,
				},
			});
			setAutoReplyFeedback("Auto-reply settings saved.");
		} catch (err) {
			setAutoReplyFeedback(err.message || "Failed to save");
		}
	};

	// Save profile
	const saveProfileSettings = async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		setLoadingProfile(true);
		setProfileFeedback("");
		try {
			await apiRequest("/users/me/profile", {
				method: "PATCH",
				token,
				body: {
					organization_name: profileDisplayName,
					headline: profileHeadline,
					bio: profileBio,
					avatar_url: profileAvatarUrl,
					cover_image_url: profileCoverUrl,
					country: profileCountry,
					industry: profileIndustry,
				},
			});
			setProfileFeedback("Profile saved.");
			loadUserProfile();
		} catch (err) {
			setProfileFeedback(err.message || "Failed to save");
		} finally {
			setLoadingProfile(false);
		}
	};

	// Save contact
	const saveContactSettings = async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		if (profileEmail && !isValidEmail(profileEmail)) {
			setProfileFeedback(ERRORS.email);
			return;
		}
		if (profilePhone && !isValidPhone(profilePhone)) {
			setProfileFeedback(ERRORS.phone);
			return;
		}
		setLoadingProfile(true);
		setProfileFeedback("");
		try {
			await apiRequest("/users/me/profile", {
				method: "PATCH",
				token,
				body: { phone: profilePhone },
			});
			setProfileFeedback("Contact saved.");
		} catch (err) {
			setProfileFeedback(err.message || "Failed to save");
		} finally {
			setLoadingProfile(false);
		}
	};

	// Change password
	const changePassword = async () => {
		if (!(currentPassword && newPassword && confirmPassword)) {
			setPasswordFeedback("Fill all password fields");
			return;
		}
		if (newPassword !== confirmPassword) {
			setPasswordFeedback("Passwords don't match");
			return;
		}
		const problems = passwordProblems(newPassword);
		if (problems.length > 0) {
			setPasswordFeedback(`Password needs: ${problems.join(", ").toLowerCase()}`);
			return;
		}
		const token = getToken();
		if (!token) {
			return;
		}
		setChangingPassword(true);
		setPasswordFeedback("");
		try {
			await apiRequest("/auth/password", {
				method: "PUT",
				token,
				body: { current_password: currentPassword, new_password: newPassword },
			});
			setPasswordFeedback("Password changed. Other devices were signed out.");
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
		} catch (err) {
			setPasswordFeedback(err.message || "Failed to change password");
		} finally {
			setChangingPassword(false);
		}
	};

	// Save branding
	const saveBrandingSettings = async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		try {
			await apiRequest("/users/me/profile", {
				method: "PATCH",
				token,
				body: {
					brand_name: brandName,
					brand_logo_url: brandLogoUrl,
					brand_cover_url: brandCoverUrl,
					brand_tagline: brandTagline,
					brand_accent: brandAccent,
				},
			});
			setStatusMessage("Branding saved.");
		} catch (err) {
			setStatusMessage(err.message || "Failed to save branding");
		}
	};

	// Save notification prefs
	const saveNotificationPref = async (type, value) => {
		const token = getToken();
		if (!token) {
			return;
		}
		try {
			await apiRequest("/users/me/notification-prefs", {
				method: "PUT",
				token,
				body: { [type]: value },
			});
			setNotifFeedback("Preferences saved.");
		} catch {
			setNotifFeedback("");
		}
	};

	// Export data
	const exportUserData = async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		setExportingData(true);
		setExportFeedback("");
		try {
			const data = await apiRequest("/users/me/export", { token });
			if (data?.export_url) {
				window.open(data.export_url, "_blank");
				setExportFeedback("Download started.");
			} else if (data) {
				const json = JSON.stringify(data, null, 2);
				const blob = new Blob([json], { type: "application/json" });
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `gartexhub-data-export-${new Date().toISOString().slice(0, 10)}.json`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
				setExportFeedback("Export downloaded.");
			} else {
				setExportFeedback("No export available yet.");
			}
		} catch (err) {
			setExportFeedback(err.message || "Export failed");
		} finally {
			setExportingData(false);
		}
	};

	// Toggle account lock
	const toggleAccountLock = async (password) => {
		const token = getToken();
		if (!token) {
			return;
		}
		setLockingAccount(true);
		setLockError("");
		try {
			if (accountLocked) {
				await apiRequest("/users/me/lock", { method: "DELETE", token });
				try {
					localStorage.removeItem("ght_account_locked");
				} catch {}
				setAccountLocked(false);
				setLockModalOpen(false);
				resetLockModal();
				save("Account unlocked.");
			} else {
				await apiRequest("/users/me/lock", { method: "POST", token, body: { password } });
				setAccountLocked(true);
				setLockModalOpen(false);
				resetLockModal();
				save("Account locked.");
			}
		} catch (err) {
			setLockError(err.message || "Failed to toggle account lock");
		} finally {
			setLockingAccount(false);
		}
	};

	const resetLockModal = () => {
		setLockStep(1);
		setLockPassword("");
		setLockConfirmText("");
		setLockError("");
	};

	// Add funds
	const addFunds = async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		setAddingFunds(true);
		try {
			const res = await apiRequest("/wallet/me/top-up", {
				method: "POST",
				token,
				body: { amount_usd: 10 },
			});
			if (res?.checkout_url) {
				window.open(res.checkout_url, "_blank");
			}
			save("Opening payment page...");
			loadBilling();
		} catch (err) {
			save(err.message || "Failed to start payment");
		} finally {
			setAddingFunds(false);
		}
	};

	// Renew verification
	const renewVerification = async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		setRenewingVerification(true);
		try {
			const res = await apiRequest("/verification/renew", {
				method: "POST",
				token,
			});
			if (res?.verification) {
				setVerification(res.verification);
			}
			const price = Number(res?.price_usd || 0);
			save(`Verification renewed. Charged $${price.toFixed(2)}.`);
			loadBilling();
		} catch (err) {
			save(err.message || "Verification renewal failed");
		} finally {
			setRenewingVerification(false);
		}
	};

	// Delete account
	const deleteAccount = async () => {
		const expected = currentUser?.name || "DELETE";
		if (deleteConfirmText !== expected) {
			setDeleteProfileFeedback(`Type "${expected}" to confirm`);
			return;
		}
		const token = getToken();
		if (!token) {
			return;
		}
		setDeletingProfile(true);
		setDeleteProfileFeedback("");
		try {
			await apiRequest("/users/me", { method: "DELETE", token });
			clearSession();
			navigate("/login?deleted=true");
		} catch (err) {
			setDeleteProfileFeedback(err.message || "Delete failed");
		} finally {
			setDeletingProfile(false);
		}
	};

	// Upgrade to (or extend) Premium: 30 days, charged to the wallet by the API.
	const upgradePremium = async () => {
		const token = getToken();
		const price = Number(premiumPricing?.next_charge_usd || 0);
		if (!(token && price)) {
			return;
		}
		const action = subscriptionPlan === "premium" ? "Extend Premium by 30 days" : "Upgrade to Premium";
		if (!window.confirm(`${action} for $${price.toFixed(2)}? It is paid from your wallet balance.`)) {
			return;
		}
		setUpgradingPremium(true);
		setBillingFeedback("");
		try {
			const res = await apiRequest("/subscriptions/me/renew-monthly", {
				method: "POST",
				token,
				body: { auto_renew: true },
			});
			const until = res?.end_date ? new Date(res.end_date).toLocaleDateString() : "";
			const charged = Number(res?.price_usd ?? price).toFixed(2);
			setBillingFeedback(
				`Premium is active${until ? ` until ${until}` : ""}. $${charged} was charged to your wallet.`,
			);
			await loadBilling();
		} catch (err) {
			setBillingFeedback(err.message || "Upgrade failed");
		} finally {
			setUpgradingPremium(false);
		}
	};

	// Cancel subscription (downgrade to free)
	const cancelSubscription = async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		setCancellingSubscription(true);
		setBillingFeedback("");
		try {
			await apiRequest("/subscriptions/me", {
				method: "POST",
				token,
				body: { plan: "free", auto_renew: false },
			});
			setSubscriptionPlan("free");
			setRemainingDays(0);
			setBillingFeedback("Subscription cancelled. You are now on the Free plan.");
		} catch (err) {
			setBillingFeedback(err.message || "Failed to cancel subscription");
		} finally {
			setCancellingSubscription(false);
		}
	};

	// Revoke session
	const revokeSession = async (sessionId) => {
		const token = getToken();
		if (!(token && sessionId)) {
			return;
		}
		setRevokingSession(sessionId);
		try {
			await apiRequest(`/auth/sessions/${encodeURIComponent(sessionId)}`, {
				method: "DELETE",
				token,
			});
			loadSessions();
			save("Session revoked.");
		} catch {
			setRevokingSession(null);
		}
	};

	// Add passkey
	const addPasskey = async () => {
		if (!passkeyName.trim()) {
			setPasskeyError("Enter a name for this security key");
			return;
		}
		const token = getToken();
		if (!token) {
			return;
		}
		setPasskeyError("");
		try {
			const optionsRes = await apiRequest("/auth/passkey/registration/options", {
				method: "POST",
				token,
			});
			if (!optionsRes?.options?.challenge) {
				throw new Error("Security key setup failed");
			}

			// Convert server options to WebAuthn format
			// Handle both base64 and base64url encoding
			const decodeBase64URL = (str) => {
				// Replace URL-safe chars with standard base64 chars
				let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
				// Add padding if needed
				while (base64.length % 4) {
					base64 += "=";
				}
				return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
			};

			const options = {
				publicKey: {
					challenge: decodeBase64URL(optionsRes.options.challenge),
					rp: {
						name: optionsRes.options.rp?.name || "GarTexHub",
						id: optionsRes.options.rp?.id || window.location.hostname,
					},
					user: {
						id: decodeBase64URL(optionsRes.options.user.id),
						name: passkeyName,
						displayName: passkeyName,
					},
					pubKeyCredParams: (optionsRes.options.pubKeyCredParams || []).map((param) => ({
						type: param.type,
						alg: param.alg,
					})),
					timeout: optionsRes.options.timeout || 60_000,
					excludeCredentials: (optionsRes.options.excludeCredentials || []).map((cred) => ({
						id: decodeBase64URL(cred.id),
						type: cred.type,
					})),
					attestation: optionsRes.options.attestation || "none",
				},
			};

			// Create the passkey using WebAuthn
			let credential;
			try {
				credential = await navigator.credentials.create(options);
			} catch (webauthnErr) {
				throw new Error(
					webauthnErr.message || "Security key registration cancelled or not supported",
				);
			}

			if (!credential) {
				throw new Error("No credential created");
			}

			// Convert credential to JSON for server verification
			const arrayBufferToBase64URL = (buffer) => {
				const bytes = new Uint8Array(buffer);
				let binary = "";
				for (let i = 0; i < bytes.byteLength; i++) {
					binary += String.fromCharCode(bytes[i]);
				}
				return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/[=]+$/, "");
			};

			const credentialData = {
				id: credential.id,
				rawId: arrayBufferToBase64URL(credential.rawId),
				type: credential.type,
				response: {
					clientDataJSON: arrayBufferToBase64URL(credential.response.clientDataJSON),
					attestationObject: arrayBufferToBase64URL(credential.response.attestationObject),
				},
			};

			// Verify and save the passkey on server
			const verifyRes = await apiRequest("/auth/passkey/registration/verify", {
				method: "POST",
				token,
				body: { credential: credentialData, name: passkeyName },
			});

			if (!verifyRes?.passkeys) {
				throw new Error("Failed to save security key");
			}

			// Reload passkeys from server
			await loadPasskeys();
			setPasskeyName("");
			save("Security key registered successfully.");
		} catch (err) {
			setPasskeyError(err.message || "Failed to add security key");
		}
	};

	// Save visibility
	const saveVisibility = async (value) => {
		const token = getToken();
		if (!token) {
			return;
		}
		try {
			await apiRequest("/users/me/profile", {
				method: "PATCH",
				token,
				body: { visibility: value },
			});
		} catch {
			/* ignore */
		}
	};

	// Save privacy settings
	const savePrivacySettings = async (field, value) => {
		const token = getToken();
		if (!token) {
			return;
		}
		try {
			await apiRequest("/users/me/profile", {
				method: "PATCH",
				token,
				body: { [field]: value },
			});
		} catch {
			/* ignore */
		}
	};

	// Initial load: only what this instance's tabs show. Every instance used to
	// load all eight groups - and the Owner Dashboard mounts one per section -
	// while a buyer (not an org manager) got none of them: no billing, no
	// sessions, no passkeys, not even the fresh profile.
	const neededLoaders = useMemo(() => {
		const needed = new Set();
		for (const t of accessibleTabs) {
			for (const name of TAB_LOADERS[t.id] || []) {
				if (isOrgManager || !ORG_ONLY_LOADERS.has(name)) needed.add(name);
			}
		}
		// The standalone header shows the verification badge (from billing).
		if (!embedded) needed.add("billing");
		return [...needed].sort().join(",");
	}, [accessibleTabs, isOrgManager, embedded]);

	useEffect(() => {
		const loaders = {
			billing: loadBilling,
			profile: loadUserProfile,
			sessions: loadSessions,
			passkeys: loadPasskeys,
			chatbot: loadChatbotSettings,
			policy: loadCommunicationPolicy,
			faqs: loadFaqs,
			members: loadMembers,
		};
		const names = neededLoaders ? neededLoaders.split(",") : [];
		Promise.allSettled(names.map((name) => loaders[name]?.())).finally(() =>
			setPageLoading(false),
		);
	}, [
		neededLoaders,
		loadBilling,
		loadUserProfile,
		loadSessions,
		loadPasskeys,
		loadChatbotSettings,
		loadCommunicationPolicy,
		loadFaqs,
		loadMembers,
	]);

	// Safety timeout — force-dismiss loading spinner after 10s so the page is never stuck
	useEffect(() => {
		if (!pageLoading) {
			return;
		}
		const timer = setTimeout(() => {
			setPageLoading(false);
			setStatusMessage("Loading timed out. Some data may not be available.");
		}, 10_000);
		return () => clearTimeout(timer);
	}, [pageLoading]);

	const onThemeToggle = toggleTheme;
	const verificationTone =
		verificationStatus === "verified_active"
			? "green"
			: verificationStatus === "expiring_soon"
				? "yellow"
				: "red";

	const bodyTheme = theme === "dark" ? "dark" : "";

	// Lock modal — defined here so it has access to Settings state
	const LockModal = () => {
		if (!lockModalOpen) return null;
		return (
			<div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
				<div class="w-full max-w-md rounded-3xl border border-white/20 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
					{/* Step 1: Warning */}
					{lockStep === 1 && (
						<div class="space-y-4">
							<div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/15">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="28"
									height="28"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									class="text-amber-600 dark:text-amber-400"
								>
									<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
									<path d="M7 11V7a5 5 0 0 1 10 0v4" />
								</svg>
							</div>
							<h3 class="text-center text-lg font-bold text-slate-900 dark:text-white">
								Lock Your Account?
							</h3>
							<p class="text-center text-sm text-slate-600 dark:text-slate-300">
								This will temporarily freeze your account, hide your listings, and prevent new
								messages.
							</p>
							<div class="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
								You can unlock your account at any time by entering your password.
							</div>
							<div class="flex gap-3">
								<button
									onClick={() => setLockModalOpen(false)}
									class="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
								>
									Cancel
								</button>
								<button
									onClick={() => setLockStep(2)}
									class="flex-1 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition hover:bg-amber-600"
								>
									Continue
								</button>
							</div>
						</div>
					)}

					{/* Step 2: Password */}
					{lockStep === 2 && (
						<div class="space-y-4">
							<div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/15">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="28"
									height="28"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									class="text-red-600 dark:text-red-400"
								>
									<rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
									<path d="M7 11V7a5 5 0 0 1 10 0v4" />
								</svg>
							</div>
							<h3 class="text-center text-lg font-bold text-slate-900 dark:text-white">
								Enter Your Password
							</h3>
							<p class="text-center text-sm text-slate-600 dark:text-slate-300">
								Confirm your identity to lock your account.
							</p>
							<input
								type="password"
								value={lockPassword}
								onChange={(e) => setLockPassword(e.target.value)}
								placeholder="Enter your password"
								autoFocus={true}
								class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-400/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
								onKeyDown={(e) => {
									if (e.key === "Enter" && lockPassword.trim()) setLockStep(3);
								}}
							/>
							{lockError && (
								<p class="text-center text-xs text-red-600 dark:text-red-400">{lockError}</p>
							)}
							<div class="flex gap-3">
								<button
									onClick={() => {
										setLockStep(1);
										setLockPassword("");
										setLockError("");
									}}
									class="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
								>
									Back
								</button>
								<button
									onClick={() => {
										if (lockPassword.trim()) setLockStep(3);
									}}
									disabled={!lockPassword.trim()}
									class="flex-1 rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									Verify
								</button>
							</div>
						</div>
					)}

					{/* Step 3: Type confirmation */}
					{lockStep === 3 && (
						<div class="space-y-4">
							<div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/15">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="28"
									height="28"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									class="text-red-600 dark:text-red-400"
								>
									<circle cx="12" cy="12" r="10" />
									<line x1="12" x2="12" y1="8" y2="12" />
									<line x1="12" x2="12.01" y1="16" y2="16" />
								</svg>
							</div>
							<h3 class="text-center text-lg font-bold text-slate-900 dark:text-white">
								Final Confirmation
							</h3>
							<p class="text-center text-sm text-slate-600 dark:text-slate-300">
								Type <span class="font-bold text-red-600 dark:text-red-400">LOCK</span> to confirm
								locking your account.
							</p>
							<input
								type="text"
								value={lockConfirmText}
								onChange={(e) => setLockConfirmText(e.target.value)}
								placeholder='Type "LOCK"'
								autoFocus={true}
								class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-mono uppercase outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-400/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
								onKeyDown={(e) => {
									if (e.key === "Enter" && lockConfirmText.toUpperCase() === "LOCK")
										toggleAccountLock(lockPassword);
								}}
							/>
							{lockError && (
								<p class="text-center text-xs text-red-600 dark:text-red-400">{lockError}</p>
							)}
							<div class="flex gap-3">
								<button
									onClick={() => {
										setLockStep(2);
										setLockConfirmText("");
										setLockError("");
									}}
									class="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
								>
									Back
								</button>
								<button
									onClick={() => {
										if (lockConfirmText.toUpperCase() === "LOCK") toggleAccountLock(lockPassword);
									}}
									disabled={lockConfirmText.toUpperCase() !== "LOCK" || lockingAccount}
									class="flex-1 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{lockingAccount ? "Locking..." : "Lock Account"}
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		);
	};

	if (pageLoading && !embedded) {
		return <NeonAtom fill={true} text="Loading..." timeout={10_000} />;
	}

	const settingsContent = (
		<>
			<LockModal />
			{/* Tab Navigation */}
			{accessibleTabs.length > 1 ? (
			<div
				class="mb-6 overflow-x-auto rounded-[1.75rem] border border-sky-200/60 bg-white/75 p-2 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-950/70"
				style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}
			>
				<div class="flex min-w-max gap-2">
					{accessibleTabs.map((tabItem) => (
						<button
							key={tabItem.id}
							onClick={() => {
								if (tabItem.id === "members") {
									loadMembers();
								}
								goSettingsTab(tabItem.id);
							}}
							class={cx(
								"rounded-2xl px-4 py-3 text-sm font-semibold transition",
								activeTab === tabItem.id
									? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25"
									: "text-slate-600 hover:bg-sky-50 dark:text-slate-300 dark:hover:bg-slate-900",
							)}
						>
							{tabItem.label}
						</button>
					))}
				</div>
			</div>
			) : null}

			{/* Save feedback. The old permanent "Status: Ready." panel with wallet
			    balances is gone - balances live in Subscription & Billing. */}
			{statusMessage && statusMessage !== "Ready." ? (
				<p
					role="status"
					class="mb-6 rounded-2xl border border-sky-200/60 bg-white/80 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200"
				>
					{statusMessage}
				</p>
			) : null}

			{/* Tab Content Sections */}
			{activeTab === "general" && (
				<div class="grid gap-6 lg:grid-cols-2">
					<SectionCard
						title="Automation & Chatbot"
						subtitle="Control buyer conversations, handoff rules, and saved alerts."
					>
						<div class="space-y-4">
							<Toggle
								checked={chatbotEnabled}
								onChange={setChatbotEnabled}
								label="Enable AI Chatbot"
								hint="Answers MOQ, lead time, certifications, then hands off when needed."
							/>
							<Toggle
								checked={autoSaveSearchAlerts}
								onChange={setAutoSaveSearchAlerts}
								label="Auto-save search alerts"
								hint="Automatically creates alerts for matching searches."
							/>
							<div>
								<Label>Handoff mode</Label>
								<Select value={handoffMode} onChange={(e) => setHandoffMode(e.target.value)}>
									<option value="notify_agent">Notify agent / owner</option>
									<option value="notify_owner">Notify owner only</option>
								</Select>
							</div>
						</div>
						<div class="mt-4">
							<PrimaryButton onClick={saveGeneralSettings}>Save settings</PrimaryButton>
						</div>
					</SectionCard>

					<SectionCard
						title="AI Auto-Reply Customization"
						subtitle="Build the tone and structure of your first response."
					>
						<div class="grid gap-4 sm:grid-cols-2">
							<div>
								<Label>Greeting</Label>
								<Input
									value={autoReplyGreeting}
									onChange={(e) => setAutoReplyGreeting(e.target.value)}
								/>
							</div>
							<div>
								<Label>Signature</Label>
								<Input
									value={autoReplySignature}
									onChange={(e) => setAutoReplySignature(e.target.value)}
								/>
							</div>
							<div class="sm:col-span-2">
								<Label>Fallback response</Label>
								<Input
									value={autoReplyFallback}
									onChange={(e) => setAutoReplyFallback(e.target.value)}
								/>
							</div>
							<div>
								<Label>Tone</Label>
								<Select value={autoReplyTone} onChange={(e) => setAutoReplyTone(e.target.value)}>
									<option>Professional</option>
									<option>Warm</option>
									<option>Direct</option>
									<option>Friendly</option>
								</Select>
							</div>
							<div class="sm:col-span-2">
								<Label>Qualification prompt</Label>
								<Textarea
									rows={4}
									value={autoReplyQualification}
									onChange={(e) => setAutoReplyQualification(e.target.value)}
								/>
							</div>
						</div>
						<div class="mt-4 flex flex-wrap gap-3">
							<PrimaryButton onClick={saveChatbotSettings} disabled={!canAutoReply}>
								Save auto-reply settings
							</PrimaryButton>
							<SecondaryButton onClick={saveGeneralSettings}>Save settings</SecondaryButton>
						</div>
					</SectionCard>

					<SectionCard
						title="Communication Policy"
						subtitle="Throttle and prioritize messages with configurable rules."
					>
						<div class="grid gap-4 sm:grid-cols-2">
							<div>
								<Label>Message cap per window</Label>
								<Input
									type="number"
									value={policyMessageCaps}
									onChange={(e) => setPolicyMessageCaps(e.target.value)}
								/>
							</div>
							<div>
								<Label>Window (minutes)</Label>
								<Input
									type="number"
									value={policyWindowMinutes}
									onChange={(e) => setPolicyWindowMinutes(e.target.value)}
								/>
							</div>
							<div>
								<Label>Cooldown (seconds)</Label>
								<Input
									type="number"
									value={policyCooldownSeconds}
									onChange={(e) => setPolicyCooldownSeconds(e.target.value)}
								/>
							</div>
							<div>
								<Label>Strictness mode</Label>
								<Select
									value={policyStrictnessMode}
									onChange={(e) => setPolicyStrictnessMode(e.target.value)}
								>
									<option>Relaxed</option>
									<option>Balanced</option>
									<option>Strict</option>
								</Select>
							</div>
						</div>
						<div class="mt-4">
							<PrimaryButton onClick={saveGeneralSettings}>Save settings</PrimaryButton>
						</div>
					</SectionCard>

					<SectionCard
						title="Supplier Profile"
						subtitle="Show your operations and capabilities clearly."
					>
						<div class="grid gap-4 sm:grid-cols-2">
							<div>
								<Label>Main processes</Label>
								<Input value={mainProcesses} onChange={(e) => setMainProcesses(e.target.value)} />
							</div>
							<div>
								<Label>Years in business</Label>
								<Input
									type="number"
									value={yearsInBusiness}
									onChange={(e) => setYearsInBusiness(e.target.value)}
								/>
							</div>
							<div>
								<Label>Team seats</Label>
								<Input
									type="number"
									value={teamSeats}
									onChange={(e) => setTeamSeats(e.target.value)}
								/>
							</div>
							<div>
								<Label>Export ports</Label>
								<Input value={exportPorts} onChange={(e) => setExportPorts(e.target.value)} />
							</div>
							<div>
								<Label>Location lat/lng</Label>
								<Input
									value={locationLat && locationLng ? `${locationLat}, ${locationLng}` : ""}
									onChange={(e) => {
										const v = e.target.value.split(",");
										setLocationLat(v[0] || "");
										setLocationLng(v[1] || "");
									}}
								/>
							</div>
							<div class="flex items-end">
								<Toggle
									checked={handlesMultipleFactories}
									onChange={setHandlesMultipleFactories}
									label="Handles multiple factories"
								/>
							</div>
						</div>
						<div class="mt-4">
							<PrimaryButton onClick={saveGeneralSettings}>Save settings</PrimaryButton>
						</div>
					</SectionCard>
				</div>
			)}

			{/* ==================== PROFILE TAB ==================== */}
			{activeTab === "profile" && hasRoleAccess(currentUserRole, "observer") && (
				<div class="grid gap-6 lg:grid-cols-2">
					<SectionCard
						title="Privacy"
						subtitle="Who can see your profile. Detailed privacy controls live in the Privacy tab."
						class="lg:col-span-2"
					>
						<div class="max-w-sm">
							<Label>Profile Visibility</Label>
							<Select
								value={profileVisibility}
								onChange={(e) => {
									setProfileVisibility(e.target.value);
									saveVisibility(e.target.value);
								}}
							>
								<option>Public</option>
								<option>Network</option>
								<option>Private</option>
							</Select>
						</div>
					</SectionCard>
					<SectionCard
						title="Profile Section"
						subtitle="Manage how your profile looks to buyers and partners."
					>
						<div class="grid gap-4 sm:grid-cols-2">
							<div>
								<Label>Organization Name</Label>
								{(() => {
									// Enforced by the API too (90-day lock; verified = re-verify).
									const changedAt = orgNameChangedAt;
									const locked = changedAt > 0 && Date.now() - changedAt < 90 * 24 * 3600 * 1000;
									const verified =
										String(verification?.status || "").toLowerCase() === "verified" ||
										verification?.verified === true;
									if (verified) {
										return (
											<p class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
												Verified account — name changes require re-uploading Trade License and
												documents.{" "}
												<button
													type="button"
													onClick={() => goSettingsTab("verification")}
													class="font-semibold underline"
												>
													Go to Verification
												</button>
											</p>
										);
									}
									if (locked) {
										return (
											<p class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
												Name locked — organization name can be changed again after 90 days of the
												last change.
											</p>
										);
									}
									return (
										<Input
											value={profileDisplayName}
											onChange={(e) => setProfileDisplayName(e.target.value)}
										/>
									);
								})()}
							</div>
							<div>
								<Label>Headline</Label>
								<Input
									value={profileHeadline}
									onChange={(e) => setProfileHeadline(e.target.value)}
								/>
							</div>
							<div>
								<Label>Country</Label>
								<select
									value={profileCountry}
									onChange={(e) => setProfileCountry(e.target.value)}
									class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
								>
									<option value="">Select country</option>
									{COUNTRY_OPTIONS.map((c) => (
										<option key={c} value={c}>
											{c}
										</option>
									))}
								</select>
							</div>
							<div>
								<Label>Industry</Label>
								<select
									value={profileIndustry}
									onChange={(e) => setProfileIndustry(e.target.value)}
									class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
								>
									<option value="">Select industry</option>
									{FACTORY_SECTOR_OPTIONS.map((opt) => (
										<option key={opt.value} value={opt.value}>
											{opt.label}
										</option>
									))}
								</select>
							</div>
							<div class="sm:col-span-2">
								<Label>Bio</Label>
								<Textarea
									rows={4}
									value={profileBio}
									onChange={(e) => setProfileBio(e.target.value)}
								/>
							</div>
							<div class="sm:col-span-2">
								<Label>Profile Image</Label>
								<ProfileImageUpload
									value={profileAvatarUrl}
									onChange={setProfileAvatarUrl}
									label="Profile Image"
								/>
							</div>
							<div class="sm:col-span-2">
								<Label>Cover Image</Label>
								<p class="mb-2 text-xs text-slate-500 dark:text-slate-400">
									Banner displayed at the top of your profile
								</p>
								<ProfileImageUpload
									value={profileCoverUrl}
									onChange={setProfileCoverUrl}
									label="Cover Image"
								/>
							</div>
						</div>
						<div class="mt-4 flex gap-3">
							<PrimaryButton onClick={saveProfileSettings} disabled={loadingProfile}>
								{loadingProfile ? (
									<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
								) : (
									"Save Profile"
								)}
							</PrimaryButton>
						</div>
					</SectionCard>

					<SectionCard title="Contact" subtitle="Edit contact details.">
						<div class="space-y-4">
							<div>
								<Label>Email</Label>
								<Input value={profileEmail} readOnly={true} class="cursor-not-allowed opacity-90" />
							</div>
							<div>
								<Label>Phone</Label>
								<Input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} />
							</div>
							<PrimaryButton onClick={saveContactSettings}>Save Contact</PrimaryButton>
						</div>
					</SectionCard>

					<SectionCard
						title="Data & Account Control"
						subtitle="Export data, review sessions, and remove the account securely."
					>
						<div class="space-y-4">
							<div class="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-4 dark:border-amber-800/40 dark:bg-amber-950/20">
								<div class="flex items-center justify-between">
									<div>
										<div class="text-sm font-medium text-amber-800 dark:text-amber-200">
											Account Lock
										</div>
										<div class="text-xs text-amber-700 dark:text-amber-300">
											Temporarily freeze your account and hide listings
										</div>
									</div>
									<button
										onClick={() => {
											if (accountLocked) {
												toggleAccountLock();
											} else {
												resetLockModal();
												setLockModalOpen(true);
											}
										}}
										disabled={lockingAccount}
										class="rounded-full border border-amber-200 bg-white px-4 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60"
									>
										{lockingAccount ? "Processing..." : accountLocked ? "Unlock" : "Lock Now"}
									</button>
								</div>
							</div>
							<SecondaryButton onClick={exportUserData} disabled={exportingData}>
								{exportingData ? "Preparing..." : "Download My Data"}
							</SecondaryButton>
							{exportFeedback && <p class="text-sm text-slate-500">{exportFeedback}</p>}
							<div>
								<Label>Type your name to confirm</Label>
								<Input
									value={deleteConfirmText}
									onChange={(e) => setDeleteConfirmText(e.target.value)}
									placeholder={profileDisplayName}
								/>
							</div>
							<PrimaryButton
								onClick={deleteAccount}
								disabled={deletingProfile || deleteConfirmText !== profileDisplayName}
							>
								{deletingProfile ? "Deleting..." : "Delete My Account"}
							</PrimaryButton>
							{deleteProfileFeedback && <p class="text-sm text-red-600">{deleteProfileFeedback}</p>}
							<div>
								<div class="mb-3 flex items-center justify-between">
									<div>
										<div class="font-semibold text-slate-900 dark:text-white">Active Sessions</div>
										<div class="text-sm text-slate-500 dark:text-slate-400">
											Reload, inspect, and revoke sessions.
										</div>
									</div>
									<SecondaryButton onClick={loadSessions}>Refresh</SecondaryButton>
								</div>
								<div class="space-y-3">
									{loadingSessions ? (
										<Mosaic
											color="#337ab0"
											size="large"
											style={{ fontSize: "40px" }}
											text=""
											textColor=""
										/>
									) : sessions.length === 0 ? (
										<p class="text-sm text-slate-500">No active sessions.</p>
									) : (
										sessions.map((session) => (
											<div
												key={session.id || session.token}
												class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"
											>
												<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
													<div>
														<div class="flex flex-wrap items-center gap-2">
															<div class="font-medium text-slate-900 dark:text-white">
																{session.device || session.browser || "Unknown"}
															</div>
															{session.current && <Badge tone="green">Current</Badge>}
														</div>
														<div class="mt-1 text-sm text-slate-500 dark:text-slate-400">
															{[
																session.ip,
																session.auth_method === "passkey" ? "Passkey" : "",
																session.last_active
																	? `Active ${new Date(session.last_active).toLocaleString()}`
																	: "",
															]
																.filter(Boolean)
																.join(" · ")}
														</div>
													</div>
													{!session.current && (
														<SecondaryButton
															onClick={() => revokeSession(session.id || session.token)}
															disabled={revokingSession === (session.id || session.token)}
														>
															Revoke
														</SecondaryButton>
													)}
												</div>
											</div>
										))
									)}
								</div>
							</div>
						</div>
					</SectionCard>
					<div class="lg:col-span-2">
						<OfflineStorageSection />
					</div>
				</div>
			)}

			{/* ==================== THEME TAB ==================== */}
			{activeTab === "theme" && hasRoleAccess(currentUserRole, "viewer") && (
				<div class="grid gap-6 lg:grid-cols-2">
					<SectionCard title="Appearance" subtitle="Customize how GarTexHub looks for you.">
						<div class="space-y-4">
							<div>
								<Label>Theme Mode</Label>
								<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
									Choose your preferred color scheme.
								</p>
								<div class="mt-3 grid grid-cols-3 gap-3">
									<button
										onClick={() => setTheme("light")}
										class={cx(
											"flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-sm font-medium transition",
											themeMode === "light"
												? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300"
												: "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500",
										)}
									>
										<Sun class="h-6 w-6" />
										Light
									</button>
									<button
										onClick={() => setTheme("dark")}
										class={cx(
											"flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-sm font-medium transition",
											themeMode === "dark"
												? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300"
												: "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500",
										)}
									>
										<Moon class="h-6 w-6" />
										Dark
									</button>
									<button
										onClick={() => setTheme("system")}
										class={cx(
											"flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-sm font-medium transition",
											themeMode === "system"
												? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300"
												: "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500",
										)}
									>
										<Monitor class="h-6 w-6" />
										System
									</button>
								</div>
							</div>
							<div class="flex items-center gap-3 pt-2">
								<PrimaryButton
									onClick={() => {
										setTheme(themeMode);
										save("Theme preference saved.");
									}}
								>
									Save Theme
								</PrimaryButton>
								<span class="text-sm text-slate-500 dark:text-slate-400">
									Current: <strong class="capitalize">{themeMode}</strong> mode
								</span>
							</div>
						</div>
					</SectionCard>
				</div>
			)}

			{/* ==================== PRIVACY TAB ==================== */}
			{activeTab === "privacy" && hasRoleAccess(currentUserRole, "observer") && (
				<div class="grid gap-6 lg:grid-cols-2">
					<SectionCard
						title="Profile Visibility"
						subtitle="Control who can see your profile and information."
					>
						<div class="space-y-4">
							<div>
								<Label>Profile Visibility</Label>
								<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
									Controls who can view your company profile and product listings.
								</p>
							</div>
							<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
								<div class="flex items-center justify-between">
									<div>
										<div class="text-sm font-medium text-slate-900 dark:text-white">
											Search Engine Indexing
										</div>
										<div class="text-xs text-slate-500 dark:text-slate-400">
											Allow search engines to index your public profile
										</div>
									</div>
									<input
										type="checkbox"
										class="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
										checked={searchIndexing}
										onChange={(e) => {
											setSearchIndexing(e.target.checked);
											savePrivacySettings("search_indexing", e.target.checked);
										}}
									/>
								</div>
							</div>
						</div>
					</SectionCard>

					<SectionCard
						title="Contact Privacy"
						subtitle="Control what contact details appear on your public profile."
					>
						<div class="space-y-4">
							<div class="flex items-center justify-between rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
								<div>
									<div class="text-sm font-medium text-slate-900 dark:text-white">Hide Email</div>
									<div class="text-xs text-slate-500 dark:text-slate-400">
										Don't show your email on your public profile
									</div>
								</div>
								<input
									type="checkbox"
									class="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
									checked={hideEmail}
									onChange={(e) => {
										setHideEmail(e.target.checked);
										savePrivacySettings("hide_email", e.target.checked);
									}}
								/>
							</div>
							<div class="flex items-center justify-between rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
								<div>
									<div class="text-sm font-medium text-slate-900 dark:text-white">Hide Phone</div>
									<div class="text-xs text-slate-500 dark:text-slate-400">
										Don't show your phone number on your public profile
									</div>
								</div>
								<input
									type="checkbox"
									class="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
									checked={hidePhone}
									onChange={(e) => {
										setHidePhone(e.target.checked);
										savePrivacySettings("hide_phone", e.target.checked);
									}}
								/>
							</div>
							<div class="rounded-2xl border border-slate-200 bg-amber-50 p-4 dark:border-slate-700 dark:bg-amber-500/10">
								<p class="text-sm font-medium text-amber-800 dark:text-amber-200">
									Contact info is private by default
								</p>
								<p class="mt-1 text-xs text-amber-700 dark:text-amber-300">
									All communication happens through the platform chat system to ensure security and
									traceability.
								</p>
							</div>
						</div>
					</SectionCard>

					<SectionCard title="Data & Sharing" subtitle="Manage how your data is used and shared.">
						<div class="space-y-4">
							<div class="flex items-center justify-between rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
								<div>
									<div class="text-sm font-medium text-slate-900 dark:text-white">
										Activity status
									</div>
									<div class="text-xs text-slate-500 dark:text-slate-400">
										Show when you are online or recently active
									</div>
								</div>
								<input
									type="checkbox"
									class="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
									checked={showActivityStatus}
									onChange={(e) => {
										setShowActivityStatus(e.target.checked);
										savePrivacySettings("show_activity", e.target.checked);
									}}
								/>
							</div>
						</div>
					</SectionCard>
				</div>
			)}

			{/* ==================== VERIFICATION TAB ==================== */}
			{activeTab === "verification" && hasRoleAccess(currentUserRole, "factory") && (
				<div class="grid gap-6 lg:grid-cols-2">
					<SectionCard
						title="Verification Status"
						subtitle="Track status and renew before expiration."
					>
						<div class="flex flex-wrap items-center gap-3">
							<Badge tone={verificationTone}>
								{verificationStatus === "verified_active"
									? "Verified Active"
									: verificationStatus === "expiring_soon"
										? "Expiring Soon"
										: "Expired"}
							</Badge>
							<Badge tone="sky">{remainingDays} days remaining</Badge>
						</div>
						<div class="mt-4 grid gap-4 sm:grid-cols-2">
							<div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
								<div class="text-xs text-slate-500 dark:text-slate-400">Wallet balance</div>
								<div class="mt-1 text-2xl font-black text-slate-900 dark:text-white">
									${walletBalance.toFixed(2)}
								</div>
							</div>
							<div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
								<div class="text-xs text-slate-500 dark:text-slate-400">Restricted balance</div>
								<div class="mt-1 text-2xl font-black text-slate-900 dark:text-white">
									${walletRestricted.toFixed(2)}
								</div>
							</div>
						</div>
						<div class="mt-4 flex flex-wrap gap-3">
							<SecondaryButton onClick={() => navigate("/verification")}>
								Open Verification Center
							</SecondaryButton>
							<PrimaryButton onClick={renewVerification} disabled={renewingVerification}>
								{renewingVerification ? "Processing..." : "Renew verification"}
							</PrimaryButton>
						</div>
					</SectionCard>

					<SectionCard
						title="Missing Documents"
						subtitle="Upload these items to complete verification."
					>
						<div class="space-y-3">
							{verification?.missing_required?.length > 0 ? (
								verification.missing_required.slice(0, 6).map((doc) => (
									<div
										key={doc}
										class="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
									>
										<span>{doc}</span>
										<span class="text-xs font-semibold">Required</span>
									</div>
								))
							) : (
								<div class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
									All verification documents have been uploaded.
								</div>
							)}
						</div>
					</SectionCard>
				</div>
			)}

			{/* ==================== SECURITY TAB ==================== */}
			{activeTab === "security" && hasRoleAccess(currentUserRole, "factory") && (
				<div class="grid gap-6 lg:grid-cols-2">
					<SectionCard
						title="Password & Security"
						subtitle="Change password and keep account access protected."
					>
						<div class="grid gap-4 sm:grid-cols-2">
							<div class="sm:col-span-2">
								<Badge tone={totpEnabled ? "green" : "red"}>
									2FA {totpEnabled ? "Enabled" : "Disabled"}
								</Badge>
							</div>
							<div>
								<Label>Current password</Label>
								<Input
									type="password"
									value={currentPassword}
									onChange={(e) => setCurrentPassword(e.target.value)}
								/>
							</div>
							<div>
								<Label>New password</Label>
								<Input
									type="password"
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
								/>
							</div>
							<div class="sm:col-span-2">
								<Label>Confirm new password</Label>
								<Input
									type="password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
								/>
							</div>
						</div>
						<div class="mt-4 flex flex-wrap gap-3">
							<PrimaryButton onClick={changePassword} disabled={changingPassword}>
								{changingPassword ? "Changing..." : "Change Password"}
							</PrimaryButton>
						</div>
						{passwordFeedback && (
							<p
								class={`mt-2 text-sm ${passwordFeedback.includes("success") ? "text-green-600" : "text-red-600"}`}
							>
								{passwordFeedback}
							</p>
						)}
					</SectionCard>
					<SectionCard
						title="Security Keys (WebAuthn)"
						subtitle="Register hardware security keys or biometric authenticators for passwordless sign-in."
					>
						<p class="mb-3 text-sm text-slate-500 dark:text-slate-400">
							Security keys use your device's built-in authenticator (fingerprint, face recognition,
							or a physical USB key) to verify your identity instead of a password. They are
							phishing-resistant and more secure than SMS codes.
						</p>
						<div class="space-y-3">
							{passkeys.map((p) => (
								<div
									key={p.id}
									class="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"
								>
									<div>
										<div class="font-medium text-slate-900 dark:text-white">{p.name}</div>
										<div class="text-sm text-slate-500 dark:text-slate-400">
											Created {p.created_at || p.createdAt}
										</div>
									</div>
									<SecondaryButton
										onClick={() => {
											setPasskeys((x) => x.filter((i) => i.id !== p.id));
											save(`Security key "${p.name}" removed.`);
										}}
									>
										Remove
									</SecondaryButton>
								</div>
							))}
						</div>
						<div class="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
							<Input
								value={passkeyName}
								onChange={(e) => setPasskeyName(e.target.value)}
								placeholder="Name this security key (e.g. YubiKey, Touch ID)"
							/>
							<PrimaryButton onClick={addPasskey}>Add Security Key</PrimaryButton>
						</div>
						{passkeyError && <p class="mt-2 text-sm text-red-600">{passkeyError}</p>}
					</SectionCard>

					<SectionCard
						title="Active Sessions"
						subtitle="See live sessions and revoke access quickly."
					>
						<div class="space-y-3">
							{loadingSessions ? (
								<Mosaic
									color="#337ab0"
									size="large"
									style={{ fontSize: "40px" }}
									text=""
									textColor=""
								/>
							) : sessions.length === 0 ? (
								<p class="text-sm text-slate-500">No sessions.</p>
							) : (
								sessions.map((session) => (
									<div
										key={session.id || session.token}
										class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"
									>
										<div class="flex items-start justify-between gap-4">
											<div>
												<div class="flex items-center gap-2">
													<div class="font-medium text-slate-900 dark:text-white">
														{session.device || session.browser || "Unknown"}
													</div>
													{session.current && <Badge tone="green">Current</Badge>}
												</div>
												<div class="mt-1 text-sm text-slate-500 dark:text-slate-400">
													{[
														session.ip,
														session.auth_method === "passkey" ? "Passkey" : "",
														session.last_active
															? `Active ${new Date(session.last_active).toLocaleString()}`
															: "",
													]
														.filter(Boolean)
														.join(" · ")}
												</div>
											</div>
											{!session.current && (
												<SecondaryButton onClick={() => revokeSession(session.id || session.token)}>
													Revoke
												</SecondaryButton>
											)}
										</div>
									</div>
								))
							)}
						</div>
					</SectionCard>

					<SectionCard title="Account Lock" subtitle="Temporarily restrict access to your account.">
						<div class="space-y-4">
							<div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
								<div class="flex items-start gap-3">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="20"
										height="20"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
										class="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
									>
										<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
										<path d="M7 11V7a5 5 0 0 1 10 0v4" />
									</svg>
									<div>
										<div class="text-sm font-medium text-amber-800 dark:text-amber-200">
											Lock your account
										</div>
										<div class="mt-1 text-xs text-amber-700 dark:text-amber-300">
											This will temporarily freeze your account, hide your listings, and prevent new
											messages. You can unlock at any time.
										</div>
									</div>
								</div>
							</div>
							<div class="flex items-center justify-between rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
								<div>
									<div class="text-sm font-medium text-slate-900 dark:text-white">
										Account status
									</div>
									<div class="text-xs text-slate-500 dark:text-slate-400">
										Currently{" "}
										{accountLocked
											? "locked — features limited"
											: "active — all features available"}
									</div>
								</div>
								<button
									onClick={() => {
										if (accountLocked) {
											toggleAccountLock();
										} else {
											resetLockModal();
											setLockModalOpen(true);
										}
									}}
									disabled={lockingAccount}
									class="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60"
								>
									{lockingAccount
										? "Processing..."
										: accountLocked
											? "Unlock Account"
											: "Lock Account"}
								</button>
							</div>
						</div>
					</SectionCard>
				</div>
			)}

			{/* ==================== BRANDING TAB ==================== */}
			{activeTab === "branding" && hasRoleAccess(currentUserRole, "factory") && (
				<div class="grid gap-6 lg:grid-cols-2">
					<SectionCard
						title="Brand Identity"
						subtitle="Set your brand name, logo, website, and tone."
					>
						<div class="grid gap-4 sm:grid-cols-2">
							<div>
								<Label>Brand name</Label>
								<Input
									value={brandName}
									onChange={(e) => setBrandName(e.target.value)}
									disabled={!canBranding}
								/>
							</div>
							<div class="sm:col-span-2">
								<Label>Logo Image</Label>
								<input
									ref={logoInputRef}
									type="file"
									accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/apng,image/bmp,image/x-ms-bmp,image/tiff,image/heic,image/heif,image/svg+xml,image/x-tga,image/vnd.adobe.photoshop,image/x-photoshop,image/x-xcf,image/x-coreldraw,image/x-adobe-dng,image/x-canon-cr2,image/x-canon-cr3,image/x-nikon-nef,image/x-sony-arw,image/x-sony-sr2,image/x-olympus-orf,image/x-fuji-raf,image/x-eps,application/postscript,application/pdf,application/dicom,application/x-coreldraw,.jpg,.jpeg,.png,.webp,.avif,.gif,.apng,.bmp,.tiff,.tif,.heic,.heif,.dcm,.tga,.svg,.eps,.pdf,.dng,.cr2,.cr3,.nef,.arw,.sr2,.orf,.raf,.psd,.ai,.xcf,.cdr"
									onChange={handleLogoUpload}
									disabled={!canBranding || logoUploading}
									class="hidden"
								/>
								<div class="flex items-center gap-4">
									<button
										type="button"
										onClick={() => logoInputRef.current?.click()}
										disabled={!canBranding || logoUploading}
										class="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
									>
										{logoUploading ? (
											<ThreeDot
												variant="bounce"
												color="#337ab0"
												size="small"
												text=""
												textColor=""
											/>
										) : (
											"Choose Image"
										)}
									</button>
									{logoUploading && (
										<UploadProgressBar progress={logoUploadProgress} class="w-40" />
									)}
									{brandLogoUrl && <span class="text-sm text-slate-500">Logo set</span>}
								</div>
								{brandLogoUrl && (
									<div class="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 w-20 h-20">
										<LazyImage
											src={brandLogoUrl}
											alt="Logo preview"
											width={80}
											height={80}
											class="w-full h-full object-contain"
										/>
									</div>
								)}
							</div>
							<div class="sm:col-span-2">
								<Label>Banner / Cover Image</Label>
								<input
									ref={bannerInputRef}
									type="file"
									accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/apng,image/bmp,image/x-ms-bmp,image/tiff,image/heic,image/heif,image/svg+xml,image/x-tga,image/vnd.adobe.photoshop,image/x-photoshop,image/x-xcf,image/x-coreldraw,image/x-adobe-dng,image/x-canon-cr2,image/x-canon-cr3,image/x-nikon-nef,image/x-sony-arw,image/x-sony-sr2,image/x-olympus-orf,image/x-fuji-raf,image/x-eps,application/postscript,application/pdf,application/dicom,application/x-coreldraw,.jpg,.jpeg,.png,.webp,.avif,.gif,.apng,.bmp,.tiff,.tif,.heic,.heif,.dcm,.tga,.svg,.eps,.pdf,.dng,.cr2,.cr3,.nef,.arw,.sr2,.orf,.raf,.psd,.ai,.xcf,.cdr"
									onChange={handleBannerUpload}
									disabled={!canBranding || bannerUploading}
									class="hidden"
								/>
								<div class="flex items-center gap-4">
									<button
										type="button"
										onClick={() => bannerInputRef.current?.click()}
										disabled={!canBranding || bannerUploading}
										class="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
									>
										{bannerUploading ? (
											<ThreeDot
												variant="bounce"
												color="#337ab0"
												size="small"
												text=""
												textColor=""
											/>
										) : (
											"Choose Image"
										)}
									</button>
									{bannerUploading && (
										<UploadProgressBar progress={bannerUploadProgress} class="w-40" />
									)}
									{brandCoverUrl && <span class="text-sm text-slate-500">Banner set</span>}
								</div>
								{brandCoverUrl && (
									<div class="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
										<LazyImage
											src={brandCoverUrl}
											alt="Banner preview"
											width={1200}
											height={400}
											class="h-32 w-full object-cover"
										/>
									</div>
								)}
							</div>
							<div>
								<Label>Accent style</Label>
								<Select
									value={brandAccent}
									onChange={(e) => setBrandAccent(e.target.value)}
									disabled={!canBranding}
								>
									<option>Sky Blue</option>
									<option>Ocean</option>
									<option>Classic Navy</option>
								</Select>
							</div>
							<div>
								<Label>Tagline</Label>
								<Input
									value={brandTagline}
									onChange={(e) => setBrandTagline(e.target.value)}
									disabled={!canBranding}
								/>
							</div>
						</div>
						<div class="mt-4 flex gap-3">
							<PrimaryButton onClick={saveBrandingSettings} disabled={!canBranding}>
								Save Branding
							</PrimaryButton>
						</div>
					</SectionCard>
					<SectionCard title="Brand Preview" subtitle="A preview of your brand identity.">
						<div class="rounded-[2rem] bg-gradient-to-br from-sky-500 via-blue-600 to-cyan-400 p-6 text-white shadow-2xl">
							<div class="flex items-center gap-4">
								<div class="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/20 text-2xl font-black backdrop-blur">
									{brandName.slice(0, 1).toUpperCase()}
								</div>
								<div>
									<div class="text-2xl font-black">{brandName}</div>
									<div class="text-sm text-white/85">{brandTagline}</div>
								</div>
							</div>
						</div>
					</SectionCard>
				</div>
			)}

			{/* ==================== SUBSCRIPTION TAB ==================== */}
			{activeTab === "subscription" && hasRoleAccess(currentUserRole, "factory") && (
				<div class="grid gap-6 lg:grid-cols-2">
					<SectionCard title="Current Plan" subtitle="Track plan level and billing status.">
						<div class="rounded-[1.75rem] bg-gradient-to-br from-sky-500 via-blue-600 to-cyan-400 p-6 text-white shadow-2xl">
							<div class="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">
								Plan
							</div>
							<div class="mt-2 text-3xl font-black">
								{subscriptionPlan === "free"
									? "Free"
									: subscriptionPlan === "premium"
										? "Premium"
										: "Enterprise"}
							</div>
							<div class="mt-2 text-white/85">
								{subscriptionPlan === "free" ? "Limited features" : `$${planPrice} / month`}
							</div>
							{subscriptionPlan !== "free" && remainingDays > 0 && (
								<div class="mt-2 text-sm text-white/70">
									{remainingDays} day{remainingDays === 1 ? "" : "s"} remaining
								</div>
							)}
							<div class="mt-5 flex flex-wrap gap-3">
								{premiumPricing?.next_charge_usd ? (
									<SecondaryButton
										class="border-white/20 bg-white/15 text-white hover:bg-white/25"
										onClick={upgradePremium}
										disabled={upgradingPremium || walletShortfall > 0}
									>
										{upgradingPremium
											? "Processing..."
											: `${subscriptionPlan === "premium" ? "Extend 30 days" : "Upgrade to Premium"} · $${Number(premiumPricing.next_charge_usd).toFixed(2)}`}
									</SecondaryButton>
								) : null}
								{subscriptionPlan !== "free" && (
									<SecondaryButton
										class="border-red-300/30 bg-red-500/20 text-red-100 hover:bg-red-500/30"
										onClick={cancelSubscription}
										disabled={cancellingSubscription}
									>
										{cancellingSubscription ? "Cancelling..." : "Cancel Subscription"}
									</SecondaryButton>
								)}
								<SecondaryButton
									class="border-white/20 bg-white/15 text-white hover:bg-white/25"
									onClick={() => navigate("/pricing")}
								>
									View plans
								</SecondaryButton>
							</div>
							{walletShortfall > 0 ? (
								<p class="mt-3 text-sm text-white/85">
									Add at least ${walletShortfall.toFixed(2)} to your wallet to{" "}
									{subscriptionPlan === "premium" ? "extend Premium" : "upgrade to Premium"}.
								</p>
							) : null}
							{billingFeedback && <p class="mt-3 text-sm text-white/90">{billingFeedback}</p>}
						</div>
					</SectionCard>
					<SectionCard title="Wallet" subtitle="Funds available for boosts and billing.">
						<div class="grid gap-4 sm:grid-cols-2">
							<div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
								<div class="text-xs text-slate-500">Balance</div>
								<div class="mt-1 text-2xl font-black">${walletBalance.toFixed(2)}</div>
							</div>
							<div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
								<div class="text-xs text-slate-500">Restricted</div>
								<div class="mt-1 text-2xl font-black">${walletRestricted.toFixed(2)}</div>
							</div>
						</div>
						<div class="mt-4">
							<PrimaryButton onClick={addFunds} disabled={addingFunds}>
								{addingFunds ? "Processing..." : "Add funds"}
							</PrimaryButton>
						</div>
					</SectionCard>
				</div>
			)}

			{/* ==================== MEMBERS TAB ==================== */}
			{activeTab === "members" && hasRoleAccess(currentUserRole, "factory") && (
				<div class="grid gap-6 lg:grid-cols-2">
					<SectionCard title="Team Members" subtitle="Manage your team.">
						<div class="space-y-3">
							{members.length === 0 ? (
								<p class="text-sm text-slate-500">No team members yet.</p>
							) : (
								members.map((member) => (
									<div
										key={member.id}
										class="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"
									>
										<div>
											<div class="font-medium text-slate-900 dark:text-white">
												{member.name || member.email}
											</div>
											<div class="text-sm text-slate-500 dark:text-slate-400">{member.email}</div>
										</div>
										<div class="flex items-center gap-3">
											<Badge tone="sky">{member.role}</Badge>
											<Badge tone={member.status === "active" ? "green" : "yellow"}>
												{member.status || "active"}
											</Badge>
											{member.status === "active" ? (
												<SecondaryButton onClick={() => removeMember(member.id)}>
													Remove
												</SecondaryButton>
											) : (
												<SecondaryButton onClick={() => reactivateMember(member.id)}>
													Reactivate
												</SecondaryButton>
											)}
										</div>
									</div>
								))
							)}
						</div>
					</SectionCard>
					<SectionCard title="Invite Members" subtitle="Add teammates by email and role.">
						<div class="grid gap-4">
							<div>
								<Label>Email</Label>
								<Input
									value={memberInviteEmail}
									onChange={(e) => setMemberInviteEmail(e.target.value)}
									placeholder="team@company.com"
								/>
							</div>
							<div>
								<Label>Role</Label>
								<Select
									value={memberInviteRole}
									onChange={(e) => setMemberInviteRole(e.target.value)}
								>
									<option>Owner</option>
									<option>Admin</option>
									<option>Manager</option>
									<option>Editor</option>
									<option>Viewer</option>
								</Select>
							</div>
							<PrimaryButton onClick={inviteMember} disabled={invitingMember}>
								{invitingMember ? "Inviting..." : "Add member"}
							</PrimaryButton>
							{memberFeedback && (
								<p
									class={`text-sm ${memberFeedback.includes("success") ? "text-green-600" : "text-red-600"}`}
								>
									{memberFeedback}
								</p>
							)}
						</div>
					</SectionCard>
				</div>
			)}

			{/* ==================== BOOSTS TAB ==================== */}
			{activeTab === "boosts" && hasRoleAccess(currentUserRole, "manager") && (
				<div class="grid gap-6 lg:grid-cols-2">
					<SectionCard title="Boost Management" subtitle="Create and manage visibility boosts.">
						<div class="space-y-4">
							<div class="grid gap-3">
								<div>
									<Label>Scope</Label>
									<Select value={boostScope} onChange={(e) => setBoostScope(e.target.value)}>
										<option value="feed">Feed</option>
										<option value="search">Search</option>
									</Select>
								</div>
								<div>
									<Label>Duration</Label>
									<Select value={boostDuration} onChange={(e) => setBoostDuration(e.target.value)}>
										<option value="7">7 days</option>
										<option value="14">14 days</option>
										<option value="30">30 days</option>
									</Select>
								</div>
								<div>
									<Label>Multiplier</Label>
									<Input
										type="number"
										step="0.1"
										value={boostMultiplier}
										onChange={(e) => setBoostMultiplier(e.target.value)}
									/>
								</div>
								<div>
									<Label>Price ($)</Label>
									<Input
										type="number"
										step="0.01"
										value={boostPrice}
										onChange={(e) => setBoostPrice(e.target.value)}
									/>
								</div>
							</div>
							<PrimaryButton onClick={createBoost} disabled={creatingBoost}>
								{creatingBoost ? "Creating..." : "Create Boost"}
							</PrimaryButton>
							{boostFeedback && (
								<p
									class={`text-sm ${boostFeedback.includes("success") ? "text-green-600" : "text-red-600"}`}
								>
									{boostFeedback}
								</p>
							)}
							{loadingBoosts ? (
								<div class="flex justify-center py-4">
									<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
								</div>
							) : boosts.length > 0 ? (
								<div class="space-y-2">
									<p class="text-sm font-medium text-slate-700 dark:text-slate-300">
										Existing Boosts
									</p>
									{boosts.map((b) => (
										<div
											key={b.id}
											class="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900"
										>
											<div class="space-y-1">
												<p class="font-medium text-slate-900 dark:text-white">
													{b.scope} — {b.duration_days || b.duration}d
												</p>
												<p class="text-slate-500">
													×{b.multiplier} · ${b.price_usd || b.price}
												</p>
											</div>
											<span
												class={cx(
													"rounded-full px-3 py-1 text-xs font-medium",
													b.status === "active"
														? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
														: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
												)}
											>
												{b.status || "pending"}
											</span>
										</div>
									))}
								</div>
							) : null}
						</div>
					</SectionCard>
				</div>
			)}

			{/* ==================== NOTIFICATIONS TAB ==================== */}
			{activeTab === "notifications" && <NotificationPreferencesTab />}

			{/* ==================== ASSISTANT KNOWLEDGE TAB ==================== */}
			{activeTab === "assistant_knowledge" && hasRoleAccess(currentUserRole, "manager") && (
				<div class="grid gap-6 lg:grid-cols-2">
					<SectionCard title="Assistant Knowledge" subtitle="Manage FAQ entries used by the bot.">
						<div class="space-y-3">
							{entries.length === 0 ? (
								<p class="text-sm text-slate-500">No FAQ entries yet.</p>
							) : (
								entries.map((entry) => (
									<div
										key={entry.id}
										class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"
									>
										{entry.question}
									</div>
								))
							)}
						</div>
					</SectionCard>
					<SectionCard title="Add FAQ" subtitle="Expand the assistant with new answers.">
						<Label>Question</Label>
						<Textarea
							rows={4}
							value={knowledgeForm.question}
							onChange={(e) =>
								setKnowledgeForm((f) => ({
									...f,
									question: e.target.value,
								}))
							}
							placeholder="Example: What is your MOQ?"
						/>
						<div class="mt-4">
							{faqFeedback && (
								<p
									class={`text-sm ${faqFeedback.includes("success") ? "text-green-600" : "text-red-600"}`}
								>
									{faqFeedback}
								</p>
							)}
							<PrimaryButton
								onClick={async () => {
									if (!knowledgeForm.question.trim()) {
										return;
									}
									const token = getToken();
									if (!token) {
										return;
									}
									try {
										const data = await apiRequest("/assistant/knowledge", {
											method: "POST",
											token,
											body: {
												type: knowledgeForm.type,
												question: knowledgeForm.question,
												answer: knowledgeForm.answer,
												keywords: knowledgeForm.keywords.split(",").map((k) => k.trim()),
											},
										});
										setEntries((prev) => [data?.entry || data, ...prev]);
										setKnowledgeForm({
											type: "faq",
											question: "",
											answer: "",
											keywords: "",
										});
										setFaqFeedback("FAQ added successfully.");
										save("FAQ added.");
									} catch (err) {
										setFaqFeedback(err.message || "Failed to add FAQ entry");
									}
								}}
							>
								Add FAQ
							</PrimaryButton>
						</div>
					</SectionCard>
				</div>
			)}

			{!isOrgManager && ORG_ONLY_TABS.has(activeTab) && (
				<div class="rounded-xl bg-red-50 p-4 text-red-600">
					You do not have permission to view organization settings.
				</div>
			)}
		</>
	);

	if (embedded) {
		return (
			<div data-lenis-prevent={true} class="space-y-6">
				{settingsContent}
			</div>
		);
	}

	return (
		<div
			class={cx(
				bodyTheme,
				"min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[var(--theme-custom-07111f)] dark:text-white",
			)}
		>
			<div class="absolute inset-0 -z-10 overflow-hidden">
				<div class="absolute -left-24 top-0 h-72 w-72 rounded-full bg-sky-400/25 blur-3xl" />
				<div class="absolute right-0 top-20 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
				<div class="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
			</div>

			<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				{/* Header */}
				<div class="mb-6 flex flex-col gap-4 rounded-[2rem] border border-sky-200/70 bg-white/80 p-5 shadow-[0_24px_80px_-35px_rgba(32,101,152,0.6)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/70 lg:flex-row lg:items-center lg:justify-between">
					<div class="flex items-center gap-4">
						<Icon>
							<SettingsIcon className="h-5 w-5" />
						</Icon>
						<div>
							<div class="flex flex-wrap items-center gap-2">
								<h1 class="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
									Settings
								</h1>
								<Badge tone="sky">Account</Badge>
							</div>
							<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
								Manage your profile, appearance, security, verification, and notifications.
							</p>
						</div>
					</div>
					<div class="flex flex-wrap items-center gap-3">
						<Badge tone={verificationTone}>
							{verificationStatus === "verified_active"
								? "Verified"
								: verificationStatus === "expiring_soon"
									? "Expiring Soon"
									: "Expired"}
						</Badge>
						{(verificationStatus === "expiring_soon" || verificationStatus === "expired") && (
							<Badge tone="violet">{remainingDays} days left</Badge>
						)}
						<SecondaryButton onClick={onThemeToggle}>
							{theme === "dark" ? "Light mode" : "Dark mode"}
						</SecondaryButton>
					</div>
				</div>

				{settingsContent}
			</div>
		</div>
	);
}

function NotificationPreferencesTab() {
	const token = getToken();
	const [prefs, setPrefs] = useState({
		email_enabled: true,
		push_enabled: true,
		message_notifs: true,
		requirement_notifs: true,
		contract_notifs: true,
		smart_match_notifs: true,
		monthly_summary: true,
	});
	const [loading, setLoading] = useState(() => Boolean(token));
	const [saving, setSaving] = useState(false);
	const [feedback, setFeedback] = useState("");

	useEffect(() => {
		if (!token) {
			return;
		}
		apiRequest("/notifications/preferences", { token })
			.then((data) => {
				if (data) {
					setPrefs(data);
				}
			})
			.catch(() => logger.warn("Failed to load notification preferences"))
			.finally(() => setLoading(false));
	}, [token]);

	const handleToggle = async (key) => {
		if (!token) {
			return;
		}
		const newPrefs = { ...prefs, [key]: !prefs[key] };
		setPrefs(newPrefs);
		setSaving(true);
		setFeedback("");

		try {
			await apiRequest("/notifications/preferences", {
				method: "PUT",
				token,
				body: newPrefs,
			});
			setFeedback("Preferences saved!");
		} catch {
			setFeedback("Failed to save. Please try again.");
			setPrefs(prefs);
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return <NeonAtom fill={true} size={64} text="Loading notifications..." timeout={10_000} />;
	}

	return (
		<div class="grid gap-6 lg:grid-cols-2">
			<SectionCard title="Notification Channels" subtitle="Choose how you receive notifications.">
				<_TogglePref
					label="Email Notifications"
					description="Receive notifications via email."
					checked={prefs.email_enabled}
					onChange={() => handleToggle("email_enabled")}
				/>
				<_TogglePref
					label="Push Notifications"
					description="Receive in-app push notifications."
					checked={prefs.push_enabled}
					onChange={() => handleToggle("push_enabled")}
				/>
			</SectionCard>

			<SectionCard title="Notification Types" subtitle="Select which events trigger notifications.">
				<_TogglePref
					label="Messages"
					description="New chat messages."
					checked={prefs.message_notifs}
					onChange={() => handleToggle("message_notifs")}
				/>
				<_TogglePref
					label="Buyer Requests"
					description="New requirements matching your interests."
					checked={prefs.requirement_notifs}
					onChange={() => handleToggle("requirement_notifs")}
				/>
				<_TogglePref
					label="Contracts"
					description="Contract updates and signatures."
					checked={prefs.contract_notifs}
					onChange={() => handleToggle("contract_notifs")}
				/>
				<_TogglePref
					label="Smart Search Matches"
					description="When new items match your saved searches."
					checked={prefs.smart_match_notifs}
					onChange={() => handleToggle("smart_match_notifs")}
				/>
				<_TogglePref
					label="Monthly Summary"
					description="Your monthly activity summary."
					checked={prefs.monthly_summary}
					onChange={() => handleToggle("monthly_summary")}
				/>
			</SectionCard>

			{feedback && (
				<div class="col-span-full rounded-lg p-3 text-sm bg-sky-50 text-sky-700 border border-sky-200">
					{feedback}
				</div>
			)}
		</div>
	);
}
