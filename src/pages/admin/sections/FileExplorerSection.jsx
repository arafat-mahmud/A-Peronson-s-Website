import {
	Copy,
	ExternalLink,
	File,
	FileText,
	Film,
	FolderOpen,
	Grid3X3,
	Image,
	List,
	RefreshCw,
	Search,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Mosaic, ThreeDot } from "react-loading-indicators";
import ConfirmDialog from "../../../components/ConfirmDialog.jsx";
import { useToast } from "../../../components/ToastContainer.jsx";
import LazyImage from "../../../components/ui/LazyImage.jsx";
import { apiRequest, getToken } from "../../../lib/auth.js";
import { logger } from "../../../lib/logger.js";

const FOLDER_CONFIG = [
	{ id: "all", label: "All Files", icon: FolderOpen },
	{ id: "root", label: "Product Media", icon: Image },
	{ id: "profile", label: "Profile", icon: FileText },
	{ id: "chat", label: "Chat", icon: FileText },
	{ id: "feed", label: "Feed", icon: Film },
	{ id: "calls", label: "Calls", icon: Film },
	{ id: "contracts", label: "Contracts", icon: FileText },
];

function _formatDate(dateStr) {
	if (!dateStr) {
		return "";
	}
	const d = new Date(dateStr);
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function FileThumbnailImage({ file, onContextMenu }) {
	const [imgError, setImgError] = useState(false);
	return (
		<div
			className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 cursor-pointer group"
			onContextMenu={onContextMenu}
		>
			{!imgError && (
				<LazyImage
					src={file.path}
					alt={file.filename}
					width={300}
					height={300}
					className="h-full w-full object-cover transition-transform group-hover:scale-105"
					onError={() => setImgError(true)}
				/>
			)}
			{imgError && (
				<div className="absolute inset-0 flex items-center justify-center">
					<Image className="h-12 w-12 text-slate-400" />
				</div>
			)}
		</div>
	);
}

export function FileThumbnailVideo({ onContextMenu }) {
	return (
		<div
			className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center cursor-pointer group"
			onContextMenu={onContextMenu}
		>
			<Film className="h-12 w-12 text-slate-400" />
			<div className="absolute inset-0 flex items-center justify-center bg-black/20">
				<div className="h-10 w-10 rounded-full bg-black/60 flex items-center justify-center">
					<div className="h-0 w-0 border-l-8 border-l-white border-t-5 border-t-transparent border-b-5 border-b-transparent ml-1" />
				</div>
			</div>
		</div>
	);
}

export function FileThumbnailDoc({ _file, onContextMenu }) {
	return (
		<div
			className="relative aspect-square w-full overflow-hidden rounded-xl flex items-center justify-center cursor-pointer group bg-slate-100 dark:bg-slate-800"
			onContextMenu={onContextMenu}
		>
			<FileText className="h-12 w-12 text-slate-400" />
		</div>
	);
}

export function FileThumbnailOther({ onContextMenu }) {
	return (
		<div
			className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center cursor-pointer group"
			onContextMenu={onContextMenu}
		>
			<File className="h-12 w-12 text-slate-400" />
		</div>
	);
}

export function FileThumbnail({ file, onContextMenu }) {
	switch (file.type) {
		case "image":
			return <FileThumbnailImage file={file} onContextMenu={onContextMenu} />;
		case "video":
			return <FileThumbnailVideo onContextMenu={onContextMenu} />;
		case "document":
			return <FileThumbnailDoc file={file} onContextMenu={onContextMenu} />;
		default:
			return <FileThumbnailOther onContextMenu={onContextMenu} />;
	}
}

export function FileCard({ file, darkMode, viewMode, onContextMenu }) {
	if (viewMode === "list") {
		return (
			<div
				className={`flex items-center gap-3 rounded-xl p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 ${darkMode ? "text-slate-300" : "text-slate-700"}`}
				onContextMenu={onContextMenu}
			>
				<div className="shrink-0">
					{file.type === "image" ? (
						<Image className="h-5 w-5" />
					) : file.type === "video" ? (
						<Film className="h-5 w-5" />
					) : (
						<FileText className="h-5 w-5" />
					)}
				</div>
				<div className="flex-1 min-w-0">
					<p className="truncate text-sm font-medium">{file.filename}</p>
					<p className="text-xs text-slate-500">{file.size_formatted}</p>
				</div>
				<div className="shrink-0 text-xs text-slate-500">{_formatDate(file.modified)}</div>
			</div>
		);
	}
	return (
		<div className="group" onContextMenu={onContextMenu}>
			<FileThumbnail file={file} onContextMenu={onContextMenu} />
			<div className="mt-2">
				<p className="truncate text-xs font-medium">{file.filename}</p>
				<p className="text-[10px] text-slate-500">{file.size_formatted}</p>
			</div>
		</div>
	);
}

export function FolderItem({ folder, isActive, adminDark, count }) {
	const _Icon = folder.icon;
	return (
		<div
			onClick={folder.onClick}
			className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all text-sm ${
				isActive
					? "bg-sky-500/20 text-sky-400"
					: adminDark
						? "text-slate-400 hover:text-white hover:bg-slate-800"
						: "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
			}`}
		>
			<_Icon className="h-4 w-4 shrink-0" />
			<span className="truncate">{folder.label}</span>
			{count !== undefined && <span className="ml-auto text-xs opacity-60">{count}</span>}
		</div>
	);
}

export function EmptyState({ darkMode }) {
	return (
		<div
			className={`flex flex-col items-center justify-center py-16 ${darkMode ? "text-slate-400" : "text-slate-500"}`}
		>
			<FolderOpen className="h-16 w-16 mb-4 opacity-30" />
			<p className="text-sm">No files found</p>
			<p className="text-xs mt-1">Try selecting a different folder or refresh</p>
		</div>
	);
}

export function FileContextMenu({
	file,
	position,
	onClose,
	onView,
	onCopyUrl,
	onDelete,
	darkMode,
}) {
	const menuRef = useRef(null);
	useEffect(() => {
		const handleClickOutside = (e) => {
			if (menuRef.current && !menuRef.current.contains(e.target)) {
				onClose();
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [onClose]);

	return (
		<div
			ref={menuRef}
			className={`fixed z-50 rounded-lg border shadow-xl ${darkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}
			style={{ left: position.x, top: position.y }}
		>
			<button
				onClick={() => {
					onView(file);
					onClose();
				}}
				className={`flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${darkMode ? "text-slate-200" : "text-slate-700"}`}
			>
				<ExternalLink className="h-4 w-4" /> Open
			</button>
			<button
				onClick={() => {
					onCopyUrl(file);
					onClose();
				}}
				className={`flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${darkMode ? "text-slate-200" : "text-slate-700"}`}
			>
				<Copy className="h-4 w-4" /> Copy URL
			</button>
			<button
				onClick={() => {
					onDelete(file);
					onClose();
				}}
				className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
			>
				<Trash2 className="h-4 w-4" /> Delete
			</button>
		</div>
	);
}

export function FileExplorerSection({ adminDark }) {
	const toast = useToast();
	const [files, setFiles] = useState([]);
	const [loading, setLoading] = useState(false);
	const [activeFolder, setActiveFolder] = useState("all");
	const [deleteTarget, setDeleteTarget] = useState(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [viewMode, setViewMode] = useState("grid");
	const [contextMenu, setContextMenu] = useState(null);
	const [stats, setStats] = useState(null);
	const [fileError, setFileError] = useState("");

	const loadFiles = async (folder) => {
		setLoading(true);
		setFileError("");
		try {
			const token = getToken();
			const result = await apiRequest(`/admin/uploads/listing?folder=${folder}`, { token });
			setFiles(result.files || result || []);
		} catch (err) {
			logger.error("Failed to load files:", err);
			setFileError(err.message || "Failed to load files");
		} finally {
			setLoading(false);
		}
	};

	const loadStats = async () => {
		try {
			const token = getToken();
			const result = await apiRequest("/admin/uploads/stats", { token });
			setStats(result);
		} catch (err) {
			logger.error("Failed to load stats:", err);
			setFileError(err.message || "Failed to load stats");
		}
	};

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		loadFiles(activeFolder);
		loadStats();
	}, [
		activeFolder,
		loadStats, // eslint-disable-next-line react-hooks/set-state-in-effect
		loadFiles,
	]);

	const filteredFiles = useMemo(() => {
		if (!searchQuery.trim()) {
			return files;
		}
		const q = searchQuery.toLowerCase();
		return files.filter((f) => f.filename.toLowerCase().includes(q));
	}, [files, searchQuery]);

	const handleContextMenu = (e, file) => {
		e.preventDefault();
		setContextMenu({ file, x: e.clientX, y: e.clientY });
	};

	const handleView = (file) => {
		window.open(file.path, "_blank");
	};

	const handleCopyUrl = (file) => {
		const url = window.location.origin + file.path;
		navigator.clipboard
			.writeText(url)
			.then(() => {
				toast.success("URL copied to clipboard!");
			})
			.catch(() => {
				prompt("Copy this URL:", url);
			});
	};

	const handleDelete = async (file) => {
		setDeleteTarget(file);
	};

	const confirmDelete = async () => {
		if (!deleteTarget) {
			return;
		}
		try {
			const token = getToken();
			await apiRequest("/admin/uploads/file", {
				method: "DELETE",
				token,
				body: { file_path: deleteTarget.path },
			});
			setFiles((prev) => prev.filter((f) => f.path !== deleteTarget.path));
			toast.success("File deleted");
		} catch (err) {
			toast.error(`Failed to delete file: ${err.message || "Unknown error"}`);
		}
		setDeleteTarget(null);
	};

	const panelBg = adminDark ? "bg-slate-950/80" : "bg-white/95";
	const borderColor = adminDark ? "border-slate-800" : "border-slate-200";
	const textPrimary = adminDark ? "text-white" : "text-slate-900";
	const textSecondary = adminDark ? "text-slate-400" : "text-slate-500";
	const inputClass = adminDark
		? "w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-500/60"
		: "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400/60";

	const folderItems = FOLDER_CONFIG.map((folder) => ({
		...folder,
		onClick: () => setActiveFolder(folder.id),
	}));

	return (
		<div className="space-y-4 p-4">
			<div className="flex items-center justify-between">
				<div>
					<h2 className={`text-xl font-semibold ${textPrimary}`}>File Explorer</h2>
					{stats && (
						<p className={`text-sm ${textSecondary}`}>
							{stats.total_files} files · {stats.total_size_formatted}
						</p>
					)}
				</div>
				<button
					onClick={() => loadFiles(activeFolder)}
					className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${adminDark ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
					disabled={loading}
				>
					{loading ? (
						<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
					) : (
						<RefreshCw className="h-4 w-4" />
					)}
					Refresh
				</button>
			</div>

			{fileError ? (
				<div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
					{fileError}
				</div>
			) : null}

			<div className={`flex gap-4 rounded-2xl ${panelBg} border ${borderColor} p-4`}>
				<aside className="w-52 shrink-0">
					<div className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-slate-500">
						Folders
					</div>
					<nav className="space-y-1">
						{folderItems.map((folder) => (
							<FolderItem
								key={folder.id}
								folder={folder}
								isActive={activeFolder === folder.id}
								adminDark={adminDark}
								count={stats?.by_category?.[folder.id]}
							/>
						))}
					</nav>
				</aside>

				<div className="flex-1 min-w-0">
					<div className="mb-4 flex items-center gap-3">
						<div className="relative flex-1">
							<Search
								className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${textSecondary}`}
							/>
							<input
								type="text"
								placeholder="Search files..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className={`${inputClass} pl-10`}
							/>
						</div>
						<div className={`flex items-center rounded-xl border ${borderColor} p-1`}>
							<button
								onClick={() => setViewMode("grid")}
								className={`rounded-lg p-1.5 transition-colors ${viewMode === "grid" ? (adminDark ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-900") : adminDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-700"}`}
							>
								<Grid3X3 className="h-4 w-4" />
							</button>
							<button
								onClick={() => setViewMode("list")}
								className={`rounded-lg p-1.5 transition-colors ${viewMode === "list" ? (adminDark ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-900") : adminDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-700"}`}
							>
								<List className="h-4 w-4" />
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
					) : filteredFiles.length === 0 ? (
						<EmptyState darkMode={adminDark} />
					) : (
						<div
							data-lenis-prevent={true}
							className={`grid gap-3 overflow-auto ${viewMode === "grid" ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "grid-cols-1"}`}
							style={{ maxHeight: "70vh" }}
						>
							{filteredFiles.map((file) => (
								<FileCard
									key={file.path}
									file={file}
									darkMode={adminDark}
									viewMode={viewMode}
									onContextMenu={(e) => handleContextMenu(e, file)}
								/>
							))}
						</div>
					)}
				</div>
			</div>

			{contextMenu && (
				<FileContextMenu
					file={contextMenu.file}
					position={{ x: contextMenu.x, y: contextMenu.y }}
					onClose={() => setContextMenu(null)}
					onView={handleView}
					onCopyUrl={handleCopyUrl}
					onDelete={handleDelete}
					darkMode={adminDark}
				/>
			)}

			<ConfirmDialog
				open={Boolean(deleteTarget)}
				onClose={() => setDeleteTarget(null)}
				onConfirm={confirmDelete}
				title="Delete file"
				message={deleteTarget ? `Delete "${deleteTarget.filename}"? This cannot be undone.` : ""}
				confirmLabel="Delete"
				destructive={true}
			/>
		</div>
	);
}

export default FileThumbnailImage;
