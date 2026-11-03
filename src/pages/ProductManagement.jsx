import { AnimatePresence, motion, Reorder } from "framer-motion";
import {
	BadgeCheck,
	CheckCircle2,
	Clock3,
	Eye,
	FileText,
	Image as ImageIcon,
	LayoutGrid,
	MoonStar,
	Pencil,
	Plus,
	Rocket,
	ShieldCheck,
	Sparkles,
	SunMedium,
	Trash2,
	Upload,
	Video,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThreeDot } from "react-loading-indicators";
import { FACTORY_SECTOR_OPTIONS } from "../../shared/config/platformTaxonomy.js";
import FlipCard from "../components/FlipCard.jsx";
import ScrollReveal from "../components/ScrollReveal.jsx";
import { StaggerContainer, StaggerItem } from "../components/StaggerContainer.jsx";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import UploadProgressBar from "../components/ui/UploadProgressBar.jsx";
import WordCount from "../components/ui/WordCount.jsx";
import { apiRequest, getCurrentUser, getToken } from "../lib/auth.js";
import { trackClientEvent } from "../lib/events.js";
import { logger } from "../lib/logger.js";
import { useTheme } from "../lib/ThemeProvider.jsx";
import { uploadFile } from "../lib/upload.js";

const EMPTY_FORM = {
	title: "",
	industry: "",
	category: "",
	material: "",
	moq: "",
	price_range: "",
	lead_time_days: "",
	fabric_gsm: "",
	size_range: "",
	color_pantone: "",
	customization_capabilities: "",
	sample_available: "",
	sample_lead_time_days: "",
	description: "",
	video_url: "",
	image_urls: [],
	cover_image_url: "",
	status: "draft",
};

/**
 * Maps a stored free-text industry to a dropdown option value.
 * Matches option values and labels case-insensitively so legacy entries
 * like "Garments" resolve to the canonical "garments" option.
 * Returns { value, isLegacy } — isLegacy is true when the stored text
 * matches no option and must be preserved verbatim.
 */
function resolveIndustryOption(stored) {
	const raw = String(stored || "").trim();
	if (!raw) {
		return { value: "", isLegacy: false };
	}
	const lowered = raw.toLowerCase();
	const match = FACTORY_SECTOR_OPTIONS.find(
		(opt) =>
			String(opt.value).toLowerCase() === lowered || String(opt.label).toLowerCase() === lowered,
	);
	if (match) {
		return { value: match.value, isLegacy: false };
	}
	return { value: raw, isLegacy: true };
}

function Badge({ children, tone = "blue" }) {
	const styles = {
		blue: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-400/15 dark:text-sky-200 dark:border-sky-500/20",
		green:
			"bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-400/15 dark:text-emerald-200 dark:border-emerald-500/20",
		amber:
			"bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-400/15 dark:text-amber-200 dark:border-amber-500/20",
		slate:
			"bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-400/15 dark:text-slate-300 dark:border-slate-500/20",
	};
	return (
		<span
			className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}
		>
			{children}
		</span>
	);
}

function Stat({ icon: Icon, label, value }) {
	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
			<div className="flex items-center gap-3">
				<div className="rounded-xl bg-sky-500/10 p-2 text-sky-600 dark:text-sky-300">
					<Icon className="h-4 w-4" />
				</div>
				<div>
					<div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
						{label}
					</div>
					<div className="text-lg font-semibold text-slate-900 dark:text-white">{value}</div>
				</div>
			</div>
		</div>
	);
}

function Field({ label, children, hint, required }) {
	return (
		<label className="block space-y-1.5">
			<div className="flex items-center justify-between gap-3">
				<span className="text-sm font-medium text-slate-700 dark:text-slate-200">
					{label} {required ? <span className="text-sky-500">*</span> : null}
				</span>
				{hint ? <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span> : null}
			</div>
			{children}
		</label>
	);
}

