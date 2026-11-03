import { ExternalLink, Film, Image } from "lucide-react";
import { Mosaic } from "react-loading-indicators";
import { apiRequest, getToken } from "../../../lib/auth.js";
import LazyImage from "../../../components/ui/LazyImage.jsx";

export function AdminMediaReviewSection({
	adminDark,
	moderationPending,
	loadingModeration,
	setModerationPending,
	setAiModalDoc,
	setRejectionModalOpen,
	setRejectionItem,
}) {
	return (
		<div className="space-y-4 p-4">
			<h2 className={`text-xl font-semibold ${adminDark ? "text-white" : "text-slate-900"}`}>
				Media Review
			</h2>
			<p className={`text-sm ${adminDark ? "text-slate-400" : "text-slate-500"}`}>
				Approve or reject uploaded media
			</p>

			{loadingModeration ? (
				<div className="flex items-center justify-center py-16">
					<Mosaic color="#337ab0" size="large" style={{ fontSize: "40px" }} text="" textColor="" />
				</div>
			) : moderationPending.length > 0 ? (
				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
					{moderationPending.slice(0, 20).map((doc) => {
						const aiLabel = doc.ai_label || "PENDING";
						const isAutoApproved = doc.ai_auto_approved === true || doc.ai_auto_approved === "true";
						return (
							<div key={doc.id} className="relative group">
								{doc.public_url ? (
									doc.type === "video" ? (
										<div className="w-full aspect-square bg-slate-800 rounded-xl overflow-hidden relative">
											<video
												src={doc.public_url}
												className="w-full h-full object-cover"
												preload="metadata"
											/>
											<div className="absolute top-2 right-2 z-10">
												<button
													onClick={(e) => {
														e.stopPropagation();
														window.open(doc.public_url, "_blank");
													}}
													className="bg-black/70 text-white px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 hover:bg-black/90 cursor-pointer backdrop-blur-sm"
												>
													<ExternalLink className="h-3 w-3" />
													{/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "Open" : "Play"}
												</button>
											</div>
										</div>
									) : (
										<LazyImage
											src={doc.public_url}
											alt={doc.title || "Media"}
											width={300}
											height={300}
											className="w-full aspect-square object-cover rounded-xl"
											onError={(e) => {
												e.target.style.display = "none";
												e.target.nextSibling.style.display = "flex";
											}}
										/>
									)
								) : null}
								<div
									className="w-full aspect-square bg-slate-200 dark:bg-slate-800 rounded-xl flex items-center justify-center"
									style={{
										display: doc.public_url ? "none" : undefined,
									}}
								>
									{doc.type === "video" ? (
										<Film className="h-10 w-10 text-slate-400" />
									) : (
										<Image className="h-10 w-10 text-slate-400" />
									)}
								</div>
								{aiLabel !== "PENDING" && (
									<div
										className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold ${
											aiLabel === "HIGH RISK"
												? "bg-red-600 text-white"
												: aiLabel === "HARAM"
													? "bg-orange-500 text-white"
													: aiLabel === "QUESTIONABLE"
														? "bg-yellow-500 text-slate-900"
														: "bg-emerald-500 text-white"
										}`}
									>
										AI: {aiLabel}
									</div>
								)}
								<div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex flex-col items-center justify-center gap-1.5 p-2">
									<button
										onClick={() => setAiModalDoc(doc)}
										className="bg-sky-600 text-white px-3 py-1 rounded-lg text-xs font-medium w-[calc(100%-24px)] hover:bg-sky-700"
									>
										Details
									</button>
									{!isAutoApproved && (
										<button
											onClick={async () => {
												await apiRequest(`/admin/media/${doc.id}/approve`, {
													method: "PATCH",
													token: getToken(),
												});
												setModerationPending((prev) => prev.filter((d) => d.id !== doc.id));
											}}
											className="bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs font-medium w-[calc(100%-24px)] hover:bg-emerald-600"
										>
											Approve
										</button>
									)}
									<button
										onClick={() => {
											setRejectionModalOpen(true);
											setRejectionItem(doc);
										}}
										className="bg-red-500 text-white px-3 py-1 rounded-lg text-xs font-medium w-[calc(100%-24px)] hover:bg-red-600"
									>
										Reject
									</button>
								</div>
							</div>
						);
					})}
				</div>
			) : (
				<div className={`text-center py-12 ${adminDark ? "text-slate-400" : "text-slate-500"}`}>
					No pending media for review
				</div>
			)}
		</div>
	);
}

export default AdminMediaReviewSection;
