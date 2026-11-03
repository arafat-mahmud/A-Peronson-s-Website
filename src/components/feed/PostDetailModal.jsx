import { ChevronDown, ChevronUp, Flag, MessageSquareText, Share2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ThreeDot } from "react-loading-indicators";
import { apiRequest, getToken } from "../../lib/auth.js";
import LazyImage from "../ui/LazyImage.jsx";
import PostPreview from "../ui/PostPreview.jsx";
import ReportModal from "./ReportModal.jsx";

function formatDateTime(value) {
	if (!value) {
		return "";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	return date.toLocaleString();
}

export default function PostDetailModal({ open, onClose, item, onShare }) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [comments, setComments] = useState([]);
	const [input, setInput] = useState("");
	const [replyingTo, setReplyingTo] = useState("");
	const [replyInput, setReplyInput] = useState("");
	const [expandedThreads, setExpandedThreads] = useState({});
	const [submitting, setSubmitting] = useState(false);
	const [activeTab, setActiveTab] = useState("post");
	const [showReport, setShowReport] = useState(false);
	const [reportBusy, setReportBusy] = useState(false);

	useEffect(() => {
		if (open) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [open]);

	const token = useMemo(() => getToken(), []);

	async function handleReportSubmit(reason) {
		if (!(item?.entityType && item?.id)) return;
		setReportBusy(true);
		try {
			await apiRequest(
				`/social/${encodeURIComponent(item.entityType)}/${encodeURIComponent(item.id)}/report`,
				{ method: "POST", token, body: { reason } },
			);
			setShowReport(false);
		} catch {
			// silent
		} finally {
			setReportBusy(false);
		}
	}

	useEffect(() => {
		if (!(open && item?.id && item?.entityType)) {
			return;
		}
		let alive = true;
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setLoading(true);
		setError("");
		apiRequest(`/social/${encodeURIComponent(item.entityType)}/${encodeURIComponent(item.id)}`, {
			token,
		})
			.then((data) => {
				if (!alive) {
					return;
				}
				setComments(Array.isArray(data?.comments) ? data.comments : []);
			})
			.catch((err) => {
				if (!alive) {
					return;
				}
				setError(err.message || "Failed to load comments");
				setComments([]);
			})
			.finally(() => {
				if (!alive) {
					return;
				}
				setLoading(false);
			});

		return () => {
			alive = false;
		};
	}, [item?.entityType, item?.id, open, token]);

	function resetReply() {
		setReplyingTo("");
		setReplyInput("");
	}

	async function submitComment() {
		const text = input.trim();
		if (!text || submitting || !item?.id || !item?.entityType) {
			return;
		}
		setSubmitting(true);
		setError("");
		try {
			const created = await apiRequest(
				`/social/${encodeURIComponent(item.entityType)}/${encodeURIComponent(item.id)}/comment`,
				{
					method: "POST",
					token,
					body: { text },
				},
			);
			setComments((previous) => [created, ...previous]);
			setInput("");
		} catch (err) {
			setError(err.message || "Failed to post comment");
		} finally {
			setSubmitting(false);
		}
	}

	async function submitReply(parentId) {
		const text = replyInput.trim();
		if (!text || submitting || !item?.id || !item?.entityType || !parentId) {
			return;
		}
		setSubmitting(true);
		setError("");
		try {
			const created = await apiRequest(
				`/social/${encodeURIComponent(item.entityType)}/${encodeURIComponent(item.id)}/comment`,
				{
					method: "POST",
					token,
					body: { text, parent_id: parentId },
				},
			);
			setComments((previous) => [created, ...previous]);
			resetReply();
		} catch (err) {
			setError(err.message || "Failed to post reply");
		} finally {
			setSubmitting(false);
		}
	}

	const commentTree = useMemo(() => {
		const byId = new Map();
		const roots = [];
		const sorted = [...comments].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
		sorted.forEach((comment) => {
			byId.set(comment.id, { comment, children: [] });
		});
		sorted.forEach((comment) => {
			const node = byId.get(comment.id);
			if (comment.parent_id && byId.has(comment.parent_id)) {
				byId.get(comment.parent_id).children.push(node);
			} else {
				roots.push(node);
			}
		});
		return roots;
	}, [comments]);

	function toggleThread(id) {
		setExpandedThreads((prev) => ({ ...prev, [id]: !prev[id] }));
	}

	function getInitials(name) {
		if (!name) {
			return "U";
		}
		const parts = name.trim().split(/\s+/);
		if (parts.length >= 2) {
			return (parts[0][0] + parts[1][0]).toUpperCase();
		}
		return parts[0].slice(0, 2).toUpperCase();
	}

	function avatarColors(name) {
		const colors = [
			"bg-blue-500",
			"bg-emerald-500",
			"bg-violet-500",
			"bg-amber-500",
			"bg-rose-500",
			"bg-cyan-500",
			"bg-pink-500",
			"bg-indigo-500",
		];
		let hash = 0;
		for (let i = 0; i < (name || "").length; i++) {
			hash = name.charCodeAt(i) + ((hash << 5) - hash);
		}
		return colors[Math.abs(hash) % colors.length];
	}

	function renderCommentNode(node, depth = 0) {
		const { comment, children } = node;
		const safeDepth = Math.min(depth, 8);
		const hasChildren = children.length > 0;
		const expanded = expandedThreads[comment.id] !== false;
		const visibleChildren = expanded ? children : children.slice(0, 2);

		return (
			<div key={comment.id}>
				<div class="flex gap-2.5">
					{comment.actor_avatar ? (
						<LazyImage
							src={comment.actor_avatar}
							alt={comment.actor_name || "User avatar"}
							width={32}
							height={32}
							class="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover"
						/>
					) : (
						<div
							class={`mt-0.5 h-8 w-8 shrink-0 rounded-full ${avatarColors(comment.actor_name)} flex items-center justify-center text-xs font-bold text-white`}
						>
							{getInitials(comment.actor_name)}
						</div>
					)}
					<div class="flex-1 min-w-0">
						<div class="rounded-2xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5">
							<div class="flex items-center gap-2">
								<span class="text-sm font-semibold text-slate-900 dark:text-slate-100">
									{comment.actor_name || "User"}
								</span>
								{comment.actor_verified ? (
									<span class="text-[10px] text-[var(--theme-custom-0a66c2)] font-bold">
										Verified
									</span>
								) : null}
							</div>
							<p class="mt-0.5 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
								{comment.text}
							</p>
						</div>
						<div class="flex items-center gap-4 mt-0.5 px-1">
							<span class="text-[11px] text-slate-400 dark:text-slate-500">
								{formatDateTime(comment.created_at)}
							</span>
							<button
								type="button"
								onClick={() => setReplyingTo(replyingTo === comment.id ? "" : comment.id)}
								class="text-[11px] font-semibold text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400"
							>
								Reply
							</button>
						</div>

						{replyingTo === comment.id ? (
							<div class="mt-1.5 flex gap-2 items-center ml-1">
								<input
									value={replyInput}
									onChange={(e) => setReplyInput(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && submitReply(comment.id)}
									placeholder="Write a reply..."
									class="flex-1 rounded-full bg-slate-100 dark:bg-slate-800 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-custom-0a66c2)]"
								/>
								<button
									type="button"
									onClick={() => submitReply(comment.id)}
									disabled={submitting || !replyInput.trim()}
									class="rounded-full bg-[var(--theme-custom-0a66c2)] text-white px-3.5 py-2 text-sm font-semibold disabled:opacity-50"
								>
									{submitting ? (
										<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
									) : (
										"Send"
									)}
								</button>
								<button
									type="button"
									onClick={resetReply}
									class="text-[11px] font-semibold text-slate-400 hover:text-slate-600"
								>
									Cancel
								</button>
							</div>
						) : null}

						{hasChildren ? (
							<div class="mt-2 space-y-2 ml-1 pl-3 border-l-2 border-slate-200 dark:border-slate-700">
								{visibleChildren.map((child) => renderCommentNode(child, depth + 1))}
								{children.length > 2 ? (
									<button
										type="button"
										onClick={() => toggleThread(comment.id)}
										class="flex items-center gap-1.5 text-xs font-semibold text-[var(--theme-custom-0a66c2)] hover:text-[var(--theme-custom-084b8a)]"
									>
										{expanded ? (
											<>
												<ChevronUp size={14} /> Hide {children.length - 2} replies
											</>
										) : (
											<>
												<ChevronDown size={14} /> View {children.length - 2} replies
											</>
										)}
									</button>
								) : null}
							</div>
						) : null}
					</div>
				</div>
			</div>
		);
	}

	if (!open) {
		return null;
	}

	return (
		<div
			class="fixed inset-0 z-50 flex items-start justify-center pt-4 pb-4 sm:pt-10"
			style={{ overflow: "hidden" }}
		>
			<button
				type="button"
				aria-label="Close"
				onClick={onClose}
				class="fixed inset-0 bg-black/50"
			/>
			<div class="relative z-10 w-full max-w-2xl mx-2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overscroll-contain">
				<header class="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
					<div class="flex items-center gap-3">
						<div class="h-10 w-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 shrink-0" />
						<div>
							<p class="text-sm font-semibold text-slate-900 dark:text-slate-100">
								{item?.author?.name || "Unknown"}
							</p>
							<p class="text-[11px] text-slate-500 dark:text-slate-400">
								{item?.entityType === "user_feed_post"
									? "Feed Post"
									: item?.entityType === "buyer_request"
										? "Buyer Request"
										: "Company Product"}
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						class="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
						aria-label="Close"
					>
						<X size={20} class="text-slate-500 dark:text-slate-400" />
					</button>
				</header>

				<div class="flex border-b border-slate-200 dark:border-slate-700 shrink-0">
					<button
						type="button"
						onClick={() => setActiveTab("post")}
						class={`flex-1 px-4 py-3 text-sm font-semibold text-center transition ${
							activeTab === "post"
								? "text-sky-600 border-b-2 border-sky-500"
								: "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
						}`}
					>
						Post
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("comments")}
						class={`flex-1 px-4 py-3 text-sm font-semibold text-center transition ${
							activeTab === "comments"
								? "text-sky-600 border-b-2 border-sky-500"
								: "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
						}`}
					>
						Comments
					</button>
				</div>

				<div class="flex-1 min-h-0">
					{activeTab === "post" ? (
						<div data-lenis-prevent={true} class="h-full overflow-y-auto p-5">
							<PostPreview item={item} />

							<div class="mt-6 flex items-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
								<button
									type="button"
									onClick={() => setActiveTab("comments")}
									class="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400"
								>
									<MessageSquareText size={18} />
									Comments
								</button>
								<button
									type="button"
									onClick={onShare}
									class="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400"
								>
									<Share2 size={18} />
									Share
								</button>
								<button
									type="button"
									onClick={() => setShowReport(true)}
									class="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400"
								>
									<Flag size={18} />
									Report
								</button>
							</div>
						</div>
					) : null}

					{activeTab === "comments" ? (
						<div class="flex flex-col h-full">
							<div data-lenis-prevent={true} class="flex-1 overflow-y-auto p-5 space-y-5">
								{loading ? (
									<div class="flex justify-center py-8">
										<ThreeDot
											variant="bounce"
											color="#337ab0"
											size="large"
											style={{ fontSize: "36px" }}
											text=""
											textColor=""
										/>
									</div>
								) : null}
								{!loading && error ? (
									<div class="text-sm text-rose-700 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-300 rounded-lg p-3">
										{error}
									</div>
								) : null}
								{!(loading || error) && comments.length === 0 ? (
									<div class="text-sm text-slate-500 dark:text-slate-400 text-center py-12">
										<MessageSquareText size={32} class="mx-auto mb-3 opacity-40" />
										<p>No comments yet.</p>
										<p class="text-xs mt-1">Be the first to share your thoughts.</p>
									</div>
								) : null}

								{!loading && commentTree.map((node) => renderCommentNode(node, 0))}
							</div>

							<div class="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
								<div class="flex gap-2 items-center">
									<input
										value={input}
										onChange={(e) => setInput(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && submitComment()}
										placeholder="Write a comment..."
										class="flex-1 rounded-full bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-custom-0a66c2)]"
									/>
									<button
										type="button"
										onClick={submitComment}
										disabled={submitting || !input.trim()}
										class="rounded-full bg-[var(--theme-custom-0a66c2)] text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-50 hover:bg-[var(--theme-custom-084b8a)] transition"
									>
										{submitting ? (
											<ThreeDot
												variant="bounce"
												color="#337ab0"
												size="small"
												text=""
												textColor=""
											/>
										) : (
											"Post"
										)}
									</button>
								</div>
							</div>
						</div>
					) : null}
				</div>
			</div>
			<ReportModal
				open={showReport}
				item={item}
				onClose={() => setShowReport(false)}
				onSubmit={handleReportSubmit}
			/>
		</div>
	);
}
