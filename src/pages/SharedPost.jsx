/*
  Shared post page — public CTA for guests, full interactive view for logged-in users.
  Route: /share/:entityType/:entityId
*/

import {
	BadgeCheck,
	Building2,
	Calendar,
	ChevronDown,
	ChevronUp,
	Flag,
	Globe,
	Hash,
	Loader2,
	Lock,
	MapPin,
	MessageSquareText,
	Package,
	Share2,
	ShieldCheck,
	Tag,
	Users,
	Workflow,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import LazyImage from "../components/ui/LazyImage.jsx";
import { apiRequest, getCurrentUser, getToken } from "../lib/auth.js";
import usePageMeta from "../lib/usePageMeta.js";

const TYPE_LABELS = {
	buyer_request: {
		label: "Buyer Request",
		icon: "\uD83D\uDCBC",
		color: "from-blue-500 to-indigo-600",
	},
	company_product: {
		label: "Company Product",
		icon: "\uD83C\uDFED",
		color: "from-emerald-500 to-teal-600",
	},
	product: {
		label: "Company Product",
		icon: "\uD83C\uDFED",
		color: "from-emerald-500 to-teal-600",
	},
	feed_post: { label: "Feed Post", icon: "\uD83D\uDCDD", color: "from-sky-500 to-cyan-600" },
	post: { label: "Feed Post", icon: "\uD83D\uDCDD", color: "from-sky-500 to-cyan-600" },
	user_feed_post: { label: "Feed Post", icon: "\uD83D\uDCDD", color: "from-sky-500 to-cyan-600" },
};

function InfoRow({ icon: Icon, label, value }) {
	if (!value) return null;
	return (
		<div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
			{Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />}
			<span className="font-medium text-slate-500 dark:text-slate-400">{label}:</span>
			<span>{value}</span>
		</div>
	);
}

function BuyerRequestCard({ post }) {
	return (
		<div className="space-y-4">
			<h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
				{post.title || post.product || "Buyer Request"}
			</h1>
			<div className="flex flex-wrap gap-2">
				{post.status && (
					<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
						{formatStatus(post.status)}
					</span>
				)}
				{post.request_type && (
					<span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
						<Tag className="h-3 w-3" />
						{post.request_type}
					</span>
				)}
			</div>
			{(post.description || post.custom_description) && (
				<p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
					{post.description || post.custom_description}
				</p>
			)}
			<div className="grid gap-3 sm:grid-cols-2">
				<InfoRow icon={Package} label="Category" value={post.category} />
				<InfoRow icon={Users} label="Quantity" value={post.quantity} />
				<InfoRow icon={Tag} label="MOQ" value={post.moq} />
				<InfoRow icon={Globe} label="Target Market" value={post.target_market} />
				<InfoRow icon={Package} label="Material" value={post.material} />
				<InfoRow icon={Hash} label="Fabric GSM" value={post.fabric_gsm} />
				<InfoRow
					icon={Calendar}
					label="Delivery"
					value={post.delivery_timeline || post.timeline_days}
				/>
				<InfoRow icon={Workflow} label="Shipping" value={post.shipping_terms} />
				<InfoRow icon={ShieldCheck} label="Payment" value={post.payment_terms} />
				<InfoRow icon={MapPin} label="Incoterms" value={post.incoterms} />
			</div>
			{post.price_range && (
				<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
					<p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
						Price Range
					</p>
					<p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
						{post.price_range}
					</p>
				</div>
			)}
			{post.size_range && <InfoRow icon={Tag} label="Size Range" value={post.size_range} />}
			{post.color_pantone && (
				<InfoRow icon={Tag} label="Colors / Pantone" value={post.color_pantone} />
			)}
			{post.compliance_notes && (
				<InfoRow icon={ShieldCheck} label="Compliance" value={post.compliance_notes} />
			)}
		</div>
	);
}

function CompanyProductCard({ post }) {
	return (
		<div className="space-y-4">
			<h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
				{post.title || post.product_name || "Company Product"}
			</h1>
			<div className="flex flex-wrap gap-2">
				{post.status && (
					<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
						{formatStatus(post.status)}
					</span>
				)}
				{post.category && (
					<span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
						<Tag className="h-3 w-3" />
						{post.category}
					</span>
				)}
			</div>
			{post.description && (
				<p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
					{post.description}
				</p>
			)}
			<div className="grid gap-3 sm:grid-cols-2">
				<InfoRow icon={Package} label="Material" value={post.material} />
				<InfoRow icon={Hash} label="GSM" value={post.fabric_gsm || post.gsm} />
				<InfoRow icon={Tag} label="MOQ" value={post.moq} />
				<InfoRow icon={Calendar} label="Lead Time" value={post.lead_time || post.lead_time_days} />
				<InfoRow icon={Globe} label="Target Market" value={post.target_market} />
				<InfoRow icon={Workflow} label="Shipping" value={post.shipping_terms} />
			</div>
			{post.price && (
				<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
					<p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
						Price
					</p>
					<p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
						{post.currency ? `${post.currency} ` : ""}
						{post.price}
					</p>
				</div>
			)}
		</div>
	);
}

function FeedPostCard({ post }) {
	return (
		<div className="space-y-4">
			<h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
				{post.title || post.caption || "Feed Post"}
			</h1>
			{(post.description_markdown || post.description || post.caption) && (
				<div className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
					{post.description_markdown || post.description || post.caption}
				</div>
			)}
			{post.media && post.media.length > 0 && (
				<div className="grid gap-3 sm:grid-cols-2">
					{post.media.map((m, i) => (
						<div
							key={i}
							className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700"
						>
							{m.type === "video" ? (
								<video src={m.url} controls className="w-full object-cover" preload="metadata" />
							) : (
								<LazyImage
									src={m.url}
									alt={post.title || "Post media"}
									className="w-full object-cover"
								/>
							)}
						</div>
					))}
				</div>
			)}
			{post.hashtags && post.hashtags.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{post.hashtags.map((tag, i) => (
						<span
							key={i}
							className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
						>
							#{tag}
						</span>
					))}
				</div>
			)}
		</div>
	);
}

