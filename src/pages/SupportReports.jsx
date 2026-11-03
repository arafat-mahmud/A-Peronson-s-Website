/*
  Route: /support
  Access: Protected (login required)

  Purpose:
    - Open a support INVESTIGATION and talk to it: describe the problem,
      answer the assistant's clarifying questions, watch the investigation
      roles run, read the report, confirm it.
    - Keep the legacy "My Support Tickets" list, which is read-only and still
      correct for the tickets that predate the case system.

  The old submit form (subject, category, priority buttons, description
  textarea, page URL, contact email, one file input) is gone. A case is
  opened, and from then on the page is a conversation.

  The HTTP contract is contracts.md §3 and the event contract is §4. Both
  belong to the server; this page only reads them, through the hook in
  src/hooks/useSupportCase.js.
*/

import {
	AlertTriangle,
	ArrowLeft,
	Check,
	CheckCircle,
	ClipboardList,
	Crown,
	Download,
	ExternalLink,
	FileText,
	Loader2,
	MessageSquare,
	Moon,
	Paperclip,
	RefreshCw,
	Search,
	Send,
	Shield,
	Sparkles,
	Sun,
	Ticket,
	Trash2,
	Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mosaic, ThreeDot } from "react-loading-indicators";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import remarkGfm from "remark-gfm";
import ScrollReveal from "../components/ScrollReveal.jsx";
import LazyImage from "../components/ui/LazyImage.jsx";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import { usePremiumCheck } from "../hooks/useSecureUser.js";
import { useSupportCase } from "../hooks/useSupportCase.js";
import { apiRequest, getCurrentUser, getToken, hasEntitlement } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { signAndDownload, signAndOpen, signOne } from "../lib/signedFile.js";
import { useTheme } from "../lib/ThemeProvider.jsx";

// The case statuses the server owns (contracts.md §1). The label is the only
// thing this page adds: the state machine is the server's.
const CASE_STATUS_LABELS = {
	collecting: "Collecting details",
	investigating: "Investigating",
	reporting: "Writing the report",
	completed: "Completed",
	failed: "Failed",
};

// The five investigation roles (contracts.md §5). They are listed here so the
// user can see what is about to run, not only what has already run.
const INVESTIGATION_ROLES = [
	{
		id: "lead",
		label: "Lead investigator",
		blurb: "Frames the question and runs the investigation.",
	},
	{ id: "code", label: "Code analysis", blurb: "Reads the code paths the problem touches." },
	{ id: "repo", label: "Repository research", blurb: "Searches history, tests and documentation." },
	{
		id: "research",
		label: "External research",
		blurb: "Checks upstream docs and outside sources.",
	},
	{ id: "verify", label: "Verification", blurb: "Challenges the findings before the report." },
];

// The three confidence levels a finding can carry (contracts.md §5).
const CONFIDENCE_LABELS = {
	confirmed: "Confirmed",
	probable: "Probable",
	speculative: "Speculative",
};

// Top level, so they are compiled once.
const IMAGE_FILE_PATTERN = /\.(png|jpe?g|gif|webp|avif|bmp)$/i;
const EXTERNAL_URL_PATTERN = /^https?:\/\//i;

/**
 * Reverses the HTML escaping the server applies to stored message content.
 *
 * `sanitizeString` (server/utils/validators.js) escapes the message body
 * before it is stored, so a stored message reads `it&#39;s broken` rather
 * than `it's broken`. The body is still rendered as TEXT — React escapes it
 * again on the way out — so decoding here restores what the user wrote
 * without ever turning the content into markup.
 *
 * @param {unknown} value - The stored content.
 * @returns {string} The content as the user wrote it.
 */
function decodeStoredText(value) {
	return String(value ?? "")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, "&");
}

/**
 * The display name of a stored file. Only the LAST segment is used: a raw
 * "/uploads/..." path must never reach the DOM for a case attachment, and a
 * file name is all the user needs.
 *
 * @param {string} filePath - The stored path.
 * @returns {string} The file name.
 */
function fileNameOf(filePath) {
	const raw = String(filePath || "");
	const [withoutQuery] = raw.split("?");
	const [withoutHash] = withoutQuery.split("#");
	const parts = withoutHash.split("/").filter(Boolean);
	return parts.length > 0 ? (parts.at(-1) ?? "attachment") : "attachment";
}

/**
 * Whether a stored file is an image, so the page can offer a preview.
 *
 * @param {Object} attachment - The attachment descriptor.
 * @returns {boolean} True when the file is an image.
 */
function isImageAttachment(attachment) {
	const mime = String(attachment?.mime_type || "").toLowerCase();
	if (mime.startsWith("image/")) {
		return true;
	}
	return IMAGE_FILE_PATTERN.test(fileNameOf(attachment?.file_path));
}

/**
 * An external link, but only an http(s) one.
 *
 * Evidence can carry a URL. A relative one is refused: the only relative
 * paths in this system are the private "/uploads/..." ones, and a private
 * path must never be rendered as a link.
 *
 * @param {unknown} value - The candidate URL.
 * @returns {string|null} The URL, or null when it is not an external link.
 */
function safeExternalUrl(value) {
	const raw = String(value ?? "").trim();
	if (!EXTERNAL_URL_PATTERN.test(raw)) {
		return null;
	}
	return raw;
}

/**
 * The colour of a legacy ticket's priority badge.
 *
 * @param {string} priority - The priority name.
 * @returns {string} The badge classes.
 */
function getPriorityColor(priority) {
	if (priority === "Urgent") {
		return "bg-rose-500/15 text-rose-300";
	}
	if (priority === "High") {
		return "bg-orange-500/15 text-orange-300";
	}
	if (priority === "Medium") {
		return "bg-amber-500/15 text-amber-300";
	}
	return "bg-emerald-500/15 text-emerald-300";
}

/**
 * A preview of one attachment, rendered through a signed url.
 *
 * The raw path is NEVER used as a src. The url is minted for the moment the
 * preview renders, and a preview that cannot be signed renders nothing at
 * all — a broken image with a private path in its src is exactly the leak
 * the signed-url gate exists to prevent.
 *
 * @param {Object} props - The component props.
 * @param {string} props.filePath - The stored path of the file.
 * @param {string} props.fileName - The display name of the file.
 * @param {boolean} props.darkMode - Whether the dark theme is on.
 * @returns {JSX.Element} The preview.
 */
