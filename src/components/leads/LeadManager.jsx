import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Mosaic } from "react-loading-indicators";
import { useNavigate } from "react-router-dom";
import { apiRequest, getCurrentUser, getToken } from "../../lib/auth.js";
import LazyImage from "../ui/LazyImage.jsx";

const STATUS_OPTIONS = [
	{ key: "new", label: "New" },
	{ key: "contacted", label: "Contacted" },
	{ key: "negotiating", label: "Negotiating" },
	{ key: "sample_sent", label: "Sample Sent" },
	{ key: "order_confirmed", label: "Order Confirmed" },
	{ key: "closed", label: "Closed" },
];

function formatDate(value) {
	if (!value) {
		return "";
	}
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) {
		return String(value);
	}
	return d.toLocaleString();
}

function statusBadgeClass(status = "") {
	if (status === "breached") {
		return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
	}
	if (status === "warning") {
		return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200";
	}
	return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
}

function formatCountdown(deadlineAt) {
	if (!deadlineAt) {
		return "No SLA";
	}
	const deadline = new Date(deadlineAt).getTime();
	if (Number.isNaN(deadline)) {
		return "No SLA";
	}
	const deltaMinutes = Math.floor((deadline - Date.now()) / 60_000);
	if (deltaMinutes >= 0) {
		return `${deltaMinutes}m left`;
	}
	return `${Math.abs(deltaMinutes)}m overdue`;
}

