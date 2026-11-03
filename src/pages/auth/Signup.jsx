/*
  Route: /signup
  Access: Public
*/

import { BadgeCheck, ClipboardList, FileSignature, MessagesSquare } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
	PASSWORD_MAX_LENGTH,
	PASSWORD_RULES,
	passwordProblems,
	passwordStrength,
} from "../../../shared/config/passwordPolicy.js";
import {
	CAPACITY_PERIOD_OPTIONS,
	COUNTRY_OPTIONS,
	FACTORY_SECTOR_OPTIONS,
	PUBLIC_ACCOUNT_TYPES,
	capacityUnitsForSector,
	normalizeCompanyFacts,
} from "../../../shared/config/platformTaxonomy.js";
import BrandMark from "../../components/ui/BrandMark.jsx";
import { apiRequest, saveSession } from "../../lib/auth.js";
import { cn } from "../../lib/cn.js";
import { useTheme } from "../../lib/ThemeProvider.jsx";
import usePageMeta from "../../lib/usePageMeta.js";

const POSITIONS = [
	"Owner",
	"CEO / Managing Director",
	"General Manager (GM)",
	"Manager",
	"Senior Merchandiser",
	"Merchandiser",
	"Assistant Merchandiser",
	"Production Manager",
	"Quality Control Manager",
	"Compliance Officer",
	"Sourcing Manager",
	"Supply Chain Manager",
	"Industrial Engineer",
	"Textile Technologist",
	"Pattern Master",
	"Cutting Master",
	"Supervisor",
	"Executive",
	"Procurement Officer",
	"Sample Master",
	"Finishing Supervisor",
	"Store In-Charge",
	"Administrator",
	"Other",
];

// Only what the platform actually does today.
const BENEFITS = [
	{
		icon: BadgeCheck,
		title: "Verified company profiles",
		text: "Document-based verification for factories, buying houses and buyers.",
	},
	{
		icon: ClipboardList,
		title: "Requirements and products in one place",
		text: "Buyers post sourcing requirements; suppliers list products and capacity.",
	},
	{
		icon: MessagesSquare,
		title: "Direct conversations",
		text: "Chat and calls with the companies you work with.",
	},
	{
		icon: FileSignature,
		title: "Contracts on record",
		text: "Prepare and sign contracts inside your account.",
	},
];

const STRENGTH = [
	{ label: "Too weak", bar: "bg-rose-400", width: "w-1/4" },
	{ label: "Fair", bar: "bg-amber-400", width: "w-2/4" },
	{ label: "Good", bar: "bg-sky-500", width: "w-3/4" },
	{ label: "Strong", bar: "bg-emerald-500", width: "w-full" },
];

const inputBase =
	"w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10 dark:bg-white/5 dark:placeholder:text-slate-500";

function inputClass(hasError) {
	return cn(
		inputBase,
		hasError
			? "border-rose-400 ring-2 ring-rose-500/20 dark:border-rose-500"
			: "border-slate-200 dark:border-white/10",
	);
}

function FieldShell({ label, htmlFor, children, hint, error, optional = false }) {
	return (
		<div class="space-y-2">
			<div class="flex items-end justify-between gap-3">
				<label htmlFor={htmlFor} class="text-sm font-medium text-slate-700 dark:text-slate-200">
					{label}
					{optional ? (
						<span class="ml-1 font-normal text-slate-400 dark:text-slate-500">(optional)</span>
					) : null}
				</label>
				{hint ? <span class="text-xs text-slate-500 dark:text-slate-400">{hint}</span> : null}
			</div>
			{children}
			{error ? <p class="text-xs font-medium text-rose-500">{error}</p> : null}
		</div>
	);
}

