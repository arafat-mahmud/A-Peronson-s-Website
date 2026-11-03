import remarkAbbr from "@syenchuk/remark-abbr";
import { motion, Reorder } from "framer-motion";
import {
	ArrowLeft,
	Check,
	Image,
	Pencil,
	Play,
	Plus,
	RefreshCw,
	Sparkles,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Mosaic, ThreeDot } from "react-loading-indicators";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import remarkDeflist from "remark-deflist";
import remarkDirective from "remark-directive";
import remarkEmoji from "remark-emoji";
import remarkGfm from "remark-gfm";
import { remarkHighlightMark } from "remark-highlight-mark";
import remarkIns from "remark-ins";
import remarkSmartypants from "remark-smartypants";
import remarkSupersub from "remark-supersub";
import CodeBlock from "../components/ui/CodeBlock.jsx";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import WordCount from "../components/ui/WordCount.jsx";
import { apiRequest, getCurrentUser, getToken, syncUserFromApi } from "../lib/auth.js";
import remarkContainerDirective from "../lib/remarkContainerDirective.js";
import { useTheme } from "../lib/ThemeProvider.jsx";
import LazyImage from "../components/ui/LazyImage.jsx";

const initialForm = {
	title: "",
	category: "",
	caption: "",
	readme: "",
	hashtags: "",
	mentions: "",
	productTags: "",
	location: "",
};

function splitCommaList(value) {
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function timeAgo(value) {
	if (!value) {
		return "Just now";
	}
	const now = Date.now();
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) {
		return value;
	}
	const diff = now - d.getTime();
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	const weeks = Math.floor(days / 7);
	const months = Math.floor(days / 30);
	if (seconds < 10) {
		return "Just now";
	}
	if (seconds < 60) {
		return `${seconds} seconds ago`;
	}
	if (minutes === 1) {
		return "1 minute ago";
	}
	if (minutes < 60) {
		return `${minutes} minutes ago`;
	}
	if (hours === 1) {
		return "1 hour ago";
	}
	if (hours < 24) {
		return `${hours} hours ago`;
	}
	if (days === 1) {
		return "1 day ago";
	}
	if (days < 7) {
		return `${days} days ago`;
	}
	if (weeks === 1) {
		return "1 week ago";
	}
	if (weeks < 5) {
		return `${weeks} weeks ago`;
	}
	if (months === 1) {
		return "1 month ago";
	}
	return `${months} months ago`;
}

import { cn } from "../lib/cn.js";