export default function ProductManagement() {
	const token = useMemo(() => getToken(), []);

	const { theme, toggleTheme } = useTheme();
	const isDark = theme === "dark";
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(true);
	const [notice, setNotice] = useState(
		"Drafts stay private until you publish them after media review.",
	);

	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState(null);
	const [deleteConfirmId, setDeleteConfirmId] = useState(null);
	const [form, setForm] = useState(EMPTY_FORM);
	const [saving, setSaving] = useState(false);
	const [advancedOpen, setAdvancedOpen] = useState(false);
	const [mediaGallery, setMediaGallery] = useState([]);

	const [mediaBusy, setMediaBusy] = useState(false);
	const [mediaUploadProgress, setMediaUploadProgress] = useState(0);
	const [mediaNotice, setMediaNotice] = useState("");
	const [videoBusy, setVideoBusy] = useState(false);
	const [videoUploadProgress, setVideoUploadProgress] = useState(0);
	const [videoNotice, setVideoNotice] = useState("");
	const [complianceChecked, setComplianceChecked] = useState(false);

	const imageInputRef = useRef(null);
	const videoInputRef = useRef(null);

	const loadMine = useCallback(async () => {
		if (!token) {
			return;
		}
		setLoading(true);
		try {
			const data = await apiRequest("/products?mine=true", { token });
			setItems(Array.isArray(data) ? data : []);
		} catch (err) {
			logger.warn("Failed to load products:", err);
			setItems([]);
		} finally {
			setLoading(false);
		}
	}, [token]);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		loadMine();
	}, [loadMine]);

	const stats = useMemo(() => {
		const published = items.filter((p) => p.status === "published").length;
		const drafts = items.filter((p) => p.status === "draft").length;
		return { published, drafts, approved: published };
	}, [items]);

	async function openCreate() {
		// Close any existing modal first
		if (modalOpen) {
			setModalOpen(false);
		}

		setEditing(null);
		setForm(EMPTY_FORM);
		setNotice("");
		setMediaNotice("");
		setMediaGallery([]);
		setComplianceChecked(false);
		setVideoNotice("");
		setAdvancedOpen(false);
		setModalOpen(true);

		if (!token) {
			setNotice("Please log in to create a product.");
			return;
		}

		try {
			setSaving(true);
			// Always create a fresh draft - don't reuse existing drafts
			const draft = await apiRequest("/products", {
				method: "POST",
				token,
				body: { createAsDraft: true },
			});
			if (draft?.id) {
				setEditing(draft);
				setForm({ ...EMPTY_FORM, ...draft });
				setMediaGallery([]);
				// Reload the products list to ensure we have the latest
				await loadMine();
				setNotice(
					"Create a new product. Media must be uploaded inside GarTexHub using internal /uploads/... URLs.",
				);
			} else {
				// If no ID returned, still allow manual entry without auto-save
				setNotice("Created draft manually. Save will create the product.");
			}
		} catch (err) {
			logger.error("Create draft error:", err);
			setNotice(
				err.message || "Failed to create draft. You can still enter product details and save.",
			);
		} finally {
			setSaving(false);
		}
	}

	function openEdit(item) {
		setEditing(item);
		const normalizedImageUrls = (Array.isArray(item?.image_urls) ? item.image_urls : []).map(
			(url) => toInternalUrl(url),
		);
		const normalizedCoverUrl = toInternalUrl(item?.cover_image_url);
		setForm({
			title: item?.title || "",
			industry: item?.industry || "",
			category: item?.category || "",
			material: item?.material || "",
			moq: item?.moq || "",
			price_range: item?.price_range || "",
			lead_time_days: item?.lead_time_days || "",
			fabric_gsm: item?.fabric_gsm || "",
			size_range: item?.size_range || "",
			color_pantone: item?.color_pantone || "",
			customization_capabilities: item?.customization_capabilities || "",
			sample_available: item?.sample_available || "",
			sample_lead_time_days: item?.sample_lead_time_days || "",
			description: item?.description || "",
			video_url: item?.video_url || "",
			image_urls: normalizedImageUrls,
			cover_image_url: normalizedCoverUrl,
			status: item?.status || "draft",
		});
		setNotice(
			"Editing existing product. Drafts remain private; published items go live after review.",
		);
		setMediaNotice("");
		setMediaGallery(Array.isArray(item?.image_gallery) ? item.image_gallery : []);
		setComplianceChecked(true);
		setVideoNotice("");
		setAdvancedOpen(false);
		setModalOpen(true);
	}

	function closeModal() {
		setModalOpen(false);
		setEditing(null);
		setForm(EMPTY_FORM);
		setMediaNotice("");
		setVideoNotice("");
		setAdvancedOpen(false);
		setComplianceChecked(false);
		// Refresh the products list after any modal close
		loadMine();
	}

	async function saveProduct(nextStatus) {
		if (!token) {
			setNotice("Please log in to save products.");
			return;
		}
		if (!form.title.trim()) {
			setNotice("Product name is required.");
			return;
		}
		if (!form.industry.trim()) {
			setNotice("Industry is required.");
			return;
		}
		if (!form.category.trim()) {
			setNotice("Category is required.");
			return;
		}
		if (!form.material.trim()) {
			setNotice("Material is required.");
			return;
		}
		if (!form.price_range.trim()) {
			setNotice("Price range is required.");
			return;
		}
		if (!form.lead_time_days.trim()) {
			setNotice("Lead time (days) is required.");
			return;
		}
		if (!form.description.trim()) {
			setNotice("Description is required.");
			return;
		}
		if (form.image_urls?.length === 0) {
			setNotice("At least one product image is required.");
			return;
		}
		if (!complianceChecked) {
			setNotice("Please confirm the media compliance checklist before saving.");
			return;
		}

		setSaving(true);
		const saveBody = {
			...form,
			status: nextStatus,
			// Ensure required fields are set
			industry: form.industry || "",
			category: form.category || "",
			material: form.material || "",
			moq: form.moq || "",
			price_range: form.price_range || "",
			lead_time_days: form.lead_time_days || "",
		};

		try {
			let savedProduct;
			if (editing?.id) {
				// Update existing product
				savedProduct = await apiRequest(`/products/${encodeURIComponent(editing.id)}`, {
					method: "PATCH",
					token,
					body: saveBody,
				});
				setItems((prev) => prev.map((p) => (p.id === savedProduct.id ? savedProduct : p)));
				setNotice(nextStatus === "published" ? "Product updated and published." : "Draft saved.");
				if (editing?.status !== "published" && nextStatus === "published") {
					trackClientEvent("product_published", {
						entityType: "product",
						entityId: savedProduct.id,
					});
				}
			} else {
				// No editing.id - create new product from scratch (not from existing draft)
				savedProduct = await apiRequest("/products", {
					method: "POST",
					token,
					body: saveBody,
				});
				setItems((prev) => [savedProduct, ...prev]);
				setNotice(nextStatus === "published" ? "Product created and published." : "Draft saved.");
				if (nextStatus === "published") {
					trackClientEvent("product_published", {
						entityType: "product",
						entityId: savedProduct.id,
					});
				}
			}
			// Reload to ensure consistency
			await loadMine();
			closeModal();
		} catch (err) {
			logger.error("Save error:", err);
			setNotice(err.message || "Save failed. Please try again.");
		} finally {
			setSaving(false);
		}
	}

	function promptDelete(productId) {
		if (!(token && productId)) {
			return;
		}
		setDeleteConfirmId(productId);
	}

	async function confirmDelete() {
		const productId = deleteConfirmId;
		if (!(token && productId)) {
			return;
		}
		setNotice("");
		try {
			await apiRequest(`/products/${encodeURIComponent(productId)}`, {
				method: "DELETE",
				token,
			});
			setItems((prev) => prev.filter((p) => p.id !== productId));
			setNotice("Product deleted.");
		} catch (err) {
			logger.error("Delete error:", err);
			setNotice(err.message || "Delete failed. The product may have already been deleted.");
		} finally {
			setDeleteConfirmId(null);
		}
	}

	function cancelDelete() {
		setDeleteConfirmId(null);
	}

	function toInternalUrl(filePath = "") {
		if (!filePath) {
			return "";
		}
		const normalized = String(filePath).replace(/\\/g, "/");
		// Already in internal format
		if (normalized.startsWith("/uploads/")) {
			return normalized;
		}
		if (normalized.startsWith("uploads/")) {
			return `/${normalized}`;
		}
		// Contains server/uploads
		if (normalized.includes("server/uploads/")) {
			const idx = normalized.indexOf("server/uploads/");
			return `/uploads/${normalized.slice(idx + "server/uploads/".length)}`;
		}
		// If it's a full URL, convert to internal
		if (normalized.startsWith("http")) {
			const urlMatch = normalized.match(/uploads\/(.+)$/);
			if (urlMatch) {
				return `/uploads/${urlMatch[1]}`;
			}
		}
		// Default: prepend /uploads/
		return `/uploads/${normalized}`;
	}

	function toPublicUrl(filePath = "") {
		if (!filePath) {
			return "";
		}
		const normalized = String(filePath).replace(/\\/g, "/");
		if (normalized.startsWith("/uploads/")) {
			return normalized;
		}
		const idx = normalized.indexOf("server/uploads/");
		if (idx >= 0) {
			return `/uploads/${normalized.slice(idx + "server/uploads/".length)}`;
		}
		return normalized.startsWith("uploads/") ? `/${normalized}` : normalized;
	}

	function getStatusBadge(status) {
		if (status === "approved") {
			return (
				<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
					Approved
				</span>
			);
		}
		if (status === "rejected") {
			return (
				<span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/20 dark:text-red-300">
					Rejected
				</span>
			);
		}
		if (status === "pending_review") {
			return (
				<span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
					Pending
				</span>
			);
		}
		return (
			<span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-500/20 dark:text-gray-300">
				{status}
			</span>
		);
	}

	async function handleUploadFiles(files) {
		if (!(editing?.id && token)) {
			setMediaNotice("Save the product first to upload images.");
			return;
		}
		if (!(files && files.length > 0)) {
			return;
		}
		setMediaBusy(true);
		setMediaUploadProgress(0);
		setMediaNotice("");
		try {
			const uploadedEntries = [];
			for (const file of files) {
				const data = await uploadFile("/documents", {
					file,
					token,
					fields: {
						entity_type: "company_product",
						entity_id: editing.id,
						type: "image",
					},
					onProgress: setMediaUploadProgress,
				});
				const internalUrl = toInternalUrl(data.file_path || data.url || "");
				uploadedEntries.push({
					document_id: data.id,
					source_path: internalUrl,
					url: toPublicUrl(internalUrl),
					status: data.moderation_status || "pending_review",
					flags: Array.isArray(data.moderation_flags) ? data.moderation_flags : [],
				});
				trackClientEvent("product_image_uploaded", {
					entityType: "product",
					entityId: editing.id,
					metadata: { document_id: data.id },
				});
			}
			const nextForm = {
				...form,
				image_urls: Array.from(
					new Set([
						...(form.image_urls || []),
						...uploadedEntries.map((e) => e.source_path).filter(Boolean),
					]),
				),
				cover_image_url: form.cover_image_url || uploadedEntries[0]?.source_path || "",
			};
			setForm(nextForm);
			setMediaGallery((prev) => [...prev, ...uploadedEntries]);
			await syncProductMedia(nextForm);
		} catch (err) {
			setMediaNotice(err.message || "Image upload failed");
		} finally {
			setMediaBusy(false);
			setMediaUploadProgress(0);
		}
	}

	async function handleUploadVideo(file) {
		if (!(editing?.id && token)) {
			setVideoNotice("Save the product first to upload a video.");
			return;
		}
		if (!file) {
			return;
		}
		setVideoBusy(true);
		setVideoUploadProgress(0);
		setVideoNotice("");
		try {
			const data = await uploadFile("/documents", {
				file,
				token,
				fields: {
					entity_type: "company_product",
					entity_id: editing.id,
					type: "video",
				},
				onProgress: setVideoUploadProgress,
			});
			const internalUrl = toInternalUrl(data.file_path || data.url || "");
			await syncProductVideo(internalUrl);
			setVideoNotice("Video uploaded and pending review.");
			trackClientEvent("product_video_uploaded", {
				entityType: "product",
				entityId: editing.id,
				metadata: { document_id: data.id },
			});
		} catch (err) {
			setVideoNotice(err.message || "Video upload failed");
		} finally {
			setVideoBusy(false);
			setVideoUploadProgress(0);
		}
	}

	async function syncProductMedia(nextForm) {
		if (!(editing?.id && token)) {
			return;
		}
		try {
			await apiRequest(`/products/${encodeURIComponent(editing.id)}`, {
				method: "PATCH",
				token,
				body: {
					image_urls: nextForm.image_urls,
					cover_image_url: nextForm.cover_image_url,
				},
			});
		} catch (err) {
			logger.error("Sync media failed:", err);
			setNotice(err.message || "Failed to sync media");
		}
	}

	async function syncProductVideo(videoUrl) {
		if (!(editing?.id && token)) {
			return;
		}
		try {
			await apiRequest(`/products/${encodeURIComponent(editing.id)}`, {
				method: "PATCH",
				token,
				body: { video_url: videoUrl },
			});
		} catch (err) {
			logger.error("Sync video failed:", err);
			setNotice(err.message || "Failed to sync video");
		}
	}

	function handleGalleryReorder(reordered) {
		setMediaGallery(reordered);
		const reorderedPaths = reordered.map((e) => e.source_path).filter(Boolean);
		setForm((f) => ({
			...f,
			image_urls: reorderedPaths,
			cover_image_url: f.cover_image_url || reorderedPaths[0] || "",
		}));
	}

	const isEditing = editing !== null && editing?.id !== null;
	const inputCls =
		"w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-sky-400/40 dark:focus:ring-sky-400/15";

	if (loading) {
		return <NeonAtom fill={true} timeout={10000} />;
	}

	return (
		<div className={isDark ? "dark" : ""}>
			<div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
				<div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 dark:bg-none dark:from-transparent dark:via-transparent dark:to-transparent">
					<div className="hidden dark:block absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(109,171,223,0.18),_transparent_36%),radial_gradient(circle_at_top_right,_rgba(106,161,212,0.16),_transparent_28%),linear-gradient(180deg,_rgba(2,6,23,1)_0%,_rgba(3,7,18,1)_100%)]" />
					<div className="hidden dark:block absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:44px_44px] opacity-35" />

					<main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
						<div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
							<div>
								<div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-700 shadow-sm backdrop-blur dark:border-sky-400/20 dark:text-sky-200">
									<Sparkles className="h-3.5 w-3.5" />
									Premium Product Management
								</div>
								<h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
									Product Management
								</h1>
								<p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
									Buying houses and factories can post products. Drafts stay private; published
									items go live after media review.
								</p>
							</div>

							<div className="flex items-center gap-3">
								<button
									onClick={toggleTheme}
									className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
								>
									{isDark ? (
										<SunMedium className="h-4 w-4 text-amber-500" />
									) : (
										<MoonStar className="h-4 w-4 text-sky-500" />
									)}
									{isDark ? "Light mode" : "Dark mode"}
								</button>
								<button
									onClick={openCreate}
									className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:scale-[1.01] hover:shadow-sky-500/35"
								>
									<Plus className="h-4 w-4" />
									Create product
								</button>
							</div>
						</div>

						<ScrollReveal as="section">
							<div className="mb-6 grid gap-4 md:grid-cols-3">
								<Stat icon={LayoutGrid} label="Published" value={stats.published} />
								<Stat icon={Clock3} label="Drafts" value={stats.drafts} />
								<Stat icon={BadgeCheck} label="Approved media" value={stats.approved} />
							</div>
						</ScrollReveal>

						<div className="mb-6 rounded-3xl border border-sky-200 bg-white p-5 shadow-sm dark:border-sky-400/15 dark:bg-white/5 dark:shadow-2xl dark:shadow-sky-950/20 dark:backdrop-blur">
							<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
								<div className="max-w-4xl">
									<div className="mb-2 flex items-center gap-2 text-sm font-medium text-sky-700 dark:text-sky-200">
										<ShieldCheck className="h-4 w-4" />
										Media & publishing help
									</div>
									<p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
										Upload product images/videos inside GarTexHub. Only internal{" "}
										<span className="rounded-md bg-sky-100 px-1.5 py-0.5 font-mono text-sky-700 dark:bg-white/10 dark:text-sky-200">
											/uploads/...
										</span>{" "}
										URLs are allowed. Pending or rejected media stays hidden from buyers.
									</p>
									<p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
										Use Draft to keep items private while preparing your gallery; switch to
										Published when ready.
									</p>
								</div>
								<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-300">
									<div className="font-medium text-slate-900 dark:text-white">Status rules</div>
									<div className="mt-2 flex flex-wrap gap-2">
										<Badge tone="slate">Draft private</Badge>
										<Badge tone="green">Published live</Badge>
										<Badge tone="amber">Media review required</Badge>
									</div>
								</div>
							</div>
						</div>

						{notice ? (
							<div className="mb-6 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-400/15 dark:bg-sky-400/10 dark:text-sky-50">
								<Eye className="mt-0.5 h-4 w-4 shrink-0 text-sky-500 dark:text-sky-200" />
								<span>{notice}</span>
							</div>
						) : null}

						{items.length === 0 ? (
							<div className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-white/5">
								<p className="text-slate-400">
									No products yet. Create your first product to get started.
								</p>
							</div>
						) : (
							<StaggerContainer className="grid gap-4">
								{items.map((product) => (
									<StaggerItem key={product.id}>
										<FlipCard
											flipOn="click"
											front={
												<article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-xl dark:shadow-slate-950/20 h-full">
													<div className="flex flex-col gap-4 h-full">
														<div className="flex flex-wrap items-center gap-2">
															<Badge tone={product.status === "published" ? "green" : "slate"}>
																Status: {product.status}
															</Badge>
															<Badge tone="blue">
																Video: {product.video_review_status || "pending"}
															</Badge>
															<Badge tone="blue">
																Content: {product.content_review_status || "pending"}
															</Badge>
														</div>

														<div>
															<h2 className="truncate text-2xl font-semibold text-slate-900 dark:text-white">
																{product.title || product.name}
															</h2>
															<div className="mt-2 inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
																MOQ {product.moq || "--"} · Lead {product.lead_time_days || "--"}
															</div>
														</div>

														<p className="flex-1 text-sm leading-6 text-slate-600 dark:text-slate-300 line-clamp-4">
															{product.description}
														</p>

														<div className="text-xs text-slate-400 dark:text-slate-500">
															Click to flip for details
														</div>
													</div>
												</article>
											}
											back={
												<article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-xl dark:shadow-slate-950/20 h-full">
													<div className="flex flex-col gap-4 h-full">
														<div className="grid gap-3 sm:grid-cols-2">
															{[
																{
																	label: "Industry",
																	value: product.industry || "—",
																},
																{
																	label: "Category",
																	value: product.category || "—",
																},
																{
																	label: "Material",
																	value: product.material || "—",
																},
																{
																	label: "Media",
																	value: `${Array.isArray(product.image_urls) ? product.image_urls.length : 0} files`,
																},
															].map((item) => (
																<div
																	key={item.label}
																	className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900/50"
																>
																	<div className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400">
																		{item.label}
																	</div>
																	<div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
																		{item.value}
																	</div>
																</div>
															))}
														</div>

														<div className="mt-auto flex flex-wrap gap-3">
															<button
																onClick={() => openEdit(product)}
																className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
															>
																<Pencil className="h-4 w-4" />
																Edit
															</button>
															<button
																onClick={() => promptDelete(product.id)}
																className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15"
															>
																<Trash2 className="h-4 w-4" />
																Delete
															</button>
														</div>
													</div>
												</article>
											}
										/>
									</StaggerItem>
								))}
							</StaggerContainer>
						)}
					</main>
				</div>

				{modalOpen ? (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-sm dark:bg-slate-950/70">
						<div
							data-lenis-prevent={true}
							className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white text-slate-900 shadow-2xl shadow-black/20 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:shadow-black/40"
						>
							<div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur dark:border-white/10 dark:bg-slate-950/95">
								<div>
									<h3 className="text-2xl font-semibold text-slate-900 dark:text-white">
										{isEditing ? "Edit product" : "Create product"}
									</h3>
									<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
										No music uploads. Videos and images must be uploaded inside GarTexHub (internal
										/uploads/... only).
									</p>
								</div>
								<button
									onClick={closeModal}
									className="rounded-2xl border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
								>
									<X className="h-5 w-5" />
								</button>
							</div>

							<div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.3fr_0.9fr]">
								<div className="space-y-5">
									<div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
										<Field label="Product name" required={true}>
											<input
												value={form.title}
												onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
												className={inputCls}
												placeholder="Untitled Draft"
												required={true}
											/>
										</Field>

										<div className="mt-4 grid gap-4 md:grid-cols-2">
											<Field label="Industry" required={true}>
												{(() => {
													const resolved = resolveIndustryOption(form.industry);
													return (
														<select
															value={resolved.value}
															onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
															className={inputCls}
															required={true}
														>
															<option value="">Select industry</option>
															{FACTORY_SECTOR_OPTIONS.map((opt) => (
																<option key={opt.value} value={opt.value}>
																	{opt.label}
																</option>
															))}
															{resolved.isLegacy ? (
																<option value={resolved.value}>{resolved.value}</option>
															) : null}
														</select>
													);
												})()}
											</Field>
											<Field label="Category (e.g. Shirts)" required={true}>
												<input
													value={form.category}
													onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
													className={inputCls}
													placeholder="Shirts"
													required={true}
												/>
											</Field>
											<Field label="Material (e.g. Cotton)" required={true}>
												<input
													value={form.material}
													onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))}
													className={inputCls}
													placeholder="Cotton"
													required={true}
												/>
											</Field>
											<Field label="MOQ">
												<input
													value={form.moq}
													onChange={(e) => setForm((f) => ({ ...f, moq: e.target.value }))}
													className={inputCls}
													placeholder="1000"
												/>
											</Field>
											<Field label="Price range" required={true}>
												<input
													value={form.price_range}
													onChange={(e) =>
														setForm((f) => ({
															...f,
															price_range: e.target.value,
														}))
													}
													className={inputCls}
													placeholder="$4.50 - $7.20"
													required={true}
												/>
											</Field>
											<Field label="Lead time (days)" required={true}>
												<input
													value={form.lead_time_days}
													onChange={(e) =>
														setForm((f) => ({
															...f,
															lead_time_days: e.target.value,
														}))
													}
													className={inputCls}
													placeholder="45"
													required={true}
												/>
											</Field>
										</div>
									</div>

									<div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
										<div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
											<FileText className="h-4 w-4 text-sky-500 dark:text-sky-300" />
											Description <span className="text-sky-500">*</span>
										</div>
										<textarea
											value={form.description}
											onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
											rows={5}
											className={inputCls}
											placeholder="Add your product description here..."
											required={true}
										/>
										<WordCount
											text={form.description}
											limit={(() => {
												const user = getCurrentUser();
												return String(user?.subscription_status || "").toLowerCase() === "premium"
													? 1500
													: 600;
											})()}
										/>
										<button
											type="button"
											onClick={() => setAdvancedOpen(!advancedOpen)}
											className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700 transition hover:bg-sky-100 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-100 dark:hover:bg-sky-400/15"
										>
											<Sparkles className="h-4 w-4" />
											{advancedOpen ? "Hide advanced details" : "Add advanced details"}
										</button>
										{advancedOpen && (
											<div className="mt-4 grid gap-4 md:grid-cols-2">
												<Field label="Fabric GSM">
													<input
														value={form.fabric_gsm}
														onChange={(e) =>
															setForm((f) => ({
																...f,
																fabric_gsm: e.target.value,
															}))
														}
														className={inputCls}
														placeholder="180"
													/>
												</Field>
												<Field label="Size range">
													<input
														value={form.size_range}
														onChange={(e) =>
															setForm((f) => ({
																...f,
																size_range: e.target.value,
															}))
														}
														className={inputCls}
														placeholder="S-XXL"
													/>
												</Field>
											</div>
										)}
									</div>

									<div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
										<div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
											<Upload className="h-4 w-4 text-sky-500 dark:text-sky-300" />
											Product media <span className="text-sky-500">*</span>
										</div>
										<p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
											Upload images or video files. Pending/rejected media stays hidden from buyers.
										</p>

										<div className="mt-4 grid gap-3 md:grid-cols-2">
											{editing?.id ? (
												<>
													<div
														className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 cursor-pointer hover:border-sky-400 dark:border-white/15 dark:bg-slate-900/60 dark:hover:border-sky-400/40"
														onClick={() => imageInputRef.current?.click()}
													>
														<div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-white">
															<ImageIcon className="h-4 w-4 text-sky-500 dark:text-sky-300" />
															{mediaBusy ? (
																<ThreeDot
																	variant="bounce"
																	color="#337ab0"
																	size="small"
																	text=""
																	textColor=""
																/>
															) : (
																"Click to upload images"
															)}
														</div>
														<div className="mt-1 text-xs text-slate-400">
															PNG, JPG up to 10MB each
														</div>
														<input
															ref={imageInputRef}
															type="file"
															multiple={true}
															accept=".jpg,.jpeg,.png,.webp,.avif,.gif,.apng,.bmp,.tiff,.tif,.heic,.heif,.dcm,.tga,.svg,.eps,.pdf,.dng,.cr2,.cr3,.nef,.arw,.sr2,.orf,.raf,.psd,.ai,.xcf,.cdr"
															onChange={(e) => handleUploadFiles(e.target.files)}
															disabled={mediaBusy}
															className="hidden"
														/>
														{mediaBusy && (
															<div className="mt-3">
																<UploadProgressBar progress={mediaUploadProgress} />
															</div>
														)}
														{mediaGallery.length > 0 && (
															<AnimatePresence mode="popLayout">
																<Reorder.Group
																	axis="x"
																	values={mediaGallery}
																	onReorder={handleGalleryReorder}
																	className="mt-3 flex flex-wrap gap-2"
																>
																	{mediaGallery.map((entry) => (
																		<Reorder.Item
																			key={entry.document_id || entry.url}
																			value={entry}
																			as="div"
																			className="relative h-16 w-16 rounded-lg overflow-hidden border border-slate-200 cursor-grab active:cursor-grabbing dark:border-white/10"
																		>
																			<motion.img
																				src={entry.url}
																				alt=""
																				className="h-full w-full object-cover pointer-events-none"
																				layout={true}
																				initial={{ opacity: 0, scale: 0.92 }}
																				animate={{ opacity: 1, scale: 1 }}
																				exit={{ opacity: 0, scale: 0.85 }}
																				transition={{
																					duration: 0.35,
																					ease: [0.16, 1, 0.3, 1],
																				}}
																			/>
																			<div className="absolute bottom-0 left-0 right-0 bg-black/50">
																				{getStatusBadge(entry.status)}
																			</div>
																		</Reorder.Item>
																	))}
																</Reorder.Group>
															</AnimatePresence>
														)}
													</div>
													<div
														className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 cursor-pointer hover:border-sky-400 dark:border-white/15 dark:bg-slate-900/60 dark:hover:border-sky-400/40"
														onClick={() => videoInputRef.current?.click()}
													>
														<div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-white">
															<Video className="h-4 w-4 text-sky-500 dark:text-sky-300" />
															{videoBusy ? (
																<ThreeDot
																	variant="bounce"
																	color="#337ab0"
																	size="small"
																	text=""
																	textColor=""
																/>
															) : (
																"Click to upload video"
															)}
														</div>
														<div className="mt-1 text-xs text-slate-400">
															MP4, WEBM, MKV, AVI, MOV, FLV, MPEG, 3GP, WMV, OGV, M4V, AMV, ASF,
															VOB, OGG, MNG, 3G2, MXF, ROQ, RM, QT, SVI, NSV, YUV, F4V up to 50MB
														</div>
														<input
															ref={videoInputRef}
															type="file"
															accept="video/*"
															onChange={(e) => handleUploadVideo(e.target.files?.[0])}
															disabled={videoBusy}
															className="hidden"
														/>
														{videoBusy && (
															<div className="mt-3">
																<UploadProgressBar progress={videoUploadProgress} />
															</div>
														)}
													</div>
												</>
											) : (
												<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 dark:border-white/15 dark:bg-slate-900/60">
													<div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-white">
														<ImageIcon className="h-4 w-4 text-sky-500 dark:text-sky-300" />
														Save product first
													</div>
													<div className="mt-1 text-xs text-slate-400">
														Save the product first to upload images.
													</div>
												</div>
											)}
										</div>

										{(mediaNotice || videoNotice) && (
											<div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-50">
												{mediaNotice || videoNotice}
											</div>
										)}
									</div>
								</div>

								<div className="space-y-5">
									<div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-blue-50 p-5 dark:border-white/10 dark:bg-gradient-to-br dark:from-sky-500/15 dark:to-blue-500/5">
										<div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
											<Rocket className="h-4 w-4 text-sky-500 dark:text-sky-300" />
											Publishing checklist
										</div>
										<div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
											{[
												"Draft mode keeps this item private while you prepare the gallery.",
												"Published items go live after media review is approved.",
												"Buyers only see internal media that passed review.",
											].map((text) => (
												<div
													key={text}
													className="flex items-start gap-3 rounded-2xl bg-white p-3 dark:bg-slate-900/50"
												>
													<CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500 dark:text-emerald-300" />
													<span>{text}</span>
												</div>
											))}
										</div>
									</div>

									<div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
										<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-200">
											<input
												type="checkbox"
												checked={complianceChecked}
												onChange={(e) => setComplianceChecked(e.target.checked)}
												className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-500 dark:border-white/20"
											/>
											<span>
												I confirm this product media contains no music or prohibited instruments.
											</span>
										</label>

										<div className="mt-5 flex flex-col gap-3 sm:flex-row">
											<button
												onClick={() => saveProduct("draft")}
												disabled={saving}
												className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 disabled:opacity-60"
											>
												Save draft
											</button>
											<button
												onClick={() => saveProduct("published")}
												disabled={saving}
												className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:scale-[1.01] hover:shadow-sky-500/35 disabled:opacity-60"
											>
												{saving ? (
													<ThreeDot
														variant="bounce"
														color="#337ab0"
														size="small"
														text=""
														textColor=""
													/>
												) : (
													"Publish"
												)}
											</button>
										</div>

										<div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 text-xs leading-6 text-slate-500 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-400">
											Tip: keep the item as Draft while your media is pending, then publish after
											everything is approved.
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				) : null}

				{deleteConfirmId ? (
					<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm dark:bg-slate-950/70">
						<div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl shadow-black/20 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:shadow-black/40">
							<h3 className="text-lg font-semibold text-slate-900 dark:text-white">
								Confirm Delete
							</h3>
							<p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
								Are you sure you want to delete this product? This action cannot be undone.
							</p>
							<div className="mt-6 flex justify-end gap-3">
								<button
									onClick={cancelDelete}
									className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
								>
									Cancel
								</button>
								<button
									onClick={confirmDelete}
									className="rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition hover:bg-rose-700"
								>
									Delete
								</button>
							</div>
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}

export { resolveIndustryOption };
