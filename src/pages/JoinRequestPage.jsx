import { CheckCircle2, Mail, MessageSquareText, Shield, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import LazyImage from "../components/ui/LazyImage.jsx";
import { apiRequest, getToken } from "../lib/auth.js";
import { useTheme } from "../lib/ThemeProvider.jsx";

function Field({ label, value }) {
	return (
		<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
			<div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
			<div className="mt-2 text-sm font-semibold text-white">{value || "—"}</div>
		</div>
	);
}

export default function JoinRequestPage() {
	const { requestId } = useParams();
	const navigate = useNavigate();
	const token = getToken();
	const { theme } = useTheme();
	const isDark = theme === "dark";
	const [request, setRequest] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [actioning, setActioning] = useState("");
	const [reason, setReason] = useState("");
	const [feedback, setFeedback] = useState("");

	useEffect(() => {
		let active = true;
		(async () => {
			try {
				const data = await apiRequest(`/join-requests/${encodeURIComponent(requestId)}`, { token });
				if (active) {
					setRequest(data);
				}
			} catch (err) {
				if (active) {
					setError(err.message || "Unable to load join request");
				}
			} finally {
				if (active) {
					setLoading(false);
				}
			}
		})();
		return () => {
			active = false;
		};
	}, [requestId, token]);

	const meta = request?.meta || {};
	const isPending = String(meta.status || "pending") === "pending";
	const applicantName = meta.applicant_name || request?.user?.name || "Applicant";
	const companyName = meta.company_name || "Company";
	const canAct = isPending && Boolean(token) && (request?.user_id === request?.user?.id || true);

	const cardClass = isDark
		? "border-white/10 bg-white/5 shadow-[0_20px_80px_rgba(2,8,23,0.55)]"
		: "border-slate-200 bg-white/85 shadow-[0_20px_70px_rgba(51,122,176,0.12)]";

	const bannerStyle = useMemo(
		() =>
			meta.company_banner
				? {
						backgroundImage: `linear-gradient(rgba(15,23,42,0.4), rgba(15,23,42,0.4)), url(${meta.company_banner})`,
						backgroundSize: "cover",
						backgroundPosition: "center",
					}
				: undefined,
		[meta.company_banner],
	);

	async function respond(action) {
		setError("");
		setFeedback("");
		setActioning(action);
		try {
			await apiRequest(`/join-requests/${encodeURIComponent(requestId)}/respond`, {
				method: "POST",
				token,
				body: {
					action,
					reason,
				},
			});
			setFeedback(action === "accept" ? "Join request approved." : "Join request rejected.");
			const refreshed = await apiRequest(`/join-requests/${encodeURIComponent(requestId)}`, { token });
			setRequest(refreshed);
		} catch (err) {
			setError(err.message || "Unable to update join request");
		} finally {
			setActioning("");
		}
	}

	if (loading) {
		return <NeonAtom fill={true} timeout={10000} />;
	}

	return (
		<div className={isDark ? "min-h-screen bg-slate-950 text-slate-100" : "min-h-screen bg-slate-50 text-slate-900"}>
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-6 lg:px-8">
				<div className={`overflow-hidden rounded-[2rem] border ${cardClass}`}>
					<div className="h-44 w-full" style={bannerStyle}>
						<div className="flex h-full items-end justify-between p-6">
							<div>
								<div className="inline-flex items-center gap-2 rounded-full bg-black/30 px-3 py-1 text-xs font-semibold text-white">
									<Shield className="h-4 w-4" />
									Verified Company Join Request
								</div>
								<h1 className="mt-4 text-3xl font-black text-white">{companyName}</h1>
								<p className="mt-2 max-w-2xl text-sm text-white/85">
									{isPending
										? 'A Verified Company Account already exists with this information. Are you a representative of this company?'
										: `This request has been ${String(meta.status || "").toLowerCase()}.`}
								</p>
							</div>
							{meta.company_logo ? (
								<LazyImage
									src={meta.company_logo}
									alt={companyName}
									width={80}
									height={80}
									className="h-20 w-20 rounded-2xl bg-white object-cover shadow-xl"
									eager={true}
								/>
							) : null}
						</div>
					</div>
					<div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
						<Field label="Applicant" value={applicantName} />
						<Field label="Email" value={meta.applicant_email} />
						<Field label="Position" value={meta.position} />
						<Field label="Company" value={companyName} />
					</div>
				</div>

				<div className={`grid gap-6 lg:grid-cols-[1.4fr_0.9fr]`}>
					<div className={`rounded-[2rem] border p-6 ${cardClass}`}>
						<div className="flex items-center gap-3">
							<div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-500/15 text-sky-300">
								<UserRound className="h-5 w-5" />
							</div>
							<div>
								<h2 className="text-xl font-bold">Applicant details</h2>
								<p className="text-sm text-slate-400">Review who is asking to join your company account.</p>
							</div>
						</div>

						<div className="mt-5 grid gap-4 sm:grid-cols-2">
							<Field label="Name" value={meta.applicant_name} />
							<Field label="Email" value={meta.applicant_email} />
							<Field label="Position" value={meta.position} />
							<Field label="Source Verification ID" value={meta.source_verification_id} />
						</div>
						<div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4">
							<div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
								<MessageSquareText className="h-4 w-4" />
								Short message
							</div>
							<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
								{meta.message || "—"}
							</p>
						</div>
					</div>

					<div className={`rounded-[2rem] border p-6 ${cardClass}`}>
						<div className="flex items-center gap-3">
							<div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300">
								<CheckCircle2 className="h-5 w-5" />
							</div>
							<div>
								<h2 className="text-xl font-bold">Decision</h2>
								<p className="text-sm text-slate-400">
									Accept to connect the applicant as an agent/team member, or reject with a reason.
								</p>
							</div>
						</div>

						<div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
							<div className="font-semibold text-white">
								{isPending ? "Waiting for your approval" : `Status: ${String(meta.status || "").toUpperCase()}`}
							</div>
							{meta.reason ? <div className="mt-2">Reason: {meta.reason}</div> : null}
							{meta.acted_at ? <div className="mt-2">Handled at: {new Date(meta.acted_at).toLocaleString()}</div> : null}
						</div>

						{isPending ? (
							<div className="mt-5 space-y-3">
								<label className="block text-sm font-medium text-slate-300" htmlFor="join-request-reason">
									Rejection reason
								</label>
								<textarea
									id="join-request-reason"
									value={reason}
									onChange={(event) => setReason(event.target.value)}
									placeholder="Add a written reason if you reject this request."
									className="min-h-28 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-slate-500"
								/>
								<div className="flex flex-wrap gap-3">
									<button
										type="button"
										disabled={actioning === "accept"}
										onClick={() => respond("accept")}
										className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
									>
										{actioning === "accept" ? "Approving..." : "Accept"}
									</button>
									<button
										type="button"
										disabled={actioning === "reject"}
										onClick={() => respond("reject")}
										className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
									>
										{actioning === "reject" ? "Rejecting..." : "Reject"}
									</button>
								</div>
							</div>
						) : (
							<div className="mt-5 flex flex-wrap gap-3">
								<Link
									to="/notifications"
									className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-500"
								>
									View notifications
								</Link>
								<button
									type="button"
									onClick={() => navigate(-1)}
									className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/5"
								>
									Go back
								</button>
							</div>
						)}

						{error ? <div className="mt-4 text-sm text-rose-300">{error}</div> : null}
						{feedback ? <div className="mt-4 text-sm text-emerald-300">{feedback}</div> : null}
					</div>
				</div>

				<div className="flex items-center justify-between text-xs text-slate-400">
					<span>Join requests keep verified companies from spawning duplicate accounts.</span>
					<span>
						<Link className="text-sky-400 hover:text-sky-300" to="/notifications">
							Open inbox
						</Link>
					</span>
				</div>
				{error && !request ? (
					<div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
						{error}
					</div>
				) : null}
			</div>
		</div>
	);
}