export default function FeedManagementPage() {
	const fileInputRef = useRef(null);
	const { theme, toggleTheme } = useTheme();
	const [form, setForm] = useState(initialForm);
	const [mediaRows, setMediaRows] = useState([]);
	const [posts, setPosts] = useState([]);
	const [loadingPosts, setLoadingPosts] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [editingPost, setEditingPost] = useState(null);
	const [pageLoading, setPageLoading] = useState(true);
	const [confirmDelete, setConfirmDelete] = useState(null);
	const [editorTab, setEditorTab] = useState("create");

	useEffect(() => {
		let postsDone = false;
		let userDone = false;

		function tryDone() {
			if (postsDone && userDone) {
				setPageLoading(false);
			}
		}

		const loadMine = async () => {
			setLoadingPosts(true);
			setError("");
			try {
				const token = getToken();
				if (!token) {
					return;
				}
				const data = await apiRequest("/feed/posts/mine", { token });
				const rows = Array.isArray(data) ? data : Array.isArray(data?.posts) ? data.posts : [];
				setPosts(rows);
			} catch (err) {
				const message = err instanceof Error ? err.message : "Failed to load your posts";
				setError(message);
			} finally {
				setLoadingPosts(false);
				postsDone = true;
				tryDone();
			}
		};

		const loadUser = async () => {
			try {
				await syncUserFromApi(getToken());
			} finally {
				userDone = true;
				tryDone();
			}
		};

		loadMine();
		loadUser();
	}, []);

	const previewHasText = form.readme.trim().length > 0;

	const previewMeta = useMemo(
		() => ({
			hashtags: splitCommaList(form.hashtags),
			mentions: splitCommaList(form.mentions),
			productTags: splitCommaList(form.productTags),
		}),
		[form.hashtags, form.mentions, form.productTags],
	);

	const wordLimit = useMemo(() => {
		const user = getCurrentUser();
		return String(user?.subscription_status || "").toLowerCase() === "premium" ? 1500 : 600;
	}, []);

	const updateField = (key, value) => {
		setForm((prev) => ({ ...prev, [key]: value }));
	};

	const openPicker = () => fileInputRef.current?.click();

	const handleFiles = async (files) => {
		if (files?.length === 0) {
			return;
		}
		setUploading(true);
		setError("");

		try {
			const nextRows = Array.from(files).map((file) => ({
				id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
				file,
				name: file.name,
				type: file.type || "application/octet-stream",
				url: URL.createObjectURL(file),
			}));

			setMediaRows((prev) => [...prev, ...nextRows]);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Upload failed";
			setError(message);
		} finally {
			setUploading(false);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	};

	const clearForm = () => {
		setForm(initialForm);
		setMediaRows([]);
		setEditingPost(null);
		setError("");
	};

	const editPost = (post) => {
		setEditingPost(post);
		setForm({
			title: post.title || "",
			category: post.category || "",
			caption: post.caption || "",
			readme: post.description_markdown || post.readme || "",
			hashtags: Array.isArray(post.hashtags) ? post.hashtags.join(", ") : post.hashtags || "",
			mentions: Array.isArray(post.mentions) ? post.mentions.join(", ") : post.mentions || "",
			productTags: Array.isArray(post.product_tags)
				? post.product_tags.join(", ")
				: post.product_tags || post.productTags || "",
			location: post.location_tag || post.location || "",
		});

		const existingMedia = (post.media || []).map((m) => ({
			id: `${m.url || m.name}-${Math.random().toString(36).slice(2, 8)}`,
			file: null,
			name: m.name || "Media",
			type: m.type || "image/jpeg",
			url: m.url || m,
		}));
		setMediaRows(existingMedia);
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const createPost = async () => {
		if (!form.title.trim()) {
			setError("Title is required.");
			return;
		}

		if (!form.readme.trim()) {
			setError("README / Longform content is required.");
			return;
		}

		const token = getToken();
		if (!token) {
			setError("Please log in again. Token missing.");
			return;
		}

		setSaving(true);
		setError("");

		const payload = {
			title: form.title,
			category: form.category,
			caption: form.caption,
			description_markdown: form.readme,
			hashtags: splitCommaList(form.hashtags),
			mentions: splitCommaList(form.mentions),
			product_tags: splitCommaList(form.productTags),
			location_tag: form.location,
			media: mediaRows.map((item) => ({
				name: item.name,
				type: item.type,
				url: item.url,
			})),
		};

		const isEditing = editingPost !== null;
		const baseUrl = isEditing ? `/feed/posts/${editingPost.id}` : "/feed/posts";
		const method = isEditing ? "PATCH" : "POST";

		try {
			const data = await apiRequest(baseUrl, {
				method,
				token,
				body: payload,
			});

			const saved = data?.post || data;
			if (!saved?.id) {
				setError("Failed to save post");
				return;
			}

			if (isEditing) {
				setPosts((prev) => prev.map((p) => (p.id === editingPost.id ? saved : p)));
			} else {
				setPosts((prev) => [saved, ...prev]);
			}
			clearForm();
		} catch (err) {
			const message = err instanceof Error ? err.message : "Save failed";
			setError(message);
		} finally {
			setSaving(false);
		}
	};

	const deletePost = async (postId) => {
		const token = getToken();
		if (!token) {
			setError("Please log in again. Token missing.");
			return;
		}

		const snapshot = posts;
		setError("");
		setPosts((prev) => prev.filter((post) => post.id !== postId));

		try {
			await apiRequest(`/feed/posts/${postId}`, { method: "DELETE", token });
		} catch (err) {
			setPosts(snapshot);
			const message = err instanceof Error ? err.message : "Delete failed";
			setError(message);
		}
	};

	const removeMedia = (id) => {
		setMediaRows((prev) => {
			const target = prev.find((item) => item.id === id);
			if (target) {
				URL.revokeObjectURL(target.url);
			}
			return prev.filter((item) => item.id !== id);
		});
	};

	const pageBg = theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";

	const panelBg =
		theme === "dark"
			? "bg-white/5 border-white/10 shadow-[0_20px_80px_-30px_rgba(109,171,223,0.25)]"
			: "bg-white border-slate-200 shadow-[0_20px_80px_-30px_rgba(51,122,176,0.18)]";

	const subtleText = theme === "dark" ? "text-slate-400" : "text-slate-500";
	const mutedBorder = theme === "dark" ? "border-white/10" : "border-slate-200";
	const inputBase =
		theme === "dark"
			? "bg-slate-900/60 text-slate-100 placeholder:text-slate-500 border-white/10 focus:border-sky-400"
			: "bg-white text-slate-900 placeholder:text-slate-400 border-slate-200 focus:border-sky-500";

	if (pageLoading) {
		return <NeonAtom fill={true} timeout={10000} />;
	}

	return (
		<div className={cn("min-h-screen transition-colors duration-300", pageBg)}>
			<div
				className={cn(
					"border-b backdrop-blur-xl",
					theme === "dark" ? "border-white/10 bg-slate-950/70" : "border-slate-200 bg-white/80",
				)}
			>
				<div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
					<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
						<div className="space-y-2">
							<div>
								<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Post Editor</h1>
								<p className={cn("mt-1 text-sm sm:text-base", subtleText)}>
									Create and manage your feed posts.
								</p>
							</div>
						</div>

						<div className="flex flex-wrap items-center gap-3">
							<Link
								to="/feed"
								className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-lg"
							>
								<ArrowLeft className="h-4 w-4" />
								Back to Feed
							</Link>
							<button
								type="button"
								onClick={toggleTheme}
								className={cn(
									"inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-lg",
									panelBg,
								)}
							>
								{theme === "dark" ? "Light mode" : "Dark mode"}
							</button>
						</div>
					</div>
				</div>
			</div>

			<div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				{error ? (
					<div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 shadow-lg">
						<div className="flex items-start gap-3">
							<div className="mt-0.5 rounded-full bg-red-500/20 p-1.5 text-red-300">
								<X className="h-4 w-4" />
							</div>
							<div>
								<p className="font-medium text-red-100">Something went wrong</p>
								<p className="mt-1 text-red-200/90">{error}</p>
							</div>
						</div>
					</div>
				) : null}

				<div className="mb-6 flex gap-2 rounded-2xl border border-slate-200/70 bg-white/80 p-1.5 dark:border-slate-800 dark:bg-slate-950/70">
					<button
						type="button"
						onClick={() => setEditorTab("create")}
						className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${editorTab === "create" ? "bg-sky-500 text-white shadow" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"}`}
					>
						Create a Post
					</button>
					<button
						type="button"
						onClick={() => setEditorTab("posts")}
						className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${editorTab === "posts" ? "bg-sky-500 text-white shadow" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"}`}
					>
						Your Posts
					</button>
				</div>

				<div className="grid gap-6 lg:grid-cols-5">
					<div className={cn("lg:col-span-3 space-y-6", editorTab !== "create" && "hidden")}>
						<section className={cn("overflow-hidden rounded-3xl border backdrop-blur-xl", panelBg)}>
							<div className={cn("border-b px-5 py-4", mutedBorder)}>
								<div className="flex items-center gap-3">
									<div className="rounded-2xl bg-sky-500/15 p-2 text-sky-400">
										<Plus className="h-5 w-5" />
									</div>
									<div>
										<h2 className="text-lg font-semibold">
											{editingPost ? "Edit Post" : "Post Editor"}
										</h2>
										<p className={cn("text-sm", subtleText)}>
											{editingPost
												? `Editing "${editingPost.title}"`
												: "Compose, enrich, and publish your feed post."}
										</p>
									</div>
								</div>
							</div>

							<div className="grid gap-5 p-5 sm:grid-cols-2">
								<Field label="Title" required={true}>
									<input
										value={form.title}
										onChange={(e) => updateField("title", e.target.value)}
										placeholder="Title..."
										className={cn(
											"w-full rounded-2xl border px-4 py-3 outline-none transition focus:ring-2 focus:ring-sky-400/20",
											inputBase,
										)}
									/>
								</Field>

								<Field label="Category">
									<input
										value={form.category}
										onChange={(e) => updateField("category", e.target.value)}
										placeholder="Announcements"
										className={cn(
											"w-full rounded-2xl border px-4 py-3 outline-none transition focus:ring-2 focus:ring-sky-400/20",
											inputBase,
										)}
									/>
								</Field>

								<Field label="Caption" className="sm:col-span-2">
									<textarea
										value={form.caption}
										onChange={(e) => updateField("caption", e.target.value)}
										placeholder="Short feed caption..."
										rows={3}
										className={cn(
											"w-full resize-none rounded-2xl border px-4 py-3 outline-none transition focus:ring-2 focus:ring-sky-400/20",
											inputBase,
										)}
									/>
								</Field>

								<Field label="README / Longform" required className="sm:col-span-2">
									<textarea
										value={form.readme}
										onChange={(e) => updateField("readme", e.target.value)}
										placeholder="Write markdown here..."
										rows={8}
										className={cn(
											"w-full rounded-2xl border px-4 py-3 outline-none transition focus:ring-2 focus:ring-sky-400/20",
											inputBase,
											"min-h-[220px]",
										)}
									/>
									<WordCount text={form.readme} limit={wordLimit} />
								</Field>

								<Field label="Hashtags">
									<input
										value={form.hashtags}
										onChange={(e) => updateField("hashtags", e.target.value)}
										placeholder="#launch, #update"
										className={cn(
											"w-full rounded-2xl border px-4 py-3 outline-none transition focus:ring-2 focus:ring-sky-400/20",
											inputBase,
										)}
									/>
								</Field>

								<Field label="Mentions">
									<input
										value={form.mentions}
										onChange={(e) => updateField("mentions", e.target.value)}
										placeholder="@buyer, @factory"
										className={cn(
											"w-full rounded-2xl border px-4 py-3 outline-none transition focus:ring-2 focus:ring-sky-400/20",
											inputBase,
										)}
									/>
								</Field>

								<Field label="Product Tags">
									<input
										value={form.productTags}
										onChange={(e) => updateField("productTags", e.target.value)}
										placeholder="cotton, denim, etc"
										className={cn(
											"w-full rounded-2xl border px-4 py-3 outline-none transition focus:ring-2 focus:ring-sky-400/20",
											inputBase,
										)}
									/>
								</Field>

								<Field label="Location Tag" className="sm:col-span-2">
									<input
										value={form.location}
										onChange={(e) => updateField("location", e.target.value)}
										placeholder="Dhaka, Bangladesh"
										className={cn(
											"w-full rounded-2xl border px-4 py-3 outline-none transition focus:ring-2 focus:ring-sky-400/20",
											inputBase,
										)}
									/>
								</Field>
							</div>

							<div className={cn("border-t px-5 py-5", mutedBorder)}>
								<div className="flex items-center justify-between gap-4">
									<div>
										<h3 className="text-sm font-semibold uppercase tracking-wide text-sky-400">
											Media (images / videos)
										</h3>
										<p className={cn("mt-1 text-sm", subtleText)}>
											Add product shots, announcements, or campaign videos.
										</p>
									</div>
									<input
										ref={fileInputRef}
										type="file"
										multiple={true}
										accept=".jpg,.jpeg,.png,.webp,.avif,.gif,.apng,.bmp,.tiff,.tif,.heic,.heif,.dcm,.tga,.svg,.eps,.pdf,.dng,.cr2,.cr3,.nef,.arw,.sr2,.orf,.raf,.psd,.ai,.xcf,.cdr,.mp4,.webm,.mkv,.flv,.vob,.ogv,.ogg,.rrc,.gifv,.mng,.mov,.avi,.qt,.wmv,.yuv,.rm,.asf,.amv,.m4p,.m4v,.mpg,.mp2,.mpeg,.mpe,.mpv,.svi,.3gp,.3g2,.mxf,.roq,.nsv,.f4v,.f4p,.f4a,.f4b,.mod"
										className="hidden"
										onChange={(e) => handleFiles(e.target.files)}
									/>
									<button
										type="button"
										onClick={openPicker}
										disabled={uploading}
										className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:translate-y-[-1px] hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
									>
										{uploading ? (
											<ThreeDot
												variant="bounce"
												color="#337ab0"
												size="small"
												text=""
												textColor=""
											/>
										) : (
											<Upload className="h-4 w-4" />
										)}
										{uploading ? "Uploading..." : "Upload"}
									</button>
								</div>

							<div className="mt-5">
								{mediaRows.length === 0 ? (
									<button
										type="button"
										onClick={openPicker}
										disabled={uploading}
										className={cn(
											"w-full rounded-2xl border-2 border-dashed px-5 py-10 text-center transition hover:border-sky-400 hover:bg-sky-50/30 cursor-pointer",
											theme === "dark"
												? "border-white/15 bg-slate-950/30 hover:bg-sky-500/5"
												: "border-slate-300 bg-slate-50/70 hover:bg-sky-50/50",
										)}
									>
										<Upload className={cn("mx-auto h-10 w-10", theme === "dark" ? "text-sky-400" : "text-sky-500")} />
										<p className="mt-3 text-sm font-semibold">
											Drop images &amp; videos here or click to browse
										</p>
										<p className={cn("mt-1 text-xs", subtleText)}>
											JPG, PNG, GIF, WebP, MP4, WebM — up to 50 MB each
										</p>
									</button>
								) : (
									<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
											{mediaRows.map((media) => {
												const isVideo = media.type.startsWith("video");
												return (
													<div
														key={media.id}
														className={cn(
															"group overflow-hidden rounded-3xl border transition hover:-translate-y-1",
															theme === "dark"
																? "border-white/10 bg-slate-950/40"
																: "border-slate-200 bg-white",
														)}
													>
														<div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-sky-500/20 via-cyan-400/10 to-transparent">
															{isVideo ? (
																<>
																	<video
																		src={media.url}
																		className="h-full w-full object-cover"
																		muted={true}
																		playsInline={true}
																	/>
																	<div className="absolute inset-0 grid place-items-center bg-black/20">
																		<div className="rounded-full bg-black/40 p-3 text-white backdrop-blur-sm">
																			<Play className="h-6 w-6 fill-white" />
																		</div>
																	</div>
																</>
															) : (
																<motion.div
																	initial={{ opacity: 0, scale: 1.06 }}
																	whileInView={{ opacity: 1, scale: 1 }}
																	viewport={{ once: true, margin: "-40px" }}
																	transition={{
																		duration: 0.5,
																		ease: [0.16, 1, 0.3, 1],
																	}}
																	className="h-full w-full"
																>
																	<LazyImage
																		src={media.url}
																		alt={media.name}
																		width={300}
																		height={300}
																		className="h-full w-full object-cover"
																	/>
																</motion.div>
															)}
															<button
																type="button"
																onClick={() => removeMedia(media.id)}
																className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white opacity-100 transition hover:bg-black"
																aria-label="Remove media"
															>
																<X className="h-4 w-4" />
															</button>
														</div>
														<div className="space-y-1 p-3">
															<div className="text-xs font-medium uppercase tracking-wide text-sky-400">
																{isVideo ? "Video" : "Image"}
															</div>
															<p className="truncate text-sm font-medium">{media.name}</p>
														</div>
													</div>
												);
											})}
										</div>
									)}
								</div>
							</div>

							<div
								className={cn(
									"flex flex-col gap-3 border-t px-5 py-5 sm:flex-row sm:items-center sm:justify-between",
									mutedBorder,
								)}
							>
								<div className="flex gap-3">
									<button
										type="button"
										onClick={clearForm}
										className={cn(
											"inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-lg",
											panelBg,
										)}
									>
										<RefreshCw className="h-4 w-4" />
										{editingPost ? "Cancel" : "Clear"}
									</button>
									{editingPost && (
										<span className="inline-flex items-center gap-2 rounded-2xl bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-400">
											Editing post
										</span>
									)}
								</div>

								<button
									type="button"
									onClick={createPost}
									disabled={saving}
									className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:translate-y-[-1px] hover:shadow-xl hover:shadow-sky-500/30 disabled:cursor-not-allowed disabled:opacity-70"
								>
									{saving ? (
										<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
									) : (
										<Check className="h-4 w-4" />
									)}
									{saving ? "Saving..." : editingPost ? "Update post" : "Save post"}
								</button>
							</div>
						</section>
					</div>

					<div className="lg:col-span-2 space-y-6">
						<section className={cn("overflow-hidden rounded-3xl border backdrop-blur-xl", panelBg, editorTab !== "create" && "hidden")}>
							<div className={cn("border-b px-5 py-4", mutedBorder)}>
								<h2 className="text-lg font-semibold">Live Preview</h2>
								<p className={cn("text-sm", subtleText)}>Rendered markdown from your README field.</p>
							</div>

							<div className="px-5 py-5">
								{previewHasText ? (
									<article
										className={cn(
											"prose max-w-none",
											theme === "dark"
												? "prose-invert prose-headings:text-white prose-a:text-sky-400"
												: "prose-slate prose-headings:text-slate-900 prose-a:text-sky-600",
										)}
									>
										<ReactMarkdown
											remarkPlugins={[
												[remarkGfm, { singleTilde: false }],
												remarkSmartypants,
												remarkEmoji,
												remarkSupersub,
												remarkIns,
												remarkHighlightMark,
												remarkDeflist,
												remarkDirective,
												remarkContainerDirective,
												remarkAbbr,
											]}
											components={{
												img({ src, alt, title, ...props }) {
													return (
														<LazyImage
															src={src}
															alt={alt || "Markdown image"}
															width={600}
															height={400}
															title={title}
															className="max-w-full rounded-xl"
															{...props}
														/>
													);
												},
												code({ inline, className, children, ...props }) {
													if (inline) {
														return (
															<code className={className} {...props}>
																{children}
															</code>
														);
													}
													return (
														<CodeBlock className={className} {...props}>
															{children}
														</CodeBlock>
													);
												},
											}}
										>
											{form.readme}
										</ReactMarkdown>
									</article>
								) : (
									<div
										className={cn(
											"rounded-2xl border border-dashed px-5 py-10 text-center",
											theme === "dark"
												? "border-white/10 bg-slate-950/30"
												: "border-slate-200 bg-slate-50",
										)}
									>
										<Sparkles className={cn("mx-auto h-10 w-10", subtleText)} />
										<p className="mt-3 text-sm font-medium">No preview content yet</p>
										<p className={cn("mt-1 text-sm", subtleText)}>
											Start writing markdown to see it rendered instantly.
										</p>
									</div>
								)}
							</div>

							<div className={cn("border-t px-5 py-5", mutedBorder)}>
								<div className="flex items-center justify-between gap-3">
									<h3 className="text-sm font-semibold uppercase tracking-wide text-sky-400">
										Content summary
									</h3>
									<div className="rounded-full border px-3 py-1 text-xs font-medium text-sky-400 border-sky-400/20 bg-sky-400/10">
										{mediaRows.length} media
									</div>
								</div>
								<div className="mt-4 grid gap-3 text-sm">
									<InfoRow
										label="Hashtags"
										value={
											previewMeta.hashtags.length > 0 ? previewMeta.hashtags.join(", ") : "None"
										}
									/>
									<InfoRow
										label="Mentions"
										value={
											previewMeta.mentions.length > 0 ? previewMeta.mentions.join(", ") : "None"
										}
									/>
									<InfoRow
										label="Product tags"
										value={
											previewMeta.productTags.length > 0
												? previewMeta.productTags.join(", ")
												: "None"
										}
									/>
									<InfoRow label="Location" value={form.location || "None"} />
								</div>
							</div>
						</section>

						<section className={cn("overflow-hidden rounded-3xl border backdrop-blur-xl", panelBg, editorTab !== "posts" && "hidden")}>
							<div className={cn("border-b px-5 py-4", mutedBorder)}>
								<h2 className="text-lg font-semibold">Your posts</h2>
								<p className={cn("text-sm", subtleText)}>Fetched from /api/feed/posts/mine</p>
							</div>

							<div className="p-5">
								{loadingPosts ? (
									<div className="flex items-center justify-center py-10">
										<Mosaic
											color="#337ab0"
											size="large"
											style={{ fontSize: "40px" }}
											text=""
											textColor=""
										/>
									</div>
								) : posts.length === 0 ? (
									<div
										className={cn(
											"rounded-2xl border border-dashed px-5 py-10 text-center",
											theme === "dark"
												? "border-white/10 bg-slate-950/30"
												: "border-slate-200 bg-slate-50",
										)}
									>
										<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/10 text-sky-400">
											<Image className="h-6 w-6" />
										</div>
										<p className="mt-3 text-sm font-medium">No posts yet</p>
										<p className={cn("mt-1 text-sm", subtleText)}>
											Create your first post to populate this list.
										</p>
									</div>
								) : (
									<Reorder.Group axis="y" values={posts} onReorder={setPosts} className="space-y-4">
										{posts.map((post) => (
											<Reorder.Item key={post.id} value={post}>
												<article
													className={cn(
														"rounded-3xl border p-4 transition hover:-translate-y-0.5 hover:shadow-xl",
														theme === "dark"
															? "border-white/10 bg-slate-950/40"
															: "border-slate-200 bg-white",
													)}
												>
													<div className="flex items-start justify-between gap-3">
														<div className="min-w-0">
															<h3 className="truncate text-base font-semibold">{post.title}</h3>
															<p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">
																{post.category || "Uncategorized"}
															</p>
														</div>
														<div className="flex items-center gap-2">
															<button
																type="button"
																onClick={() => editPost(post)}
																className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-300 transition hover:bg-sky-500/15"
															>
																<Pencil className="h-4 w-4" />
																Edit
															</button>
														<button
															type="button"
															onClick={() => setConfirmDelete(post)}
															className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/25 hover:text-red-200"
														>
															<Trash2 className="h-4 w-4" />
															Delete
														</button>
														</div>
													</div>

													<p className={cn("mt-3 line-clamp-3 text-sm leading-6", subtleText)}>
														{post.caption || "No caption provided."}
													</p>

													<div className="mt-4 flex items-center justify-between gap-3 text-xs">
														<div
															className={cn(
																"inline-flex items-center gap-2 rounded-full border px-3 py-1.5",
																theme === "dark"
																	? "border-white/10 bg-white/5 text-slate-300"
																	: "border-slate-200 bg-slate-50 text-slate-600",
															)}
														>
															<span className="h-2 w-2 rounded-full bg-sky-400" />
															Created {timeAgo(post.createdAt)}
														</div>
														<div className="text-sky-400/90">Published</div>
													</div>
												</article>
											</Reorder.Item>
										))}
									</Reorder.Group>
								)}
							</div>
						</section>
					</div>
				</div>
			</div>

			{confirmDelete && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
					<div className={cn("w-full max-w-md rounded-3xl border p-6 shadow-2xl", panelBg)}>
						<div className="flex items-center gap-3 mb-4">
							<div className="grid h-10 w-10 place-items-center rounded-2xl bg-red-500/15 text-red-400">
								<Trash2 className="h-5 w-5" />
							</div>
							<div>
								<h3 className="text-lg font-semibold">Delete Post</h3>
								<p className={cn("text-sm", subtleText)}>This action cannot be undone.</p>
							</div>
						</div>
						<p className={cn("text-sm mb-5", subtleText)}>
							Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-white">"{confirmDelete.title}"</span>?
						</p>
						<div className="flex gap-3 justify-end">
							<button
								type="button"
								onClick={() => setConfirmDelete(null)}
								className={cn(
									"inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition",
									panelBg,
								)}
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={() => {
									deletePost(confirmDelete.id);
									setConfirmDelete(null);
								}}
								className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
							>
								<Trash2 className="h-4 w-4" />
								Delete
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function Field({ label, required, className, children }) {
	return (
		<div className={className}>
			<label className="mb-2 block text-sm font-medium">
				{label} {required ? <span className="text-sky-400">*</span> : null}
			</label>
			{children}
		</div>
	);
}

function InfoRow({ label, value }) {
	return (
		<div className="flex flex-col gap-1 rounded-2xl border border-white/5 bg-white/5 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
			<span className="text-xs font-semibold uppercase tracking-wide text-sky-400">{label}</span>
			<span className="text-sm text-slate-300 sm:text-right">{value}</span>
		</div>
	);
}
