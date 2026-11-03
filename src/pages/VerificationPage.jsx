/*
  Routes: /verification and /verification-center
  Access: Protected (login required)
  Allowed roles: buyer, buying_house, factory, owner, admin, agent

  Public Pages:
    /, /pricing, /about, /terms, /privacy, /help, /login, /signup, /access-denied
  Protected Pages (login required):
    /feed, /search, /buyer/:id, /factory/:id, /buying-house/:id, /contracts,
    /notifications, /chat, /call, /verification, /verification-center

  Primary responsibilities:
    - Let users upload required verification documents based on role + buyer region.
    - Show verification status per document (submitted, missing, etc.).
    - Enforce subscription rules (verification is subscription-based and renewed).

  Key API endpoints:
    - GET /api/verification/me
    - POST /api/verification/me  (update documents + upload references)
    - GET /api/subscriptions/me

  Notes:
    - Buyer required documents vary by region (EU/USA/OTHER), derived from country.
*/

import {
	Check,
	Camera,
	Clock,
	CreditCard,
	HelpCircle,
	Moon,
	RefreshCw,
	Shield,
	Sparkles,
	Star,
	Sun,
	Upload,
	Users,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThreeDot } from "react-loading-indicators";
import {
	BUYER_COUNTRY_OPTIONS,
	VERIFICATION_FIELD_LABELS,
	VERIFICATION_REQUIREMENTS,
	getBuyerRegionFromCountry,
} from "../../shared/config/platformTaxonomy.js";
import ScrollReveal from "../components/ScrollReveal.jsx";
import LazyImage from "../components/ui/LazyImage.jsx";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import UploadProgressBar from "../components/ui/UploadProgressBar.jsx";
import WordleInput from "../components/WordleInput.jsx";
import { apiRequest, getCurrentUser, getToken, syncUserFromApi } from "../lib/auth.js";
import { useTheme } from "../lib/ThemeProvider.jsx";
import { uploadFile } from "../lib/upload.js";

function normalizeBuyerRegionFromCountry(country) {
	return getBuyerRegionFromCountry(country);
}

