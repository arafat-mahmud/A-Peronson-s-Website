/*
  Routes: /forgot-password, /reset-password?token=...
  Access: Public

  Self-service password reset. The request page always shows the same message
  (it never reveals whether an email has an account); the reset page accepts
  the one-time token from the emailed link.
*/

import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
	PASSWORD_MAX_LENGTH,
	PASSWORD_RULES,
	passwordProblems,
} from "../../../shared/config/passwordPolicy.js";
import BrandMark from "../../components/ui/BrandMark.jsx";
import { apiRequest } from "../../lib/auth.js";
import { cn } from "../../lib/cn.js";
import usePageMeta from "../../lib/usePageMeta.js";

const inputClass =
	"w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10 dark:border-white/10 dark:bg-white/5";

function AuthCard({ title, subtitle, children }) {
	return (
		<div class="min-h-[70vh] bg-slate-50 px-4 py-10 text-slate-900 dark:bg-[var(--theme-custom-07111f)] dark:text-white">
			<div class="mx-auto w-full max-w-md rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[var(--theme-custom-0b1627-80)] sm:p-8">
				<Link to="/" class="mb-6 inline-flex items-center gap-2" aria-label="GarTexHub home">
					<BrandMark size={32} alt="" />
					<span class="text-base font-bold">GarTexHub</span>
				</Link>
				<h1 class="text-2xl font-bold tracking-tight">{title}</h1>
				<p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{subtitle}</p>
				<div class="mt-6">{children}</div>
			</div>
		</div>
	);
}

function SubmitButton({ busy, children }) {
	return (
		<button
			type="submit"
			disabled={busy}
			class="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-3.5 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-wait disabled:opacity-80"
		>
			{busy ? <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}
			{children}
		</button>
	);
}

export function ForgotPassword() {
	usePageMeta({ title: "Reset password — GarTexHub", robots: "noindex,nofollow" });
	const [email, setEmail] = useState("");
	const [busy, setBusy] = useState(false);
	const [done, setDone] = useState("");
	const [error, setError] = useState("");

	const submit = async (event) => {
		event.preventDefault();
		if (busy) return;
		setError("");
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
			setError("Enter the email address you signed up with.");
			return;
		}
		setBusy(true);
		try {
			const data = await apiRequest("/auth/password/forgot", { method: "POST", body: { email: email.trim() } });
			setDone(data?.message || "If an account exists for that email, a reset link has been sent.");
		} catch (err) {
			setError(err?.message || "Could not send the reset link. Try again.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<AuthCard
			title="Forgot your password?"
			subtitle="Enter your account email and we'll send you a link to choose a new password."
		>
			{done ? (
				<div role="status" class="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
					{done}
				</div>
			) : (
				<form onSubmit={submit} noValidate={true} class="space-y-4">
					<label htmlFor="forgot-email" class="text-sm font-medium text-slate-700 dark:text-slate-200">
						Email
					</label>
					<input
						id="forgot-email"
						type="email"
						inputMode="email"
						autoComplete="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="name@company.com"
						class={inputClass}
					/>
					{error ? <p class="text-xs font-medium text-rose-500">{error}</p> : null}
					<SubmitButton busy={busy}>Send reset link</SubmitButton>
				</form>
			)}
			<p class="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
				Remembered it?{" "}
				<Link to="/login" class="font-semibold text-sky-700 hover:text-sky-800 dark:text-sky-300">
					Back to login
				</Link>
			</p>
		</AuthCard>
	);
}

export default function ResetPassword() {
	usePageMeta({ title: "Choose a new password — GarTexHub", robots: "noindex,nofollow" });
	const [searchParams] = useSearchParams();
	const token = searchParams.get("token") || "";
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [shown, setShown] = useState(false);
	const [busy, setBusy] = useState(false);
	const [done, setDone] = useState(false);
	const [error, setError] = useState("");

	const problems = passwordProblems(password);

	const submit = async (event) => {
		event.preventDefault();
		if (busy) return;
		setError("");
		if (problems.length > 0) {
			setError(`Password needs: ${problems.join(", ").toLowerCase()}`);
			return;
		}
		if (password !== confirm) {
			setError("Passwords do not match");
			return;
		}
		setBusy(true);
		try {
			await apiRequest("/auth/password/reset", { method: "POST", body: { token, password } });
			setDone(true);
		} catch (err) {
			setError(err?.message || "Could not reset the password.");
		} finally {
			setBusy(false);
		}
	};

	if (!token) {
		return (
			<AuthCard title="Reset link missing" subtitle="Open the link from the reset email, or request a new one.">
				<Link to="/forgot-password" class="font-semibold text-sky-700 dark:text-sky-300">
					Request a new reset link
				</Link>
			</AuthCard>
		);
	}

	if (done) {
		return (
			<AuthCard title="Password updated" subtitle="All other sessions were signed out. Sign in with your new password.">
				<Link
					to="/login"
					class="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-3.5 text-sm font-bold text-white"
				>
					Go to login
				</Link>
			</AuthCard>
		);
	}

	return (
		<AuthCard title="Choose a new password" subtitle="The link works once and expires 30 minutes after it was sent.">
			<form onSubmit={submit} noValidate={true} class="space-y-4">
				<div class="space-y-2">
					<label htmlFor="reset-password" class="text-sm font-medium text-slate-700 dark:text-slate-200">
						New password
					</label>
					<div class="relative">
						<input
							id="reset-password"
							type={shown ? "text" : "password"}
							autoComplete="new-password"
							maxLength={PASSWORD_MAX_LENGTH}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							class={cn(inputClass, "pr-20")}
						/>
						<button
							type="button"
							onClick={() => setShown((v) => !v)}
							class="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-200"
						>
							{shown ? "Hide" : "Show"}
						</button>
					</div>
					{password ? (
						<ul class="flex flex-wrap gap-x-4 gap-y-1">
							{PASSWORD_RULES.map((rule) => (
								<li
									key={rule.id}
									class={cn(
										"text-xs",
										rule.test(password) ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500",
									)}
								>
									{rule.test(password) ? "✓ " : "• "}
									{rule.label}
								</li>
							))}
						</ul>
					) : null}
				</div>
				<div class="space-y-2">
					<label htmlFor="reset-confirm" class="text-sm font-medium text-slate-700 dark:text-slate-200">
						Confirm new password
					</label>
					<input
						id="reset-confirm"
						type={shown ? "text" : "password"}
						autoComplete="new-password"
						maxLength={PASSWORD_MAX_LENGTH}
						value={confirm}
						onChange={(e) => setConfirm(e.target.value)}
						class={inputClass}
					/>
				</div>
				{error ? (
					<p role="alert" class="text-sm font-medium text-rose-600 dark:text-rose-300">
						{error}
					</p>
				) : null}
				<SubmitButton busy={busy}>Update password</SubmitButton>
			</form>
		</AuthCard>
	);
}
