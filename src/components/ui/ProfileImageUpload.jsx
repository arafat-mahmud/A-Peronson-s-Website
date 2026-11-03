import { useRef, useState } from "react";
import { ThreeDot } from "react-loading-indicators";
import { getToken } from "../../lib/auth.js";
import { uploadFile } from "../../lib/upload.js";
import LazyImage from "./LazyImage.jsx";
import UploadProgressBar from "./UploadProgressBar.jsx";

export default function ProfileImageUpload({ value = "", onChange, label = "Profile image" }) {
	const [uploading, setUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [error, setError] = useState("");
	const fileInputRef = useRef(null);

	const handleFileSelect = async (e) => {
		const file = e.target.files?.[0];
		if (!file) {
			return;
		}

		const validTypes = [
			"image/jpeg",
			"image/png",
			"image/webp",
			"image/avif",
			"image/gif",
			"image/apng",
			"image/bmp",
			"image/x-ms-bmp",
			"image/tiff",
			"image/heic",
			"image/heif",
			"image/svg+xml",
			"image/x-tga",
			"image/vnd.adobe.photoshop",
			"image/x-photoshop",
			"image/x-xcf",
			"image/x-coreldraw",
			"image/x-adobe-dng",
			"image/x-canon-cr2",
			"image/x-canon-cr3",
			"image/x-nikon-nef",
			"image/x-sony-arw",
			"image/x-sony-sr2",
			"image/x-olympus-orf",
			"image/x-fuji-raf",
			"image/x-eps",
			"application/postscript",
			"application/pdf",
			"application/dicom",
			"application/x-coreldraw",
		];
		if (!validTypes.includes(file.type)) {
			setError("Unsupported image format");
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			setError("File size must be less than 5MB");
			return;
		}

		setUploading(true);
		setError("");

		try {
			setUploadProgress(0);
			const token = getToken();
			const data = await uploadFile("/users/me/avatar", {
				file,
				token,
				onProgress: setUploadProgress,
			});
			onChange(data.avatar_url || data.profile_image);
		} catch (err) {
			setError(err.message || "Unable to upload image");
		} finally {
			setUploading(false);
			setUploadProgress(0);
		}
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					disabled={uploading}
					className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
				>
					{uploading ? (
						<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
					) : (
						"Choose Image"
					)}
				</button>
				{uploading && <UploadProgressBar progress={uploadProgress} className="w-40" />}
				<input
					ref={fileInputRef}
					type="file"
					accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/apng,image/bmp,image/x-ms-bmp,image/tiff,image/heic,image/heif,image/svg+xml,image/x-tga,image/vnd.adobe.photoshop,image/x-photoshop,image/x-xcf,image/x-coreldraw,image/x-adobe-dng,image/x-canon-cr2,image/x-canon-cr3,image/x-nikon-nef,image/x-sony-arw,image/x-sony-sr2,image/x-olympus-orf,image/x-fuji-raf,image/x-eps,application/postscript,application/pdf,application/dicom,application/x-coreldraw,.jpg,.jpeg,.png,.webp,.avif,.gif,.apng,.bmp,.tiff,.tif,.heic,.heif,.dcm,.tga,.svg,.eps,.pdf,.dng,.cr2,.cr3,.nef,.arw,.sr2,.orf,.raf,.psd,.ai,.xcf,.cdr"
					onChange={handleFileSelect}
					className="hidden"
				/>
			</div>

			{error && (
				<div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
					{error}
				</div>
			)}

			{value && (
				<div className="flex items-center gap-3">
					<LazyImage
						src={value}
						alt="Profile preview"
						width={64}
						height={64}
						className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-200/60 dark:ring-slate-800"
						onError={(e) => {
							e.target.style.display = "none";
						}}
					/>
					<span className="text-xs text-slate-500">Image set</span>
				</div>
			)}
		</div>
	);
}