export default function VerificationPage({ embedded = false }) {
	const user = getCurrentUser();
	const token = getToken();
	const role = user?.role || "buyer";

	const { theme, toggleTheme } = useTheme();
	const isDark = theme === "dark";
	const [verification, setVerification] = useState(null);
	const [buyerCountry, setBuyerCountry] = useState("");
	const [busyDoc, setBusyDoc] = useState("");
	const [uploadProgress, setUploadProgress] = useState(0);
	const [savingCountry, setSavingCountry] = useState(false);
	const [error, setError] = useState("");
	const [feedback, setFeedback] = useState("");
	const [optionalLicenseInput, setOptionalLicenseInput] = useState("");
	const [renewing, setRenewing] = useState(false);
	const [pageLoading, setPageLoading] = useState(true);
	const [verificationPrice, setVerificationPrice] = useState({
		firstMonth: null,
		renewal: null,
	});
	const [code, setCode] = useState("");
	const [verifyingCode, setVerifyingCode] = useState(false);
	const [duplicatePrompt, setDuplicatePrompt] = useState(null);
	const [joiningCompany, setJoiningCompany] = useState(false);
	const [joinFeedback, setJoinFeedback] = useState("");
	const [joinName, setJoinName] = useState("");
	const [joinEmail, setJoinEmail] = useState("");
	const [joinPosition, setJoinPosition] = useState("");
	const [joinMessage, setJoinMessage] = useState("");
	const [disputingDuplicate, setDisputingDuplicate] = useState(false);
	const [docVisibility, setDocVisibility] = useState({});
	const [factoryVisitFiles, setFactoryVisitFiles] = useState([]);
	const [factoryVisitBusy, setFactoryVisitBusy] = useState(false);
	const [factoryVisitProgress, setFactoryVisitProgress] = useState(0);

	const fileInputRef = useRef(null);
	const pendingDocRef = useRef("");

	function handleDuplicateResult(result) {
		const tier = String(result?.duplicate_match_tier || result?.duplicate_candidate?.match?.tier || "").toLowerCase();
		if (!["exact", "strong"].includes(tier)) {
			return;
		}
		const candidate = result?.duplicate_candidate || null;
		if (!candidate) {
			return;
		}
		setDuplicatePrompt({
			tier,
			company_id: candidate.user_id || "",
			name: candidate.name || candidate.company_name || "Verified Company",
			logo: candidate.logo || "",
			banner: candidate.banner || "",
			email: candidate.email || "",
			country: candidate.country || "",
			website: candidate.website || "",
			matchReason: candidate.match?.reason || "",
			matchedFields: Array.isArray(candidate.match?.matched_fields) ? candidate.match.matched_fields : [],
		});
	}

	const buyerRegion = useMemo(() => {
		if (role !== "buyer") {
			return "";
		}
		return normalizeBuyerRegionFromCountry(buyerCountry);
	}, [buyerCountry, role]);

	const requiredDocs = useMemo(() => {
		if (role === "buyer") {
			return VERIFICATION_REQUIREMENTS.buyer[buyerRegion] || VERIFICATION_REQUIREMENTS.buyer.OTHER;
		}
		return VERIFICATION_REQUIREMENTS[role] || [];
	}, [buyerRegion, role]);

	const documents = verification?.documents || {};
	const documentVisibility = verification?.document_visibility || docVisibility;
	const optionalLicenses = Array.isArray(documents.optional_licenses)
		? documents.optional_licenses.filter(Boolean)
		: [];

	const credibilityScore = verification?.credibility?.score ?? 0;
	const verified = Boolean(verification?.verified);
	const reviewStatus = verification?.review_status || (verified ? "approved" : "pending");
	const reviewReason = verification?.review_reason || "";
	const remainingDays = Number(verification?.subscription_remaining_days || 0);

	const credibility = useMemo(() => {
		const base = 12;
		const bonus = optionalLicenses.length * 12;
		return Math.min(100, base + bonus + credibilityScore);
	}, [optionalLicenses.length, credibilityScore]);

	const loadStatus = useCallback(async () => {
		if (!token) {
			return;
		}
		setError("");
		setFeedback("");
		try {
			const verificationData = await apiRequest("/verification/me", { token });
			setVerification(verificationData);
			setBuyerCountry(String(verificationData?.documents?.buyer_country || ""));
		} catch (err) {
			setError(err.message || "Could not load verification center data");
		}
	}, [token]);

	useEffect(() => {
		let cancelled = false;
		let statusDone = false;
		let userDone = false;

		function tryDone() {
			if (statusDone && userDone && !cancelled) {
				setPageLoading(false);
			}
		}

		(async () => {
			try {
				await loadStatus();
			} finally {
				statusDone = true;
				tryDone();
			}
		})();

		(async () => {
			try {
				await syncUserFromApi(getToken());
			} finally {
				userDone = true;
				tryDone();
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [loadStatus]);

	useEffect(() => {
		if (!token || role !== "buyer") {
			return;
		}
		if (!buyerCountry) {
			return;
		}

		const currentCountry = String(verification?.documents?.buyer_country || "");
		const currentRegion = String(verification?.documents?.buyer_region || "");
		const nextRegion = normalizeBuyerRegionFromCountry(buyerCountry);
		if (currentCountry === buyerCountry && currentRegion === nextRegion) {
			return;
		}

		const timeoutId = setTimeout(async () => {
			try {
				setSavingCountry(true);
				const updatedDocs = {
					...(verification?.documents || {}),
					buyer_country: buyerCountry,
					buyer_region: nextRegion,
				};
				await apiRequest("/verification/me", {
					method: "POST",
					token,
					body: { documents: updatedDocs },
				});
				setVerification((prev) => ({
					...(prev || {}),
					documents: updatedDocs,
				}));
			} catch {
				setError("Could not save buyer country. Please try again.");
			} finally {
				setSavingCountry(false);
			}
		}, 350);

		return () => clearTimeout(timeoutId);
	}, [buyerCountry, role, token, verification]);

	useEffect(() => {
		if (!token) {
			return;
		}
		(async () => {
			try {
				const data = await apiRequest("/subscriptions/me/verification-pricing", { token });
				if (data?.first_month != null && typeof data.first_month === "number") {
					setVerificationPrice({
						firstMonth: data.first_month,
						renewal: data.renewal ?? data.renewal_monthly ?? data.first_month,
					});
				} else {
					setVerificationPrice({ firstMonth: 1.99, renewal: 6.99 });
				}
			} catch {
				setVerificationPrice({ firstMonth: 1.99, renewal: 6.99 });
			}
		})();
	}, [token]);

	async function requestUpload(documentKey, file) {
		if (!(file && token)) {
			return;
		}
		setBusyDoc(documentKey);
		setFeedback("");
		setError("");

		try {
			setUploadProgress(0);
			const uploadData = await uploadFile("/documents", {
				file,
				token,
				fields: {
					type: documentKey,
					entity_type: "verification",
				},
				onProgress: setUploadProgress,
			});

			const updatedDocs = {
				...(verification?.documents || {}),
				[documentKey]: "uploaded",
				...(role === "buyer"
					? {
							buyer_country: buyerCountry,
							buyer_region: normalizeBuyerRegionFromCountry(buyerCountry),
						}
					: {}),
			};

			const updated = await apiRequest("/verification/me", {
				method: "POST",
				token,
				body: { documents: updatedDocs },
			});
			setVerification(updated);
			setFeedback(
				`${VERIFICATION_FIELD_LABELS[documentKey] || documentKey} uploaded and verification state updated.`,
			);
			handleDuplicateResult(updated);
		} catch (err) {
			setError(err.message || "Upload failed");
		} finally {
			setBusyDoc("");
			setUploadProgress(0);
		}
	}

	function openPicker(documentKey) {
		pendingDocRef.current = documentKey;
		fileInputRef.current?.click();
	}

	async function onFileSelected(event) {
		const file = event.target.files?.[0];
		const documentKey = pendingDocRef.current;
		event.target.value = "";
		if (!(file && documentKey)) {
			return;
		}
		await requestUpload(documentKey, file);
	}

	async function onFactoryVisitFileSelected(event) {
		const files = Array.from(event.target.files || []);
		event.target.value = "";
		if (files.length === 0 || !token) {
			return;
		}
		setFactoryVisitBusy(true);
		setFactoryVisitProgress(0);
		setFeedback("");
		setError("");
		try {
			const uploaded = [];
			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				setUploadProgress(Math.round((i / files.length) * 100));
				const uploadData = await uploadFile("/documents", {
					file,
					token,
					fields: {
						type: "factory_visit",
						entity_type: "verification",
					},
					onProgress: (p) => {
						const base = Math.round((i / files.length) * 100);
						const chunk = Math.round(p / files.length);
						setUploadProgress(Math.min(100, base + chunk));
					},
				});
				uploaded.push({
					file_name: file.name,
					file_type: file.type,
					url: uploadData?.url || "",
					uploaded_at: new Date().toISOString(),
				});
			}

			const existingFiles = Array.isArray(
				verification?.documents?.factory_visit_files,
			)
				? verification.documents.factory_visit_files
				: [];
			const updatedDocs = {
				...(verification?.documents || {}),
				factory_visit_files: [...existingFiles, ...uploaded],
				factory_visit: "uploaded",
			};

			const updated = await apiRequest("/verification/me", {
				method: "POST",
				token,
				body: { documents: updatedDocs },
			});
			setVerification(updated);
			setFactoryVisitFiles((prev) => [...prev, ...uploaded]);
			setFeedback(
				`${files.length} factory visit file${files.length > 1 ? "s" : ""} uploaded successfully.`,
			);
		} catch (err) {
			setError(err.message || "Factory visit upload failed");
		} finally {
			setFactoryVisitBusy(false);
			setFactoryVisitProgress(0);
			setUploadProgress(0);
		}
	}

	async function addOptionalLicense() {
		const nextValue = optionalLicenseInput.trim();
		if (!(nextValue && token)) {
			return;
		}
		setOptionalLicenseInput("");
		setFeedback("");
		setError("");
		try {
			const updatedDocs = {
				...(verification?.documents || {}),
				optional_licenses: [...optionalLicenses, nextValue],
				...(role === "buyer" && buyerCountry
					? {
							buyer_country: buyerCountry,
							buyer_region: normalizeBuyerRegionFromCountry(buyerCountry),
						}
					: {}),
			};
			const updated = await apiRequest("/verification/me", {
				method: "POST",
				token,
				body: { documents: updatedDocs },
			});
			if (updated?.error) {
				throw new Error(updated.error);
			}
			setVerification(updated);
			handleDuplicateResult(updated);
			setFeedback("Optional license saved.");
		} catch (err) {
			setError(err.message || "Could not save optional license");
		}
	}

	async function removeOptionalLicense(value) {
		if (!token) {
			return;
		}
		setFeedback("");
		setError("");
		try {
			const updatedDocs = {
				...(verification?.documents || {}),
				optional_licenses: optionalLicenses.filter((x) => x !== value),
				...(role === "buyer"
					? {
							buyer_country: buyerCountry,
							buyer_region: normalizeBuyerRegionFromCountry(buyerCountry),
						}
					: {}),
			};
			const updated = await apiRequest("/verification/me", {
				method: "POST",
				token,
				body: { documents: updatedDocs },
			});
			setVerification(updated);
			handleDuplicateResult(updated);
			setFeedback("Optional license removed.");
		} catch (err) {
			setError(err.message || "Could not remove optional license");
		}
	}

	async function requestJoinFromDuplicate() {
		if (!(token && duplicatePrompt?.company_id)) {
			return;
		}
		setJoiningCompany(true);
		setError("");
		setJoinFeedback("");
		try {
			const res = await apiRequest("/join-requests", {
				method: "POST",
				token,
				body: {
					company_id: duplicatePrompt.company_id,
					source_verification_id: verification?.user_id || "",
					position: joinPosition || user?.profile?.position || "",
					message: joinMessage || "",
					name: joinName || user?.name || "",
					email: joinEmail || user?.email || "",
				},
			});
			const requestId = res?.request?.id || res?.request?.meta?.request_id || "";
			setJoinFeedback("Request to join sent to the verified company admin.");
			setDuplicatePrompt(null);
			setJoinName("");
			setJoinEmail("");
			setJoinPosition("");
			setJoinMessage("");
			if (requestId) {
				window.location.href = `/join-requests/${encodeURIComponent(requestId)}`;
			}
		} catch (err) {
			setError(err.message || "Could not send join request");
		} finally {
			setJoiningCompany(false);
		}
	}

	async function disputeDuplicate() {
		if (!(token && duplicatePrompt?.company_id)) {
			return;
		}
		setDisputingDuplicate(true);
		setError("");
		try {
			await apiRequest("/join-requests/dispute", {
				method: "POST",
				token,
				body: {
					company_id: duplicatePrompt.company_id,
					applicant_id: user?.id || "",
					source_verification_id: verification?.user_id || "",
					applicant_name: user?.name || "",
					applicant_email: user?.email || "",
				},
			});
			setJoinFeedback("This duplicate flag has been sent to admin review. You will be notified of the outcome.");
			setDuplicatePrompt(null);
		} catch (err) {
			setError(err.message || "Could not submit dispute");
		} finally {
			setDisputingDuplicate(false);
		}
	}

	function handleRenewVerification() {
		setFeedback("");
		setError("");
		setFeedback("Payment processing is coming soon. Stay tuned!");
	}

	async function updateDocumentVisibility(documentKey, visibility) {
		if (!token) {
			return;
		}
		setFeedback("");
		setError("");
		try {
			const updatedVisibility = {
				...(verification?.document_visibility || {}),
				[documentKey]: visibility,
			};
			const updated = await apiRequest("/verification/me", {
				method: "POST",
				token,
				body: { document_visibility: updatedVisibility },
			});
			setVerification(updated);
			setFeedback(`${VERIFICATION_FIELD_LABELS[documentKey] || documentKey} visibility updated to ${visibility}.`);
		} catch (err) {
			setError(err.message || "Could not update document visibility");
		}
	}

	const pageBg = isDark
		? "bg-slate-950 text-slate-100"
		: "bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900";

	const cardBg = isDark
		? "bg-white/5 border-white/10 shadow-[0_20px_80px_rgba(2,8,23,0.55)]"
		: "bg-white/80 border-slate-200 shadow-[0_20px_70px_rgba(51,122,176,0.12)] backdrop-blur";

	const softText = isDark ? "text-slate-300" : "text-slate-600";
	const mutedText = isDark ? "text-slate-400" : "text-slate-500";
	const fieldBg = isDark
		? "bg-slate-900/80 border-white/10 text-slate-100"
		: "bg-white border-slate-200 text-slate-900";
	const chipBg = isDark
		? "bg-sky-500/10 text-sky-200 border-sky-400/20"
		: "bg-sky-50 text-sky-700 border-sky-200";
	const buttonPrimary =
		"bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-400 text-white shadow-lg shadow-sky-500/25 hover:shadow-sky-500/35 hover:-translate-y-0.5";
	const buttonGhost = isDark
		? "bg-white/5 hover:bg-white/10 border-white/10 text-slate-100"
		: "bg-white hover:bg-sky-50 border-slate-200 text-slate-900";

	const requirements = requiredDocs.map((key) => ({
		title: VERIFICATION_FIELD_LABELS[key] || key,
		desc: documents?.[key] ? "Submitted" : "Missing",
		done: Boolean(documents?.[key]),
	}));

	if (pageLoading) {
		return <NeonAtom fill={true} timeout={10000} />;
	}

	const content = (
		<>
			<header
				className={`mb-6 flex items-center justify-between rounded-3xl border px-4 py-4 ${cardBg}`}
			>
				<div className="flex items-center gap-3">
					<div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-500 text-white shadow-lg shadow-sky-500/25">
						<Shield className="h-6 w-6" />
					</div>
					<div>
						<div className="flex items-center gap-2">
							<h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Verification Center</h1>
							<span
								className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] ${chipBg}`}
							>
								{reviewStatus}
							</span>
						</div>
						<p className={`mt-1 text-sm ${softText}`}>
							Verification is subscription-based and renews monthly. First month: $
							{(verificationPrice.firstMonth ?? 0).toFixed(2)} • Renewals: $
							{(verificationPrice.renewal ?? 0).toFixed(2)}/month
							{verificationPrice.firstMonth === null && (
								<span className="ml-1 text-amber-500">(pricing unavailable)</span>
							)}
						</p>
					</div>
				</div>

				{!embedded && (
					<button
						onClick={toggleTheme}
						className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition-all ${buttonGhost}`}
					>
						{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
						{isDark ? "Light" : "Dark"}
					</button>
				)}
			</header>

			{feedback && (
				<div className="mb-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 px-4 py-3 text-emerald-200">
					{feedback}
				</div>
			)}
			{error && (
				<div className="mb-4 rounded-2xl bg-rose-500/20 border border-rose-500/30 px-4 py-3 text-rose-300">
					{error}
				</div>
			)}

			<main className="grid flex-1 gap-6 lg:grid-cols-[1.25fr_0.75fr]">
				<section className="space-y-6">
					<div className={`rounded-[28px] border p-6 sm:p-8 ${cardBg}`}>
						<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
							<div>
								<div
									className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${chipBg}`}
								>
									<Sparkles className="h-3.5 w-3.5" />
									Review status: {reviewStatus}
									{reviewReason && ` • ${reviewReason}`}
								</div>
								<h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
									Build trust with verified proof
								</h2>
								<p className={`mt-4 max-w-2xl text-base leading-7 ${softText}`}>
									Upload the right documents for your role, add optional licenses, and strengthen
									credibility for buyers and partners.
								</p>
							</div>

							<div
								className={`min-w-[240px] rounded-3xl border p-5 ${isDark ? "bg-slate-900/70 border-white/10" : "bg-sky-50/70 border-sky-100"}`}
							>
								<div className={`flex items-center justify-between text-sm ${mutedText}`}>
									<span>Credibility</span>
									<span>{credibility}/100</span>
								</div>
								<div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-200/60 dark:bg-slate-800">
									<div
										className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-400 transition-all duration-500"
										style={{ width: `${credibility}%` }}
									/>
								</div>
								<div className="mt-4 flex items-center justify-between">
									<div>
										<div className="text-sm font-semibold">Basic credibility</div>
										<div className={`mt-1 text-xs ${mutedText}`}>
											More licensing proof increases credibility and international trust.
										</div>
									</div>
									<Star className="h-7 w-7 text-sky-400" />
								</div>
							</div>
						</div>
					</div>

					{role === "buyer" && (
						<div className={`rounded-[28px] border p-6 sm:p-8 ${cardBg}`}>
							<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
								<div>
									<h3 className="text-xl font-semibold">Buyer region</h3>
									<p className={`mt-1 text-sm ${softText}`}>
										Select your country to determine required documents.
									</p>
								</div>
								<div className="flex items-center gap-2 text-sm text-sky-500">
									<HelpCircle className="h-4 w-4" />
									Region: {buyerRegion}
								</div>
							</div>

							<div className="mt-5 flex flex-col gap-3 sm:flex-row">
								<select
									value={buyerCountry}
									onChange={(e) => setBuyerCountry(e.target.value)}
									className={`w-full rounded-2xl border px-4 py-3 outline-none ring-0 transition ${fieldBg}`}
								>
									<option value="">Select country</option>
									{BUYER_COUNTRY_OPTIONS.map((country) => (
										<option key={country} value={country}>
											{country}
										</option>
									))}
								</select>
								{savingCountry && (
									<span className="flex items-center">
										<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
									</span>
								)}
							</div>

							<p className={`mt-3 text-sm ${softText}`}>
								EU buyers need:{" "}
								<span className="font-semibold">
									Business Registration + VAT Number + EORI + Bank proof
								</span>
								. USA buyers need:{" "}
								<span className="font-semibold">Business Registration + EIN + IOR + Bank proof</span>.
							</p>

							{!buyerCountry && (
								<p className="mt-3 text-sm text-rose-400">
									Buyer country is required before completing buyer verification.
								</p>
							)}
						</div>
					)}

					<ScrollReveal as="section">
						<div className={`rounded-[28px] border p-6 sm:p-8 ${cardBg}`}>
							<div className="flex items-center justify-between gap-4">
								<div>
									<h3 className="text-xl font-semibold">Your requirements</h3>
									<p className={`mt-1 text-sm ${softText}`}>
										Role-based checklist. Uploading more proof increases credibility.
									</p>
								</div>
								<span className={`rounded-full border px-3 py-1 text-sm ${chipBg}`}>
									{verified ? "Verified" : "Not verified"}
								</span>
							</div>

							<div className="mt-6 grid gap-4 md:grid-cols-3">
								{requirements.map((item, idx) => (
									<div
										key={idx}
										className={`rounded-3xl border p-5 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
									>
										<div className="flex items-start gap-3">
											<div
												className={`mt-0.5 grid h-10 w-10 place-items-center rounded-2xl ${item.done ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/10 text-sky-500"}`}
											>
												{item.done ? <Check className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
											</div>
											<div>
												<h4 className="font-semibold">{item.title}</h4>
												<p className={`mt-1 text-sm leading-6 ${softText}`}>{item.desc}</p>
											</div>
										</div>
										{item.done && (
											<div className="mt-3">
												<label className={`text-xs font-medium ${mutedText}`}>Visibility</label>
												<select
													value={documentVisibility[requiredDocs[idx]] || "private"}
													onChange={(e) => updateDocumentVisibility(requiredDocs[idx], e.target.value)}
													className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs outline-none transition ${fieldBg}`}
												>
													<option value="private">Private</option>
													<option value="buyer_visible">Buyers Only</option>
													<option value="public">Public</option>
												</select>
											</div>
										)}
										<button
											onClick={() => openPicker(requiredDocs[idx])}
											disabled={
												busyDoc === requiredDocs[idx] || (role === "buyer" && !buyerCountry)
											}
											className={`mt-4 w-full rounded-2xl border px-3 py-2 text-sm font-medium transition-all ${
												busyDoc === requiredDocs[idx] || (role === "buyer" && !buyerCountry)
													? "opacity-50 cursor-not-allowed border-white/10"
													: buttonGhost
											}`}
										>
											{busyDoc === requiredDocs[idx] ? (
												<ThreeDot
													variant="bounce"
													color="#337ab0"
													size="small"
													text=""
													textColor=""
												/>
											) : (
												"Upload"
											)}
										</button>
										{busyDoc === requiredDocs[idx] && (
											<UploadProgressBar progress={uploadProgress} className="mt-2" />
										)}
									</div>
								))}
							</div>
						</div>
					</ScrollReveal>

					<div className={`rounded-[28px] border p-6 sm:p-8 ${cardBg}`}>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
							<div>
								<h3 className="text-xl font-semibold">Optional licenses</h3>
								<p className={`mt-1 text-sm ${softText}`}>
									Optional proofs can be added anytime. More proof = more trust.
								</p>
							</div>
							<div className={`flex items-center gap-2 text-sm ${softText}`}>
								<HelpCircle className="h-4 w-4 text-sky-400" />
								e.g. OEKO-TEX, BSCI, WRAP...
							</div>
						</div>

						<div className="mt-5 flex flex-col gap-3 sm:flex-row">
							<input
								value={optionalLicenseInput}
								onChange={(e) => setOptionalLicenseInput(e.target.value)}
								placeholder="Add a license or certification"
								className={`w-full rounded-2xl border px-4 py-3 outline-none ring-0 transition placeholder:text-slate-400 focus:border-sky-400 ${fieldBg}`}
							/>
							<button
								onClick={addOptionalLicense}
								className={`rounded-2xl px-5 py-3 font-semibold transition-all ${buttonPrimary}`}
							>
								Add
							</button>
						</div>

						<div className="mt-5 min-h-[92px] rounded-3xl border border-dashed border-sky-400/30 bg-sky-500/5 p-4">
							{optionalLicenses.length > 0 ? (
								<div className="flex flex-wrap gap-2">
									{optionalLicenses.map((lic) => (
										<button
											key={lic}
											onClick={() => removeOptionalLicense(lic)}
											className={`rounded-full border px-3 py-2 text-sm ${chipBg}`}
										>
											{lic}
											<X className="ml-2 inline h-3 w-3" />
										</button>
									))}
								</div>
							) : (
								<div className={`flex h-full items-center justify-center text-sm ${mutedText}`}>
									No optional licenses yet.
								</div>
							)}
						</div>
					</div>

					{role === "buyer" && (
						<div className={`rounded-[28px] border p-6 sm:p-8 ${cardBg}`}>
							<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
								<div>
									<h3 className="text-xl font-semibold">Factory Visit Documentation</h3>
									<p className={`mt-1 text-sm ${softText}`}>
										Upload photos or videos from your factory visits. This strengthens your buyer credibility.
									</p>
								</div>
								<div className={`flex items-center gap-2 text-sm ${softText}`}>
									<Camera className="h-4 w-4 text-sky-400" />
									JPG, PNG, MP4, MOV
								</div>
							</div>

							<div className="mt-5">
								<label
									className={`flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-6 transition-all ${
										factoryVisitBusy
											? "pointer-events-none opacity-50"
											: "border-sky-400/40 bg-sky-500/5 hover:border-sky-400/70 hover:bg-sky-500/10"
									}`}
								>
									<input
										type="file"
										accept="image/*,video/*"
										multiple
										className="hidden"
										disabled={factoryVisitBusy}
										onChange={onFactoryVisitFileSelected}
									/>
									<Upload className="h-5 w-5 text-sky-400" />
									<span className={`text-sm font-medium ${softText}`}>
										{factoryVisitBusy ? "Uploading..." : "Click to upload photos or videos"}
									</span>
								</label>
								{factoryVisitBusy && (
									<UploadProgressBar progress={factoryVisitProgress} className="mt-3" />
								)}
							</div>

							{(() => {
								const existingFiles = Array.isArray(verification?.documents?.factory_visit_files)
									? verification.documents.factory_visit_files
									: [];
								const allFiles = [...existingFiles, ...factoryVisitFiles.filter(
									(f) => !existingFiles.some((e) => e.file_name === f.file_name),
								)];
								if (allFiles.length === 0) return null;
								return (
									<div className="mt-5 grid gap-3 sm:grid-cols-2">
										{allFiles.map((file, idx) => (
											<div
												key={`${file.file_name}-${idx}`}
												className={`flex items-center gap-3 rounded-2xl border p-3 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"}`}
											>
												<div className={`grid h-10 w-10 place-items-center rounded-xl ${file.file_type?.startsWith("video") ? "bg-cyan-500/15 text-cyan-400" : "bg-sky-500/15 text-sky-400"}`}>
													{file.file_type?.startsWith("video") ? (
														<span className="text-lg">🎬</span>
													) : (
														<Camera className="h-5 w-5" />
													)}
												</div>
												<div className="min-w-0 flex-1">
													<p className="truncate text-sm font-medium">{file.file_name}</p>
													<p className={`text-xs ${mutedText}`}>
														{file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : ""}
													</p>
												</div>
											</div>
										))}
									</div>
								);
							})()}
						</div>
					)}

					<div className={`rounded-[28px] border p-6 sm:p-8 ${cardBg}`}>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
							<div>
								<h3 className="text-xl font-semibold">Verification code</h3>
								<p className={`mt-1 text-sm ${softText}`}>
									Enter the 6-digit code sent to your email on file.
								</p>
							</div>
						</div>
						<div className="mt-5">
							<WordleInput
								maxLength={6}
								onChange={(val) => {
									setCode(val);
									if (val.length === 6) {
										setVerifyingCode(true);
										setFeedback("");
										setError("");
										apiRequest("/verification/code", {
											method: "POST",
											token,
											body: { code: val },
										})
											.then((res) => {
												if (res?.error) {
													throw new Error(res.error);
												}
												setFeedback("Code accepted. Verification in progress.");
												loadStatus();
											})
											.catch((err) => {
												setError(err.message || "Invalid verification code");
											})
											.finally(() => {
												setVerifyingCode(false);
											});
									}
								}}
								placeholder="●"
							/>
							{verifyingCode && (
								<div className="mt-3 flex items-center gap-2 text-sm text-sky-400">
									<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
									<span>Verifying code...</span>
								</div>
							)}
						</div>
					</div>
				</section>

				<aside className="space-y-6">
					<div className={`rounded-[28px] border p-6 ${cardBg}`}>
						<div className="flex items-center gap-3">
							<div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-500/10 text-sky-500">
								<CreditCard className="h-5 w-5" />
							</div>
							<div>
								<h3 className="font-semibold">Subscription</h3>
								<p className={`text-sm ${mutedText}`}>
									Verification approval requires an active verification subscription.
								</p>
							</div>
						</div>

						<div
							className={`mt-5 rounded-3xl border p-5 ${isDark ? "border-white/10 bg-slate-900/70" : "border-slate-200 bg-white"}`}
						>
							<div className="flex items-center justify-between text-sm">
								<span className={softText}>Status</span>
								<span className="rounded-full bg-rose-500/10 px-3 py-1 font-semibold text-rose-400">
									{remainingDays > 0 ? "Active" : "Inactive"}
								</span>
							</div>
							<div className={`mt-3 text-sm leading-6 ${softText}`}>
								Activate your verification plan to unlock review eligibility and progress toward
								approval.
							</div>
							{remainingDays > 0 && (
								<p className={`mt-3 text-xs ${mutedText}`}>
									Remaining: {remainingDays} day
									{remainingDays === 1 ? "" : "s"}
								</p>
							)}
						</div>

						<div className="mt-4 grid gap-3">
						<button
							onClick={handleRenewVerification}
							className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-semibold transition-all ${buttonPrimary} opacity-80 cursor-default`}
						>
							<CreditCard className="h-4 w-4" />
							Pay / Renew Verification
							<span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wide">Coming Soon</span>
						</button>
							<button
								onClick={loadStatus}
								className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 font-semibold transition-all ${buttonGhost}`}
							>
								<RefreshCw className="h-4 w-4" />
								Refresh status
							</button>
						</div>
					</div>

					<div className={`rounded-[28px] border p-6 ${cardBg}`}>
						<div className="flex items-center gap-3">
							<div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-500">
								<HelpCircle className="h-5 w-5" />
							</div>
							<div>
								<h3 className="font-semibold">Need help?</h3>
								<p className={`text-sm ${mutedText}`}>Visit the Help Center.</p>
							</div>
						</div>

						<div
							className={`mt-5 rounded-3xl border p-5 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-sky-50/60"}`}
						>
							<div className="flex items-start gap-3">
								<Upload className="mt-0.5 h-5 w-5 text-sky-400" />
								<div>
									<p className="text-sm font-semibold">Upload stronger proof</p>
									<p className={`mt-1 text-sm leading-6 ${softText}`}>
										Higher-quality documents and licenses can improve review confidence and
										credibility.
									</p>
								</div>
							</div>
						</div>
					</div>

					<div className={`rounded-[28px] border p-6 ${cardBg}`}>
						<h3 className="font-semibold">Overview</h3>
						<div className="mt-4 space-y-3 text-sm">
							<div className="flex items-center justify-between">
								<span className={softText}>First month</span>
								<span className="font-semibold">
									{verificationPrice.firstMonth !== null
										? `$${verificationPrice.firstMonth.toFixed(2)}`
										: <span className="text-amber-500 text-xs">Pricing unavailable</span>}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className={softText}>Renewals</span>
								<span className="font-semibold">
									{verificationPrice.renewal !== null
										? `${verificationPrice.renewal.toFixed(2)}/month`
										: <span className="text-amber-500 text-xs">Pricing unavailable</span>}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className={softText}>Review status</span>
								<span className="font-semibold text-amber-400">{reviewStatus}</span>
							</div>
							<div className="flex items-center justify-between">
								<span className={softText}>Verification</span>
								<span className="font-semibold text-rose-400">
									{verified ? "Verified" : "Not verified"}
								</span>
							</div>
						</div>
					</div>
				</aside>
			</main>

			<input ref={fileInputRef} type="file" className="hidden" onChange={onFileSelected} />

			{duplicatePrompt && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
					<div className={`relative w-full max-w-lg rounded-3xl border p-6 sm:p-8 shadow-2xl ${cardBg}`}>
						<button
							onClick={() => setDuplicatePrompt(null)}
							className="absolute right-4 top-4 rounded-full p-1 hover:bg-white/10 transition"
						>
							<X className="h-5 w-5" />
						</button>

						{duplicatePrompt.banner && (
							<div className="mb-4 -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 rounded-t-3xl overflow-hidden h-32 sm:h-40">
								<img
									src={duplicatePrompt.banner}
									alt=""
									className="h-full w-full object-cover"
								/>
							</div>
						)}

						<div className="flex items-center gap-3 mb-4">
							{duplicatePrompt.logo ? (
								<img
									src={duplicatePrompt.logo}
									alt=""
									className="h-14 w-14 rounded-2xl object-cover border border-white/10"
								/>
							) : (
								<div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-500 text-white text-lg font-bold">
									{duplicatePrompt.name?.charAt(0) || "?"}
								</div>
							)}
							<div>
								<h3 className="text-lg font-semibold">{duplicatePrompt.name}</h3>
								<p className={`text-sm ${mutedText}`}>
									{duplicatePrompt.country && `${duplicatePrompt.country}`}
									{duplicatePrompt.country && duplicatePrompt.website && " · "}
									{duplicatePrompt.website && (
										<a href={`https://${duplicatePrompt.website}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
											{duplicatePrompt.website}
										</a>
									)}
								</p>
							</div>
						</div>

						<div className={`mb-4 rounded-2xl border p-4 ${isDark ? "bg-amber-500/10 border-amber-400/20" : "bg-amber-50 border-amber-200"}`}>
							<p className={`text-sm font-medium ${isDark ? "text-amber-200" : "text-amber-800"}`}>
								A Verified Company Account already exists with this information. Are you a representative of this company?
							</p>
							{duplicatePrompt.matchedFields?.length > 0 && (
								<p className={`mt-2 text-xs ${isDark ? "text-amber-300/70" : "text-amber-600"}`}>
									Match confidence: {duplicatePrompt.tier === "exact" ? "Exact legal identifier match" : "Strong multi-field match"} — matched: {duplicatePrompt.matchedFields.join(", ")}
								</p>
							)}
						</div>

						<div className="space-y-3 mb-5">
							<p className={`text-sm font-semibold ${softText}`}>Your details for the join request:</p>
							<input
								value={joinName}
								onChange={(e) => setJoinName(e.target.value)}
								placeholder="Your full name"
								className={`w-full rounded-2xl border px-4 py-2.5 text-sm outline-none ring-0 transition placeholder:text-slate-400 ${fieldBg}`}
							/>
							<input
								value={joinEmail}
								onChange={(e) => setJoinEmail(e.target.value)}
								placeholder="Your email"
								type="email"
								className={`w-full rounded-2xl border px-4 py-2.5 text-sm outline-none ring-0 transition placeholder:text-slate-400 ${fieldBg}`}
							/>
							<input
								value={joinPosition}
								onChange={(e) => setJoinPosition(e.target.value)}
								placeholder="Position (e.g. Merchandiser, Sample Manager)"
								className={`w-full rounded-2xl border px-4 py-2.5 text-sm outline-none ring-0 transition placeholder:text-slate-400 ${fieldBg}`}
							/>
							<textarea
								value={joinMessage}
								onChange={(e) => setJoinMessage(e.target.value)}
								placeholder="Optional short message (e.g. I am the sample manager)"
								rows={2}
								className={`w-full rounded-2xl border px-4 py-2.5 text-sm outline-none ring-0 transition resize-none placeholder:text-slate-400 ${fieldBg}`}
							/>
						</div>

						<div className="flex flex-col gap-3 sm:flex-row">
							<button
								onClick={requestJoinFromDuplicate}
								disabled={joiningCompany}
								className={`flex-1 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-semibold transition-all ${buttonPrimary} ${joiningCompany ? "opacity-60 cursor-not-allowed" : ""}`}
							>
								<Users className="h-4 w-4" />
								{joiningCompany ? "Sending..." : "Request to Join"}
							</button>
							<button
								onClick={disputeDuplicate}
								disabled={disputingDuplicate}
								className={`flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 font-semibold transition-all ${buttonGhost} ${disputingDuplicate ? "opacity-60 cursor-not-allowed" : ""}`}
							>
								{disputingDuplicate ? "Submitting..." : "No, this is a different company"}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);

	if (embedded) {
		return content;
	}
	return (
		<div className={`min-h-screen ${pageBg} transition-colors duration-300`}>
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-sky-500/20 blur-3xl" />
				<div className="absolute top-1/3 right-[-5rem] h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
				<div className="absolute bottom-[-6rem] left-[-4rem] h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
			</div>
			<div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
				{content}
			</div>
		</div>
	);
}
