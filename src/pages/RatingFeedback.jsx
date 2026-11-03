/*
  Route: /ratings/feedback
  Access: Protected (login required)
  Purpose: Show pending feedback requests and submit ratings.
*/

import {
	CheckCircle2,
	MessageSquareText,
	ShieldCheck,
	Sparkles,
	Star,
	UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ScrollReveal from "../components/ScrollReveal.jsx";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import { apiRequest, getToken } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

const STAR_OPTIONS = [1, 2, 3, 4, 5];
const MAX_COMMENT_LEN = 500;

const CATEGORY_LABELS = {
	sample_accuracy: "Sample Accuracy",
	communication_speed: "Communication Speed",
	quality_control: "Quality Control",
	delivery_timeliness: "Delivery Timeliness",
	after_sales_support: "After-Sales Support",
};
const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS);

function buildSignals(row) {
	const parts = [];
	parts.push(row?.signals?.contract_signed ? "Contract signed" : "No contract");
	parts.push(row?.signals?.recorded_call ? "Recorded call" : "No call");
	if (row?.signals?.avg_response_hours !== null && row?.signals?.avg_response_hours !== undefined) {
		parts.push(`Avg response ${row.signals.avg_response_hours}h`);
	}
	return parts;
}

function Stars({ value, onChange }) {
	return (
		<div className="flex items-center gap-1">
			{STAR_OPTIONS.map((score) => {
				const active = score <= value;
				return (
					<button
						key={score}
						type="button"
						aria-label={`${score} star`}
						onClick={() => onChange(score)}
						className={[
							"group inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200",
							"focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-transparent",
							active
								? "border-sky-400/60 bg-sky-500/10 text-sky-300 shadow-sm shadow-sky-500/10"
								: "border-slate-200/70 bg-white/70 text-slate-300 hover:border-sky-300/60 hover:text-sky-400 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-600 dark:hover:border-sky-400/50 dark:hover:text-sky-300",
						].join(" ")}
					>
						<Star className={`h-5 w-5 ${active ? "fill-current" : ""}`} />
					</button>
				);
			})}
		</div>
	);
}

function StatChip({ icon: Icon, label, value }) {
	return (
		<div className="inline-flex items-center gap-2 rounded-full border border-sky-500/15 bg-sky-500/5 px-3 py-1.5 text-sm text-slate-600 shadow-sm dark:text-slate-300">
			<Icon className="h-4 w-4 text-sky-400" />
			<span className="font-medium">{label}:</span>
			<span>{value}</span>
		</div>
	);
}

function formatDate(value) {
	if (!value) {
		return "recently";
	}
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) {
		return "recently";
	}
	return d.toLocaleDateString();
}