function formatStatus(status) {
	return String(status || "")
		.replace(/_/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr) {
	if (!dateStr) return "";
	try {
		return new Date(dateStr).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	} catch {
		return "";
	}
}

function formatDateTime(value) {
	if (!value) return "";
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return "";
	return d.toLocaleString();
}

function getInitials(name) {
	return (name || "?")
		.split(" ")
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

function avatarColorClass(name) {
	const colors = [
		"from-rose-500 to-pink-600",
		"from-violet-500 to-purple-600",
		"from-sky-500 to-blue-600",
		"from-emerald-500 to-teal-600",
		"from-amber-500 to-orange-600",
	];
	const hash = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
	return colors[hash % colors.length];
}

export default function SharedPost() {
	const { entityType, entityId } = useParams();
	const [post, setPost] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [copied, setCopied] = useState(false);

	const token = useMemo(() => getToken(), []);
	const currentUser = useMemo(() => getCurrentUser(), []);
	const isLoggedIn = Boolean(token);

	const [comments, setComments] = useState([]);
	const [commentsLoading, setCommentsLoading] = useState(false);
	const [commentInput, setCommentInput] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [replyingTo, setReplyingTo] = useState("");
	const [replyInput, setReplyInput] = useState("");
	const [expandedThreads, setExpandedThreads] = useState({});

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			setError("");
			try {
				const res = await fetch(
					`/api/feed/share/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
				);
				if (!res.ok) {
					const err = await res.json().catch(() => ({}));
					throw new Error(err.error || `HTTP ${res.status}`);
				}
				const data = await res.json();
				if (!cancelled) setPost(data);
			} catch (err) {
				if (!cancelled) setError(err.message || "Failed to load post");
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [entityType, entityId]);

	useEffect(() => {
		if (!isLoggedIn || !post?.id || !post?.entityType) return;
		let alive = true;
		setCommentsLoading(true);
		apiRequest(`/social/${encodeURIComponent(post.entityType)}/${encodeURIComponent(post.id)}`, {
			token,
		})
			.then((data) => {
				if (alive) setComments(Array.isArray(data?.comments) ? data.comments : []);
			})
			.catch(() => {
				if (alive) setComments([]);
			})
			.finally(() => {
				if (alive) setCommentsLoading(false);
			});
		return () => {
			alive = false;
		};
	}, [isLoggedIn, post?.id, post?.entityType, token]);

	const commentTree = useMemo(() => {
		const byId = new Map();
		const roots = [];
		const sorted = [...comments].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
		sorted.forEach((c) => byId.set(c.id, { comment: c, children: [] }));
		sorted.forEach((c) => {
			const node = byId.get(c.id);
			if (c.parent_id && byId.has(c.parent_id)) {
				byId.get(c.parent_id).children.push(node);
			} else {
				roots.push(node);
			}
		});
		return roots;
	}, [comments]);

	const commentCount = comments.length;

	async function submitComment() {
		const text = commentInput.trim();
		if (!text || submitting || !post?.id || !post?.entityType) return;
		setSubmitting(true);
		try {
			const created = await apiRequest(
				`/social/${encodeURIComponent(post.entityType)}/${encodeURIComponent(post.id)}/comment`,
				{ method: "POST", token, body: { text } },
			);
			setComments((prev) => [created, ...prev]);
			setCommentInput("");
		} catch {
			/* silent */
		} finally {
			setSubmitting(false);
		}
	}

	async function submitReply(parentId) {
		const text = replyInput.trim();
		if (!text || submitting || !post?.id || !post?.entityType || !parentId) return;
		setSubmitting(true);
		try {
			const created = await apiRequest(
				`/social/${encodeURIComponent(post.entityType)}/${encodeURIComponent(post.id)}/comment`,
				{ method: "POST", token, body: { text, parent_id: parentId } },
			);
			setComments((prev) => [created, ...prev]);
			setReplyingTo("");
			setReplyInput("");
		} catch {
			/* silent */
		} finally {
			setSubmitting(false);
		}
	}

	function toggleThread(commentId) {
		setExpandedThreads((prev) => ({
			...prev,
			[commentId]: prev[commentId] === false ? true : false,
		}));
	}

	function renderCommentNode(node, depth = 0) {
		const { comment, children } = node;
		const expanded = expandedThreads[comment.id] !== false;
		return (
			<div key={comment.id} className={depth > 0 ? "ml-6 sm:ml-10" : ""}>
				<div className="flex gap-3 py-3">
					{comment.actor_avatar ? (
						<img
							src={comment.actor_avatar}
							alt=""
							className="h-8 w-8 shrink-0 rounded-full object-cover"
						/>
					) : (
						<div
							className={`mt-0.5 h-8 w-8 shrink-0 rounded-full bg-gradient-to-br ${avatarColorClass(comment.actor_name)} flex items-center justify-center text-xs font-bold text-white`}
						>
							{getInitials(comment.actor_name)}
						</div>
					)}
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<span className="text-sm font-semibold text-slate-900 dark:text-white">
								{comment.actor_name || "User"}
							</span>
							{comment.actor_verified && <BadgeCheck size={14} className="text-sky-500" />}
						</div>
						<p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
							{comment.text}
						</p>
						<div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
							<span>{formatDateTime(comment.created_at)}</span>
							{isLoggedIn && (
								<button
									onClick={() => setReplyingTo(replyingTo === comment.id ? "" : comment.id)}
									className="font-medium hover:text-sky-500 transition"
								>
									Reply
								</button>
							)}
						</div>
						{replyingTo === comment.id && (
							<div className="mt-2 flex gap-2">
								<input
									value={replyInput}
									onChange={(e) => setReplyInput(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && submitReply(comment.id)}
									placeholder="Write a reply..."
									className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
									// biome-ignore lint/a11y/noAutofocus: focus moves into the dialog/editor the user just opened
									autoFocus
								/>
								<button
									onClick={() => submitReply(comment.id)}
									disabled={!replyInput.trim() || submitting}
									className="rounded-full bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
								>
									Post
								</button>
							</div>
						)}
					</div>
				</div>
				{children.length > 0 && (
					<>
						{children.length > 2 && depth === 0 ? (
							<>
								{(expanded ? children : children.slice(0, 2)).map((child) =>
									renderCommentNode(child, depth + 1),
								)}
								<button
									onClick={() => toggleThread(comment.id)}
									className="ml-8 mb-2 flex items-center gap-1 text-xs font-medium text-sky-500 hover:text-sky-600"
								>
									{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
									{expanded
										? "Show less"
										: `View ${children.length - 2} more ${children.length - 2 === 1 ? "reply" : "replies"}`}
								</button>
							</>
						) : (
							children.map((child) => renderCommentNode(child, depth + 1))
						)}
					</>
				)}
			</div>
		);
	}

	async function handleCopyLink() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			/* ignore */
		}
	}

	const typeInfo = TYPE_LABELS[entityType] || TYPE_LABELS.feed_post;

	const sharedTitle =
		post?.title || post?.product || post?.product_name || post?.caption || "Shared post";
	const sharedAuthor = post?.author?.name || "a GarTexHub member";
	const sharedExcerpt = String(
		post?.description ||
			post?.description_markdown ||
			post?.caption ||
			post?.custom_description ||
			sharedTitle,
	)
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 157);
	usePageMeta({
		title: post
			? `${sharedTitle} — shared by ${sharedAuthor} on GarTexHub`
			: "Shared post — GarTexHub",
		type: "article",
		description: post
			? sharedExcerpt
			: "This shared GarTexHub post is unavailable or was removed. Join GarTexHub to connect with garment buyers and suppliers.",
		robots: post ? "index,follow" : "noindex,nofollow",
	});

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
				<div className="text-center">
					<Loader2 className="mx-auto h-10 w-10 animate-spin text-sky-500" />
					<p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading shared post...</p>
				</div>
			</div>
		);
	}

	if (error || !post) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
				<div className="mx-4 w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-700 dark:bg-slate-900">
					<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/15">
						<Lock className="h-8 w-8 text-red-500" />
					</div>
					<h1 className="text-xl font-bold text-slate-900 dark:text-white">Post Not Found</h1>
					<p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
						{error || "This post may have been removed or is no longer available."}
					</p>
					<Link
						to="/"
						className="mt-6 inline-flex items-center gap-2 rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-600"
					>
						Go to GarTexHub
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
			<header className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
				<div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
					<Link to="/" className="flex items-center gap-2">
						<div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-sm font-bold text-white shadow-lg shadow-sky-500/25">
							G
						</div>
						<span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
							GarTexHub
						</span>
					</Link>
					<div className="flex items-center gap-2">
						{isLoggedIn && commentCount > 0 && (
							<span className="text-xs font-medium text-slate-500 dark:text-slate-400">
								{commentCount} {commentCount === 1 ? "comment" : "comments"}
							</span>
						)}
						<button
							onClick={handleCopyLink}
							className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-sky-500/30"
						>
							<Share2 className="h-3.5 w-3.5" />
							{copied ? "Copied!" : "Share"}
						</button>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
				<article className="overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
					<div className={`bg-gradient-to-r ${typeInfo.color} px-6 py-4 sm:px-8`}>
						<div className="flex items-center gap-2 text-sm font-semibold text-white/90">
							<span>{typeInfo.icon}</span>
							<span>{typeInfo.label}</span>
						</div>
					</div>

					<div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4 sm:px-8 dark:border-slate-800">
						{post.author?.avatar_url ? (
							<img
								src={post.author.avatar_url}
								alt={post.author.name}
								className="h-11 w-11 rounded-full object-cover ring-2 ring-white dark:ring-slate-900"
							/>
						) : (
							<div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-sm font-bold text-white">
								{(post.author?.name || "U").charAt(0).toUpperCase()}
							</div>
						)}
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-1.5">
								<span className="truncate text-sm font-bold text-slate-900 dark:text-white">
									{post.author?.name || "Unknown"}
								</span>
								{post.author?.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" />}
							</div>
							<div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
								{post.author?.accountType && (
									<span className="inline-flex items-center gap-1">
										<Building2 className="h-3 w-3" />
										{post.author.accountType}
									</span>
								)}
								{post.created_at && (
									<span className="inline-flex items-center gap-1">
										<Calendar className="h-3 w-3" />
										{formatDate(post.created_at)}
									</span>
								)}
							</div>
						</div>
					</div>

					<div className="px-6 py-5 sm:px-8 sm:py-6">
						{entityType === "buyer_request" || entityType === "buyer_requests" ? (
							<BuyerRequestCard post={post} />
						) : entityType === "company_product" ||
							entityType === "product" ||
							entityType === "products" ? (
							<CompanyProductCard post={post} />
						) : (
							<FeedPostCard post={post} />
						)}
					</div>

					{isLoggedIn ? (
						<>
							<div className="border-t border-slate-100 px-6 py-3 sm:px-8 dark:border-slate-800">
								<div className="flex items-center gap-1 text-xs">
									<button
										onClick={() => {
											const el = document.getElementById("shared-comment-input");
											if (el) el.focus();
										}}
										className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
									>
										<MessageSquareText size={16} /> Comment
									</button>
									<button
										onClick={handleCopyLink}
										className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
									>
										<Share2 size={16} /> Share
									</button>
									<button className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer">
										<Flag size={16} /> Report
									</button>
								</div>
							</div>

							<div className="border-t border-slate-100 px-6 py-4 sm:px-8 dark:border-slate-800">
								{commentsLoading ? (
									<div className="flex justify-center py-4">
										<Loader2 className="h-5 w-5 animate-spin text-slate-400" />
									</div>
								) : (
									<>
										{commentTree.length === 0 && (
											<p className="py-3 text-center text-sm text-slate-400 dark:text-slate-500">
												No comments yet. Be the first to comment.
											</p>
										)}
										{commentTree.map((node) => renderCommentNode(node, 0))}
									</>
								)}
								<div className="mt-3 flex gap-2">
									<input
										id="shared-comment-input"
										value={commentInput}
										onChange={(e) => setCommentInput(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && submitComment()}
										placeholder="Write a comment..."
										className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
									/>
									<button
										onClick={submitComment}
										disabled={!commentInput.trim() || submitting}
										className="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-sky-600 disabled:opacity-50"
									>
										Post
									</button>
								</div>
							</div>
						</>
					) : (
						<div className="border-t border-slate-100 bg-slate-50/50 px-6 py-5 sm:px-8 dark:border-slate-800 dark:bg-slate-800/30">
							<div className="text-center">
								<p className="text-sm font-medium text-slate-600 dark:text-slate-300">
									Interested in this {typeInfo.label.toLowerCase()}?
								</p>
								<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
									Join GarTexHub to connect with suppliers and buyers in the garment industry.
								</p>
								<div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
									<Link
										to="/signup"
										className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-600"
									>
										<Users className="h-4 w-4" />
										Join GarTexHub — It&apos;s Free
									</Link>
									<Link
										to="/login"
										className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
									>
										Already have an account? Log in
									</Link>
								</div>
							</div>
						</div>
					)}
				</article>
			</main>
		</div>
	);
}
