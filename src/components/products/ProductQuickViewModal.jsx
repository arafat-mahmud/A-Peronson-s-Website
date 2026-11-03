import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest, getCurrentUser, getToken } from "../../lib/auth.js";
import { recordLeadSource } from "../../lib/leadSource.js";
import AnimatedModal from "../AnimatedModal.jsx";
import LazyImage from "../ui/LazyImage.jsx";
import VideoEmbed from "../ui/VideoEmbed.jsx";

function roleToProfileRoute(role, id) {
	if (!id) {
		return "/feed";
	}
	const normalized = String(role || "").toLowerCase();
	if (normalized === "buyer") {
		return `/buyer/${encodeURIComponent(id)}`;
	}
	if (normalized === "buying_house") {
		return `/buying-house/${encodeURIComponent(id)}`;
	}
	return `/factory/${encodeURIComponent(id)}`;
}

export default function ProductQuickViewModal({ open, onClose, item, onViewed }) {
	const navigate = useNavigate();
	const token = useMemo(() => getToken(), []);
	const user = useMemo(() => getCurrentUser(), []);
	const viewRecordedRef = useRef({ productId: "", recorded: false });
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [currentImageIndex, setCurrentImageIndex] = useState(0);
	const [appealReason, setAppealReason] = useState("");
	const [showAppealModal, setShowAppealModal] = useState(false);

	const productId = item?.product?.id || item?.id || "";
	const companyId = item?.company_id || item?.product?.company_id || item?.author?.id || "";
	const author = item?.author || item?.product?.author || null;
	const contentReviewStatus = String(
		item?.content_review_status || item?.product?.content_review_status || "",
	).toLowerCase();
	const contentReviewReason =
		item?.content_review_reason || item?.product?.content_review_reason || "";
	const viewerRole = String(user?.role || "").toLowerCase();
	const isOwner = Boolean(user?.id) && String(user.id) === String(companyId);
	const isAgentOwner =
		viewerRole === "agent" && String(user?.org_owner_id || "") === String(companyId);
	const canAppeal = contentReviewStatus === "rejected" && (isOwner || isAgentOwner);
	const gallery = Array.isArray(item?.image_gallery)
		? item.image_gallery
		: Array.isArray(item?.product?.image_gallery)
			? item.product.image_gallery
			: [];
	const galleryUrls = gallery.map((entry) => entry?.url).filter(Boolean);
	const coverUrl =
		item?.cover_image_public_url ||
		item?.cover_image_url ||
		item?.product?.cover_image_public_url ||
		item?.product?.cover_image_url ||
		galleryUrls[0] ||
		"";

	useEffect(() => {
		if (!(open && productId)) {
			return;
		}
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setCurrentImageIndex(0);
		const state = viewRecordedRef.current;
		if (state.productId !== productId) {
			viewRecordedRef.current = { productId, recorded: false };
		}
		if (viewRecordedRef.current.recorded) {
			return;
		}

		let alive = true;
		apiRequest(`/products/${encodeURIComponent(productId)}/view`, {
			method: "POST",
			token,
		})
			.then(() => {
				if (!alive) {
					return;
				}
				viewRecordedRef.current = { productId, recorded: true };
				if (onViewed) {
					onViewed();
				}
			})
			.catch((err) => {
				if (!alive) {
					return;
				}
				setError(err.message || "Could not record view");
			});
		return () => {
			alive = false;
		};
	}, [open, onViewed, productId, token]);

	if (!open) {
		return null;
	}

	function handleClose() {
		viewRecordedRef.current = { productId: "", recorded: false };
		setError("");
		setNotice("");
		onClose?.();
	}

	function contact() {
		const name = author?.name || "company";
		if (productId) {
			recordLeadSource({
				type: "product",
				id: productId,
				label: item?.title || item?.product?.title || "Product",
			});
		}
		navigate("/chat", {
			state: {
				notice: `Contacting ${name}. If you are unverified, your first message may appear as a request.`,
			},
		});
		handleClose();
	}

	function startAppeal() {
		setAppealReason("");
		setShowAppealModal(true);
	}

	async function submitAppeal() {
		if (!(token && productId && appealReason.trim())) {
			return;
		}
		setError("");
		setNotice("");
		setShowAppealModal(false);
		try {
			await apiRequest("/reports/product-appeal", {
				method: "POST",
				token,
				body: { product_id: productId, reason: appealReason.trim() },
			});
			setNotice("Appeal submitted. Our team will review it shortly.");
		} catch (err) {
			setError(err.message || "Unable to submit appeal.");
		}
	}

	const profileLink = author?.id ? roleToProfileRoute(author.role, author.id) : "";

	const allImages = coverUrl
		? [coverUrl, ...galleryUrls.filter((u) => u !== coverUrl)]
		: galleryUrls;
	const currentImage = allImages[currentImageIndex] || "";

	function nextImage() {
		setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
	}

	function prevImage() {
		setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
	}

	return (
		<AnimatedModal open={open} onClose={handleClose} className="w-[92vw] max-w-2xl overflow-hidden">
			<div className="bg-white dark:bg-slate-950 rounded-2xl">
				<header className="flex items-center justify-between gap-3 px-5 py-4 shadow-dividerB dark:shadow-dividerBDark">
					<div className="min-w-0">
						<p className="text-sm font-bold text-slate-900 truncate">
							{item?.title || item?.product?.title || "Product"}
						</p>
						{author ? (
							<p className="text-[11px] text-slate-500 truncate">
								{author.name}{" "}
								{author.verified ? (
									<span className="ml-1 font-bold text-sky-600 dark:text-sky-400">Verified</span>
								) : null}{" "}
								{author.country ? `- ${author.country}` : ""}
							</p>
						) : null}
					</div>
					<button
						type="button"
						onClick={handleClose}
						className="rounded-full p-2 hover:bg-slate-100"
						aria-label="Close"
					>
						<X size={18} />
					</button>
				</header>

				<div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="rounded-2xl shadow-borderless dark:shadow-borderlessDark bg-slate-50 p-4">
						{allImages.length > 0 ? (
							<div className="relative mb-4">
								<AnimatePresence mode="wait">
									<motion.div
										key={currentImageIndex}
										drag="x"
										dragConstraints={{ left: 0, right: 0 }}
										dragElastic={0.2}
										onDragEnd={(_, info) => {
											if (info.offset.x < -50) {
												nextImage();
											}
											if (info.offset.x > 50) {
												prevImage();
											}
										}}
										initial={{ opacity: 0, x: 60 }}
										animate={{ opacity: 1, x: 0 }}
										exit={{ opacity: 0, x: -60 }}
										transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
										className="h-40 w-full rounded-xl overflow-hidden"
									>
										<LazyImage
											src={currentImage}
											alt="Product image"
											width={300}
											height={300}
											className="h-full w-full object-cover pointer-events-none"
										/>
									</motion.div>
								</AnimatePresence>
								{allImages.length > 1 ? (
									<>
										<button
											type="button"
											onClick={prevImage}
											className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 shadow-md hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900"
										>
											<ChevronLeft className="h-4 w-4" />
										</button>
										<button
											type="button"
											onClick={nextImage}
											className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 shadow-md hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900"
										>
											<ChevronRight className="h-4 w-4" />
										</button>
										<div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">
											{currentImageIndex + 1} / {allImages.length}
										</div>
									</>
								) : null}
							</div>
						) : (
							<div className="h-40 w-full rounded-xl bg-slate-200 mb-4" />
						)}
						{allImages.length > 1 ? (
							<div className="flex gap-2 mb-4 overflow-x-auto pb-1">
								{allImages.map((url, i) => (
									<button
										key={url}
										type="button"
										onClick={() => setCurrentImageIndex(i)}
										className={`shrink-0 h-10 w-10 rounded-lg overflow-hidden border-2 transition ${i === currentImageIndex ? "border-sky-500" : "border-transparent opacity-60 hover:opacity-100"}`}
									>
										<LazyImage
											src={url}
											alt={`Product thumbnail ${i + 1}`}
											width={40}
											height={40}
											className="h-full w-full object-cover"
										/>
									</button>
								))}
							</div>
						) : null}
						<p className="text-xs font-bold text-slate-700">Details</p>
						<div className="mt-3 space-y-2 text-sm text-slate-700">
							<div className="flex items-start justify-between gap-3">
								<span className="text-slate-500 text-xs">Category</span>
								<span className="font-semibold text-right">
									{item?.category || item?.product?.category || "--"}
								</span>
							</div>
							<div className="flex items-start justify-between gap-3">
								<span className="text-slate-500 text-xs">Material</span>
								<span className="font-semibold text-right">
									{item?.material || item?.product?.material || "--"}
								</span>
							</div>
							<div className="flex items-start justify-between gap-3">
								<span className="text-slate-500 text-xs">MOQ</span>
								<span className="font-semibold text-right">
									{item?.moq || item?.product?.moq || "--"}
								</span>
							</div>
							<div className="flex items-start justify-between gap-3">
								<span className="text-slate-500 text-xs">Lead time</span>
								<span className="font-semibold text-right">
									{item?.lead_time_days || item?.product?.lead_time_days || "--"}
								</span>
							</div>
						</div>
						{(item?.hasVideo || item?.product?.hasVideo) &&
						(item?.video_url || item?.product?.video_url) ? (
							<VideoEmbed url={item?.video_url || item?.product?.video_url} className="mt-4" />
						) : null}
					</div>

					<div className="rounded-2xl shadow-borderless dark:shadow-borderlessDark bg-white p-4">
						<p className="text-xs font-bold text-slate-700">Description</p>
						<p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
							{item?.description || item?.product?.description || "No description provided."}
						</p>
						{canAppeal ? (
							<div className="mt-4 rounded-xl shadow-borderless dark:shadow-borderlessDark bg-rose-50 px-3 py-3">
								<p className="text-xs font-semibold text-rose-900">This product was rejected.</p>
								<p className="mt-1 text-xs text-rose-700">
									{contentReviewReason || "This product needs changes to meet content standards."}
								</p>
								<button
									type="button"
									onClick={startAppeal}
									className="mt-3 w-full rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white"
								>
									If you think this is a mistake, report it for review
								</button>
							</div>
						) : null}
						{error ? <p className="mt-3 text-xs text-rose-700">{error}</p> : null}
						{notice ? <p className="mt-3 text-xs text-emerald-700">{notice}</p> : null}
					</div>
				</div>

				{showAppealModal ? (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
						<div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-950">
							<h3 className="text-lg font-semibold text-slate-900 dark:text-white">
								Appeal rejection
							</h3>
							<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
								Explain why this product should be approved.
							</p>
							<textarea
								value={appealReason}
								onChange={(e) => setAppealReason(e.target.value)}
								rows={4}
								className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
								placeholder="Explain why this product should be approved..."
							/>
							<div className="mt-4 flex justify-end gap-3">
								<button
									type="button"
									onClick={() => setShowAppealModal(false)}
									className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={submitAppeal}
									disabled={!appealReason.trim()}
									className="rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Submit appeal
								</button>
							</div>
						</div>
					</div>
				) : null}

				<footer className="px-5 py-4 shadow-dividerT dark:shadow-dividerTDark bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
					<div className="text-[11px] text-slate-500">
						Views are private and help you revisit items quickly.
					</div>
					<div className="flex gap-2">
						{profileLink ? (
							<Link
								to={profileLink}
								onClick={handleClose}
								className="rounded-full shadow-borderless dark:shadow-borderlessDark px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
							>
								View company profile
							</Link>
						) : null}
						<button
							type="button"
							onClick={contact}
							className="rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700"
						>
							Contact
						</button>
					</div>
				</footer>
			</div>
		</AnimatedModal>
	);
}
