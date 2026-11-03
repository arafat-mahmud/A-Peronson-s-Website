import { memo, useEffect, useMemo, useState } from "react";
import { Atom } from "react-loading-indicators";
import { logger } from "../../lib/logger.js";
import { describeSignFailure, signAndDownload, signEntry } from "../../lib/signedFile.js";
import LazyImage from "../ui/LazyImage.jsx";

const TEXT_EXTS = new Set([
	"txt",
	"log",
	"csv",
	"tsv",
	"json",
	"jsonc",
	"xml",
	"html",
	"htm",
	"css",
	"js",
	"jsx",
	"ts",
	"tsx",
	"py",
	"java",
	"c",
	"cpp",
	"h",
	"hpp",
	"sql",
	"yml",
	"yaml",
	"md",
	"markdown",
]);

function safeExt(value = "") {
	const raw = String(value || "").trim();
	if (!raw) {
		return "";
	}
	const cleaned = raw.split("?")[0].split("#")[0];
	const tail = cleaned.split("/").pop() || cleaned;
	const match = tail.match(/\.([a-z0-9]+)$/i);
	return match ? match[1].toLowerCase() : "";
}

function safeDownloadName(name = "") {
	const cleaned = String(name || "").trim();
	if (!cleaned) {
		return;
	}
	return cleaned.replace(/[\\/:??"<>|]+/g, "_");
}

function formatBytes(bytes) {
	const value = Number(bytes);
	if (!Number.isFinite(value) || value <= 0) {
		return "";
	}
	const units = ["B", "kB", "MB", "GB", "TB"];
	const base = 1024;

	let unitIndex = 0;
	let scaled = value;
	while (scaled >= base && unitIndex < units.length - 1) {
		scaled /= base;
		unitIndex += 1;
	}

	if (unitIndex === 0) {
		return `${Math.round(scaled)} ${units[unitIndex]}`;
	}

	const rounded =
		scaled >= 100
			? Math.round(scaled)
			: scaled >= 10
				? Math.round(scaled * 10) / 10
				: Math.round(scaled * 100) / 100;
	return `${rounded.toLocaleString()} ${units[unitIndex]}`;
}

function classifyAttachment(attachment) {
	const mime = String(attachment?.mime_type || attachment?.mimeType || "")
		.trim()
		.toLowerCase();
	const ext = safeExt(attachment?.name) || safeExt(attachment?.url);

	if (mime === "application/pdf" || ext === "pdf") {
		return "pdf";
	}
	if (mime.startsWith("text/")) {
		return "text";
	}
	if (TEXT_EXTS.has(ext)) {
		return "text";
	}
	return "file";
}

function FileTypeBadge({ kind, isLight, ext }) {
	const label =
		kind === "pdf"
			? "PDF"
			: kind === "text"
				? ext
					? ext.toUpperCase()
					: "TXT"
				: ext
					? ext.toUpperCase()
					: "FILE";

	const palette = (() => {
		if (kind === "pdf") {
			return isLight
				? { bg: "bg-red-600", text: "text-white" }
				: { bg: "bg-red-500/20", text: "text-red-200" };
		}
		if (kind === "text") {
			return isLight
				? { bg: "bg-emerald-600", text: "text-white" }
				: { bg: "bg-emerald-500/20", text: "text-emerald-200" };
		}
		return isLight
			? { bg: "bg-slate-600", text: "text-white" }
			: { bg: "bg-white/10", text: "text-slate-200" };
	})();

	return (
		<div
			className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl${palette.bg}${palette.text}text-[11px] font-extrabold tracking-wide`}
		>
			{label.slice(0, 4)}
		</div>
	);
}

function FileAttachmentCard({
	attachment = null,
	url = "",
	isOwn = false,
	isLight = false,
	onOpen = null,
}) {
	const kind = useMemo(() => classifyAttachment(attachment), [attachment]);
	const ext = useMemo(() => safeExt(attachment?.name) || safeExt(attachment?.url), [attachment]);
	const name = String(attachment?.name || "Attachment");
	const bytes = Number(attachment?.size || 0);

	const [pdfPreview, setPdfPreview] = useState({
		loading: false,
		error: "",
		thumbUrl: "",
		pages: 0,
	});
	const [textPreview, setTextPreview] = useState({
		loading: false,
		error: "",
		snippet: "",
	});

	useEffect(() => {
		if (!url || kind !== "pdf") {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setPdfPreview({ loading: false, error: "", thumbUrl: "", pages: 0 });
			return;
		}

		let alive = true;
		let createdUrl = "";

		async function renderPdfThumbnail() {
			setPdfPreview({ loading: true, error: "", thumbUrl: "", pages: 0 });
			try {
				const [{ getDocument, GlobalWorkerOptions }, workerUrlModule] = await Promise.all([
					import("pdfjs-dist"),
					import("pdfjs-dist/build/pdf.worker.mjs?url"),
				]);

				const workerSrc = workerUrlModule?.default;
				if (workerSrc && GlobalWorkerOptions?.workerSrc !== workerSrc) {
					GlobalWorkerOptions.workerSrc = workerSrc;
				}

				// Sign first: pdf.js fetches the bytes itself and cannot carry an
				// Authorization header, so it needs a signed url like any other sink.
				const entry = await signEntry(url);
				if (!entry?.url) {
					throw new Error(describeSignFailure(entry));
				}
				const signed = entry.url;
				const loadingTask = getDocument({
					url: signed,
					// Be CSP-friendly: avoid `eval` where possible.
					isEvalSupported: false,
					// Reduce memory overhead for small thumbnails.
					useSystemFonts: true,
				});

				const pdf = await loadingTask.promise;
				const pages = Number(pdf?.numPages || 0);

				const page = await pdf.getPage(1);
				const viewport = page.getViewport({ scale: 1 });
				const targetWidth = 720;
				const scale = viewport?.width ? targetWidth / viewport.width : 1;
				const scaledViewport = page.getViewport({ scale });

				const canvas = document.createElement("canvas");
				const context = canvas.getContext("2d", { alpha: false });
				canvas.width = Math.floor(scaledViewport.width);
				canvas.height = Math.floor(scaledViewport.height);

				await page.render({ canvasContext: context, viewport: scaledViewport }).promise;

				const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
				if (!blob) {
					throw new Error("Unable to render PDF thumbnail");
				}

				createdUrl = URL.createObjectURL(blob);
				if (!alive) {
					URL.revokeObjectURL(createdUrl);
					createdUrl = "";
					return;
				}

				setPdfPreview({
					loading: false,
					error: "",
					thumbUrl: createdUrl,
					pages,
				});

				// Best-effort cleanup (ignore failures).
				try {
					page.cleanup?.();
				} catch {
					/* noop */
				}
				try {
					pdf.cleanup?.();
				} catch {
					/* noop */
				}
				try {
					loadingTask.destroy?.();
				} catch {
					/* noop */
				}
			} catch (error) {
				if (!alive) {
					return;
				}
				logger.warn("[FileAttachmentCard] PDF thumbnail failed", { error: error?.message, url });
				setPdfPreview({
					loading: false,
					error: error?.message || "Unable to preview PDF",
					thumbUrl: "",
					pages: 0,
				});
			}
		}

		renderPdfThumbnail();

		return () => {
			alive = false;
			if (createdUrl) {
				URL.revokeObjectURL(createdUrl);
			}
		};
	}, [kind, url]);

	useEffect(() => {
		if (!url || kind !== "text") {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setTextPreview({ loading: false, error: "", snippet: "" });
			return;
		}

		let alive = true;
		const controller = new AbortController();

		async function loadTextSnippet() {
			setTextPreview({ loading: true, error: "", snippet: "" });
			try {
				const entry = await signEntry(url);
				if (!entry?.url) {
					throw new Error(describeSignFailure(entry));
				}
				const signed = entry.url;
				const response = await fetch(signed, { signal: controller.signal });
				if (!response.ok) {
					throw new Error(`Unable to load preview (${response.status})`);
				}

				const len = Number(response.headers.get("content-length") || "0");
				if (len && len > 600_000) {
					setTextPreview({
						loading: false,
						error: "File is too large to preview. Please open or download it.",
						snippet: "",
					});
					return;
				}

				const content = await response.text();
				const normalized = content.replace(/\r\n/g, "\n");
				const lines = normalized.split("\n");
				const clippedLines = lines.slice(0, 12).join("\n");
				const suffix = lines.length > 12 || normalized.length > clippedLines.length ? "\n..." : "";
				const snippet = `${clippedLines}${suffix}`.trim();

				if (!alive) {
					return;
				}
				setTextPreview({ loading: false, error: "", snippet });
			} catch (error) {
				if (!alive) {
					return;
				}
				if (error?.name === "AbortError") {
					return;
				}
				logger.warn("[FileAttachmentCard] text snippet fetch failed", {
					error: error?.message,
					url,
					status: error?.status,
				});
				setTextPreview({
					loading: false,
					error: error?.message || "Unable to preview file",
					snippet: "",
				});
			}
		}

		loadTextSnippet();

		return () => {
			alive = false;
			controller.abort();
		};
	}, [kind, url]);

	const metaLine = useMemo(() => {
		const sizeLabel = formatBytes(bytes);
		if (kind === "pdf") {
			const pages = pdfPreview.pages;
			const pagesLabel = pages ? `${pages} page${pages === 1 ? "" : "s"}` : "";
			const parts = [pagesLabel, "PDF", sizeLabel].filter(Boolean);
			return parts.join(" - ");
		}
		if (kind === "text") {
			const parts = [ext ? ext.toUpperCase() : "TXT", sizeLabel].filter(Boolean);
			return parts.join(" - ");
		}
		const parts = [ext ? ext.toUpperCase() : "FILE", sizeLabel].filter(Boolean);
		return parts.join(" - ");
	}, [bytes, ext, kind, pdfPreview.pages]);

	const containerTone = (() => {
		if (isOwn) {
			return "bg-black/20 text-white";
		}
		if (isLight) {
			return "bg-slate-50 text-slate-900";
		}
		return "bg-black/20 text-white";
	})();

	const previewBg = (() => {
		if (isOwn) {
			return "bg-black/25";
		}
		if (isLight) {
			return "bg-white";
		}
		return "bg-black/25";
	})();

	const buttonTone =
		isLight && !isOwn ? "text-slate-700 hover:bg-slate-100" : "text-white/90 hover:bg-white/10";

	return (
		<div
			className={`w-full overflow-hidden rounded-2xl shadow-borderless dark:shadow-borderlessDark${containerTone}`}
		>
			{kind === "pdf" ? (
				<button
					type="button"
					onClick={() => onOpen?.()}
					className={`block w-full${previewBg}`}
					title="Open preview"
				>
					<div className="flex h-28 w-full items-center justify-center overflow-hidden">
						{pdfPreview.thumbUrl ? (
							<LazyImage
								src={pdfPreview.thumbUrl}
								alt={`${name} preview`}
								width={720}
								height={280}
								className="h-full w-full object-contain"
							/>
						) : (
							<div className="px-3 text-[11px] font-semibold opacity-70">
								{pdfPreview.loading ? (
									<Atom
										color="#337ab0"
										size="small"
										text="Generating preview..."
										textColor="#94a3b8"
									/>
								) : (
									pdfPreview.error || "Preview unavailable"
								)}
							</div>
						)}
					</div>
				</button>
			) : null}

			{kind === "text" ? (
				<button
					type="button"
					onClick={() => onOpen?.()}
					className={`block w-full${previewBg}`}
					title="Open preview"
				>
					<div className="max-h-28 overflow-hidden p-3 text-left">
						{textPreview.loading ? (
							<Atom color="#337ab0" size="small" text="Loading preview..." textColor="#94a3b8" />
						) : textPreview.error ? (
							<div className="text-[11px] font-semibold opacity-70">{textPreview.error}</div>
						) : (
							<pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-snug opacity-90">
								{textPreview.snippet || " "}
							</pre>
						)}
					</div>
				</button>
			) : null}

			<button
				type="button"
				onClick={() => onOpen?.()}
				className={`flex w-full items-center gap-3 px-3 py-3 text-left${kind === "file" ? "" : ""}`}
				title="Open preview"
			>
				<FileTypeBadge kind={kind} isLight={isLight && !isOwn} ext={ext} />
				<div className="min-w-0 flex-1">
					<div className="truncate text-[12px] font-semibold">{name}</div>
					{metaLine ? <div className="truncate text-[11px] opacity-70">{metaLine}</div> : null}
				</div>
			</button>

			<div className="grid grid-cols-2 shadow-dividerT dark:shadow-dividerTDark">
				<button
					type="button"
					onClick={() => onOpen?.()}
					className={`px-3 py-2 text-[12px] font-semibold transition-colors${buttonTone}`}
				>
					Open
				</button>
				{/* The attachment path is private, so it must never sit in an href.
					Signing is deferred to the click because the signature is
					short-lived: one minted at render time has expired by the time
					anyone clicks. */}
				<button
					type="button"
					disabled={!url}
					onClick={() => {
						void signAndDownload(url, safeDownloadName(name)).then((saved) => {
							if (!saved) {
								logger.warn("[FileAttachmentCard] sign-and-download refused", { url });
							}
						});
					}}
					className={`px-3 py-2 text-center text-[12px] font-semibold transition-colors${buttonTone}shadow-dividerL dark:shadow-dividerLDark disabled:opacity-50`}
				>
					Save as...
				</button>
			</div>
		</div>
	);
}

export default memo(FileAttachmentCard);