function SignedAttachmentPreview({ filePath, fileName, darkMode }) {
	const [signedUrl, setSignedUrl] = useState(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setSignedUrl(null);
		setFailed(false);
		signOne(filePath)
			.then((url) => {
				if (cancelled) {
					return;
				}
				if (!url) {
					setFailed(true);
					return;
				}
				setSignedUrl(url);
			})
			.catch(() => {
				if (!cancelled) {
					setFailed(true);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [filePath]);

	if (failed) {
		return (
			<p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
				Preview unavailable for {fileName}.
			</p>
		);
	}

	if (!signedUrl) {
		return (
			<div
				className={`flex h-40 items-center justify-center rounded-2xl border border-dashed ${
					darkMode ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"
				}`}
			>
				<Loader2 className="h-5 w-5 animate-spin text-sky-400" />
			</div>
		);
	}

	return (
		<LazyImage
			src={signedUrl}
			alt={fileName}
			width={640}
			height={360}
			// biome-ignore lint/suspicious/noReactSpecificProps: LazyImage reads className itself; a class attribute would land on the img as a second class and replace the fade classes
			className="h-40 w-full rounded-2xl object-cover"
		/>
	);
}

/**
 * The icon that stands for one investigation role's state.
 *
 * @param {boolean} failed - Whether the role failed.
 * @param {boolean} done - Whether the role finished.
 * @param {boolean} busy - Whether the role is running.
 * @returns {JSX.Element} The icon.
 */
function progressIcon(failed, done, busy) {
	if (failed) {
		return <AlertTriangle className="h-4 w-4" />;
	}
	if (done) {
		return <CheckCircle className="h-4 w-4" />;
	}
	if (busy) {
		return <Loader2 className="h-4 w-4 animate-spin" />;
	}
	return <ClipboardList className="h-4 w-4" />;
}

/**
 * One message in the transcript.
 *
 * The body is rendered as TEXT. It never becomes markup, whatever it holds.
 *
 * @param {Object} props - The component props.
 * @param {Object} props.message - The stored message row.
 * @param {boolean} props.darkMode - Whether the dark theme is on.
 * @returns {JSX.Element} The message bubble.
 */
function MessageBubble({ message, darkMode }) {
	const role = String(message?.role || "system");
	const kind = String(message?.kind || "answer");
	const body = decodeStoredText(message?.content);

	const isClient = role === "client";
	const isAdmin = role === "admin";
	const isNotice = role === "system" || kind === "notice" || kind === "progress";

	let bubbleClass = darkMode
		? "border-white/10 bg-white/5 text-slate-100"
		: "border-slate-200 bg-white text-slate-800";
	if (isClient) {
		bubbleClass = "border-sky-400/30 bg-sky-500/15 text-sky-50";
	} else if (isAdmin) {
		bubbleClass = darkMode
			? "border-amber-400/30 bg-amber-500/10 text-amber-100"
			: "border-amber-200 bg-amber-50 text-amber-900";
	}

	let label = "Assistant";
	if (isClient) {
		label = "You";
	} else if (isAdmin) {
		label = "Support";
	}

	if (isNotice) {
		return (
			<div className="flex justify-center">
				<p
					className={`max-w-[85%] rounded-full border px-4 py-2 text-center text-xs ${
						darkMode
							? "border-white/10 bg-white/5 text-slate-400"
							: "border-slate-200 bg-slate-50 text-slate-500"
					}`}
				>
					{body}
				</p>
			</div>
		);
	}

	return (
		<div className={`flex ${isClient ? "justify-end" : "justify-start"}`}>
			<div className={`max-w-[85%] rounded-[24px] border px-4 py-3 ${bubbleClass}`}>
				<p className={`text-xs font-semibold ${isClient ? "text-sky-200" : "text-slate-400"}`}>
					{label}
					{message?.agent ? ` · ${message.agent}` : ""}
				</p>
				<p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{body}</p>
			</div>
		</div>
	);
}

/**
 * The conversation.
 *
 * @param {Object} props - The component props.
 * @param {Array<Object>} props.messages - The stored messages.
 * @param {boolean} props.darkMode - Whether the dark theme is on.
 * @param {Object} props.transcriptRef - The ref of the scrolling box.
 * @returns {JSX.Element} The transcript.
 */
function TranscriptPanel({ messages, darkMode, transcriptRef }) {
	return (
		<div
			ref={transcriptRef}
			data-lenis-prevent={true}
			className={`max-h-[26rem] space-y-3 overflow-y-auto rounded-[24px] border p-4 ${
				darkMode ? "border-white/10 bg-slate-950/40" : "border-slate-200 bg-slate-50"
			}`}
		>
			{messages.length === 0 ? (
				<p className={`py-6 text-center text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
					No messages yet. Describe the problem below and the assistant will take it from there.
				</p>
			) : (
				messages.map((message) => (
					<MessageBubble
						key={message?.id ?? `seq-${message?.sequence ?? 0}`}
						message={message}
						darkMode={darkMode}
					/>
				))
			)}
		</div>
	);
}

/**
 * Which investigation role is running, and which have finished.
 *
 * @param {Object} props - The component props.
 * @param {Map<string, Object>} props.progressByRole - The latest row per role.
 * @param {string} props.caseStatus - The case status.
 * @param {boolean} props.darkMode - Whether the dark theme is on.
 * @returns {JSX.Element} The progress panel.
 */
function InvestigationProgressPanel({ progressByRole, caseStatus, darkMode }) {
	return (
		<div
			className={`rounded-[24px] border p-5 ${darkMode ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
		>
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-lg font-semibold">Investigation progress</h3>
				<span
					className={`rounded-full px-3 py-1 text-xs font-semibold ${
						darkMode ? "bg-white/5 text-slate-300" : "bg-slate-100 text-slate-600"
					}`}
				>
					{CASE_STATUS_LABELS[caseStatus] || caseStatus}
				</span>
			</div>
			<ul className="mt-4 space-y-3">
				{INVESTIGATION_ROLES.map((role) => {
					const row = progressByRole.get(role.id);
					const roleStatus = String(row?.status || "queued");
					const busy = roleStatus === "running";
					const done = roleStatus === "complete";
					const failed = roleStatus === "failed";
					let tone = darkMode ? "bg-white/5 text-slate-500" : "bg-slate-100 text-slate-400";
					if (failed) {
						tone = "bg-rose-500/15 text-rose-300";
					} else if (done) {
						tone = "bg-emerald-500/15 text-emerald-300";
					} else if (busy) {
						tone = "bg-sky-500/20 text-sky-300";
					}
					return (
						<li key={role.id} className="flex items-start gap-3">
							<span
								className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone}`}
							>
								{progressIcon(failed, done, busy)}
							</span>
							<div className="min-w-0">
								<p className="text-sm font-semibold">
									{role.label}
									<span
										className={`ml-2 text-xs font-normal ${darkMode ? "text-slate-400" : "text-slate-500"}`}
									>
										{roleStatus}
									</span>
								</p>
								<p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
									{row?.detail || role.blurb}
								</p>
							</div>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

/**
 * The findings that arrived while the investigation ran.
 *
 * @param {Object} props - The component props.
 * @param {Array<Object>} props.findingRows - The findings, with keys.
 * @param {boolean} props.darkMode - Whether the dark theme is on.
 * @returns {JSX.Element} The findings panel.
 */
function FindingsPanel({ findingRows, darkMode }) {
	return (
		<div
			className={`rounded-[24px] border p-5 ${darkMode ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
		>
			<h3 className="text-lg font-semibold">Findings</h3>
			<ul className="mt-4 space-y-4">
				{findingRows.map(({ key, entry }) => {
					const finding = entry?.finding || {};
					const confidence = String(finding.confidence || "speculative");
					const evidence = Array.isArray(finding.evidence) ? finding.evidence : [];
					let tone = "bg-slate-500/15 text-slate-400";
					if (confidence === "confirmed") {
						tone = "bg-emerald-500/15 text-emerald-300";
					} else if (confidence === "probable") {
						tone = "bg-amber-500/15 text-amber-300";
					}
					return (
						<li
							key={key}
							className={`rounded-2xl border p-4 ${darkMode ? "border-white/10 bg-slate-900/40" : "border-slate-200 bg-slate-50"}`}
						>
							<div className="flex flex-wrap items-center gap-2">
								<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
									{CONFIDENCE_LABELS[confidence] || confidence}
								</span>
								{entry?.role ? (
									<span
										className={`rounded-full px-2.5 py-1 text-xs ${darkMode ? "bg-white/5 text-slate-300" : "bg-slate-100 text-slate-600"}`}
									>
										{entry.role}
									</span>
								) : null}
							</div>
							<p className="mt-2 text-sm leading-6">{finding.detail || ""}</p>
							{evidence.length > 0 ? (
								<ul className="mt-3 space-y-1">
									{evidence.map((item) => {
										const href = safeExternalUrl(item?.url);
										const label = item?.file || item?.commit || "evidence";
										const suffix = item?.lines ? ` (lines ${item.lines})` : "";
										return (
											<li key={`${label}${suffix}`} className="text-xs">
												{href ? (
													<a
														href={href}
														target="_blank"
														rel="noopener noreferrer"
														className="inline-flex items-center gap-1 text-sky-300 underline underline-offset-2"
													>
														{label}
														{suffix}
														<ExternalLink className="h-3 w-3" />
													</a>
												) : (
													<span className={darkMode ? "text-slate-400" : "text-slate-500"}>
														{label}
														{suffix}
													</span>
												)}
											</li>
										);
									})}
								</ul>
							) : null}
						</li>
					);
				})}
			</ul>
		</div>
	);
}

/**
 * The Markdown elements the report renderer is allowed to produce.
 *
 * The report is Markdown (the design spec says so). Two elements are
 * overridden, and both overrides REFUSE a relative path:
 *
 *   - `a` — only an http(s) href becomes a link. A relative href in this
 *     system is a private "/uploads/..." path, and a private path must never
 *     be rendered as an href.
 *   - `img` — only an http(s) src becomes an image, for the same reason.
 *
 * `rehype-raw` is deliberately NOT used, so raw HTML inside the report is
 * never parsed into the DOM at all.
 *
 * @type {Object}
 */
const REPORT_MARKDOWN_COMPONENTS = {
	a({ node: _node, href, children, ...props }) {
		const url = safeExternalUrl(href);
		if (!url) {
			return <span {...props}>{children}</span>;
		}
		return (
			<a {...props} href={url} target="_blank" rel="noopener noreferrer">
				{children}
			</a>
		);
	},
	img({ node: _node, src, alt }) {
		const url = safeExternalUrl(src);
		if (!url) {
			return null;
		}
		return (
			<img
				src={url}
				alt={alt || ""}
				width={640}
				height={360}
				loading="lazy"
				className="max-w-full rounded-2xl"
			/>
		);
	},
};

/**
 * The finished report, and the action that confirms it.
 *
 * The report is Markdown, rendered by react-markdown WITHOUT `rehype-raw`, so
 * no raw HTML in the report ever reaches the DOM. The two elements that could
 * carry a path — `a` and `img` — are overridden to refuse anything that is not
 * an absolute http(s) url.
 *
 * @param {Object} props - The component props.
 * @param {Object} props.report - The report payload.
 * @param {boolean} props.confirming - Whether the confirmation is in flight.
 * @param {boolean} props.confirmed - Whether the user already confirmed.
 * @param {Function} props.onConfirm - The confirmation action.
 * @param {boolean} props.darkMode - Whether the dark theme is on.
 * @returns {JSX.Element} The report panel.
 */
function ReportPanel({ report, confirming, confirmed, onConfirm, darkMode }) {
	return (
		<div
			className={`rounded-[24px] border p-5 ${darkMode ? "border-emerald-400/20 bg-emerald-500/10" : "border-emerald-200 bg-emerald-50"}`}
		>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h3 className="text-lg font-semibold">Investigation report</h3>
				{report?.reportStatus ? (
					<span
						className={`rounded-full px-3 py-1 text-xs font-semibold ${darkMode ? "bg-white/5 text-slate-200" : "bg-white text-emerald-700"}`}
					>
						{report.reportStatus}
					</span>
				) : null}
			</div>
			<div className="mt-3 max-h-[32rem] overflow-y-auto break-words text-sm leading-6">
				<ReactMarkdown remarkPlugins={[remarkGfm]} components={REPORT_MARKDOWN_COMPONENTS}>
					{String(report?.report ?? "")}
				</ReactMarkdown>
			</div>
			<div className="mt-5 flex flex-wrap items-center gap-3">
				<button
					type="button"
					onClick={onConfirm}
					disabled={confirming || confirmed}
					className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{confirming ? (
						<ThreeDot variant="bounce" color="#10b981" size="small" text="" textColor="" />
					) : (
						<Check className="h-4 w-4" />
					)}
					Confirm this is accurate
				</button>
				{confirmed ? (
					<p className="text-sm text-emerald-300">Thanks — your confirmation was recorded.</p>
				) : null}
			</div>
		</div>
	);
}

/**
 * The composer: the message box, the attachment button, the send button.
 *
 * @param {Object} props - The component props.
 * @param {string} props.draft - The message being written.
 * @param {Function} props.onDraftChange - Called with the new message.
 * @param {Array<Object>} props.pendingAttachments - The uploaded, unsent files.
 * @param {Function} props.onRemoveAttachment - Removes one uploaded file.
 * @param {boolean} props.uploading - Whether a file is uploading.
 * @param {boolean} props.sending - Whether the message is in flight.
 * @param {boolean} props.canSend - Whether the send button is live.
 * @param {Function} props.onSend - Sends the message.
 * @param {Function} props.onFiles - Handles the chosen files.
 * @param {string} props.caseStatus - The case status.
 * @param {boolean} props.confirming - Whether the confirmation is in flight.
 * @param {Function} props.onConfirm - Confirms the case.
 * @param {string} props.inputTheme - The input classes.
 * @param {boolean} props.darkMode - Whether the dark theme is on.
 * @returns {JSX.Element} The composer.
 */
function Composer({
	draft,
	onDraftChange,
	pendingAttachments,
	onRemoveAttachment,
	uploading,
	sending,
	canSend,
	onSend,
	onFiles,
	caseStatus,
	confirming,
	onConfirm,
	inputTheme,
	darkMode,
}) {
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				onSend();
			}}
			className="space-y-3"
		>
			<textarea
				rows={4}
				value={draft}
				onChange={(event) => onDraftChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter" && !event.shiftKey) {
						event.preventDefault();
						onSend();
					}
				}}
				placeholder="Describe what went wrong…"
				aria-label="Message"
				className={`w-full resize-y rounded-3xl border px-4 py-3 text-sm outline-none transition ${inputTheme}`}
			/>

			{pendingAttachments.length > 0 ? (
				<ul className="flex flex-wrap gap-2">
					{pendingAttachments.map((attachment) => {
						const name = fileNameOf(attachment.file_path);
						return (
							<li
								key={attachment.file_path}
								className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs ${darkMode ? "border-white/10 bg-white/5 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"}`}
							>
								<FileText className="h-3.5 w-3.5" />
								<span className="max-w-[12rem] truncate">{name}</span>
								<button
									type="button"
									onClick={() => onRemoveAttachment(attachment.file_path)}
									className="text-slate-400 transition hover:text-rose-300"
									aria-label={`Remove ${name}`}
								>
									<Trash2 className="h-3.5 w-3.5" />
								</button>
							</li>
						);
					})}
				</ul>
			) : null}

			<div className="flex flex-wrap items-center gap-3">
				<label
					className={`inline-flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition hover:scale-[1.01] active:scale-[0.99] ${darkMode ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
				>
					<input
						type="file"
						multiple={true}
						className="hidden"
						onChange={(event) => {
							onFiles(event.target.files);
							event.target.value = "";
						}}
					/>
					{uploading ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Paperclip className="h-4 w-4" />
					)}
					{uploading ? "Uploading…" : "Attach evidence"}
				</label>

				<button
					type="submit"
					disabled={!canSend}
					className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-sky-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{sending ? (
						<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
					) : (
						<Send className="h-4 w-4" />
					)}
					Send
				</button>

				{caseStatus === "collecting" ? (
					<button
						type="button"
						onClick={onConfirm}
						disabled={confirming}
						className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${darkMode ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
					>
						<Shield className="h-4 w-4" />
						Start the investigation
					</button>
				) : null}
			</div>
		</form>
	);
}

/**
 * The files attached to this case, served through signed links.
 *
 * @param {Object} props - The component props.
 * @param {Array<Object>} props.attachments - The attachment descriptors.
 * @param {Function} props.onOpen - Opens a file in a new tab.
 * @param {Function} props.onDownload - Downloads a file.
 * @param {boolean} props.darkMode - Whether the dark theme is on.
 * @returns {JSX.Element} The evidence panel.
 */
function EvidencePanel({ attachments, onOpen, onDownload, darkMode }) {
	return (
		<section
			className={`rounded-[28px] border ${darkMode ? "bg-white/5 border-white/10" : "bg-white border-slate-200"} p-5 backdrop-blur-xl sm:p-6`}
		>
			<h3 className="text-xl font-semibold">Evidence on this case</h3>
			<p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
				Private files, served through short-lived signed links.
			</p>
			<ul className="mt-5 space-y-4">
				{attachments.map((attachment) => {
					const name = fileNameOf(attachment?.file_path);
					return (
						<li
							key={attachment.file_path}
							className={`rounded-[24px] border p-4 ${darkMode ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
						>
							{isImageAttachment(attachment) ? (
								<SignedAttachmentPreview
									filePath={attachment.file_path}
									fileName={name}
									darkMode={darkMode}
								/>
							) : null}
							<p className="mt-3 truncate text-sm font-semibold">{name}</p>
							{attachment?.byte_size ? (
								<p className={`mt-1 text-xs ${darkMode ? "text-slate-500" : "text-slate-500"}`}>
									{Math.max(1, Math.round(attachment.byte_size / 1024))} KB
								</p>
							) : null}
							<div className="mt-3 flex flex-wrap items-center gap-2">
								<button
									type="button"
									onClick={() => onOpen(attachment)}
									className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
										darkMode
											? "border-white/10 bg-white/5 text-white hover:bg-white/10"
											: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
									}`}
								>
									<ExternalLink className="h-3.5 w-3.5" />
									Open
								</button>
								<button
									type="button"
									onClick={() => onDownload(attachment)}
									className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
										darkMode
											? "border-white/10 bg-white/5 text-white hover:bg-white/10"
											: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
									}`}
								>
									<Download className="h-3.5 w-3.5" />
									Download
								</button>
							</div>
						</li>
					);
				})}
			</ul>
		</section>
	);
}

/**
 * The investigations this user opened.
 *
 * @param {Object} props - The component props.
 * @param {Array<Object>} props.cases - The case rows.
 * @param {boolean} props.loading - Whether the list is loading.
 * @param {string} props.activeCaseId - The open case.
 * @param {Function} props.onRefresh - Reloads the list.
 * @param {Function} props.onOpen - Opens one case.
 * @param {boolean} props.darkMode - Whether the dark theme is on.
 * @returns {JSX.Element} The case list.
 */
function InvestigationList({ cases, loading, activeCaseId, onRefresh, onOpen, darkMode }) {
	let body = null;
	if (loading) {
		body = (
			<Mosaic color="#337ab0" size="large" style={{ fontSize: "40px" }} text="" textColor="" />
		);
	} else if (cases.length === 0) {
		body = (
			<div
				className={`rounded-[24px] border border-dashed p-8 text-center ${darkMode ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"}`}
			>
				<Search className={`mx-auto h-10 w-10 ${darkMode ? "text-sky-300" : "text-sky-600"}`} />
				<p className="mt-4 text-lg font-semibold">No investigations yet.</p>
				<p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
					Open one to describe a problem and get an investigated answer.
				</p>
			</div>
		);
	} else {
		body = (
			<div className="space-y-4">
				{cases.map((entry) => {
					const entryStatus = String(entry?.status || "collecting");
					const isActive = entry?.id === activeCaseId;
					return (
						<article
							key={entry.id}
							className={`rounded-[24px] border p-4 transition hover:-translate-y-0.5 ${darkMode ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
						>
							<div className="flex flex-wrap items-center gap-2">
								<span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-300">
									{String(entry?.id || "").slice(0, 8)}
								</span>
								<span
									className={`rounded-full px-2.5 py-1 text-xs font-semibold ${darkMode ? "bg-white/5 text-slate-300" : "bg-slate-100 text-slate-600"}`}
								>
									{CASE_STATUS_LABELS[entryStatus] || entryStatus}
								</span>
							</div>
							<p className="mt-3 text-sm font-semibold">
								{entry?.subject || entry?.summary || "Investigation"}
							</p>
							<p className={`mt-1 text-xs ${darkMode ? "text-slate-500" : "text-slate-500"}`}>
								{entry?.updated_at || entry?.created_at
									? new Date(entry.updated_at || entry.created_at).toLocaleString()
									: ""}
							</p>
							<button
								type="button"
								onClick={() => onOpen(entry.id)}
								className={`mt-3 inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
									darkMode
										? "border-white/10 bg-white/5 text-white hover:bg-white/10"
										: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
								}`}
							>
								{isActive ? (
									<>
										<MessageSquare className="h-3.5 w-3.5" />
										Open
									</>
								) : (
									<>
										<ExternalLink className="h-3.5 w-3.5" />
										View transcript
									</>
								)}
							</button>
						</article>
					);
				})}
			</div>
		);
	}

	return (
		<section
			className={`rounded-[28px] border ${darkMode ? "bg-white/5 border-white/10" : "bg-white border-slate-200"} p-5 backdrop-blur-xl sm:p-6`}
		>
			<div className="mb-5 flex items-center justify-between gap-3">
				<div>
					<h3 className="text-xl font-semibold">My Investigations</h3>
					<p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
						Open one to read its transcript and report.
					</p>
				</div>
				<button
					type="button"
					onClick={onRefresh}
					disabled={loading}
					className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
						darkMode
							? "border-white/10 bg-white/5 text-white hover:bg-white/10"
							: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
					}`}
				>
					{loading ? (
						<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
					) : (
						<RefreshCw className="h-4 w-4" />
					)}
					Refresh
				</button>
			</div>

			{body}
		</section>
	);
}

/**
 * The legacy ticket list — read-only, and unchanged in meaning.
 *
 * @param {Object} props - The component props.
 * @param {Array<Object>} props.tickets - The ticket rows.
 * @param {boolean} props.loading - Whether the list is loading.
 * @param {Function} props.onRefresh - Reloads the list.
 * @param {boolean} props.darkMode - Whether the dark theme is on.
 * @returns {JSX.Element} The ticket list.
 */
function LegacyTicketList({ tickets, loading, onRefresh, darkMode }) {
	let body = null;
	if (loading) {
		body = (
			<Mosaic color="#337ab0" size="large" style={{ fontSize: "40px" }} text="" textColor="" />
		);
	} else if (tickets.length === 0) {
		body = (
			<div
				className={`rounded-[24px] border border-dashed p-8 text-center ${darkMode ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"}`}
			>
				<Ticket className={`mx-auto h-10 w-10 ${darkMode ? "text-sky-300" : "text-sky-600"}`} />
				<p className="mt-4 text-lg font-semibold">No tickets yet.</p>
				<p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
					Tickets submitted before the investigation flow still live here.
				</p>
			</div>
		);
	} else {
		body = (
			<div className="space-y-4">
				{tickets.map((ticket) => (
					<article
						key={ticket.id}
						className={`rounded-[24px] border p-4 transition hover:-translate-y-0.5 ${darkMode ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
					>
						<div className="flex items-start justify-between gap-4">
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-2">
									<span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-300">
										{ticket.id}
									</span>
									<span
										className={`rounded-full px-2.5 py-1 text-xs font-semibold ${darkMode ? "bg-white/5 text-slate-300" : "bg-slate-100 text-slate-600"}`}
									>
										{ticket.status || "Open"}
									</span>
								</div>
								<h4 className="mt-3 font-semibold">{ticket.subject}</h4>
								<p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
									{ticket.category}
								</p>
							</div>
							{ticket.priority ? (
								<span
									className={`rounded-full px-3 py-1 text-xs font-semibold ${getPriorityColor(ticket.priority)}`}
								>
									{ticket.priority}
								</span>
							) : null}
						</div>
						<p className={`mt-4 text-xs ${darkMode ? "text-slate-500" : "text-slate-500"}`}>
							{ticket.created_at ? new Date(ticket.created_at).toLocaleString() : ""}
						</p>
					</article>
				))}
			</div>
		);
	}

	return (
		<section
			className={`rounded-[28px] border ${darkMode ? "bg-white/5 border-white/10" : "bg-white border-slate-200"} p-5 backdrop-blur-xl sm:p-6`}
		>
			<div className="mb-5 flex items-center justify-between">
				<div>
					<h3 className="text-xl font-semibold">My Support Tickets</h3>
					<p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
						Your earlier ticket submissions, read-only.
					</p>
				</div>
				<button
					type="button"
					onClick={onRefresh}
					disabled={loading}
					className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
						darkMode
							? "border-white/10 bg-white/5 text-white hover:bg-white/10"
							: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
					}`}
				>
					{loading ? (
						<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
					) : (
						<RefreshCw className="h-4 w-4" />
					)}
					Refresh
				</button>
			</div>

			{body}
		</section>
	);
}

/**
 * What the user can expect from an investigation.
 *
 * @param {Object} props - The component props.
 * @param {boolean} props.darkMode - Whether the dark theme is on.
 * @returns {JSX.Element} The steps panel.
 */
function NextStepsPanel({ darkMode }) {
	const steps = [
		{
			icon: MessageSquare,
			title: "Describe",
			text: "Tell the assistant what went wrong, in plain language. Attach a screenshot if you have one.",
		},
		{
			icon: Search,
			title: "Clarify",
			text: "The assistant asks for what it needs to reproduce the problem, and nothing more.",
		},
		{
			icon: Shield,
			title: "Investigate",
			text: "Five investigator roles work on it in parallel: code, repository, research, and verification.",
		},
		{
			icon: CheckCircle,
			title: "Report",
			text: "You get a report with the findings, the evidence behind them, and what could not be confirmed.",
		},
	];

	return (
		<section
			className={`rounded-[28px] border ${darkMode ? "bg-white/5 border-white/10" : "bg-white border-slate-200"} p-5 backdrop-blur-xl sm:p-6`}
		>
			<h3 className="text-xl font-semibold">What happens next</h3>
			<div className="mt-5 space-y-4">
				{steps.map((item, index) => {
					const LucideIcon = item.icon;
					return (
						<div key={item.title} className="flex gap-4">
							<div className="flex flex-col items-center">
								<div
									className={`flex h-11 w-11 items-center justify-center rounded-2xl ${darkMode ? "bg-white/5 text-sky-300" : "bg-sky-50 text-sky-600"}`}
								>
									<LucideIcon className="h-5 w-5" />
								</div>
								{index < steps.length - 1 ? (
									<div
										className={`mt-2 h-full w-px flex-1 ${darkMode ? "bg-white/10" : "bg-slate-200"}`}
									/>
								) : null}
							</div>
							<div className="pb-3">
								<p className="font-semibold">{item.title}</p>
								<p
									className={`mt-1 text-sm leading-6 ${darkMode ? "text-slate-400" : "text-slate-600"}`}
								>
									{item.text}
								</p>
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}

export default function SupportReports() {
	const token = useMemo(() => getToken(), []);
	const navigate = useNavigate();
	const sessionUser = getCurrentUser();
	const { isPremium, loading: premiumLoading } = usePremiumCheck();

	const canDedicatedManager = isPremium || hasEntitlement(sessionUser, "dedicated_account_manager");
	const accountManager = sessionUser?.profile || {};
	const hasAccountManager = Boolean(
		accountManager.account_manager_name ||
			accountManager.account_manager_email ||
			accountManager.account_manager_phone,
	);

	const { theme: currentTheme, toggleTheme } = useTheme();
	const darkMode = currentTheme === "dark";

	const [activeCaseId, setActiveCaseId] = useState(null);
	const [cases, setCases] = useState([]);
	const [casesLoading, setCasesLoading] = useState(false);
	const [tickets, setTickets] = useState([]);
	const [ticketsLoading, setTicketsLoading] = useState(false);
	const [draft, setDraft] = useState("");
	const [pendingAttachments, setPendingAttachments] = useState([]);
	const [uploading, setUploading] = useState(false);
	const [sending, setSending] = useState(false);
	const [creating, setCreating] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [confirmed, setConfirmed] = useState(false);
	const [notice, setNotice] = useState("");
	const [problem, setProblem] = useState("");
	const [pageLoading, setPageLoading] = useState(true);

	const transcriptRef = useRef(null);

	// The hook owns every call to the case API. The page renders what it
	// returns and calls the actions it exposes.
	const supportCase = useSupportCase(activeCaseId);

	const theme = useMemo(
		() => (darkMode ? "bg-slate-950 text-white" : "bg-sky-50 text-slate-900"),
		[darkMode],
	);

	const cardTheme = useMemo(
		() =>
			darkMode
				? "bg-white/5 border-white/10 shadow-[0_20px_80px_rgba(32,101,152,0.18)]"
				: "bg-white border-slate-200 shadow-[0_20px_60px_rgba(51,122,176,0.10)]",
		[darkMode],
	);

	const inputTheme = useMemo(
		() =>
			darkMode
				? "bg-slate-900/70 border-white/10 placeholder:text-slate-400 text-white focus:border-sky-400 focus:ring-sky-400/20"
				: "bg-white border-slate-200 placeholder:text-slate-400 text-slate-900 focus:border-sky-500 focus:ring-sky-500/20",
		[darkMode],
	);

	const caseStatus = supportCase.status || supportCase.caseRow?.status || "collecting";
	const isOpen = activeCaseId !== null;
	const canSend = isOpen && !sending && draft.trim().length > 0;
	const messageCount = supportCase.messages.length;

	const loadCases = useCallback(async () => {
		if (!token) {
			return;
		}
		setCasesLoading(true);
		try {
			const data = await apiRequest("/support/cases", { token });
			setCases(Array.isArray(data?.cases) ? data.cases : []);
		} catch (err) {
			logger.warn("Failed to load support cases:", err);
			setCases([]);
		} finally {
			setCasesLoading(false);
		}
	}, [token]);

	const loadTickets = useCallback(async () => {
		if (!token) {
			return;
		}
		setTicketsLoading(true);
		try {
			const data = await apiRequest("/support/tickets", { token });
			setTickets(Array.isArray(data?.items) ? data.items : []);
		} catch (err) {
			logger.warn("Failed to load tickets:", err);
			setTickets([]);
		} finally {
			setTicketsLoading(false);
		}
	}, [token]);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		loadTickets();
		// eslint-disable-next-line react-hooks/set-state-in-effect
		loadCases();
	}, [loadCases, loadTickets]);

	useEffect(() => {
		if (pageLoading && !ticketsLoading && !casesLoading && !premiumLoading) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setPageLoading(false);
		}
	}, [casesLoading, pageLoading, premiumLoading, ticketsLoading]);

	// Keep the newest message in view. The transcript scrolls inside its own
	// box, so the page itself must not jump.
	useEffect(() => {
		const node = transcriptRef.current;
		if (!node || messageCount === 0) {
			return;
		}
		node.scrollTop = node.scrollHeight;
	}, [messageCount]);

	const progressByRole = useMemo(() => {
		const map = new Map();
		for (const row of supportCase.progress || []) {
			if (row?.role) {
				map.set(row.role, row);
			}
		}
		return map;
	}, [supportCase.progress]);

	// Findings carry no id, so the key is built from the content. The counter
	// keeps two identical findings from colliding.
	const findingRows = useMemo(() => {
		const seen = new Map();
		return (supportCase.findings || []).map((entry) => {
			const base = `${entry?.role ?? "unknown"}:${entry?.finding?.detail ?? ""}`;
			const count = seen.get(base) ?? 0;
			seen.set(base, count + 1);
			return { key: `${base}#${count}`, entry };
		});
	}, [supportCase.findings]);

	function openCase(caseId) {
		setActiveCaseId(caseId);
		setDraft("");
		setPendingAttachments([]);
		setConfirmed(false);
		setNotice("");
		setProblem("");
	}

	async function startCase() {
		if (!token) {
			setProblem("Please login again to start an investigation.");
			return;
		}
		setCreating(true);
		setProblem("");
		setNotice("");
		try {
			const data = await apiRequest("/support/cases", {
				method: "POST",
				token,
				body: {},
			});
			const created = data?.case ?? null;
			if (!created?.id) {
				setProblem("The server did not return an investigation. Please try again.");
				return;
			}
			setActiveCaseId(created.id);
			setNotice("Investigation opened. Describe the problem below.");
			await loadCases();
		} catch (err) {
			setProblem(err instanceof Error ? err.message : "Unable to open the investigation.");
		} finally {
			setCreating(false);
		}
	}

	async function handleSend() {
		const text = draft.trim();
		if (!isOpen) {
			setProblem("Open an investigation before sending a message.");
			return;
		}
		if (!text) {
			setProblem("Write a message before sending.");
			return;
		}
		setSending(true);
		setProblem("");
		setNotice("");
		try {
			const result = await supportCase.send(text, pendingAttachments);
			if (result) {
				setDraft("");
				setPendingAttachments([]);
				setConfirmed(false);
			}
		} finally {
			setSending(false);
		}
	}

	async function handleFiles(fileList) {
		const files = Array.from(fileList || []);
		if (files.length === 0) {
			return;
		}
		if (!isOpen) {
			setProblem("Open an investigation before attaching files.");
			return;
		}
		setUploading(true);
		setProblem("");
		for (const file of files) {
			// biome-ignore lint/performance/noAwaitInLoops: the uploads go one at a time, so a large batch cannot flood the upload endpoint
			const descriptor = await supportCase.attach(file);
			if (descriptor) {
				setPendingAttachments((previous) => [...previous, descriptor]);
			}
		}
		setUploading(false);
	}

	function removePendingAttachment(filePath) {
		setPendingAttachments((previous) => previous.filter((entry) => entry?.file_path !== filePath));
	}

	async function handleConfirm() {
		if (!isOpen) {
			return;
		}
		setConfirming(true);
		setProblem("");
		// Two things confirm: the composer-side "start the investigation" and
		// the report's "confirm this is accurate". They say different things,
		// so they get different words.
		const wasCollecting = caseStatus === "collecting";
		try {
			const result = await supportCase.confirm();
			if (result) {
				setConfirmed(true);
				setNotice(wasCollecting ? "Investigation started." : "");
			}
		} finally {
			setConfirming(false);
		}
	}

	async function handleDownload(attachment) {
		const name = fileNameOf(attachment?.file_path);
		const ok = await signAndDownload(attachment?.file_path, name);
		if (!ok) {
			setProblem("That file could not be downloaded. Please try again.");
		}
	}

	async function handleOpen(attachment) {
		const ok = await signAndOpen(attachment?.file_path);
		if (!ok) {
			setProblem("That file could not be opened. Please try again.");
		}
	}

	const failure = problem || supportCase.error || "";

	if (pageLoading) {
		return <NeonAtom fill={true} timeout={10000} />;
	}

	return (
		<div className={`min-h-screen ${theme} transition-colors duration-300`}>
			<div className="absolute inset-0 pointer-events-none overflow-hidden">
				<div className="absolute -top-24 left-[-6rem] h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
				<div className="absolute top-40 right-[-6rem] h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />
				<div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
			</div>

			<div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				<header
					className={`mb-6 overflow-hidden rounded-[28px] border ${cardTheme} backdrop-blur-xl`}
				>
					<div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8">
						<div className="max-w-3xl">
							<div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-sm font-medium text-sky-300">
								<Sparkles className="h-4 w-4" />
								AI support investigations
							</div>

							<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
								Support &amp; Investigations
							</h1>
							<p
								className={`mt-4 max-w-2xl text-sm leading-6 sm:text-base ${darkMode ? "text-slate-300" : "text-slate-600"}`}
							>
								Describe what went wrong in plain language. The assistant asks only what it needs,
								then a team of investigators works on it live and reports back with evidence.
							</p>

							{canDedicatedManager && hasAccountManager ? (
								<div
									className={`mt-4 rounded-2xl border p-4 ${darkMode ? "border-amber-400/20 bg-amber-500/10" : "border-amber-200 bg-amber-50"}`}
								>
									<div className="flex items-start gap-3">
										<Crown
											className={`mt-0.5 h-5 w-5 ${darkMode ? "text-amber-300" : "text-amber-600"}`}
										/>
										<div>
											<p className="font-semibold">Dedicated Account Manager</p>
											<p
												className={`mt-1 text-sm leading-6 ${darkMode ? "text-amber-100/80" : "text-amber-900/70"}`}
											>
												{accountManager.account_manager_name || "Support manager"} —{" "}
												{accountManager.account_manager_email || ""} —{" "}
												{accountManager.account_manager_phone || ""}
											</p>
										</div>
									</div>
								</div>
							) : null}
						</div>

						<div className="flex flex-wrap items-center gap-3">
							<button
								type="button"
								onClick={toggleTheme}
								className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition hover:scale-[1.01] active:scale-[0.99] ${
									darkMode
										? "border-white/10 bg-white/5 text-white hover:bg-white/10"
										: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
								}`}
							>
								{darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
								{darkMode ? "Light mode" : "Dark mode"}
							</button>

							<button
								type="button"
								onClick={() => navigate(-1)}
								className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:-translate-y-0.5"
							>
								<ArrowLeft className="h-4 w-4" />
								Back
							</button>
						</div>
					</div>
				</header>

				{failure ? (
					<div className="mb-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-rose-300">
						{failure}
					</div>
				) : null}

				{notice ? (
					<div className="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-emerald-300">
						{notice}
					</div>
				) : null}

				<main className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
					<section className={`rounded-[28px] border ${cardTheme} backdrop-blur-xl`}>
						<div className="flex flex-col gap-4 border-b border-white/5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
							<div className="min-w-0">
								<h2 className="text-2xl font-semibold tracking-tight">Investigation</h2>
								<p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
									{isOpen
										? `Case ${String(activeCaseId).slice(0, 8)} · ${CASE_STATUS_LABELS[caseStatus] || caseStatus}`
										: "Open an investigation to start a conversation."}
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								{isOpen ? (
									<span
										className={`rounded-full px-3 py-1.5 text-xs font-semibold ${darkMode ? "bg-white/5 text-slate-300" : "bg-slate-100 text-slate-600"}`}
									>
										{CASE_STATUS_LABELS[caseStatus] || caseStatus}
									</span>
								) : null}
								<button
									type="button"
									onClick={startCase}
									disabled={creating}
									className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-300 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{creating ? (
										<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
									) : (
										<Sparkles className="h-4 w-4" />
									)}
									New investigation
								</button>
							</div>
						</div>

						{isOpen ? (
							<div className="space-y-6 p-5 sm:p-6">
								{supportCase.caseRow?.summary ? (
									<div
										className={`rounded-2xl border p-4 ${darkMode ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"}`}
									>
										<p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
											Summary
										</p>
										<p className="mt-1 text-sm leading-6">{supportCase.caseRow.summary}</p>
									</div>
								) : null}

								<TranscriptPanel
									messages={supportCase.messages}
									darkMode={darkMode}
									transcriptRef={transcriptRef}
								/>

								{progressByRole.size > 0 ||
								caseStatus === "investigating" ||
								caseStatus === "reporting" ? (
									<InvestigationProgressPanel
										progressByRole={progressByRole}
										caseStatus={caseStatus}
										darkMode={darkMode}
									/>
								) : null}

								{findingRows.length > 0 ? (
									<FindingsPanel findingRows={findingRows} darkMode={darkMode} />
								) : null}

								{supportCase.report?.report ? (
									<ReportPanel
										report={supportCase.report}
										confirming={confirming}
										confirmed={confirmed}
										onConfirm={handleConfirm}
										darkMode={darkMode}
									/>
								) : null}

								<Composer
									draft={draft}
									onDraftChange={setDraft}
									pendingAttachments={pendingAttachments}
									onRemoveAttachment={removePendingAttachment}
									uploading={uploading}
									sending={sending}
									canSend={canSend}
									onSend={handleSend}
									onFiles={handleFiles}
									caseStatus={caseStatus}
									confirming={confirming}
									onConfirm={handleConfirm}
									inputTheme={inputTheme}
									darkMode={darkMode}
								/>
							</div>
						) : (
							<div className="p-5 sm:p-6">
								<div
									className={`rounded-[24px] border border-dashed p-8 text-center ${darkMode ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"}`}
								>
									<Search
										className={`mx-auto h-10 w-10 ${darkMode ? "text-sky-300" : "text-sky-600"}`}
									/>
									<p className="mt-4 text-lg font-semibold">Start an investigation</p>
									<p
										className={`mx-auto mt-2 max-w-md text-sm leading-6 ${darkMode ? "text-slate-400" : "text-slate-600"}`}
									>
										Open a case and describe the problem in plain language. The assistant asks for
										what it needs, then the investigators work on it and report back.
									</p>
									<button
										type="button"
										onClick={startCase}
										disabled={creating}
										className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
									>
										{creating ? (
											<ThreeDot
												variant="bounce"
												color="#337ab0"
												size="small"
												text=""
												textColor=""
											/>
										) : (
											<Sparkles className="h-4 w-4" />
										)}
										Open an investigation
									</button>
								</div>
							</div>
						)}
					</section>

					<aside className="space-y-6">
						<ScrollReveal as="section">
							<InvestigationList
								cases={cases}
								loading={casesLoading}
								activeCaseId={activeCaseId}
								onRefresh={loadCases}
								onOpen={openCase}
								darkMode={darkMode}
							/>
						</ScrollReveal>

						{supportCase.attachments?.length > 0 ? (
							<ScrollReveal as="section">
								<EvidencePanel
									attachments={supportCase.attachments}
									onOpen={handleOpen}
									onDownload={handleDownload}
									darkMode={darkMode}
								/>
							</ScrollReveal>
						) : null}

						<ScrollReveal as="section">
							<LegacyTicketList
								tickets={tickets}
								loading={ticketsLoading}
								onRefresh={loadTickets}
								darkMode={darkMode}
							/>
						</ScrollReveal>

						<ScrollReveal as="section">
							<NextStepsPanel darkMode={darkMode} />
						</ScrollReveal>

						<ScrollReveal as="section">
							<section className={`rounded-[28px] border ${cardTheme} p-5 backdrop-blur-xl sm:p-6`}>
								<div className="flex items-start gap-3">
									<Upload
										className={`mt-0.5 h-5 w-5 ${darkMode ? "text-sky-300" : "text-sky-600"}`}
									/>
									<div>
										<h3 className="font-semibold">Best practice</h3>
										<p
											className={`mt-1 text-sm leading-6 ${darkMode ? "text-slate-400" : "text-slate-600"}`}
										>
											Say what you expected, what actually happened, and how to reproduce it. Add
											the exact error text and a screenshot — investigators search the repository
											with what you give them.
										</p>
									</div>
								</div>
							</section>
						</ScrollReveal>
					</aside>
				</main>
			</div>
		</div>
	);
}
