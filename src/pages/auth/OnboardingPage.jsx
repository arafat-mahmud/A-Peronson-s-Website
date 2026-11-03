import {
	ArrowLeft,
	ArrowRight,
	Building2,
	Check,
	CloudUpload,
	ImageIcon,
	Layers3,
	MoonStar,
	Sparkles,
	SunMedium,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ThreeDot } from "react-loading-indicators";
import { useLocation, useNavigate } from "react-router-dom";
import {
	COMMON_CERTIFICATIONS,
	garmentCategories,
	textileCategories,
} from "../../../shared/config/platformTaxonomy.js";
import NeonAtom from "../../components/ui/NeonAtom.jsx";
import ProfileImageUpload from "../../components/ui/ProfileImageUpload.jsx";
import { apiRequest, getCurrentUser, getRoleHome, getToken, saveSession } from "../../lib/auth.js";
import { useTheme } from "../../lib/ThemeProvider.jsx";

const TOTAL_STEPS = 4;

const DEFAULT_CATEGORIES = [
	"T-Shirt",
	"Polo",
	"Denim",
	"Hoodie",
	"Sportswear",
	"Knitwear",
	"Woven",
	"Outerwear",
	"Other",
];

export default function OnboardingPage() {
	const navigate = useNavigate();
	const user = getCurrentUser();
	const token = getToken();

	const { theme, toggleTheme } = useTheme();
	const isDark = theme === "dark";
	const [step, setStep] = useState(1);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [availableCategories, setAvailableCategories] = useState(DEFAULT_CATEGORIES);

	const [profileImage, setProfileImage] = useState(() => user?.profile?.profile_image || "");
	const [organizationName, setOrganizationName] = useState(
		() => user?.profile?.organization_name || user?.company_name || user?.name || "",
	);
	const [bio, setBio] = useState(() => user?.profile?.bio || "");
	const [categories, setCategories] = useState(() => {
		const current = user?.profile?.categories;
		return Array.isArray(current) && current.length > 0 ? current : [];
	});
	const [customCategory, setCustomCategory] = useState("");
	const [customCategoryError, setCustomCategoryError] = useState("");
	// Step 4 is optional (client 02/11/2026): certifications can be added now
	// or later from the company profile.
	const [certifications, setCertifications] = useState(() =>
		Array.isArray(user?.profile?.certifications) ? user.profile.certifications : [],
	);
	const [customCertification, setCustomCertification] = useState("");
	const location = useLocation();
	const returnTo = typeof location.state?.from === "string" ? location.state.from : "";

	// Categories come from the shared taxonomy for the company's industry; the
	// old request went to /api/categories, an endpoint that does not exist.
	useEffect(() => {
		const sector = String(user?.profile?.industry || user?.profile?.factory_sector || "").toLowerCase();
		const list = sector === "textile" ? textileCategories : sector === "garments" ? garmentCategories : null;
		if (list) {
			setAvailableCategories([...list, "Other"]);
		}
	}, [user?.profile?.industry, user?.profile?.factory_sector]);

	const progress = useMemo(() => ((step - 1) / (TOTAL_STEPS - 1)) * 100, [step]);

	function toggleCategory(cat) {
		setCategories((prev) => {
			const set = new Set(prev);
			if (set.has(cat)) {
				set.delete(cat);
			} else {
				set.add(cat);
			}
			return [...set];
		});
		if (cat !== "Other") {
			setCustomCategory("");
			setCustomCategoryError("");
		}
	}

	function validateCustomCategory(value) {
		const trimmed = String(value || "").trim();
		if (!trimmed) {
			setCustomCategoryError("Please enter a category name.");
			return false;
		}
		if (trimmed.length < 2) {
			setCustomCategoryError("Category name must be at least 2 characters.");
			return false;
		}
		if (trimmed.length > 40) {
			setCustomCategoryError("Category name must be 40 characters or less.");
			return false;
		}
		if (!/^[a-zA-Z\s\-&]+$/.test(trimmed)) {
			setCustomCategoryError("Only letters, spaces, hyphens, and & are allowed.");
			return false;
		}
		setCustomCategoryError("");
		return true;
	}

	function toggleCertification(name) {
		setCertifications((prev) =>
			prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name],
		);
	}

	function addCustomCertification() {
		const name = customCertification.trim().slice(0, 80);
		if (name && !certifications.includes(name)) {
			setCertifications((prev) => [...prev, name]);
		}
		setCustomCertification("");
	}

	async function submit({ skipped = false, skipCertifications = false } = {}) {
		if (!token) {
			return;
		}
		setSaving(true);
		setError("");
		try {
			if (!skipped) {
				const name = String(organizationName || "").trim();
				if (!name || name.length < 3) {
					setError("Organization name must be at least 3 characters.");
					setSaving(false);
					return;
				}
				if (!Array.isArray(categories) || categories.length === 0) {
					setError('Please select at least one category or click "Skip for now".');
					setSaving(false);
					return;
				}
				if (categories.includes("Other") && !validateCustomCategory(customCategory)) {
					setSaving(false);
					return;
				}
			}
			const finalCategories = categories.includes("Other")
				? categories.filter((c) => c !== "Other").concat(customCategory.trim())
				: categories;
			const payload = {
				profile_image: skipped ? profileImage || "" : profileImage || "",
				organization_name: skipped ? organizationName || "" : organizationName || "",
				bio: skipped ? bio || "" : bio || "",
				categories: skipped ? categories || [] : finalCategories || [],
				certifications: skipped || skipCertifications ? [] : certifications,
			};

			const updatedUser = await apiRequest("/onboarding", {
				method: "POST",
				token,
				body: payload,
			});
			saveSession(updatedUser, token);
			navigate(returnTo || getRoleHome(updatedUser.role), { replace: true });
		} catch (err) {
			setError(err.message || "Unable to save onboarding");
		} finally {
			setSaving(false);
		}
	}

	function next() {
		setError("");
		const validate = (s) => {
			if (s === 1) {
				if (!profileImage || profileImage.trim() === "") {
					setError("Profile image is required.");
					return false;
				}
				const isUrl = profileImage.startsWith("http://") || profileImage.startsWith("https://");
				const isRelativePath = profileImage.startsWith("/uploads/");
				if (!(isUrl || isRelativePath)) {
					setError("Please enter a valid image URL or upload an image.");
					return false;
				}
			}
			if (s === 2) {
				const name = String(organizationName || "").trim();
				if (!name || name.length < 3) {
					setError("Organization name is required (min 3 characters).");
					return false;
				}
			}
			if (s === 3 && (!categories || categories.length === 0)) {
				setError("Please select at least one category.");
				return false;
			}
			if (s === 3 && categories.includes("Other") && !validateCustomCategory(customCategory)) {
				return false;
			}
			return true;
		};

		if (!validate(step)) {
			return;
		}
		setStep((s) => Math.min(TOTAL_STEPS, s + 1));
	}

	if (saving) {
		return <NeonAtom fill={true} timeout={10_000} />;
	}

	return (
		<div class={isDark ? "dark" : ""}>
			<div class="min-h-screen overflow-hidden bg-slate-50 text-slate-900 transition-colors duration-500 dark:bg-[var(--theme-custom-07111f)] dark:text-white">
				<div class="pointer-events-none absolute inset-0 overflow-hidden">
					<div class="absolute left-[-10rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-sky-400/25 blur-3xl dark:bg-sky-500/20" />
					<div class="absolute right-[-8rem] top-[8rem] h-[24rem] w-[24rem] rounded-full bg-blue-500/20 blur-3xl dark:bg-cyan-500/10" />
					<div class="absolute bottom-[-10rem] left-[20%] h-[22rem] w-[22rem] rounded-full bg-cyan-300/20 blur-3xl dark:bg-blue-600/10" />
				</div>

				<div class="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
					<div class="grid w-full gap-6 lg:grid-cols-[1.05fr_1.2fr]">
						<aside class="relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/75 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-colors duration-500 dark:border-white/10 dark:bg-slate-950/70 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
							<div class="mb-8 flex items-center justify-between">
								<div class="flex items-center gap-3">
									<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/30">
										<Sparkles class="h-6 w-6" />
									</div>
									<div>
										<p class="text-sm font-medium text-slate-500 dark:text-slate-400">Welcome</p>
										<h1 class="text-xl font-semibold tracking-tight">Finish your setup</h1>
									</div>
								</div>

								<button
									onClick={toggleTheme}
									class="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
								>
									{isDark ? <SunMedium class="h-4 w-4" /> : <MoonStar class="h-4 w-4" />}
									{isDark ? "Light" : "Dark"}
								</button>
							</div>

							<div class="space-y-5">
								<div>
									<div class="mb-2 flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-400">
										<span>Setup progress</span>
										<span>{Math.round(progress)}%</span>
									</div>
									<div class="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
										<div
											class="h-full rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-cyan-400 transition-all duration-500"
											style={{ width: `${progress}%` }}
										/>
									</div>
								</div>

								<div class="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
									{[
										{
											title: "Step 1",
											desc: "Add your profile image",
											active: step === 1,
											done: step > 1,
										},
										{
											title: "Step 2",
											desc: "Confirm organization",
											active: step === 2,
											done: step > 2,
										},
										{
											title: "Step 3",
											desc: "Select categories",
											active: step === 3,
											done: step > 3,
										},
										{
											title: "Step 4",
											desc: "Certifications (optional)",
											active: step === 4,
											done: false,
										},
									].map((item, index) => (
										<div
											key={item.title}
											class={`rounded-2xl border p-4 transition-all ${
												item.active
													? "border-sky-400/60 bg-sky-500/10 shadow-lg shadow-sky-500/10"
													: item.done
														? "border-emerald-400/40 bg-emerald-500/10"
														: "border-slate-200/70 bg-white/70 dark:border-white/10 dark:bg-white/[0.03]"
											}`}
										>
											<div class="flex items-center justify-between gap-3">
												<div>
													<p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
														{item.title}
													</p>
													<h3 class="mt-1 text-base font-semibold">{item.desc}</h3>
												</div>
												<div
													class={`flex h-9 w-9 items-center justify-center rounded-full ${item.done ? "bg-emerald-500 text-white" : item.active ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"}`}
												>
													{item.done ? <Check class="h-4 w-4" /> : index + 1}
												</div>
											</div>
										</div>
									))}
								</div>

								<div class="rounded-3xl border border-sky-500/15 bg-gradient-to-br from-sky-500/10 via-blue-500/10 to-cyan-500/10 p-5 dark:border-white/10 dark:from-sky-400/10 dark:via-blue-400/10 dark:to-cyan-400/10">
									<div class="flex items-start gap-4">
										<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-sky-600 shadow-sm dark:bg-white/10 dark:text-sky-300">
											<Building2 class="h-6 w-6" />
										</div>
										<div>
											<h3 class="text-lg font-semibold">
												{String(user?.role || "Account").replace("_", " ")} setup
											</h3>
											<p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
												Step {step} of {TOTAL_STEPS} —{" "}
												{step === 1
													? "profile image"
													: step === 2
														? "organization details"
														: step === 3
															? "product categories"
															: "certifications (optional)"}
												. You can always update these later.
											</p>
										</div>
									</div>
								</div>
							</div>
						</aside>

						<main class="relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-colors duration-500 dark:border-white/10 dark:bg-slate-950/75 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
							<div class="mb-6 flex items-center justify-between gap-4">
								<div>
									<p class="text-sm font-semibold uppercase tracking-[0.22em] text-sky-500">
										Onboarding
									</p>
									<h2 class="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
										Step {step} / {TOTAL_STEPS}
									</h2>
								</div>
								<div class="hidden rounded-full border border-sky-500/20 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-700 dark:text-sky-300 sm:flex sm:items-center sm:gap-2">
									<Layers3 class="h-4 w-4" />
									{String(user?.role || "user").replace("_", " ")}
								</div>
							</div>

							<div class="space-y-5">
								{step === 1 && (
									<section class="rounded-3xl border border-slate-200/70 bg-slate-50/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
										<div class="mb-5 flex items-center gap-3">
											<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/30">
												<ImageIcon class="h-5 w-5" />
											</div>
											<div>
												<h3 class="text-xl font-semibold">Add your profile image</h3>
												<p class="text-sm text-slate-500 dark:text-slate-400">
													Optional. Upload an image for your profile.
												</p>
											</div>
										</div>

										<ProfileImageUpload
											value={profileImage}
											onChange={setProfileImage}
											label="Profile Image"
										/>
									</section>
								)}

								{step === 2 && (
									<section class="rounded-3xl border border-slate-200/70 bg-slate-50/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
										<div class="mb-5 flex items-center gap-3">
											<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/30">
												<Building2 class="h-5 w-5" />
											</div>
											<div>
												<h3 class="text-xl font-semibold">Confirm your organization</h3>
												<p class="text-sm text-slate-500 dark:text-slate-400">
													Use the official name used in documents.
												</p>
											</div>
										</div>

										<label class="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
											Organization name
										</label>
										<input
											value={organizationName}
											onChange={(e) => setOrganizationName(e.target.value)}
											placeholder="Your company / buying house name"
											class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:shadow-[0_0_0_4px_rgba(51,122,176,0.12)] dark:border-white/10 dark:bg-slate-900/80 dark:placeholder:text-slate-500"
										/>

										<div class="mt-4 rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-white/10 dark:bg-slate-900/70">
											<p class="text-sm text-slate-500 dark:text-slate-400">Account role</p>
											<p class="mt-1 text-base font-semibold text-slate-900 dark:text-white">
												{String(user?.role || "").replace("_", " ")}
											</p>
										</div>

										<label class="mt-4 mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
											Description / Bio
										</label>
										<textarea
											value={bio}
											onChange={(e) => setBio(e.target.value)}
											placeholder="Tell us about your organization..."
											rows={3}
											class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:shadow-[0_0_0_4px_rgba(51,122,176,0.12)] dark:border-white/10 dark:bg-slate-900/80 dark:placeholder:text-slate-500 resize-none"
										/>
									</section>
								)}

								{step === 3 && (
									<section class="rounded-3xl border border-slate-200/70 bg-slate-50/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
										<div class="mb-5 flex items-center gap-3">
											<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/30">
												<CloudUpload class="h-5 w-5" />
											</div>
											<div>
												<h3 class="text-xl font-semibold">Select categories</h3>
												<p class="text-sm text-slate-500 dark:text-slate-400">
													Pick a few categories you work with.
												</p>
											</div>
										</div>

										<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
											{availableCategories.map((cat) => {
												const active = categories.includes(cat);
												return (
													<button
														key={cat}
														type="button"
														onClick={() => toggleCategory(cat)}
														class={`rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition-all ${
															active
																? "border-sky-500 bg-sky-500/10 text-sky-700 shadow-[0_12px_30px_rgba(51,122,176,0.18)] dark:text-sky-300"
																: "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-500/5 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
														}`}
													>
														<div class="flex items-center justify-between gap-3">
															<span>{cat}</span>
															<span
																class={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
																	active
																		? "bg-sky-500 text-white"
																		: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
																}`}
															>
																{active ? <Check class="h-3.5 w-3.5" /> : "+"}
															</span>
														</div>
													</button>
												);
											})}
										</div>

										{categories.includes("Other") && (
											<div class="mt-4">
												<label class="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
													Type your category
												</label>
												<input
													value={customCategory}
													onChange={(e) => {
														setCustomCategory(e.target.value);
														if (customCategoryError) {
															validateCustomCategory(e.target.value);
														}
													}}
													onBlur={() => {
														if (customCategory) {
															validateCustomCategory(customCategory);
														}
													}}
													placeholder="e.g. Sustainable Fabrics"
													maxLength={40}
													class={`w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:shadow-[0_0_0_4px_rgba(51,122,176,0.12)] dark:bg-slate-900/80 dark:placeholder:text-slate-500 ${
														customCategoryError
															? "border-rose-400 focus:border-rose-500 dark:border-rose-500"
															: "border-slate-200 focus:border-sky-400 dark:border-white/10"
													}`}
												/>
												{customCategoryError ? (
													<p class="mt-1 text-xs font-medium text-rose-500">
														{customCategoryError}
													</p>
												) : (
													<p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
														Letters, spaces, hyphens, and & only. 2-40 characters.
													</p>
												)}
											</div>
										)}

										<p class="mt-5 text-sm text-slate-500 dark:text-slate-400">
											You can change these later in Organization Settings.
										</p>
									</section>
								)}

								{step === 4 && (
									<section class="rounded-3xl border border-slate-200/70 bg-slate-50/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
										<div class="mb-4">
											<h3 class="text-xl font-semibold">Certifications</h3>
											<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
												Select the certifications your company holds. This step is optional - you can
												skip it and add certifications later from your company profile.
											</p>
										</div>
										<div class="flex flex-wrap gap-2">
											{[...new Set([...COMMON_CERTIFICATIONS, ...certifications])].map((name) => {
												const active = certifications.includes(name);
												return (
													<button
														key={name}
														type="button"
														aria-pressed={active}
														onClick={() => toggleCertification(name)}
														class={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${
															active
																? "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300"
																: "border-slate-200 bg-white text-slate-700 hover:border-sky-300 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
														}`}
													>
														{active ? "✓ " : ""}
														{name}
													</button>
												);
											})}
										</div>
										<div class="mt-4 flex gap-2">
											<input
												value={customCertification}
												onChange={(e) => setCustomCertification(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === "Enter") {
														e.preventDefault();
														addCustomCertification();
													}
												}}
												maxLength={80}
												placeholder="Another certification"
												aria-label="Another certification"
												class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 dark:border-white/10 dark:bg-slate-900/80"
											/>
											<button
												type="button"
												onClick={addCustomCertification}
												class="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
											>
												Add
											</button>
										</div>
										<button
											type="button"
											onClick={() => submit({ skipCertifications: true })}
											disabled={saving}
											class="mt-4 text-sm font-semibold text-sky-700 transition hover:text-sky-800 disabled:opacity-60 dark:text-sky-300"
										>
											Skip this step
										</button>
									</section>
								)}
							</div>

							{error ? (
								<div class="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
									{error}
								</div>
							) : null}

							<div class="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div class="flex items-center gap-2">
									<button
										onClick={() => setStep((s) => Math.max(1, s - 1))}
										disabled={step === 1 || saving}
										class="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:shadow-sm disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
									>
										<ArrowLeft class="h-4 w-4" />
										Back
									</button>
									{step < TOTAL_STEPS ? (
										<button
											onClick={next}
											disabled={saving}
											class="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:translate-y-[-1px] hover:shadow-xl disabled:opacity-60"
										>
											Continue
											<ArrowRight class="h-4 w-4" />
										</button>
									) : (
										<button
											onClick={() => submit()}
											disabled={saving}
											class="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:translate-y-[-1px] hover:shadow-xl disabled:opacity-60"
										>
											{saving ? (
												<ThreeDot
													variant="bounce"
													color="#337ab0"
													size="small"
													text=""
													textColor=""
												/>
											) : (
												"Finish setup"
											)}
											<Check class="h-4 w-4" />
										</button>
									)}
								</div>

								<button
									onClick={() => submit({ skipped: true })}
									disabled={saving}
									class="text-sm font-semibold text-slate-500 transition hover:text-slate-700 disabled:opacity-60 dark:text-slate-400 dark:hover:text-slate-200"
								>
									Skip for now
								</button>
							</div>
						</main>
					</div>
				</div>
			</div>
		</div>
	);
}
