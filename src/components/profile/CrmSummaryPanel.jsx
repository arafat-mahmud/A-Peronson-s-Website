import { FileText, MessageSquare, PhoneCall } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiRequest, getCurrentUser, getToken } from "../../lib/auth.js";

function formatDate(value) {
	if (!value) {
		return "--";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "--";
	}
	return date.toLocaleString();
}

function withinRange(iso, range = {}) {
	if (!(range?.from || range?.to)) {
		return true;
	}
	const ts = new Date(iso || "").getTime();
	if (!Number.isFinite(ts)) {
		return false;
	}
	if (range.from && ts < range.from) {
		return false;
	}
	if (range.to && ts > range.to) {
		return false;
	}
	return true;
}

export default function CrmSummaryPanel({ targetId, onContact }) {
	const token = useMemo(() => getToken(), []);
	const currentUser = useMemo(() => getCurrentUser(), []);
	const actorRole = String(currentUser?.role || "").toLowerCase();
	const actorOrgId =
		actorRole === "agent" ? String(currentUser?.org_owner_id || "") : String(currentUser?.id || "");
	const [data, setData] = useState(null);
	const [error, setError] = useState("");
	const [filterType, setFilterType] = useState("all");
	const [filterMatch, setFilterMatch] = useState("");
	const [filterFrom, setFilterFrom] = useState("");
	const [filterTo, setFilterTo] = useState("");
	const [expandedThreads, setExpandedThreads] = useState({});

	useEffect(() => {
		if (!(token && targetId)) {
			return;
		}
		const relationshipMode = actorOrgId && String(targetId) !== String(actorOrgId);
		const endpoint = relationshipMode
			? `/crm/relationship/${encodeURIComponent(targetId)}`
			: `/crm/profile/${encodeURIComponent(targetId)}`;
		let alive = true;
		apiRequest(endpoint, { token })
			.then((res) => {
				if (!alive) {
					return;
				}
				setData(res);
				setError("");
			})
			.catch((err) => {
				if (!alive) {
					return;
				}
				setError(err.status === 403 ? "" : err.message || "Unable to load CRM summary");
				setData(null);
			});
		return () => {
			alive = false;
		};
	}, [targetId, token, actorOrgId]);

	if (!(data || error)) {
		return null;
	}
	if (!data) {
		return null;
	}

	const leadStatus = data?.leads?.by_status || {};
	const threads = Array.isArray(data?.messages?.threads) ? data.messages.threads : [];
	const calls = Array.isArray(data?.calls?.items) ? data.calls.items : [];
	const contracts = Array.isArray(data?.contracts?.items) ? data.contracts.items : [];
	const previousOrders = Array.isArray(data?.previous_orders) ? data.previous_orders : [];
	const agentOutcomes = Array.isArray(data?.agent_outcomes) ? data.agent_outcomes : [];
	const openLink = currentUser?.role === "agent" ? "/agent?tab=leads" : "/owner?tab=leads";
	const counterparty = data?.counterparty || null;
	const titleHint = counterparty?.name ? `Relationship with ${counterparty.name}` : "";

	const range = {
		from: filterFrom ? new Date(`${filterFrom}T00:00:00`).getTime() : null,
		to: filterTo ? new Date(`${filterTo}T23:59:59`).getTime() : null,
	};

	const matches = threads.map((thread) => thread.match_id).filter(Boolean);
	const filteredThreads = threads
		.filter((thread) => (filterMatch ? thread.match_id === filterMatch : true))
		.map((thread) => ({
			...thread,
			messages: Array.isArray(thread.messages)
				? thread.messages.filter((msg) => withinRange(msg.timestamp || msg.created_at, range))
				: [],
		}))
		.filter((thread) => (range.from || range.to ? thread.messages.length > 0 : true));

	const filteredCalls = calls
		.filter((call) =>
			filterMatch
				? String(call.match_id || call?.context?.chat_thread_id || "") === filterMatch
				: true,
		)
		.filter((call) => withinRange(call.created_at || call.started_at, range));

	const filteredContracts = contracts.filter((contract) =>
		withinRange(contract.updated_at || contract.created_at, range),
	);

	function toggleThread(matchId) {
		setExpandedThreads((prev) => ({ ...prev, [matchId]: !prev[matchId] }));
	}

	const STAGES = ["Discovered", "Matched", "Contacted", "Closed"];
	const stageReached = STAGES.map((stage) =>
		Object.keys(leadStatus).some((k) => String(k).toLowerCase().includes(stage.toLowerCase())),
	);
	const currentStage = stageReached.lastIndexOf(true);

	return (
		<section class="mt-6 w-full min-w-0 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 shadow-borderless dark:shadow-borderlessDark bg-white dark:bg-slate-950 p-5">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p class="text-sm font-semibold text-slate-900 dark:text-slate-100">CRM Timeline</p>
					<p class="text-[11px] text-slate-500 dark:text-slate-400">
						{titleHint || "Visible only to your team"}
					</p>
				</div>
				<a
					href={openLink}
					class="rounded-full bg-[var(--theme-custom-0a66c2)] px-3 py-1 text-[11px] font-semibold text-white"
				>
					Open Leads
				</a>
			</div>

			<div class="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800/80 dark:bg-slate-900/40">
				<p class="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
					Journey progress
				</p>
				<div class="mt-3 flex items-start">
					{STAGES.map((stage, i) => {
						const reached = stageReached[i];
						const isCurrent = i === currentStage;
						return (
							<div key={stage} class={`flex items-start ${i < STAGES.length - 1 ? "flex-1" : ""}`}>
								<div class="flex flex-col items-center gap-1.5">
									<span
										class={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
											reached
												? "bg-emerald-500 text-white"
												: "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
										} ${isCurrent ? "ring-2 ring-emerald-500/40 ring-offset-2 ring-offset-white dark:ring-offset-slate-950" : ""}`}
									>
										{reached ? "✓" : i + 1}
									</span>
									<span
										class={`text-[10px] font-semibold ${reached ? "text-slate-700 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}`}
									>
										{stage}
									</span>
								</div>
								{i < STAGES.length - 1 ? (
									<div class="mx-1 mt-3 h-0.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-800">
										<div
											class={`h-full rounded-full ${i < currentStage ? "bg-emerald-500" : "bg-transparent"}`}
											style={{ width: "100%" }}
										/>
									</div>
								) : null}
							</div>
						);
					})}
				</div>
			</div>

			<div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
				<div class="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800/80 dark:bg-slate-900/40">
					<p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Lead Status</p>
					<div class="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-300">
						{Object.keys(leadStatus).length > 0 ? (
							Object.entries(leadStatus).map(([status, count]) => (
								<div key={status} class="flex items-center justify-between">
									<span class="capitalize">{String(status).replace(/_/g, " ")}</span>
									<span class="font-semibold">{count}</span>
								</div>
							))
						) : (
							<div class="text-slate-400 dark:text-slate-500">No leads yet.</div>
						)}
					</div>
				</div>

				<div class="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800/80 dark:bg-slate-900/40">
					<p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Messages</p>
					<div class="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-300">
						<div class="flex items-center justify-between">
							<span>Total threads</span>
							<span class="font-semibold">{data?.messages?.total_threads ?? 0}</span>
						</div>
						<div class="flex items-center justify-between">
							<span>Total messages</span>
							<span class="font-semibold">{data?.messages?.total_messages ?? 0}</span>
						</div>
						{threads[0]?.last_message_at ? (
							<div class="text-[10px] text-slate-500 dark:text-slate-400">
								Latest: {formatDate(threads[0].last_message_at)}
							</div>
						) : null}
					</div>
				</div>

				<div class="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800/80 dark:bg-slate-900/40">
					<p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Calls & Contracts</p>
					<div class="mt-2 space-y-2 text-xs text-slate-700 dark:text-slate-300">
						<div class="flex items-center justify-between">
							<span>Calls</span>
							<span class="font-semibold">{data?.calls?.total ?? 0}</span>
						</div>
						<div class="flex items-center justify-between">
							<span>Contracts</span>
							<span class="font-semibold">{data?.contracts?.total ?? 0}</span>
						</div>
						{contracts.length > 0 ? (
							<div class="text-[10px] text-slate-500 dark:text-slate-400">
								Latest contract: {formatDate(contracts[0]?.updated_at || contracts[0]?.created_at)}
							</div>
						) : null}
						{calls.length > 0 ? (
							<div class="text-[10px] text-slate-500 dark:text-slate-400">
								Latest call: {formatDate(calls[0]?.created_at || calls[0]?.started_at)}
							</div>
						) : null}
					</div>
				</div>
			</div>

			<div class="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800/80 dark:bg-slate-900/40">
				<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
					<div>
						<label class="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
							Type
						</label>
						<select
							value={filterType}
							onChange={(event) => setFilterType(event.target.value)}
							class="mt-1.5 w-full rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
						>
							<option value="all">All</option>
							<option value="messages">Messages</option>
							<option value="calls">Calls</option>
							<option value="contracts">Contracts</option>
						</select>
					</div>

					<div>
						<label class="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
							Match
						</label>
						<select
							value={filterMatch}
							onChange={(event) => setFilterMatch(event.target.value)}
							class="mt-1.5 w-full rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
						>
							<option value="">All threads</option>
							{matches.map((match) => (
								<option key={match} value={match}>
									{match.slice(0, 18)}...
								</option>
							))}
						</select>
					</div>

					<div>
						<label class="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
							From
						</label>
						<input
							type="date"
							value={filterFrom}
							onChange={(event) => setFilterFrom(event.target.value)}
							class="mt-1.5 w-full rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
						/>
					</div>

					<div>
						<label class="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
							To
						</label>
						<input
							type="date"
							value={filterTo}
							onChange={(event) => setFilterTo(event.target.value)}
							class="mt-1.5 w-full rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
						/>
					</div>
				</div>
			</div>

			{filterType === "all" || filterType === "messages" ? (
				<div class="mt-4">
					<p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Message Timeline</p>
					<div class="mt-2 space-y-3">
						{filteredThreads.length > 0 ? (
							filteredThreads.map((thread) => (
								<div
									key={thread.match_id}
									class="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800/80 dark:bg-slate-900/40"
								>
									<div class="flex items-center justify-between">
										<div class="text-xs font-semibold text-slate-700 dark:text-slate-300">
											Thread {thread.match_id.slice(0, 10)}...
										</div>
										<button
											type="button"
											onClick={() => toggleThread(thread.match_id)}
											class="text-[11px] font-semibold text-[var(--theme-custom-0a66c2)]"
										>
											{expandedThreads[thread.match_id] ? "Hide" : "View"} ({thread.message_count})
										</button>
									</div>
									<div class="text-[10px] text-slate-500 dark:text-slate-400">
										Last: {formatDate(thread.last_message_at)}
									</div>
									{expandedThreads[thread.match_id] ? (
										<div class="mt-3 space-y-2">
											{thread.messages.map((msg) => (
												<div
													key={msg.id}
													class="rounded-lg bg-white dark:bg-slate-800 p-2 text-xs text-slate-700 dark:text-slate-300"
												>
													<div class="flex items-center justify-between">
														<span class="font-semibold">{msg.sender_name || msg.sender_id}</span>
														<span class="text-[10px] text-slate-400 dark:text-slate-500">
															{formatDate(msg.timestamp || msg.created_at)}
														</span>
													</div>
													<p class="mt-1 whitespace-pre-wrap">{msg.message}</p>
												</div>
											))}
										</div>
									) : null}
								</div>
							))
						) : (
							<div class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300/70 bg-slate-50/50 px-4 py-8 text-center dark:border-slate-700/70 dark:bg-slate-900/20">
								<span class="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500 dark:text-sky-300">
									<MessageSquare className="h-5 w-5" />
								</span>
								<p class="text-sm text-slate-500 dark:text-slate-400">No message history yet.</p>
								{onContact ? (
									<button
										type="button"
										onClick={onContact}
										className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:-translate-y-0.5 hover:bg-sky-400"
									>
										<MessageSquare className="h-4 w-4" /> Send First Message
									</button>
								) : null}
							</div>
						)}
					</div>
				</div>
			) : null}

			{filterType === "all" || filterType === "calls" ? (
				<div class="mt-4">
					<p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Call History</p>
					<div class="mt-2 space-y-2">
						{filteredCalls.length > 0 ? (
							filteredCalls.map((call) => (
								<div
									key={call.id}
									class="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800/80 dark:bg-slate-900/40 text-xs text-slate-700 dark:text-slate-300"
								>
									<div class="flex items-center justify-between">
										<span class="font-semibold">{call.title || "Call session"}</span>
										<span class="text-[10px] text-slate-400 dark:text-slate-500">
											{formatDate(call.created_at || call.started_at)}
										</span>
									</div>
									<div class="text-[10px] text-slate-500 dark:text-slate-400">
										Participants: {(call.participants || []).map((p) => p.name).join(", ") || "N/A"}
									</div>
								</div>
							))
						) : (
							<div class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300/70 bg-slate-50/50 px-4 py-8 text-center dark:border-slate-700/70 dark:bg-slate-900/20">
								<span class="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500 dark:text-sky-300">
									<PhoneCall className="h-5 w-5" />
								</span>
								<p class="text-sm text-slate-500 dark:text-slate-400">No call history yet.</p>
							</div>
						)}
					</div>
				</div>
			) : null}

			{filterType === "all" || filterType === "contracts" ? (
				<div class="mt-4">
					<p class="text-sm font-semibold text-slate-900 dark:text-slate-100">
						Contracts & Previous Orders
					</p>
					<div class="mt-2 space-y-2">
						{filteredContracts.length > 0 ? (
							filteredContracts.map((contract) => (
								<div
									key={contract.id}
									class="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800/80 dark:bg-slate-900/40 text-xs text-slate-700 dark:text-slate-300"
								>
									<div class="flex items-center justify-between">
										<span class="font-semibold">
											{contract.contract_number || contract.title || "Contract"}
										</span>
										<span class="text-[10px] text-slate-400 dark:text-slate-500">
											{formatDate(contract.updated_at || contract.created_at)}
										</span>
									</div>
									<div class="text-[10px] text-slate-500 dark:text-slate-400">
										Status: {contract.lifecycle_status || "draft"}
									</div>
								</div>
							))
						) : (
							<div class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300/70 bg-slate-50/50 px-4 py-8 text-center dark:border-slate-700/70 dark:bg-slate-900/20">
								<span class="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500 dark:text-sky-300">
									<FileText className="h-5 w-5" />
								</span>
								<p class="text-sm text-slate-500 dark:text-slate-400">No contracts yet.</p>
							</div>
						)}
					</div>

					{previousOrders.length > 0 ? (
						<div class="mt-3 rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-slate-800/80 dark:bg-slate-900/40">
							<p class="text-xs font-semibold text-slate-600 dark:text-slate-300">
								Previous orders (signed contracts)
							</p>
							<div class="mt-2 space-y-2 text-xs text-slate-700 dark:text-slate-300">
								{previousOrders.map((order) => (
									<div
										key={order.id}
										class="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 dark:border-slate-800/80 dark:bg-slate-950/60"
									>
										<span class="truncate text-slate-900 dark:text-slate-100">
											{order.contract_number || order.title || "Contract"}
										</span>
										<span class="text-[10px] text-slate-500 dark:text-slate-400">
											{formatDate(order.signed_at)}
										</span>
									</div>
								))}
							</div>
						</div>
					) : null}
				</div>
			) : null}

			{agentOutcomes.length > 0 ? (
				<div class="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800/80 dark:bg-slate-900/40">
					<p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Agent Outcomes</p>
					<div class="mt-2 space-y-2 text-xs text-slate-700 dark:text-slate-300">
						<div class="grid grid-cols-6 gap-2 text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
							<span class="col-span-2">Agent</span>
							<span class="text-right">Assigned</span>
							<span class="text-right">Closed</span>
							<span class="text-right">Confirmed</span>
							<span class="text-right">Converted</span>
						</div>
						{agentOutcomes.map((agent) => (
							<div
								key={agent.agent_id}
								class="grid grid-cols-6 gap-2 rounded-xl border border-slate-200/70 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
							>
								<span class="col-span-2 truncate">{agent.name}</span>
								<span class="text-right">{agent.assigned_leads ?? 0}</span>
								<span class="text-right">{agent.closed_leads ?? 0}</span>
								<span class="text-right">{agent.orders_confirmed ?? 0}</span>
								<span class="text-right">{agent.conversions ?? 0}</span>
							</div>
						))}
					</div>
				</div>
			) : null}
		</section>
	);
}