export default function LeadManager({
	title = "Leads (CRM)",
	allowAssign = true,
	showOperations = true,
}) {
	const token = useMemo(() => getToken(), []);
	const canAssignLeads = Boolean(getCurrentUser()?.capabilities?.leads?.assign);
	const navigate = useNavigate();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [items, setItems] = useState([]);
	const [selectedId, setSelectedId] = useState("");
	const [selected, setSelected] = useState(null);
	const [lookup, setLookup] = useState({});
	const [noteDraft, setNoteDraft] = useState("");
	const [saving, setSaving] = useState(false);
	const [queueMeta, setQueueMeta] = useState({
		queue: [],
		team_queues: [],
		assignments: [],
		agent_capacity: [],
		escalations: [],
		workload: [],
	});

	const [reminderModalOpen, setReminderModalOpen] = useState(false);
	const [reminderDate, setReminderDate] = useState("");
	const [reminderMessage, setReminderMessage] = useState("");
	const [escalationModalOpen, setEscalationModalOpen] = useState(false);
	const [escalationReason, setEscalationReason] = useState("");
	const [assignModalOpen, setAssignModalOpen] = useState(false);
	const [assignAgentId, setAssignAgentId] = useState("");
	const [assignReason, setAssignReason] = useState("");

	useEffect(() => {
		function handleKeyDown(e) {
			if (e.key === "Escape") {
				setReminderModalOpen(false);
				setEscalationModalOpen(false);
				setAssignModalOpen(false);
			}
		}
		if (reminderModalOpen || escalationModalOpen || assignModalOpen) {
			document.addEventListener("keydown", handleKeyDown);
			return () => document.removeEventListener("keydown", handleKeyDown);
		}
	}, [reminderModalOpen, escalationModalOpen, assignModalOpen]);

	const loadLeads = useCallback(async () => {
		if (!token) {
			return;
		}
		setLoading(true);
		setError("");
		try {
			const data = await apiRequest("/leads", { token });
			const nextItems = Array.isArray(data?.items) ? data.items : [];
			let operationsQueue = [];
			if (showOperations) {
				try {
					const [queueData, escalationsData, workloadData] = await Promise.all([
						apiRequest("/org/ops/queue", { token }),
						apiRequest("/org/ops/escalations", { token }).catch(() => ({
							items: [],
						})),
						apiRequest("/org/ops/workload", { token }).catch(() => ({
							items: [],
						})),
					]);
					operationsQueue = Array.isArray(queueData?.queue) ? queueData.queue : [];
					setQueueMeta({
						queue: operationsQueue,
						team_queues: queueData?.team_queues || [],
						assignments: queueData?.assignments || [],
						agent_capacity: queueData?.agent_capacity || [],
						escalations: escalationsData?.items || [],
						workload: workloadData?.items || [],
					});
				} catch {
					setQueueMeta({
						queue: [],
						team_queues: [],
						assignments: [],
						agent_capacity: [],
						escalations: [],
						workload: [],
					});
				}
			}

			const queueMap = new Map(operationsQueue.map((row) => [row.id, row]));
			setItems(
				nextItems.map((lead) => ({
					...lead,
					...(queueMap.get(lead.id) || {}),
				})),
			);

			const ids = new Set();
			nextItems.forEach((lead) => {
				if (lead.counterparty_id) {
					ids.add(String(lead.counterparty_id));
				}
				if (lead.assigned_agent_id) {
					ids.add(String(lead.assigned_agent_id));
				}
			});

			if (ids.size > 0) {
				const lookupRes = await apiRequest("/users/lookup", {
					method: "POST",
					token,
					body: { ids: [...ids] },
				});
				const map = (lookupRes?.users || []).reduce((acc, user) => {
					acc[user.id] = user;
					return acc;
				}, {});
				setLookup(map);
			} else {
				setLookup({});
			}
		} catch (err) {
			setItems([]);
			setLookup({});
			setError(err.message || "Failed to load leads");
		} finally {
			setLoading(false);
		}
	}, [showOperations, token]);

	const loadLeadDetail = useCallback(
		async (leadId) => {
			if (!(token && leadId)) {
				return;
			}
			setSaving(true);
			setError("");
			try {
				const data = await apiRequest(`/leads/${encodeURIComponent(leadId)}`, {
					token,
				});
				setSelected(data);
			} catch (err) {
				setSelected(null);
				setError(err.message || "Failed to load lead details");
			} finally {
				setSaving(false);
			}
		},
		[token],
	);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		loadLeads();
	}, [loadLeads]);

	useEffect(() => {
		if (!selectedId) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setSelected(null);
			setNoteDraft("");
			return;
		}
		loadLeadDetail(selectedId);
	}, [loadLeadDetail, selectedId]);

	async function updateLead(patch) {
		if (!(token && selectedId)) {
			return;
		}
		setSaving(true);
		setError("");
		try {
			const updated = await apiRequest(`/leads/${encodeURIComponent(selectedId)}`, {
				method: "PATCH",
				token,
				body: patch,
			});
			setItems((prev) =>
				prev.map((lead) => (lead.id === updated.id ? { ...lead, ...updated } : lead)),
			);
			setSelected((prev) => (prev ? { ...prev, ...updated } : prev));
		} catch (err) {
			setError(err.message || "Failed to update lead");
		} finally {
			setSaving(false);
		}
	}

	async function submitNote() {
		if (!(token && selectedId)) {
			return;
		}
		const text = noteDraft.trim();
		if (!text) {
			return;
		}

		setSaving(true);
		setError("");
		try {
			const created = await apiRequest(`/leads/${encodeURIComponent(selectedId)}/notes`, {
				method: "POST",
				token,
				body: { note: text },
			});
			setSelected((prev) => (prev ? { ...prev, notes: [created, ...(prev.notes || [])] } : prev));
			setNoteDraft("");
		} catch (err) {
			setError(err.message || "Failed to add note");
		} finally {
			setSaving(false);
		}
	}

	function openReminderModal() {
		setReminderDate(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
		setReminderMessage("Follow up");
		setReminderModalOpen(true);
	}

	async function handleConfirmReminder() {
		if (!(token && selectedId)) {
			return;
		}
		const remindAt = reminderDate;
		if (!remindAt) {
			return;
		}
		const message = reminderMessage || "Follow up";
		setSaving(true);
		setError("");
		try {
			const created = await apiRequest(`/leads/${encodeURIComponent(selectedId)}/reminders`, {
				method: "POST",
				token,
				body: { remind_at: remindAt, message },
			});
			setSelected((prev) =>
				prev ? { ...prev, reminders: [...(prev.reminders || []), created] } : prev,
			);
		} catch (err) {
			setError(err.message || "Failed to create reminder");
		} finally {
			setSaving(false);
			setReminderModalOpen(false);
		}
	}

	async function triggerRebalance() {
		if (!token) {
			return;
		}
		setSaving(true);
		setError("");
		try {
			await apiRequest("/org/ops/rebalance", {
				method: "POST",
				token,
				body: { strategy: "least_loaded" },
			});
			await loadLeads();
			if (selectedId) {
				await loadLeadDetail(selectedId);
			}
		} catch (err) {
			setError(err.message || "Failed to rebalance queue");
		} finally {
			setSaving(false);
		}
	}

	function openEscalationModal() {
		setEscalationReason("SLA risk");
		setEscalationModalOpen(true);
	}

	async function handleConfirmEscalation() {
		if (!(token && selectedId)) {
			return;
		}
		const reason = escalationReason || "SLA risk";
		setSaving(true);
		setError("");
		try {
			const updated = await apiRequest(`/org/ops/escalate/${encodeURIComponent(selectedId)}`, {
				method: "POST",
				token,
				body: { reason },
			});
			setItems((prev) =>
				prev.map((lead) => (lead.id === updated.id ? { ...lead, ...updated } : lead)),
			);
			setSelected((prev) => (prev ? { ...prev, ...updated } : prev));
			await loadLeads();
		} catch (err) {
			setError(err.message || "Failed to escalate lead");
		} finally {
			setSaving(false);
			setEscalationModalOpen(false);
		}
	}

	async function resolveEscalation(leadId) {
		if (!(token && leadId)) {
			return;
		}
		setSaving(true);
		setError("");
		try {
			await apiRequest(`/org/ops/escalations/${encodeURIComponent(leadId)}/resolve`, {
				method: "POST",
				token,
				body: { resolution_note: "Resolved from CRM dashboard" },
			});
			await loadLeads();
		} catch (err) {
			setError(err.message || "Failed to resolve escalation");
		} finally {
			setSaving(false);
		}
	}

	const selectedAssignments = useMemo(
		() =>
			(queueMeta.assignments || [])
				.filter((row) => String(row.lead_id || "") === String(selectedId || ""))
				.slice(0, 8),
		[queueMeta.assignments, selectedId],
	);

	const selectedEscalation = useMemo(
		() =>
			(queueMeta.escalations || []).find(
				(row) => String(row.lead_id || "") === String(selectedId || "") && !row.resolved_at,
			),
		[queueMeta.escalations, selectedId],
	);

	const selectedCounterparty = selected?.counterparty_id ? lookup[selected.counterparty_id] : null;
	const assignedAgent = selected?.assigned_agent_id ? lookup[selected.assigned_agent_id] : null;

	return (
		<>
			<div className="rounded-2xl bg-white p-4 shadow-borderless ring-1 ring-slate-200/60 dark:bg-white/5 dark:shadow-borderlessDark dark:ring-white/10">
				<div className="flex flex-col gap-4 lg:flex-row">
					<div className="lg:w-2/5">
						<div className="flex items-center justify-between gap-3 mb-3">
							<h3 className="font-semibold">{title}</h3>
							<div className="flex items-center gap-2">
								{showOperations ? (
									<button
										type="button"
										onClick={triggerRebalance}
										className="px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-500 active:scale-[0.98]"
										disabled={loading || saving}
									>
										Rebalance
									</button>
								) : null}
								<button
									type="button"
									onClick={loadLeads}
									className="px-3 py-1.5 text-sm rounded-md bg-white shadow-borderless ring-1 ring-slate-200/60 hover:bg-slate-50 active:scale-[0.98] dark:bg-white/5 dark:shadow-borderlessDark dark:ring-white/10 dark:hover:bg-white/8"
									disabled={loading}
								>
									Refresh
								</button>
							</div>
						</div>

						{loading ? (
							<Mosaic
								color="#337ab0"
								size="large"
								style={{ fontSize: "40px" }}
								text=""
								textColor=""
							/>
						) : null}
						{error ? <div className="mt-2 text-sm text-rose-600">{error}</div> : null}

						<div data-lenis-prevent={true} className="mt-3 space-y-2 max-h-[520px] overflow-auto pr-1">
							{items.length === 0 && !loading ? (
								<div className="text-sm text-slate-500">
									No leads yet. Leads are created automatically when chats start.
								</div>
							) : null}
							{items.map((lead) => {
								const counterparty = lead.counterparty_id ? lookup[lead.counterparty_id] : null;
								const label = counterparty?.name || lead.counterparty_id || "Counterparty";
								const isActive = lead.id === selectedId;
								const avatarUrl =
									counterparty?.profile?.profile_image ||
									counterparty?.avatar_url ||
									counterparty?.avatar ||
									"";

								return (
									<button
										key={lead.id}
										type="button"
										onClick={() => setSelectedId(lead.id)}
										className={[
											"w-full text-left rounded-lg bg-white shadow-borderless ring-1 ring-slate-200/60 px-3 py-2 transition dark:bg-white/5 dark:shadow-borderlessDark dark:ring-white/10",
											isActive
												? "bg-gtBlue/10 ring-gtBlue/40 dark:bg-gtBlue/15 dark:ring-gtBlue/40"
												: "hover:bg-slate-50 dark:hover:bg-white/8",
										].join(" ")}
									>
										<div className="flex items-center justify-between gap-2">
											<div className="flex items-center gap-2 min-w-0">
												{avatarUrl ? (
													<motion.div
														initial={{ opacity: 0, scale: 0.9 }}
														whileInView={{ opacity: 1, scale: 1 }}
														viewport={{ once: true }}
														transition={{
															duration: 0.35,
															ease: [0.16, 1, 0.3, 1],
														}}
														className="h-8 w-8 shrink-0"
													>
														<LazyImage
															src={avatarUrl}
															alt={label}
															width={32}
															height={32}
															className="h-8 w-8 rounded-full object-cover"
														/>
													</motion.div>
												) : (
													<div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-200">
														{String(label).slice(0, 2).toUpperCase()}
													</div>
												)}
												<p className="font-medium truncate">{label}</p>
											</div>
											<span className="text-[11px] uppercase tracking-widest text-slate-500">
												{(lead.status || "new").replace(/_/g, " ")}
											</span>
										</div>
										<div className="mt-1 flex items-center gap-2">
											{lead?.sla?.status || lead?.sla?.deadline_at ? (
												<span
													className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(lead?.sla?.status || "healthy")}`}
												>
													SLA {lead?.sla?.status || "active"} ·{" "}
													{formatCountdown(lead?.sla?.deadline_at)}
												</span>
											) : null}
											{lead?.queue_owner_id ? (
												<span className="text-[10px] text-slate-500">
													Queue: {lookup[lead.queue_owner_id]?.name || lead.queue_owner_id}
												</span>
											) : null}
										</div>
										<p className="mt-1 text-xs text-slate-500">
											Last: {formatDate(lead.last_interaction_at || lead.updated_at)}
										</p>
									</button>
								);
							})}
						</div>
					</div>

					<div className="lg:w-3/5">
						{selectedId ? (
							<div className="rounded-xl shadow-borderless dark:shadow-borderlessDark p-4">
								<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
									<div className="min-w-0">
										<p className="text-xs uppercase tracking-widest text-slate-500">Counterparty</p>
										<div className="mt-2 flex items-center gap-3">
											{selectedCounterparty?.profile?.profile_image ? (
												<motion.div
													initial={{ opacity: 0, scale: 0.9 }}
													whileInView={{ opacity: 1, scale: 1 }}
													viewport={{ once: true }}
													transition={{
														duration: 0.35,
														ease: [0.16, 1, 0.3, 1],
													}}
													className="h-10 w-10 shrink-0"
												>
													<LazyImage
														src={selectedCounterparty.profile.profile_image}
														alt={selectedCounterparty?.name}
														width={40}
														height={40}
														className="h-10 w-10 rounded-full object-cover"
													/>
												</motion.div>
											) : (
												<div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
													{String(selectedCounterparty?.name || selected?.counterparty_id || "--")
														.slice(0, 2)
														.toUpperCase()}
												</div>
											)}
											<div className="min-w-0">
												<p className="font-semibold truncate">
													{selectedCounterparty?.name || selected?.counterparty_id || "--"}
												</p>
												<p className="text-xs text-slate-500">
													{selectedCounterparty?.profile?.organization_name ||
														selectedCounterparty?.profile?.organization ||
														""}
												</p>
											</div>
										</div>
										<p className="text-xs text-slate-500">Match: {selected?.match_id || "--"}</p>
									</div>

									<div className="flex flex-col gap-2">
										<label className="text-xs uppercase tracking-widest text-slate-500">Status</label>
										<select
											value={selected?.status || "new"}
											onChange={(e) => updateLead({ status: e.target.value })}
											className="rounded-md shadow-borderless dark:shadow-borderlessDark px-3 py-2 text-sm"
											disabled={saving}
										>
											{STATUS_OPTIONS.map((opt) => (
												<option key={opt.key} value={opt.key}>
													{opt.label}
												</option>
											))}
										</select>
										<button
											type="button"
											className="rounded-md shadow-borderless dark:shadow-borderlessDark px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
											disabled={!selected?.match_id}
											onClick={() => {
												if (!selected?.match_id) {
													return;
												}
												navigate("/chat", {
													state: {
														matchId: selected.match_id,
														notice: "Opening the lead conversation.",
													},
												});
											}}
										>
											Message
										</button>
										{showOperations ? (
											<button
												type="button"
												className="rounded-md bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-400"
												disabled={saving || !selectedId}
												onClick={openEscalationModal}
											>
												Escalate
											</button>
										) : null}
									</div>
								</div>

								<div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
									<div className="rounded-lg bg-slate-50 p-3">
										<p className="text-xs uppercase tracking-widest text-slate-500">Assigned agent</p>
										<p className="mt-1 text-sm font-medium">
											{assignedAgent?.name || selected?.assigned_agent_id || "Unassigned"}
										</p>
										{allowAssign && canAssignLeads ? (
											<button
												type="button"
												onClick={() => {
													setAssignAgentId(selected?.assigned_agent_id || "");
													setAssignReason("manual_reassignment");
													setAssignModalOpen(true);
												}}
												className="mt-2 text-sm text-gtBlue hover:underline"
												disabled={saving}
											>
												Assign / Reassign
											</button>
										) : null}
										{allowAssign && !canAssignLeads ? (
											<p className="mt-2 text-xs text-slate-500">
												Lead assignment is restricted by your role policy.
											</p>
										) : null}
									</div>
									<div className="rounded-lg bg-slate-50 p-3">
										<p className="text-xs uppercase tracking-widest text-slate-500">Updated</p>
										<p className="mt-1 text-sm font-medium">
											{formatDate(selected?.updated_at || "") || "--"}
										</p>
										{selected?.sla?.status || selected?.sla?.deadline_at ? (
											<p
												className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadgeClass(selected?.sla?.status || "healthy")}`}
											>
												SLA {selected?.sla?.status || "active"} ·{" "}
												{formatCountdown(selected?.sla?.deadline_at)}
											</p>
										) : null}
										{selectedEscalation ? (
											<button
												type="button"
												onClick={() => resolveEscalation(selectedId)}
												className="mt-2 text-xs rounded bg-emerald-600 px-2 py-1 text-white"
												disabled={saving}
											>
												Resolve escalation
											</button>
										) : null}
										{selected?.queue_owner_id ? (
											<p className="mt-1 text-xs text-slate-600">
												Queue owner:{" "}
												{lookup[selected.queue_owner_id]?.name || selected.queue_owner_id}
											</p>
										) : null}
										<button
											type="button"
											onClick={openReminderModal}
											className="mt-2 text-sm text-gtBlue hover:underline"
											disabled={saving}
										>
											Set reminder
										</button>
									</div>
								</div>

								<div className="mt-5">
									{showOperations ? (
										<div className="mb-4 rounded-lg bg-slate-50 p-3">
											<p className="text-xs uppercase tracking-widest text-slate-500">
												Team queue snapshot
											</p>
											<div className="mt-2 grid gap-2 md:grid-cols-2">
												{(queueMeta.team_queues || []).slice(0, 4).map((queue) => (
													<div
														key={queue.agent_id}
														className="rounded-md shadow-borderless dark:shadow-borderlessDark px-2 py-1 text-xs"
													>
														<div className="font-medium">{queue.agent_name || queue.agent_id}</div>
														<div className="text-slate-500">Load: {queue.current_load} leads</div>
													</div>
												))}
											</div>
											<p className="mt-3 text-xs uppercase tracking-widest text-slate-500">
												Escalation queue
											</p>
											<div className="mt-2 space-y-1">
												{(queueMeta.escalations || []).slice(0, 5).map((item) => (
													<div
														key={item.id}
														className="rounded-md shadow-borderless dark:shadow-borderlessDark px-2 py-1 text-xs flex items-center justify-between gap-2"
													>
														<span className="truncate">
															Lead {item.lead_id} · {item.reason}
														</span>
														<span className="text-slate-500">{formatDate(item.triggered_at)}</span>
													</div>
												))}
											</div>
										</div>
									) : null}
									<p className="text-xs uppercase tracking-widest text-slate-500">Internal notes</p>
									<div className="mt-2 flex items-center gap-2">
										<input
											value={noteDraft}
											onChange={(e) => setNoteDraft(e.target.value)}
											placeholder="Add a note for your team..."
											className="flex-1 rounded-md shadow-borderless dark:shadow-borderlessDark px-3 py-2 text-sm"
											disabled={saving}
										/>
										<button
											type="button"
											onClick={submitNote}
											className="px-3 py-2 rounded-md bg-gtBlue text-white text-sm font-medium hover:bg-gtBlueHover active:scale-[0.98]"
											disabled={saving}
										>
											Add
										</button>
									</div>

									<div
										data-lenis-prevent={true}
										className="mt-3 space-y-2 max-h-[260px] overflow-auto pr-1"
									>
										{(selected?.notes || []).length === 0 ? (
											<div className="text-sm text-slate-500">No notes yet.</div>
										) : null}
										{(selected?.notes || []).map((note) => (
											<div
												key={note.id}
												className="rounded-lg shadow-borderless dark:shadow-borderlessDark p-3"
											>
												<p className="text-sm text-slate-900">{note.note}</p>
												<p className="mt-1 text-xs text-slate-500">{formatDate(note.created_at)}</p>
											</div>
										))}
									</div>
								</div>

								<div className="mt-5">
									{selectedAssignments.length > 0 ? (
										<div className="mb-4">
											<p className="text-xs uppercase tracking-widest text-slate-500">
												Assignment audit trail
											</p>
											<div className="mt-2 space-y-1">
												{selectedAssignments.map((item) => (
													<div
														key={item.id}
														className="rounded-lg shadow-borderless dark:shadow-borderlessDark px-3 py-2 text-xs"
													>
														<span className="font-medium">{item.reason || "assignment"}</span>
														<span className="text-slate-500">
															{" "}
															· {formatDate(item.assigned_at || item.created_at)}
														</span>
													</div>
												))}
											</div>
										</div>
									) : null}
									<p className="text-xs uppercase tracking-widest text-slate-500">Reminders</p>
									<div className="mt-2 space-y-2">
										{(selected?.reminders || []).length === 0 ? (
											<div className="text-sm text-slate-500">No reminders yet.</div>
										) : null}
										{(selected?.reminders || []).map((reminder) => (
											<div
												key={reminder.id}
												className="rounded-lg shadow-borderless dark:shadow-borderlessDark p-3"
											>
												<div className="flex items-center justify-between gap-2">
													<p className="text-sm font-medium">{reminder.message}</p>
													<p className="text-xs text-slate-500">{formatDate(reminder.remind_at)}</p>
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						) : (
							<div className="rounded-xl shadow-borderless dark:shadow-borderlessDark p-6 text-sm text-slate-500">
								Select a lead to view details, notes, and reminders.
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Reminder modal */}
			{reminderModalOpen ? (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
					onClick={() => setReminderModalOpen(false)}
					role="presentation"
				>
					<div
						className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg dark:bg-slate-800"
						onClick={(e) => e.stopPropagation()}
						role="presentation"
					>
						<p className="mb-3 text-sm font-medium">Set reminder</p>
						<label className="mb-1 block text-xs text-slate-500">
							Date/time (ISO or YYYY-MM-DD HH:mm)
						</label>
						<input
							value={reminderDate}
							onChange={(e) => setReminderDate(e.target.value)}
							className="w-full rounded-md border px-3 py-2 text-sm"
						/>
						<label className="mt-3 mb-1 block text-xs text-slate-500">Note</label>
						<input
							value={reminderMessage}
							onChange={(e) => setReminderMessage(e.target.value)}
							className="w-full rounded-md border px-3 py-2 text-sm"
						/>
						<div className="mt-4 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setReminderModalOpen(false)}
								className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleConfirmReminder}
								className="rounded-md bg-gtBlue px-3 py-1.5 text-sm text-white hover:bg-gtBlueHover"
							>
								OK
							</button>
						</div>
					</div>
				</div>
			) : null}

			{/* Escalation modal */}
			{escalationModalOpen ? (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
					onClick={() => setEscalationModalOpen(false)}
					role="presentation"
				>
					<div
						className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg dark:bg-slate-800"
						onClick={(e) => e.stopPropagation()}
						role="presentation"
					>
						<p className="mb-3 text-sm font-medium">Escalation reason</p>
						<input
							value={escalationReason}
							onChange={(e) => setEscalationReason(e.target.value)}
							className="w-full rounded-md border px-3 py-2 text-sm"
						/>
						<div className="mt-4 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setEscalationModalOpen(false)}
								className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleConfirmEscalation}
								className="rounded-md bg-amber-500 px-3 py-1.5 text-sm text-white hover:bg-amber-400"
							>
								OK
							</button>
						</div>
					</div>
				</div>
			) : null}

			{/* Assign modal */}
			{assignModalOpen ? (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
					onClick={() => setAssignModalOpen(false)}
					role="presentation"
				>
					<div
						className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg dark:bg-slate-800"
						onClick={(e) => e.stopPropagation()}
						role="presentation"
					>
						<p className="mb-3 text-sm font-medium">Assign / Reassign agent</p>
						<label className="mb-1 block text-xs text-slate-500">Agent ID (user id)</label>
						<input
							value={assignAgentId}
							onChange={(e) => setAssignAgentId(e.target.value)}
							className="w-full rounded-md border px-3 py-2 text-sm"
						/>
						<label className="mt-3 mb-1 block text-xs text-slate-500">Reason (audit trail)</label>
						<input
							value={assignReason}
							onChange={(e) => setAssignReason(e.target.value)}
							className="w-full rounded-md border px-3 py-2 text-sm"
						/>
						<div className="mt-4 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setAssignModalOpen(false)}
								className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={() => {
									updateLead({
										assigned_agent_id: assignAgentId,
										assignment_reason: assignReason,
									});
									setAssignModalOpen(false);
								}}
								className="rounded-md bg-gtBlue px-3 py-1.5 text-sm text-white hover:bg-gtBlueHover"
							>
								OK
							</button>
						</div>
					</div>
				</div>
			) : null}
		</>
	);
}
