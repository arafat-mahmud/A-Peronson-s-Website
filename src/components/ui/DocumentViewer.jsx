import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/auth.js";
import WatermarkOverlay from "./WatermarkOverlay.jsx";

export default function DocumentViewer({ documentId, src, alt, className = "" }) {
	const [viewCount, setViewCount] = useState(null);

	useEffect(() => {
		if (!documentId) return;
		let cancelled = false;
		(async () => {
			try {
				const res = await apiRequest(`/documents/${documentId}/view`, { method: "POST" });
				if (!cancelled && res?.view_count != null) {
					setViewCount(res.view_count);
				}
			} catch {
				// silently ignore — view logging is best-effort
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [documentId]);

	return (
		<div className={`relative overflow-hidden rounded-xl ${className}`}>
			<WatermarkOverlay />
			{src && (
				<img
					src={src}
					alt={alt || "Document"}
					className="w-full h-full object-contain"
					draggable={false}
				/>
			)}
			{viewCount != null && (
				<span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
					{viewCount} view{viewCount !== 1 ? "s" : ""}
				</span>
			)}
		</div>
	);
}
