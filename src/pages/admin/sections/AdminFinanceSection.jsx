import { useMemo, useState } from "react";
import { ThreeDot } from "react-loading-indicators";
import { apiRequest, getToken } from "../../../lib/auth.js";

export function AdminFinanceSection({
	adminDark,
	catalog,
	walletLedger,
	users,
	formatNumber,
	formatCurrency,
	error,
	setError,
}) {
	const [busyUserId, setBusyUserId] = useState(null);
	const [subQuery, setSubQuery] = useState("");

	const finance = catalog?.finance || {};
	const wallet = catalog?.wallet || {};
	const revenueSummary = finance.revenue_summary || [];
	const failedRenewals = finance.failed_renewals || [];
	const invoices = finance.invoices || [];
	const payouts = finance.payouts || [];
	const ledger = walletLedger?.length ? walletLedger : wallet.ledger || [];

	const totalSubs = revenueSummary.reduce((sum, r) => sum + (r.subscribers || 0), 0);
	const revenueEstimate = revenueSummary.reduce(
		(sum, r) => sum + (r.subscribers || 0) * (r.price_usd || 0),
		0,
	);

	const filteredUsers = useMemo(() => {
		if (!subQuery) return users || [];
		const q = subQuery.toLowerCase();
		return (users || []).filter(
			(u) =>
				String(u.id || "")
					.toLowerCase()
					.includes(q) ||
				String(u.email || "")
					.toLowerCase()
					.includes(q) ||
				String(u.name || "")
					.toLowerCase()
					.includes(q),
		);
	}, [users, subQuery]);

	const inputClass = adminDark
		? "w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/60"
		: "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400/60";

	const cardClass = adminDark
		? "rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
		: "rounded-2xl border border-slate-200 bg-slate-50 p-4";

	const labelClass =
		"text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

	async function changeUserPlan(userId, plan) {
		setBusyUserId(userId);
		try {
			await apiRequest(`/admin/subscriptions/${encodeURIComponent(userId)}`, {
				method: "POST",
				token: getToken(),
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ plan }),
			});
		} catch (err) {
			setError?.(err.message || "Failed to update subscription");
		} finally {
			setBusyUserId(null);
		}
	}

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<div className={cardClass}>
					<p className={labelClass}>Total Subscriptions</p>
					<p className="mt-1 text-2xl font-bold">
						{formatNumber ? formatNumber(totalSubs) : totalSubs}
					</p>
				</div>
				<div className={cardClass}>
					<p className={labelClass}>Revenue Estimate</p>
					<p className="mt-1 text-2xl font-bold">
						{formatCurrency ? formatCurrency(revenueEstimate) : `$${revenueEstimate.toFixed(2)}`}
					</p>
				</div>
				<div className={cardClass}>
					<p className={labelClass}>Failed Renewals</p>
					<p className="mt-1 text-2xl font-bold text-rose-400">{failedRenewals.length}</p>
				</div>
				<div className={cardClass}>
					<p className={labelClass}>Transactions</p>
					<p className="mt-1 text-2xl font-bold">{ledger.length}</p>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<div className="space-y-3">
					<p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
						Subscribers by Plan
					</p>
					<div className="space-y-2">
						{revenueSummary.length === 0 && (
							<p className="text-xs text-slate-400">No subscription data</p>
						)}
						{revenueSummary.map((row) => (
							<div key={row.plan} className={`${cardClass} flex items-center justify-between`}>
								<div>
									<p className="text-sm font-medium capitalize">{row.plan}</p>
									<p className="text-xs text-slate-400">
										{row.subscribers} subscriber{row.subscribers !== 1 ? "s" : ""}
									</p>
								</div>
								<div className="text-right">
									<p className="text-sm font-semibold">
										{formatCurrency ? formatCurrency(row.price_usd) : `$${row.price_usd}`}
									</p>
									<p className="text-xs text-slate-400">/mo</p>
								</div>
							</div>
						))}
					</div>
				</div>

				<div className="space-y-3">
					<p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
						Recent Transactions
					</p>
					<div className="max-h-64 space-y-2 overflow-y-auto">
						{ledger.length === 0 && (
							<p className="text-xs text-slate-400">No recent transactions</p>
						)}
						{ledger.slice(0, 10).map((row) => (
							<div key={row.id} className={`${cardClass} flex items-center justify-between`}>
								<div className="min-w-0 flex-1">
									<p className="truncate text-xs font-medium">
										{row.user_id ? String(row.user_id).slice(0, 16) : "—"}
									</p>
									<p className="text-[10px] text-slate-400">{row.reason || "—"}</p>
								</div>
								<div className="ml-2 text-right">
									<p
										className={`text-xs font-semibold ${Number(row.amount_usd || 0) < 0 ? "text-rose-400" : "text-emerald-400"}`}
									>
										{Number(row.amount_usd || 0) < 0 ? "-" : "+"}$
										{Math.abs(Number(row.amount_usd || 0)).toFixed(2)}
									</p>
									<p className="text-[10px] text-slate-400">{row.kind || "—"}</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
						Failed Renewals
						{failedRenewals.length > 0 && (
							<span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">
								{failedRenewals.length}
							</span>
						)}
					</p>
				</div>
				{failedRenewals.length === 0 && (
					<p className="text-xs text-slate-400">No failed renewals</p>
				)}
				{failedRenewals.length > 0 && (
					<div className="max-h-48 space-y-2 overflow-y-auto">
						{failedRenewals.map((row, i) => (
							<div key={row.id || i} className={`${cardClass} flex items-center justify-between`}>
								<div className="min-w-0 flex-1">
									<p className="truncate text-xs font-medium">{row.user_id || "—"}</p>
									<p className="text-[10px] text-slate-400">Plan: {row.plan || "—"}</p>
								</div>
								<div className="ml-2 text-right">
									<p className="text-[10px] text-slate-400">
										{row.end_date ? new Date(row.end_date).toLocaleDateString() : "—"}
									</p>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
						User Subscriptions
					</p>
					<input
						type="text"
						placeholder="Search by ID, email, or name..."
						value={subQuery}
						onChange={(e) => setSubQuery(e.target.value)}
						className={`max-w-xs ${inputClass}`}
					/>
				</div>
				<div className="max-h-96 space-y-2 overflow-y-auto">
					{filteredUsers.length === 0 && <p className="text-xs text-slate-400">No users found</p>}
					{filteredUsers.map((u) => (
						<div key={u.id} className={`${cardClass} flex items-center justify-between`}>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium">{u.name || u.email || u.id}</p>
								<p className="text-[11px] text-slate-400">{u.email || ""}</p>
								<p className="text-[10px] text-slate-500">
									Role: {u.role || "—"} &middot; Status: {u.status || "—"}
								</p>
							</div>
							<div className="ml-3 flex items-center gap-2">
								<span
									className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
										String(u.subscription_status || "") === "premium"
											? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
											: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
									}`}
								>
									{u.subscription_status || "free"}
								</span>
								{String(u.subscription_status || "") === "free" ? (
									<button
										type="button"
										disabled={busyUserId === u.id}
										onClick={() => changeUserPlan(u.id, "premium")}
										className="rounded-xl bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold text-emerald-500 transition hover:bg-emerald-500/20 disabled:opacity-40"
									>
										{busyUserId === u.id ? (
											<ThreeDot variant3={true} color="#10b981" size={12} />
										) : (
											"Upgrade"
										)}
									</button>
								) : (
									<button
										type="button"
										disabled={busyUserId === u.id}
										onClick={() => changeUserPlan(u.id, "free")}
										className="rounded-xl bg-rose-500/10 px-3 py-1 text-[10px] font-semibold text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-40"
									>
										{busyUserId === u.id ? (
											<ThreeDot variant3={true} color="#f43f5e" size={12} />
										) : (
											"Downgrade"
										)}
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
