import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { ThreeDot } from "react-loading-indicators";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
	COUNTRY_OPTIONS,
	ELEVATED_ACCOUNT_TYPES,
	FACTORY_SECTOR_OPTIONS,
} from "../../../shared/config/platformTaxonomy.js";
import NeonAtom from "../../components/ui/NeonAtom.jsx";
import { apiRequest, getCurrentUser, getRoleHome, saveSession } from "../../lib/auth.js";
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

export default function SignupUltra() {
	usePageMeta({
		title: "Sign Up — GarTexHub",
		description:
			"Join GarTexHub — the global textile and garment marketplace. Create your account and connect with verified factories, buyers, and suppliers.",
		robots: "noindex,nofollow",
	});

	const { time, date } = useParams();
	const navigate = useNavigate();

	// Validation Logic
	const isAuthorized = useMemo(() => {
		const now = new Date();

		// Check Date (DD:MM:YY)
		const day = String(now.getDate()).padStart(2, "0");
		const month = String(now.getMonth() + 1).padStart(2, "0");
		const year = String(now.getFullYear()).slice(-2);
		const expectedDate = `${day}:${month}:${year}`;

		if (date !== expectedDate) {
			return false;
		}

		// Check Time (HH:MM) - allow 2 minute window
		const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

		const [h, m] = (time || "").split(":").map(Number);
		if (Number.isNaN(h) || Number.isNaN(m)) {
			return false;
		}

		const inputTotalMinutes = h * 60 + m;
		const diff = Math.abs(currentTotalMinutes - inputTotalMinutes);

		return diff <= 2; // 2 minute tolerance
	}, [time, date]);

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [form, setForm] = useState({
		name: "",
		email: "",
		password: "",
		confirmPassword: "",
		role: "admin",
		country: "",
		organization: "",
		position: "",
		customPosition: "",
		factorySector: "",
	});
	const [passwordVisible, setPasswordVisible] = useState(false);
	const [confirmVisible, setConfirmVisible] = useState(false);

	const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

	// Hooks run before any early return, so every render calls them in the same order.
	useEffect(() => {
		if (form.role !== "factory" && form.factorySector) {
			onChange("factorySector", "");
		}
	}, [form.role, form.factorySector]);

	if (!isAuthorized) {
		return <Navigate to="/" replace={true} />;
	}

	const currentUser = getCurrentUser();
	if (currentUser && currentUser.role !== "admin" && currentUser.role !== "owner") {
		return <Navigate to="/" replace={true} />;
	}

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		if (!form.position) {
			setLoading(false);
			setError("Please select your position.");
			return;
		}
		if (form.position === "Other" && !form.customPosition.trim()) {
			setLoading(false);
			setError("Please enter your position.");
			return;
		}
		if (!form.organization.trim()) {
			setLoading(false);
			setError("Please enter your organization name.");
			return;
		}
		if (form.role === "factory" && !form.factorySector) {
			setLoading(false);
			setError("Please select whether the factory is Garments or Textile.");
			return;
		}
		if (form.password !== form.confirmPassword) {
			setLoading(false);
			setError("Passwords do not match.");
			return;
		}
		try {
			const effectivePosition =
				form.position === "Other" && form.customPosition.trim()
					? form.customPosition.trim()
					: form.position;
			const payload = {
				name: form.name,
				email: form.email,
				password: form.password,
				role: form.role,
				company_name: form.organization,
				profile: {
					country: form.country,
					position: effectivePosition,
					factory_sector: form.factorySector,
				},
			};

			const data = await apiRequest("/auth/register", {
				method: "POST",
				body: payload,
				signal: AbortSignal.timeout(30_000),
			});
			saveSession(data.user, data.token);
			navigate(getRoleHome(data.user.role), { replace: true });
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return <NeonAtom fill={true} timeout={10_000} />;
	}

	return (
		<div class="min-h-screen bg-slate-50 dark:bg-[var(--theme-slate-950)] flex items-center justify-center p-4">
			<div class="w-full max-w-2xl bg-white rounded-xl p-8 shadow-[0_0_20px_rgba(10,102,194,0.35)] ring-1 ring-slate-200/60 dark:bg-slate-900/70 dark:shadow-none dark:ring-white/10">
				<div class="flex items-center gap-2 mb-2">
					<span class="bg-gtBlue text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter">
						Ultra Access
					</span>
					<h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
						Elevated Registration
					</h1>
				</div>
				<p class="text-sm text-slate-500 dark:text-slate-300">
					Authorized personnel only. Create Admin, Agent, or Owner accounts directly.
				</p>

				<AnimatePresence mode="wait">
					<motion.form
						key="signup-form"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
						class="mt-6 grid md:grid-cols-2 gap-4"
						onSubmit={handleSubmit}
					>
						<div>
							<label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
								Full Name
							</label>
							<input
								class="w-full px-4 py-2.5 rounded-lg outline-none transition-colors shadow-borderless dark:shadow-borderlessDark bg-white text-slate-900 dark:bg-[var(--theme-custom-0b1224)] dark:text-slate-100"
								value={form.name}
								onChange={(e) => onChange("name", e.target.value)}
								required={true}
							/>
						</div>
						<div>
							<label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
								Secret Email
							</label>
							<input
								type="email"
								class="w-full px-4 py-2.5 rounded-lg outline-none transition-colors shadow-borderless dark:shadow-borderlessDark bg-white text-slate-900 dark:bg-[var(--theme-custom-0b1224)] dark:text-slate-100"
								value={form.email}
								onChange={(e) => onChange("email", e.target.value)}
								required={true}
							/>
						</div>
						<div>
							<label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
								Master Password
							</label>
							<div class="flex items-center gap-2 rounded-lg shadow-borderless dark:shadow-borderlessDark px-3 py-2 bg-white dark:bg-[var(--theme-custom-0b1224)] focus-within:ring-2 focus-within:ring-[var(--theme-brand-20)]">
								<input
									type={passwordVisible ? "text" : "password"}
									placeholder="--------"
									class="w-full bg-transparent outline-none text-slate-900 dark:text-slate-100"
									value={form.password}
									onChange={(e) => onChange("password", e.target.value)}
									required={true}
								/>
								<button
									type="button"
									onClick={() => setPasswordVisible((prev) => !prev)}
									class="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
								>
									{passwordVisible ? "Hide" : "Show"}
								</button>
							</div>
						</div>
						<div>
							<label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
								Confirm Password
							</label>
							<div class="flex items-center gap-2 rounded-lg shadow-borderless dark:shadow-borderlessDark px-3 py-2 bg-white dark:bg-[var(--theme-custom-0b1224)] focus-within:ring-2 focus-within:ring-[var(--theme-brand-20)]">
								<input
									type={confirmVisible ? "text" : "password"}
									placeholder="--------"
									class="w-full bg-transparent outline-none text-slate-900 dark:text-slate-100"
									value={form.confirmPassword}
									onChange={(e) => onChange("confirmPassword", e.target.value)}
									required={true}
								/>
								<button
									type="button"
									onClick={() => setConfirmVisible((prev) => !prev)}
									class="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
								>
									{confirmVisible ? "Hide" : "Show"}
								</button>
							</div>
						</div>
						<div>
							<label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
								Elevated Role
							</label>
							<select
								class="w-full px-4 py-2.5 rounded-lg outline-none bg-white dark:bg-[var(--theme-custom-0b1224)] text-slate-900 dark:text-slate-100 transition-colors shadow-borderless dark:shadow-borderlessDark"
								value={form.role}
								onChange={(e) => onChange("role", e.target.value)}
							>
								{ELEVATED_ACCOUNT_TYPES.map((item) => (
									<option key={item.value} value={item.value}>
										{item.label}
									</option>
								))}
							</select>
						</div>
						<div>
							<label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
								HQ Country
							</label>
							<select
								class="w-full px-4 py-2.5 rounded-lg outline-none transition-colors shadow-borderless dark:shadow-borderlessDark bg-white text-slate-900 dark:bg-[var(--theme-custom-0b1224)] dark:text-slate-100"
								value={form.country}
								onChange={(e) => onChange("country", e.target.value)}
								required={true}
							>
								<option value="">Select country</option>
								{COUNTRY_OPTIONS.map((country) => (
									<option key={country} value={country}>
										{country}
									</option>
								))}
							</select>
						</div>
						<div>
							<label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
								Organization / Entity
							</label>
							<input
								class="w-full px-4 py-2.5 rounded-lg outline-none transition-colors shadow-borderless dark:shadow-borderlessDark bg-white text-slate-900 dark:bg-[var(--theme-custom-0b1224)] dark:text-slate-100"
								value={form.organization}
								onChange={(e) => onChange("organization", e.target.value)}
								required={true}
							/>
						</div>
						<div>
							<label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
								Your Position
							</label>
							<select
								class="w-full px-4 py-2.5 rounded-lg outline-none bg-white dark:bg-[var(--theme-custom-0b1224)] text-slate-900 dark:text-slate-100 transition-colors shadow-borderless dark:shadow-borderlessDark"
								value={form.position}
								onChange={(e) => onChange("position", e.target.value)}
								required={true}
							>
								<option value="">Select position</option>
								{POSITIONS.map((p) => (
									<option key={p} value={p}>
										{p}
									</option>
								))}
							</select>
							{form.position === "Other" ? (
								<input
									class="mt-2 w-full px-4 py-2.5 rounded-lg outline-none transition-colors shadow-borderless dark:shadow-borderlessDark bg-white text-slate-900 dark:bg-[var(--theme-custom-0b1224)] dark:text-slate-100"
									value={form.customPosition}
									onChange={(e) => onChange("customPosition", e.target.value)}
									placeholder="Enter your position"
									required={true}
								/>
							) : null}
						</div>

						{form.role === "factory" ? (
							<div class="md:col-span-2">
								<label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
									Factory sector
								</label>
								<select
									class="w-full px-4 py-2.5 rounded-lg outline-none bg-white dark:bg-[var(--theme-custom-0b1224)] text-slate-900 dark:text-slate-100 transition-colors shadow-borderless dark:shadow-borderlessDark"
									value={form.factorySector}
									onChange={(e) => onChange("factorySector", e.target.value)}
									required={true}
								>
									<option value="">Select sector</option>
									{FACTORY_SECTOR_OPTIONS.map((item) => (
										<option key={item.value} value={item.value}>
											{item.label}
										</option>
									))}
								</select>
							</div>
						) : null}

						<div class="md:col-span-2 bg-blue-50 rounded-xl p-4 text-xs text-[var(--theme-custom-0a3d78)] leading-relaxed shadow-borderless dark:shadow-borderlessDark dark:bg-[var(--theme-custom-0a1a33)] dark:text-slate-200 dark:ring-1 dark:ring-[#0A66C2]/30">
							<p class="font-bold mb-1 underline">⚠️ Security Notice:</p>
							<p>
								Admin and Owner accounts are automatically granted full system verification and
								override capabilities. All actions performed through this terminal are logged for
								security auditing. High-level accounts must maintain 2FA after initial login.
							</p>
						</div>

						{error ? (
							<p class="md:col-span-2 text-sm font-bold text-rose-600 bg-rose-50 p-2 rounded shadow-borderless dark:shadow-borderlessDark dark:bg-rose-500/10 dark:text-rose-200">
								Auth Error: {error}
							</p>
						) : null}

						<div class="md:col-span-2 pt-2">
							<button
								disabled={loading}
								class="w-full py-3.5 rounded-lg bg-gtBlue hover:bg-gtBlueHover text-white font-bold shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50"
							>
								{loading ? (
									<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
								) : (
									"PROVISION ACCOUNT"
								)}
							</button>
						</div>
					</motion.form>
				</AnimatePresence>
			</div>
		</div>
	);
}