export default function RatingFeedback() {
	const token = useMemo(() => getToken(), []);
	const [searchParams] = useSearchParams();
	const focusProfileKey = searchParams.get("profile_key") || "";

	const [loading, setLoading] = useState(true);
	const [lookupDone, setLookupDone] = useState(false);
	const [error, setError] = useState("");
	const [items, setItems] = useState([]);
	const [lookup, setLookup] = useState({});
	const [drafts, setDrafts] = useState({});
	const [feedback, setFeedback] = useState("");
	const [submittingId, setSubmittingId] = useState("");

	useEffect(() => {
		if (!token) {
			return;
		}
		apiRequest("/ratings/feedback-requests", { token })
			.then((data) => {
				setError("");
				const rows = Array.isArray(data?.items) ? data.items : [];
				setItems(rows);
			setDrafts((prev) => {
				const next = { ...prev };
				rows.forEach((row) => {
					if (!next[row.id]) {
						const initialScore = Number(row?.suggested_score || 0);
						next[row.id] = {
							score: initialScore >= 1 ? Math.round(initialScore) : 4,
							comment: "",
							categories: {
								sample_accuracy: 0,
								communication_speed: 0,
								quality_control: 0,
								delivery_timeliness: 0,
								after_sales_support: 0,
							},
						};
					}
				});
				return next;
			});

				const ids = rows
					.map((row) => String(row.profile_key || "").replace(/^user:/, ""))
					.filter(Boolean);
				if (ids.length > 0) {
					apiRequest("/users/lookup", { method: "POST", token, body: { ids } })
						.then((res) => {
							const map = (res?.users || []).reduce((acc, user) => {
								acc[user.id] = user;
								return acc;
							}, {});
							setLookup(map);
						})
						.catch((err) => {
							logger.warn("User lookup failed:", err);
							setLookup({});
						})
						.finally(() => setLookupDone(true));
				} else {
					setLookup({});
					setLookupDone(true);
				}
			})
			.catch((err) => {
				setError(err.message || "Unable to load feedback requests");
				setItems([]);
			})
			.finally(() => setLoading(false));
	}, [token]);

	function updateDraft(id, patch) {
		setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
	}

	async function submitRating(row) {
		const draft = drafts[row.id];
		if (!draft?.score) {
			setFeedback("Please select a score before submitting.");
			return;
		}
		if (!row.profile_key) {
			setFeedback("Cannot submit: missing profile key.");
			return;
		}
		setSubmittingId(row.id);
		setFeedback("");
		try {
			await apiRequest(`/ratings/profiles/${encodeURIComponent(row.profile_key)}`, {
				method: "POST",
				token,
				body: {
					score: draft.score,
					comment: draft.comment,
					interaction_type: row.interaction_type || "deal",
					categories: draft.categories,
				},
			});
			setItems((prev) => prev.filter((item) => item.id !== row.id));
			setFeedback("Rating submitted. Thank you!");
		} catch (err) {
			setFeedback(err.message || "Unable to submit rating");
		} finally {
			setSubmittingId("");
		}
	}

	if (loading || !lookupDone) {
		return <NeonAtom fill={true} timeout={10000} />;
	}

	if (error) {
		return (
			<div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(109,171,223,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(55,115,168,0.12),_transparent_28%),linear-gradient(to_bottom,_#f8fbff,_#eef7ff_48%,_#f8fafc)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(109,171,223,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(55,115,168,0.12),_transparent_28%),linear-gradient(to_bottom,_#020617,_#07111f_55%,_#020617)]">
				<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
					<div className="rounded-[2rem] border border-red-500/20 bg-white/80 p-6 shadow-[0_10px_40px_rgba(239,68,68,0.08)] dark:bg-slate-950/70">
						<p className="text-sm font-medium text-red-600 dark:text-red-300">{error}</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(109,171,223,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(55,115,168,0.12),_transparent_28%),linear-gradient(to_bottom,_#f8fbff,_#eef7ff_48%,_#f8fafc)] text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(109,171,223,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(55,115,168,0.12),_transparent_28%),linear-gradient(to_bottom,_#020617,_#07111f_55%,_#020617)] dark:text-white">
			<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
				<ScrollReveal as="section">
					<div className="mb-6 rounded-[2rem] border border-sky-500/15 bg-white/75 p-6 shadow-[0_10px_40px_rgba(109,171,223,0.08)] backdrop-blur-xl dark:bg-slate-950/70">
						<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
							<div className="max-w-3xl space-y-3">
								<div className="inline-flex items-center gap-2 rounded-full border border-sky-500/15 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-700 dark:text-sky-300">
									<Sparkles className="h-3.5 w-3.5" />
									GarTexHub / Ratings
								</div>
								<div>
									<h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
										Rate recent interactions
									</h1>
									<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
										Feedback helps strengthen trust signals across GarTexHub.
									</p>
								</div>
							</div>
						</div>
					</div>
				</ScrollReveal>

				{feedback ? (
					<div className="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
						{feedback}
					</div>
				) : null}

				{items.length === 0 ? (
					<div className="rounded-[2rem] border border-slate-200/70 bg-white/80 p-10 text-center shadow-[0_10px_40px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-slate-950/70">
						<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-500/15 bg-sky-500/10">
							<MessageSquareText className="h-7 w-7 text-sky-500" />
						</div>
						<h2 className="text-lg font-semibold text-slate-900 dark:text-white">
							No pending rating requests right now.
						</h2>
						<p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
							New requests will appear here after qualifying interactions are completed.
						</p>
					</div>
				) : null}

				<ScrollReveal as="section">
					<div className="space-y-5">
						{items.map((row) => {
							const targetId = String(row.profile_key || "").replace(/^user:/, "");
							const target = lookup[targetId] || {};
							const draft = drafts[row.id] || { score: 4, comment: "" };
							const suggested = row?.suggested_score ? Number(row.suggested_score) : null;
							const isFocused = focusProfileKey && row.profile_key === focusProfileKey;
							const signalsList = buildSignals(row);
							const suggestedReasons = Array.isArray(row.suggested_reasons)
								? row.suggested_reasons
								: [];

							return (
								<div
									key={row.id}
									className={[
										"relative overflow-hidden rounded-3xl border p-5 shadow-[0_10px_35px_rgba(15,23,42,0.08)] transition-all",
										"bg-white/85 backdrop-blur-xl dark:bg-slate-950/70",
										isFocused
											? "border-sky-400/70 ring-2 ring-sky-400/30 shadow-sky-500/10"
											: "border-slate-200/70 dark:border-white/10",
									].join(" ")}
								>
									<div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-cyan-400 to-blue-500 opacity-80" />

									<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
										<div className="space-y-3">
											<div className="flex flex-wrap items-center gap-2">
												<h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
													{target.name || "Counterparty"}
												</h3>
												<span className="rounded-full border border-sky-500/15 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-600 dark:text-sky-300">
													{target.role || "User"}
												</span>
												{isFocused ? (
													<span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-300">
														<Sparkles className="h-3.5 w-3.5" />
														Focused
													</span>
												) : null}
											</div>

											<div className="grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2 xl:grid-cols-4">
												<div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
													<UserRound className="h-4 w-4 text-sky-500" />
													<span className="truncate">{target.email || "--"}</span>
												</div>
												<div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
													<ShieldCheck className="h-4 w-4 text-sky-500" />
													<span>{row.interaction_type || "deal"}</span>
												</div>
												<div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
													<MessageSquareText className="h-4 w-4 text-sky-500" />
													<span>{formatDate(row.created_at)}</span>
												</div>
												<div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
													<CheckCircle2 className="h-4 w-4 text-sky-500" />
													<span>profile_key: {row.profile_key || "—"}</span>
												</div>
											</div>

											<div className="flex flex-wrap gap-2">
												{signalsList.map((signal) => (
													<StatChip key={signal} icon={Sparkles} label="Signal" value={signal} />
												))}
											</div>
										</div>

										<div className="w-full max-w-[360px] rounded-3xl border border-sky-500/15 bg-gradient-to-br from-sky-500/10 via-cyan-500/5 to-transparent p-4 dark:from-sky-500/15 dark:via-sky-500/5 dark:to-transparent">
											<div className="mb-2 flex items-center justify-between gap-2">
												<div>
													<p className="text-sm font-semibold text-slate-900 dark:text-white">
														Suggested rating
													</p>
													<p className="text-xs text-slate-500 dark:text-slate-400">
														{suggested === null
															? "Default score 4"
															: `Score ${suggested.toFixed(1)}`}
													</p>
												</div>
												{suggested === null ? null : (
													<button
														type="button"
														onClick={() =>
															updateDraft(row.id, {
																score: Math.round(suggested),
															})
														}
														className="rounded-full border border-sky-500/20 bg-white px-3 py-1.5 text-xs font-medium text-sky-600 shadow-sm transition hover:border-sky-400/40 hover:bg-sky-50 dark:bg-slate-950 dark:text-sky-300 dark:hover:bg-slate-900"
													>
														Use suggested
													</button>
												)}
											</div>

											{suggested === null ? null : (
												<div className="mb-3 rounded-2xl border border-sky-500/10 bg-white/80 p-3 text-sm text-slate-600 dark:bg-slate-950/60 dark:text-slate-300">
													<div className="mb-1 font-medium text-slate-800 dark:text-slate-100">
														Why this score?
													</div>
													<div className="flex flex-wrap gap-2">
														{suggestedReasons.length > 0 ? (
															suggestedReasons.map((reason) => (
																<span
																	key={reason}
																	className="rounded-full bg-sky-500/10 px-2.5 py-1 text-xs text-sky-700 dark:text-sky-300"
																>
																	{reason}
																</span>
															))
														) : (
															<span className="text-xs text-slate-500 dark:text-slate-400">
																No suggested reasons available.
															</span>
														)}
													</div>
												</div>
											)}

											<div className="space-y-3">
												<div>
													<label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
														Rating
													</label>
													<Stars
														value={draft.score}
														onChange={(score) => updateDraft(row.id, { score })}
													/>
												</div>

												<div>
													<label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
														Category Ratings (optional)
													</label>
													<div className="space-y-2">
														{CATEGORY_KEYS.map((key) => (
															<div key={key} className="flex items-center justify-between gap-3">
																<span className="text-xs text-slate-600 dark:text-slate-400 min-w-[140px]">
																	{CATEGORY_LABELS[key]}
																</span>
																<Stars
																	value={draft.categories?.[key] || 0}
																	onChange={(val) =>
																		updateDraft(row.id, {
																			categories: {
																				...(draft.categories || {}),
																				[key]: val,
																			},
																		})
																	}
																/>
															</div>
														))}
													</div>
												</div>

												<div>
													<label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
														Comment
													</label>
													<textarea
														rows={3}
														value={draft.comment}
														onChange={(e) => updateDraft(row.id, { comment: e.target.value })}
														placeholder="Optional comment for this interaction..."
														className="w-full rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-slate-950/50 dark:text-white dark:placeholder:text-slate-500"
													/>
													<div className="mt-1 text-right text-xs text-slate-500 dark:text-slate-400">
														{draft.comment.length}/{MAX_COMMENT_LEN}
													</div>
												</div>

												<div className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
													<span className="font-medium text-slate-800 dark:text-slate-100">
														Signals:
													</span>{" "}
													{signalsList.join(" · ")}
												</div>

												<button
													type="button"
													onClick={() => submitRating(row)}
													disabled={submittingId === row.id}
													className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:from-sky-400 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
												>
													{submittingId === row.id ? "Submitting..." : "Submit rating"}
												</button>
											</div>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</ScrollReveal>
			</div>
		</div>
	);
}
