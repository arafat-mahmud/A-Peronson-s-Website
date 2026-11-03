import { motion } from "framer-motion";
import {
	ArrowLeft,
	BadgeCheck,
	Building2,
	ChevronLeft,
	Globe2,
	Mail,
	MapPin,
	Phone,
	SearchX,
	Shield,
	ShieldCheck,
	UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import LazyImage from "../components/ui/LazyImage.jsx";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import { apiRequest, getCurrentUser, getToken } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import usePageMeta from "../lib/usePageMeta.js";

function Pill({ children, tone = "default" }) {
	const tones = {
		default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
		success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
		info: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
		premium: "bg-gradient-to-r from-sky-500 to-cyan-500 text-white",
	};
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone] || tones.default}`}
		>
			{children}
		</span>
	);
}

function Metric({ label, value, helper }) {
	return (
		<div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800/80 dark:bg-slate-900/40">
			<div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
				{label}
			</div>
			<div className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">{value}</div>
			{helper ? (
				<div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helper}</div>
			) : null}
		</div>
	);
}

function InfoRow({ label, children }) {
	return (
		<div className="flex items-center justify-between gap-3 py-2">
			<span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
				{label}
			</span>
			<span className="text-right text-sm font-bold text-slate-900 dark:text-white">
				{children}
			</span>
		</div>
	);
}

function SoftCard({ children, className = "" }) {
	return (
		<div
			className={`rounded-3xl border border-slate-200/70 bg-white/75 p-4 shadow-[0_10px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/65 ${className}`}
		>
			{children}
		</div>
	);
}

function AvatarFallback({ name, imageUrl }) {
	const initials = (n) => {
		if (!n) {
			return "?";
		}
		return n
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase())
			.join("");
	};
	return (
		<div className="relative h-24 w-24 overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-sky-500 via-cyan-400 to-indigo-500 p-[2px] shadow-xl">
			<div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[1.15rem] bg-slate-100 text-2xl font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-100">
				{imageUrl ? (
					<LazyImage
						src={imageUrl}
						alt={name || "Profile avatar"}
						width={40}
						height={40}
						loading="eager"
						className="h-full w-full object-cover"
					/>
				) : (
					initials(name)
				)}
			</div>
		</div>
	);
}

function ProfileNotFound() {
	return (
		<div className="flex min-h-[60vh] items-center justify-center px-4">
			<div className="mx-auto max-w-md text-center">
				<div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
					<SearchX className="h-10 w-10 text-slate-400" />
				</div>
				<h1 className="text-2xl font-semibold text-slate-900 dark:text-white">User not found</h1>
				<p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
					This profile doesn't exist or you may not have access.
				</p>
				<Link
					to="/"
					className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-sky-500/20 hover:bg-sky-500"
				>
					<ArrowLeft className="h-4 w-4" />
					Back to home
				</Link>
			</div>
		</div>
	);
}

export default function ProfilePage() {
	const { id } = useParams();
	const navigate = useNavigate();
	const [target, setTarget] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [activeTab, setActiveTab] = useState("overview");

	usePageMeta({ title: "Profile — GarTexHub", url: `/profile/${id}`, robots: "noindex,nofollow" });

	useEffect(() => {
		let cancelled = false;
		async function lookup() {
			try {
				const data = await apiRequest("/users/lookup", {
					method: "POST",
					token: getToken(),
					body: { ids: [id] },
				});
				const user = data?.users?.[0];
				if (!cancelled) {
					setTarget(user || null);
				}
			} catch (err) {
				logger.warn("API error:", err);
				if (!cancelled) {
					setError(true);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}
		lookup();
		return () => {
			cancelled = true;
		};
	}, [id]);

	if (loading) {
		return <NeonAtom fill={true} timeout={10000} />;
	}
	if (error || !target) {
		return <ProfileNotFound />;
	}

	const role = target.role;
	if (role === "buyer") {
		return <Navigate to={`/buyer/${id}`} replace={true} />;
	}
	if (role === "factory") {
		return <Navigate to={`/factory/${id}`} replace={true} />;
	}
	if (role === "buying_house") {
		return <Navigate to={`/buying-house/${id}`} replace={true} />;
	}

	const profile = target.profile || {};
	const displayName = target.name || "";
	const displayRole = (role || "").replace(/_/g, " ");
	const avatarImage =
		target.avatar_url || profile.avatar_url || profile.profile_image || profile.avatar || "";
	const coverImage = profile.cover_image_url || "";
	const country = profile.country || "";
	const company = profile.company || "";
	const industry = profile.industry || "";
	const headline = profile.headline || "";
	const bio = profile.bio || "";
	const email = target.email || "";
	const currentUser = getCurrentUser();
	const isOwner = currentUser && String(currentUser.id) === String(target.id);
	const isAdmin = ["owner", "admin"].includes(currentUser?.role);
	const showEmail = isOwner || isAdmin || !profile?.hide_email;
	const showPhone = isOwner || isAdmin || !profile?.hide_phone;
	const phone = target.phone || profile?.phone || "";
	const joinedYear = target.created_at ? new Date(target.created_at).getFullYear() : "—";

	const badges = [
		target.verified ? { label: "Verified", icon: ShieldCheck, tone: "success" } : null,
	].filter(Boolean);

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(51,122,176,0.16),transparent_28%),linear-gradient(to_bottom,rgba(2,6,23,0.02),rgba(2,6,23,0))] text-slate-900 dark:bg-[radial-gradient(circle_at_top,rgba(51,122,176,0.22),transparent_30%),linear-gradient(to_bottom,rgba(2,6,23,0.95),rgba(2,6,23,1))] dark:text-slate-100">
			<div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				<div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-2 shadow-sm backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/60">
					<button
						onClick={() => navigate(-1)}
						className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:text-sky-300"
					>
						<ChevronLeft className="h-4 w-4" /> Back
					</button>
					<div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
						<Shield className="h-3.5 w-3.5" /> Role:{" "}
						<span className="font-bold capitalize text-slate-900 dark:text-white">
							{displayRole}
						</span>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.55fr_0.85fr]">
					<div className="w-full space-y-6">
						<motion.div
							initial={{ opacity: 0, y: 16 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.45 }}
							className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/80 shadow-[0_24px_100px_rgba(51,122,176,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70"
						>
							<div className="relative h-[280px] overflow-hidden sm:h-[340px]">
								{coverImage ? (
									<img
										src={coverImage}
										alt="Cover"
										className="absolute inset-0 h-full w-full object-cover"
									/>
								) : (
									<div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(109,171,223,0.35),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.22),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(51,122,176,0.3))]" />
								)}
								<div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/35 to-transparent" />
								<div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
									<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
										<div className="flex items-center gap-4">
											<div className="shrink-0">
												<AvatarFallback name={displayName} imageUrl={avatarImage} />
											</div>
											<div className="min-w-0 text-white">
												<h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
													{displayName}
												</h1>
												<div className="mt-2 flex flex-wrap items-center gap-2">
													{badges.map((badge) => (
														<Pill key={badge.label} tone={badge.tone}>
															<badge.icon className="h-3.5 w-3.5" /> {badge.label}
														</Pill>
													))}
													<Pill tone="info">{displayRole}</Pill>
													{country ? (
														<Pill tone="info">
															<MapPin className="h-3.5 w-3.5" /> {country}
														</Pill>
													) : null}
												</div>
											</div>
										</div>
										{showEmail && email ? (
											<div className="flex shrink-0 flex-wrap items-center gap-2">
												<button
													onClick={() => (window.location.href = `mailto:${email}`)}
													className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:-translate-y-0.5 hover:bg-sky-400"
												>
													<Mail className="h-4 w-4" /> Contact
												</button>
												{showPhone && phone ? (
													<button
														onClick={() => (window.location.href = `tel:${phone}`)}
														className="inline-flex items-center gap-2 rounded-full border border-sky-300 bg-white/80 px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-50 dark:border-sky-700 dark:bg-slate-950/70 dark:text-sky-300 dark:hover:bg-sky-950"
													>
														<Phone className="h-4 w-4" /> Call
													</button>
												) : null}
											</div>
										) : null}
									</div>
								</div>
							</div>

							<div className="border-t border-slate-200/70 dark:border-slate-800/80">
								<div
									role="tablist"
									aria-label="Profile sections"
									className="flex gap-1 overflow-x-auto p-2"
								>
									{[
										{ id: "overview", label: "Overview" },
										{ id: "company", label: "Company Details" },
										{ id: "verification", label: "Verification & Docs" },
										{ id: "activity", label: "Activity" },
									].map((tab) => (
										<button
											key={tab.id}
											type="button"
											role="tab"
											aria-selected={activeTab === tab.id}
											onClick={() => setActiveTab(tab.id)}
											className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
												activeTab === tab.id
													? "bg-sky-500 text-white shadow-lg shadow-sky-500/25"
													: "text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
											}`}
										>
											{tab.label}
										</button>
									))}
								</div>
							</div>
						</motion.div>

						{activeTab === "overview" && (
							<div className="space-y-6">
								<div className="grid gap-4 sm:grid-cols-3">
									<SoftCard>
										<h3 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
											Trust & Compliance
										</h3>
										<div className="mt-2 divide-y divide-slate-200/60 dark:divide-slate-800/60">
											{target.verified ? (
												<InfoRow label="Status">
													<span className="inline-flex items-center gap-1.5">
														<BadgeCheck className="h-4 w-4 text-emerald-500" />
														Verified
													</span>
												</InfoRow>
											) : null}
											{target.verified ? (
												<InfoRow label="Identity">Verified account</InfoRow>
											) : null}
										</div>
									</SoftCard>
									<SoftCard>
										<h3 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
											Account Metrics
										</h3>
										<div className="mt-2 divide-y divide-slate-200/60 dark:divide-slate-800/60">
											<InfoRow label="Account age">{joinedYear}</InfoRow>
											<InfoRow label="Role">
												<span className="capitalize">{displayRole}</span>
											</InfoRow>
										</div>
									</SoftCard>
									{industry || country || (showEmail && email) ? (
										<SoftCard>
											<h3 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
												Business Info
											</h3>
											<div className="mt-2 divide-y divide-slate-200/60 dark:divide-slate-800/60">
												{industry ? <InfoRow label="Industry">{industry}</InfoRow> : null}
												{country ? <InfoRow label="Country">{country}</InfoRow> : null}
												{Number.isFinite(Number(target.capacity)) && Number(target.capacity) > 0 ? (
													<InfoRow label="Capacity">
														{Number(target.capacity).toLocaleString()} employees
													</InfoRow>
												) : null}
												{showEmail && email ? <InfoRow label="Email">{email}</InfoRow> : null}
											</div>
										</SoftCard>
									) : null}
								</div>

								{headline || bio ? (
									<SoftCard>
										<h3 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
											About / Executive Summary
										</h3>
										{headline && headline !== bio ? (
											<p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
												{headline}
											</p>
										) : null}
										{bio ? (
											<p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
												{bio}
											</p>
										) : null}
									</SoftCard>
								) : null}
							</div>
						)}

						{activeTab === "company" && (company || industry || country || email) ? (
							<SoftCard>
								<h3 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
									Company Details
								</h3>
								<div className="mt-3 grid gap-3 sm:grid-cols-2">
									{company ? (
										<div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/70">
											<Building2 className="h-4 w-4 shrink-0 text-sky-500" />
											<div>
												<div className="text-xs text-slate-500 dark:text-slate-400">Company</div>
												<div className="text-sm font-medium text-slate-900 dark:text-white">
													{company}
												</div>
											</div>
										</div>
									) : null}
									{industry ? (
										<div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/70">
											<Globe2 className="h-4 w-4 shrink-0 text-sky-500" />
											<div>
												<div className="text-xs text-slate-500 dark:text-slate-400">Industry</div>
												<div className="text-sm font-medium text-slate-900 dark:text-white">
													{industry}
												</div>
											</div>
										</div>
									) : null}
									{country ? (
										<div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/70">
											<MapPin className="h-4 w-4 shrink-0 text-sky-500" />
											<div>
												<div className="text-xs text-slate-500 dark:text-slate-400">Country</div>
												<div className="text-sm font-medium text-slate-900 dark:text-white">
													{country}
												</div>
											</div>
										</div>
									) : null}
									{showEmail && email ? (
										<div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/70">
											<Mail className="h-4 w-4 shrink-0 text-sky-500" />
											<div>
												<div className="text-xs text-slate-500 dark:text-slate-400">Email</div>
												<div className="text-sm font-medium text-slate-900 dark:text-white">
													{email}
												</div>
											</div>
										</div>
									) : null}
									{showPhone && phone ? (
										<div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/70">
											<Phone className="h-4 w-4 shrink-0 text-sky-500" />
											<div>
												<div className="text-xs text-slate-500 dark:text-slate-400">Phone</div>
												<div className="text-sm font-medium text-slate-900 dark:text-white">
													{phone}
												</div>
											</div>
										</div>
									) : null}
								</div>
							</SoftCard>
						) : null}

						{activeTab === "verification" && (
							<div className="space-y-6">
								<SoftCard>
									<h3 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
										Verification & Docs
									</h3>
									<div className="mt-2 divide-y divide-slate-200/60 dark:divide-slate-800/60">
										{target.verified ? (
											<InfoRow label="Status">
												<span className="inline-flex items-center gap-1.5">
													<BadgeCheck className="h-4 w-4 text-emerald-500" />
													Verified
												</span>
											</InfoRow>
										) : null}
										{target.verified ? <InfoRow label="Identity">Verified account</InfoRow> : null}
									</div>
									<div className="mt-4 rounded-2xl border border-dashed border-slate-300/70 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
										No verification documents shared yet.
									</div>
								</SoftCard>
							</div>
						)}

						{activeTab === "activity" && (
							<SoftCard>
								<h3 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
									Activity
								</h3>
								<p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
									No recent activity yet.
								</p>
							</SoftCard>
						)}
					</div>

					<aside className="space-y-6">
						<SoftCard>
							<div className="flex items-center gap-2">
								<UserRound className="h-4 w-4 text-sky-500" />
								<h3 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
									Account
								</h3>
							</div>
							<div className="mt-4 space-y-3">
								<div className="flex items-center justify-between text-sm">
									<span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
										Role
									</span>
									<span className="font-bold capitalize text-slate-900 dark:text-white">
										{displayRole}
									</span>
								</div>
								{target.verified ? (
									<div className="flex items-center justify-between text-sm">
										<span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
											Status
										</span>
										<span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
											<BadgeCheck className="h-3.5 w-3.5" />
											Verified
										</span>
									</div>
								) : null}
								<div className="flex items-center justify-between text-sm">
									<span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
										Joined
									</span>
									<span className="font-bold text-slate-900 dark:text-white">{joinedYear}</span>
								</div>
							</div>
						</SoftCard>
					</aside>
				</div>
			</div>
		</div>
	);
}