function EyeIcon({ open }) {
	return open ? (
		<svg viewBox="0 0 24 24" fill="none" class="h-4 w-4" aria-hidden="true">
			<path
				d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
				stroke="currentColor"
				strokeWidth="1.7"
			/>
			<circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
		</svg>
	) : (
		<svg viewBox="0 0 24 24" fill="none" class="h-4 w-4" aria-hidden="true">
			<path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
			<path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
			<path
				d="M9.9 5.1A10.6 10.6 0 0 1 12 5c6 0 9.5 7 9.5 7a18.2 18.2 0 0 1-3.1 4.1"
				stroke="currentColor"
				strokeWidth="1.7"
				strokeLinecap="round"
			/>
			<path
				d="M6.3 6.3C3.8 8.2 2.5 12 2.5 12s3.5 7 9.5 7c1.3 0 2.5-.2 3.6-.5"
				stroke="currentColor"
				strokeWidth="1.7"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function ChevronDown() {
	return (
		<svg viewBox="0 0 24 24" fill="none" class="h-4 w-4" aria-hidden="true">
			<path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function RuleMark({ ok }) {
	return (
		<span
			aria-hidden="true"
			class={cn(
				"inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold",
				ok
					? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
					: "bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400",
			)}
		>
			{ok ? "✓" : "•"}
		</span>
	);
}

function PasswordInput({ id, value, onChange, onBlur, shown, onToggle, invalid, autoComplete }) {
	return (
		<div class="relative">
			<input
				id={id}
				value={value}
				onChange={onChange}
				onBlur={onBlur}
				type={shown ? "text" : "password"}
				autoComplete={autoComplete}
				maxLength={PASSWORD_MAX_LENGTH}
				aria-invalid={invalid ? "true" : undefined}
				class={cn(inputClass(invalid), "pr-20")}
			/>
			<button
				type="button"
				onClick={onToggle}
				class="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 dark:text-sky-200 dark:hover:bg-white/10"
				aria-label={shown ? "Hide password" : "Show password"}
			>
				<span class="inline-flex items-center gap-1">
					<EyeIcon open={shown} />
					{shown ? "Hide" : "Show"}
				</span>
			</button>
		</div>
	);
}

/** Searchable country list: native scrolling, arrow keys, Enter, Escape. */
function CountryCombobox({ value, onChange, invalid }) {
	const listId = useId();
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);
	const rootRef = useRef(null);
	const listRef = useRef(null);

	const options = useMemo(() => {
		const q = query.trim().toLowerCase();
		return q ? COUNTRY_OPTIONS.filter((c) => c.toLowerCase().includes(q)) : COUNTRY_OPTIONS;
	}, [query]);

	useEffect(() => {
		if (!open) return undefined;
		const close = (event) => {
			if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
		};
		document.addEventListener("pointerdown", close);
		return () => document.removeEventListener("pointerdown", close);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
	}, [active, open]);

	const pick = (country) => {
		onChange(country);
		setQuery("");
		setOpen(false);
	};

	const onKeyDown = (event) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setOpen(true);
			setActive((index) => Math.min(options.length - 1, index + 1));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setActive((index) => Math.max(0, index - 1));
		} else if (event.key === "Enter" && open) {
			event.preventDefault();
			if (options[active]) pick(options[active]);
		} else if (event.key === "Escape") {
			setOpen(false);
		}
	};

	return (
		<div class="relative" ref={rootRef}>
			<input
				id="signup-country"
				role="combobox"
				aria-expanded={open}
				aria-controls={listId}
				aria-autocomplete="list"
				aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
				aria-invalid={invalid ? "true" : undefined}
				autoComplete="country-name"
				value={open ? query : value}
				onChange={(event) => {
					setQuery(event.target.value);
					setActive(0);
					setOpen(true);
				}}
				onFocus={() => {
					setQuery("");
					setOpen(true);
				}}
				onKeyDown={onKeyDown}
				placeholder={value || "Type to search countries"}
				class={inputClass(invalid)}
			/>
			{open ? (
				<div
					id={listId}
					ref={listRef}
					role="listbox"
					class="absolute z-40 mt-2 max-h-64 w-full overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/10 dark:border-slate-600 dark:bg-slate-800"
				>
					{options.length > 0 ? (
						options.map((country, index) => (
							<div
								key={country}
								id={`${listId}-${index}`}
								data-index={index}
								role="option"
								tabIndex={-1}
								aria-selected={country === value}
								onPointerDown={(event) => event.preventDefault()}
								onClick={() => pick(country)}
								onMouseEnter={() => setActive(index)}
								class={cn(
									"cursor-pointer px-4 py-2.5 text-sm text-slate-700 dark:text-slate-100",
									index === active ? "bg-sky-50 dark:bg-white/10" : "",
								)}
							>
								{country}
							</div>
						))
					) : (
						<p class="px-4 py-4 text-sm text-slate-500 dark:text-slate-300">No matching country found.</p>
					)}
				</div>
			) : null}
		</div>
	);
}

export default function Signup() {
	usePageMeta({
		title: "Create Account — GarTexHub",
		type: "website",
		description:
			"Join GarTexHub — the garments and textile sourcing marketplace. Create your account as a buyer, factory, or buying house.",
		canonical: "https://gartexhub.onrender.com/signup",
		robots: "noindex,nofollow",
		siteName: "GarTexHub",
		locale: "en_US",
	});
	const navigate = useNavigate();
	const location = useLocation();
	const returnTo = typeof location.state?.from === "string" ? location.state.from : "";

	const { theme: currentTheme, toggleTheme } = useTheme();
	const isDark = currentTheme === "dark";
	const [fullName, setFullName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [passwordTouched, setPasswordTouched] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [accountType, setAccountType] = useState(PUBLIC_ACCOUNT_TYPES[0]);
	const [accountOpen, setAccountOpen] = useState(false);
	const [country, setCountry] = useState("");
	const [organizationName, setOrganizationName] = useState("");
	const [industry, setIndustry] = useState("");
	const [employeeCount, setEmployeeCount] = useState("");
	const [capacityQuantity, setCapacityQuantity] = useState("");
	const [capacityUnit, setCapacityUnit] = useState("");
	const [capacityPeriod, setCapacityPeriod] = useState("month");
	const [position, setPosition] = useState("");
	const [positionOpen, setPositionOpen] = useState(false);
	const [customPosition, setCustomPosition] = useState("");

	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [fieldErrors, setFieldErrors] = useState({});

	const accountDropdownRef = useRef(null);
	const positionDropdownRef = useRef(null);
	const submittingRef = useRef(false);

	const isFactory = accountType.value === "factory";
	const needsEmployees = accountType.value !== "buyer";
	const capacityUnits = useMemo(() => capacityUnitsForSector(industry), [industry]);

	useEffect(() => {
		function handleClickOutside(e) {
			if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target)) {
				setAccountOpen(false);
			}
			if (positionDropdownRef.current && !positionDropdownRef.current.contains(e.target)) {
				setPositionOpen(false);
			}
		}
		document.addEventListener("pointerdown", handleClickOutside);
		return () => document.removeEventListener("pointerdown", handleClickOutside);
	}, []);

	// Keep the capacity unit consistent with the chosen industry.
	useEffect(() => {
		if (capacityUnit && !capacityUnits.some((unit) => unit.value === capacityUnit)) {
			setCapacityUnit("");
		}
	}, [capacityUnits, capacityUnit]);

	const passwordIssues = passwordProblems(password);
	const strength = STRENGTH[passwordStrength(password)];
	const showPasswordHelp = passwordTouched || password.length > 0;
	const confirmStarted = confirmPassword.length > 0;
	const passwordsMatch = confirmStarted && password === confirmPassword;

	const handleBack = () => {
		if (window.history.length > 1) {
			navigate(-1);
			return;
		}
		navigate("/", { replace: true });
	};

	function validateForm() {
		const errors = {};
		if (!fullName.trim()) {
			errors.fullName = "Full name is required";
		} else if (fullName.trim().length < 2) {
			errors.fullName = "Must be at least 2 characters";
		}
		if (!email) {
			errors.email = "Email is required";
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			errors.email = "Please enter a valid email address";
		}
		if (passwordIssues.length > 0) {
			errors.password = `Password needs: ${passwordIssues.join(", ").toLowerCase()}`;
		}
		if (!confirmPassword) {
			errors.confirmPassword = "Please confirm your password";
		} else if (password !== confirmPassword) {
			errors.confirmPassword = "Passwords do not match";
		}
		if (!organizationName.trim()) {
			errors.organizationName = "Organization name is required";
		}
		if (!industry) {
			errors.industry = "Choose your industry";
		}
		if (!country) {
			errors.country = "Please select your country";
		}
		if (!position) {
			errors.position = "Please select your position";
		} else if (position === "Other" && !customPosition.trim()) {
			errors.position = "Please enter your position";
		}
		const facts = normalizeCompanyFacts({
			employee_count: employeeCount,
			production_capacity: isFactory
				? { quantity: capacityQuantity, unit: capacityUnit, period: capacityPeriod }
				: null,
		});
		if (facts.errors.employee_count) {
			errors.employeeCount = facts.errors.employee_count;
		} else if (needsEmployees && !employeeCount) {
			errors.employeeCount = "Enter the number of employees";
		}
		if (isFactory) {
			if (!capacityQuantity) {
				errors.capacity = "Enter your production capacity";
			} else if (facts.errors.production_capacity) {
				errors.capacity = facts.errors.production_capacity;
			}
		}
		return { errors, facts: facts.value };
	}

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (submittingRef.current) return;
		setError("");
		setPasswordTouched(true);
		const { errors, facts } = validateForm();
		setFieldErrors(errors);
		if (Object.keys(errors).length > 0) {
			requestAnimationFrame(() => {
				document.querySelector("[aria-invalid='true']")?.scrollIntoView({ block: "center" });
			});
			return;
		}
		submittingRef.current = true;
		setSubmitting(true);
		try {
			const effectivePosition =
				position === "Other" && customPosition.trim() ? customPosition.trim() : position;
			const payload = {
				name: fullName.trim(),
				email: email.trim(),
				password,
				role: accountType.value,
				company_name: organizationName.trim(),
				profile: {
					country,
					position: effectivePosition,
					industry,
					...(isFactory ? { factory_sector: industry } : {}),
					...facts,
				},
			};
			const data = await apiRequest("/auth/register", {
				method: "POST",
				body: payload,
				signal: AbortSignal.timeout(30_000),
			});
			saveSession(data.user, data.token);
			navigate("/onboarding", { replace: true, state: returnTo ? { from: returnTo } : undefined });
		} catch (err) {
			setError(
				err?.name === "TimeoutError" || err?.name === "AbortError"
					? "The server is taking longer than usual (it may be waking up). Please try again."
					: err.message || "Could not create the account",
			);
			submittingRef.current = false;
			setSubmitting(false);
		}
	};

	return (
		<div
			class={cn(
				isDark ? "dark" : "",
				"relative min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[var(--theme-custom-07111f)] dark:text-white",
			)}
		>
			<div class="relative mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-12 lg:py-14">
				{/* Form first on phones: the reason to be here is to create the account. */}
				<main class="order-1 lg:order-2">
					<div class="rounded-[2rem] border border-slate-200/80 bg-white p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[var(--theme-custom-0b1627-80)] sm:p-8">
						<div class="mb-6 flex items-center justify-between">
							<button
								type="button"
								onClick={handleBack}
								class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:text-sky-200"
							>
								<span class="text-base">←</span>
								Back
							</button>
							<Link to="/" class="inline-flex items-center gap-2" aria-label="GarTexHub home">
								<BrandMark size={32} alt="" />
								<span class="text-base font-bold text-slate-900 dark:text-white">GarTexHub</span>
							</Link>
						</div>

						<div class="mb-7">
							<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Create your account</h1>
							<p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
								For garment and textile buyers, factories and buying houses.
							</p>
						</div>

						<form onSubmit={handleSubmit} noValidate={true} class="space-y-5">
							<FieldShell label="Full Name" htmlFor="signup-name" error={fieldErrors.fullName}>
								<input
									id="signup-name"
									value={fullName}
									onChange={(e) => setFullName(e.target.value)}
									autoComplete="name"
									placeholder="Enter your full name"
									aria-invalid={fieldErrors.fullName ? "true" : undefined}
									class={inputClass(fieldErrors.fullName)}
								/>
							</FieldShell>

							<FieldShell label="Email" htmlFor="signup-email" error={fieldErrors.email}>
								<input
									id="signup-email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									type="email"
									inputMode="email"
									autoComplete="email"
									placeholder="name@company.com"
									aria-invalid={fieldErrors.email ? "true" : undefined}
									class={inputClass(fieldErrors.email)}
								/>
							</FieldShell>

							<div class="grid gap-5 sm:grid-cols-2">
								<FieldShell label="Password" htmlFor="signup-password" error={fieldErrors.password}>
									<PasswordInput
										id="signup-password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										onBlur={() => setPasswordTouched(true)}
										shown={showPassword}
										onToggle={() => setShowPassword((v) => !v)}
										invalid={Boolean(fieldErrors.password)}
										autoComplete="new-password"
									/>
								</FieldShell>

								<FieldShell
									label="Confirm Password"
									htmlFor="signup-confirm"
									error={fieldErrors.confirmPassword}
								>
									<PasswordInput
										id="signup-confirm"
										value={confirmPassword}
										onChange={(e) => setConfirmPassword(e.target.value)}
										shown={showConfirmPassword}
										onToggle={() => setShowConfirmPassword((v) => !v)}
										invalid={Boolean(fieldErrors.confirmPassword)}
										autoComplete="new-password"
									/>
									{confirmStarted && !fieldErrors.confirmPassword ? (
										<p
											class={cn(
												"text-xs font-medium",
												passwordsMatch ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500",
											)}
										>
											{passwordsMatch ? "Passwords match" : "Passwords do not match yet"}
										</p>
									) : null}
								</FieldShell>
							</div>

							{showPasswordHelp ? (
								<div class="-mt-1 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-white/5" aria-live="polite">
									<div class="flex items-center gap-3">
										<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
											<div class={cn("h-full rounded-full transition-all", strength.bar, strength.width)} />
										</div>
										<span class="text-xs font-medium text-slate-600 dark:text-slate-300">{strength.label}</span>
									</div>
									<ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
										{PASSWORD_RULES.map((rule) => (
											<li key={rule.id} class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
												<RuleMark ok={rule.test(password)} />
												{rule.label}
											</li>
										))}
									</ul>
								</div>
							) : null}

							<FieldShell label="Account Type">
								<div class="relative" ref={accountDropdownRef}>
									<button
										type="button"
										aria-haspopup="listbox"
										aria-expanded={accountOpen}
										onClick={() => setAccountOpen((v) => !v)}
										class="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm transition hover:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-500/10 dark:border-white/10 dark:bg-white/5"
									>
										<span class="font-medium text-slate-800 dark:text-slate-100">{accountType.label}</span>
										<span class="text-slate-500 dark:text-slate-300">
											<ChevronDown />
										</span>
									</button>
									{accountOpen ? (
										<div
											role="listbox"
											class="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-600 dark:bg-slate-800"
										>
											{PUBLIC_ACCOUNT_TYPES.map((item) => (
												<button
													key={item.value}
													type="button"
													role="option"
													aria-selected={accountType.value === item.value}
													onClick={() => {
														setAccountType(item);
														setAccountOpen(false);
													}}
													class={cn(
														"flex w-full items-center px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:bg-sky-50 dark:text-slate-100 dark:hover:bg-white/5",
														accountType.value === item.value ? "bg-sky-50 dark:bg-white/5" : "",
													)}
												>
													{item.label}
												</button>
											))}
										</div>
									) : null}
								</div>
							</FieldShell>

							<FieldShell label="Organization Name" htmlFor="signup-org" error={fieldErrors.organizationName}>
								<input
									id="signup-org"
									value={organizationName}
									onChange={(e) => setOrganizationName(e.target.value)}
									autoComplete="organization"
									placeholder="Registered company name"
									aria-invalid={fieldErrors.organizationName ? "true" : undefined}
									class={inputClass(fieldErrors.organizationName)}
								/>
							</FieldShell>

							<div class="grid gap-5 sm:grid-cols-2">
								<FieldShell label="Industry" htmlFor="signup-industry" error={fieldErrors.industry}>
									<select
										id="signup-industry"
										value={industry}
										onChange={(e) => setIndustry(e.target.value)}
										aria-invalid={fieldErrors.industry ? "true" : undefined}
										class={inputClass(fieldErrors.industry)}
									>
										<option value="">Select industry</option>
										{FACTORY_SECTOR_OPTIONS.map((item) => (
											<option key={item.value} value={item.value}>
												{item.label}
											</option>
										))}
									</select>
								</FieldShell>

								<FieldShell label="Country" htmlFor="signup-country" error={fieldErrors.country}>
									<CountryCombobox value={country} onChange={setCountry} invalid={Boolean(fieldErrors.country)} />
								</FieldShell>
							</div>

							<FieldShell
								label="Number of Employees"
								htmlFor="signup-employees"
								error={fieldErrors.employeeCount}
								optional={!needsEmployees}
							>
								<input
									id="signup-employees"
									value={employeeCount}
									onChange={(e) => setEmployeeCount(e.target.value.replace(/[^\d]/g, ""))}
									inputMode="numeric"
									placeholder="e.g. 450"
									aria-invalid={fieldErrors.employeeCount ? "true" : undefined}
									class={inputClass(fieldErrors.employeeCount)}
								/>
							</FieldShell>

							{isFactory ? (
								<FieldShell
									label="Production Capacity"
									htmlFor="signup-capacity"
									hint="How much you can produce"
									error={fieldErrors.capacity}
								>
									<div class="grid grid-cols-[1.2fr_1fr_1fr] gap-2">
										<input
											id="signup-capacity"
											value={capacityQuantity}
											onChange={(e) => setCapacityQuantity(e.target.value.replace(/[^\d]/g, ""))}
											inputMode="numeric"
											placeholder="Quantity"
											aria-label="Capacity quantity"
											aria-invalid={fieldErrors.capacity ? "true" : undefined}
											class={inputClass(fieldErrors.capacity)}
										/>
										<select
											value={capacityUnit}
											onChange={(e) => setCapacityUnit(e.target.value)}
											aria-label="Capacity unit"
											class={inputClass(fieldErrors.capacity && !capacityUnit)}
										>
											<option value="">Unit</option>
											{capacityUnits.map((unit) => (
												<option key={unit.value} value={unit.value}>
													{unit.label}
												</option>
											))}
										</select>
										<select
											value={capacityPeriod}
											onChange={(e) => setCapacityPeriod(e.target.value)}
											aria-label="Capacity period"
											class={inputClass(false)}
										>
											{CAPACITY_PERIOD_OPTIONS.map((period) => (
												<option key={period.value} value={period.value}>
													{period.label}
												</option>
											))}
										</select>
									</div>
								</FieldShell>
							) : null}

							<FieldShell label="Your Position" error={fieldErrors.position}>
								<div class="relative" ref={positionDropdownRef}>
									<button
										type="button"
										aria-haspopup="listbox"
										aria-expanded={positionOpen}
										aria-invalid={fieldErrors.position ? "true" : undefined}
										onClick={() => setPositionOpen((v) => !v)}
										class={cn(
											"flex w-full items-center justify-between rounded-2xl border bg-white px-4 py-3 text-left text-sm transition hover:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-500/10 dark:bg-white/5",
											fieldErrors.position
												? "border-rose-400 ring-2 ring-rose-500/20 dark:border-rose-500"
												: "border-slate-200 dark:border-white/10",
										)}
									>
										<span class="font-medium text-slate-800 dark:text-slate-100">
											{position === "Other" && customPosition
												? customPosition
												: position || "Select your position"}
										</span>
										<span class="text-slate-500 dark:text-slate-300">
											<ChevronDown />
										</span>
									</button>
									{positionOpen ? (
										<div
											role="listbox"
											class="absolute z-30 mt-2 max-h-60 w-full overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-600 dark:bg-slate-800"
										>
											{POSITIONS.map((item) => (
												<button
													key={item}
													type="button"
													role="option"
													aria-selected={position === item}
													onClick={() => {
														setPosition(item);
														setPositionOpen(false);
													}}
													class={cn(
														"flex w-full items-center px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:bg-sky-50 dark:text-slate-100 dark:hover:bg-white/5",
														position === item ? "bg-sky-50 dark:bg-white/5" : "",
													)}
												>
													{item}
												</button>
											))}
										</div>
									) : null}
								</div>
								{position === "Other" ? (
									<input
										value={customPosition}
										onChange={(e) => setCustomPosition(e.target.value)}
										placeholder="Enter your position"
										aria-label="Your position"
										class={cn(inputClass(false), "mt-2")}
									/>
								) : null}
							</FieldShell>

							{error ? (
								<div
									role="alert"
									class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200"
								>
									{error}
								</div>
							) : null}

							<button
								type="submit"
								disabled={submitting}
								aria-busy={submitting}
								class="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-sky-900/15 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-80"
							>
								{submitting ? (
									<>
										<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
										Creating your account…
									</>
								) : (
									"Create account"
								)}
							</button>

							<p class="pt-1 text-center text-sm text-slate-600 dark:text-slate-300">
								Already have an account?{" "}
								<Link
									to="/login"
									state={returnTo ? { from: returnTo } : undefined}
									class="font-semibold text-sky-700 hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200"
								>
									Login
								</Link>
							</p>
						</form>
					</div>
				</main>

				<aside class="order-2 lg:order-1 lg:sticky lg:top-24">
					<div class="flex items-center justify-between gap-3">
						<div class="flex items-center gap-3">
							<BrandMark size={40} alt="" />
							<div>
								<div class="text-lg font-bold text-slate-900 dark:text-white">GarTexHub</div>
								<div class="text-xs text-slate-500 dark:text-slate-400">
									Garments &amp; Textile Sourcing Marketplace
								</div>
							</div>
						</div>
						<button
							type="button"
							onClick={toggleTheme}
							class="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
						>
							{isDark ? "Light mode" : "Dark mode"}
						</button>
					</div>

					<h2 class="mt-8 text-xl font-semibold leading-snug text-slate-900 dark:text-white sm:text-2xl">
						One workspace for sourcing garments and textiles.
					</h2>
					<ul class="mt-6 space-y-4">
						{BENEFITS.map(({ icon: Icon, title, text }) => (
							<li key={title} class="flex gap-3">
								<span class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-white/5 dark:text-sky-300">
									<Icon class="h-[18px] w-[18px]" aria-hidden="true" />
								</span>
								<div>
									<div class="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
									<p class="mt-0.5 text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p>
								</div>
							</li>
						))}
					</ul>
				</aside>
			</div>
		</div>
	);
}
