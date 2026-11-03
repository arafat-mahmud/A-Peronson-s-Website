import {
	ChevronDown,
	ChevronUp,
	Flag,
	FolderOpen,
	Home,
	Info,
	Lock,
	Plus,
	Search,
	VolumeX,
} from "lucide-react";
import { ThreeDot } from "react-loading-indicators";
import { SignedImage, SignedVideo } from "../../components/chat/SignedMedia.jsx";
import LazyImage from "../../components/ui/LazyImage.jsx";
import { getInitials, isVideoMessage, toAbsoluteAssetUrl, truncateId } from "./chatUtils.js";

export default function RightPanel({
	activeThread,
	activeAvatar,
	activeThreadDisplayName,
	isLight,
	theme,
	leadLoading,
	prequal,
	aiSummary,
	aiSummaryLoading,
	aiSummaryError,
	aiNegotiation,
	aiNegotiationLoading,
	aiNegotiationError,
	accordionState,
	setAccordionState,
	sharedMedia,
	sharedLinks,
	sharedPosts,
	requestAiSummary,
	requestNegotiationHelper,
	openAttachmentPreview,
	userRole,
}) {
	const activeThreadInitials = getInitials(activeThreadDisplayName);

	const isAdmin = ["owner", "admin"].includes(userRole);

	return (
		<aside
			data-lenis-prevent={true}
			className="hidden xl:block rounded-[24px] p-6 h-full overflow-auto shadow-borderless dark:shadow-borderlessDark"
			style={{ background: theme.panelBg, boxShadow: theme.shadow }}
		>
			{activeThread ? (
				<>
					<div className="mb-8 text-center">
						<div className="mx-auto mb-4 h-24 w-24 rounded-full shadow-md">
							{activeAvatar ? (
								<LazyImage
									src={activeAvatar}
									alt={activeThreadDisplayName}
									width={96}
									height={96}
									className="h-full w-full rounded-full object-cover"
									eager={true}
								/>
							) : (
								<div className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-400">
									{activeThreadInitials}
								</div>
							)}
						</div>
						<h3 className="text-lg font-bold tracking-tight">{activeThreadDisplayName}</h3>
						<p className="text-xs font-medium text-slate-400 tracking-wide">
							@{truncateId(activeThread.senderId || activeThread.matchId, 16)}
						</p>
					</div>

					{leadLoading ? (
						<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
					) : prequal ? (
						<div className="mb-6 rounded-2xl shadow-borderless dark:shadow-borderlessDark bg-slate-50 p-3 text-[11px] text-slate-600 dark:bg-slate-800/30">
							<p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
								AI Pre-Qual Summary
							</p>
							<p className="mt-1">
								Score: <span className="font-semibold">{prequal.score ?? "--"}</span>
							</p>
							<p className="mt-1">Missing: {prequal.missing || "None"}</p>
						</div>
					) : null}

					<div className="mb-6 rounded-2xl shadow-borderless dark:shadow-borderlessDark bg-slate-50 p-3 text-[11px] text-slate-600 dark:bg-slate-800/30">
						<div className="flex items-center justify-between gap-2">
							<p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
								AI Conversation Summary
							</p>
							<button
								type="button"
								onClick={requestAiSummary}
								disabled={aiSummaryLoading || !activeThread?.matchId}
								className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
							>
								{aiSummaryLoading ? (
									<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
								) : (
									"Refresh"
								)}
							</button>
						</div>
						{aiSummaryError ? (
							<div className="mt-2 text-[10px] font-semibold text-rose-600">{aiSummaryError}</div>
						) : null}
						{aiSummary?.text ? (
							<>
								<p className="mt-2 whitespace-pre-wrap text-[11px] text-slate-700 dark:text-slate-200">
									{aiSummary.text}
								</p>
								{aiSummary.suggestedReply ? (
									<p className="mt-2 text-[11px] text-slate-500">
										Suggested reply: {aiSummary.suggestedReply}
									</p>
								) : null}
							</>
						) : (
							<p className="mt-2 text-[10px] text-slate-400 italic">No summary yet.</p>
						)}
					</div>

					<div className="mb-6 rounded-2xl shadow-borderless dark:shadow-borderlessDark bg-slate-50 p-3 text-[11px] text-slate-600 dark:bg-slate-800/30">
						<div className="flex items-center justify-between gap-2">
							<p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
								AI Negotiation Helper
							</p>
							<button
								type="button"
								onClick={requestNegotiationHelper}
								disabled={aiNegotiationLoading || !activeThread?.matchId}
								className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
							>
								{aiNegotiationLoading ? (
									<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
								) : (
									"Generate"
								)}
							</button>
						</div>
						{aiNegotiationError ? (
							<div className="mt-2 text-[10px] font-semibold text-rose-600">
								{aiNegotiationError}
							</div>
						) : null}
						{aiNegotiation?.guidance ? (
							<>
								<p className="mt-2 whitespace-pre-wrap text-[11px] text-slate-700 dark:text-slate-200">
									{aiNegotiation.guidance}
								</p>
								{aiNegotiation.suggestedReply ? (
									<p className="mt-2 text-[11px] text-slate-500">
										Suggested reply: {aiNegotiation.suggestedReply}
									</p>
								) : null}
							</>
						) : (
							<p className="mt-2 text-[10px] text-slate-400 italic">
								Generate guidance for this thread.
							</p>
						)}
					</div>

					<div className="mb-8 grid grid-cols-4 gap-3">
						{[
							{
								icon: Flag,
								title: "Report",
								roles: ["buyer", "factory", "buying_house", "agent", "owner", "admin"],
							},
							{
								icon: Lock,
								title: "Block",
								roles: ["buyer", "factory", "buying_house", "agent", "owner", "admin"],
							},
							{
								icon: Info,
								title: "Info",
								roles: ["buyer", "factory", "buying_house", "agent", "owner", "admin"],
							},
							{ icon: VolumeX, title: "Mute", roles: ["owner", "admin"] },
						]
							.filter((action) => action.roles.includes(userRole))
							.map((action, i) => (
								<button
									key={i}
									className="flex flex-col items-center gap-1.5 transition-opacity hover:opacity-70"
									title={action.title}
								>
									<div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-transparent text-slate-400 dark:text-slate-500">
										<action.icon size={16} strokeWidth={2} />
									</div>
								</button>
							))}
					</div>

					<div className="space-y-4">
						{[
							{
								id: "sharedDocument",
								label: "Documents",
								count: sharedLinks.length,
								icon: FolderOpen,
							},
							{
								id: "sharedMedia",
								label: "Media",
								count: sharedMedia.length,
								icon: Search,
							},
							{
								id: "sharedPost",
								label: "Posts",
								count: sharedPosts.length,
								icon: Home,
							},
						].map((section) => (
							<div
								key={section.id}
								className="overflow-hidden rounded-[18px] shadow-borderless dark:shadow-borderlessDark"
							>
								<button
									className="flex w-full items-center justify-between p-4 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
									style={{
										background: isLight ? "#f8fafc" : "#101328",
										color: theme.textMuted,
									}}
									onClick={() =>
										setAccordionState((prev) => ({
											...prev,
											[section.id]: !prev[section.id],
										}))
									}
								>
									<div className="flex items-center gap-2">
										<section.icon size={14} className="opacity-50" />
										<span>
											{section.label} <span className="ml-1 opacity-50">({section.count})</span>
										</span>
									</div>
									{accordionState[section.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
								</button>
								{accordionState[section.id] && (
									<div className="p-3 bg-white dark:bg-transparent">
										{section.id === "sharedDocument" && (
											<div className="space-y-2">
												{sharedLinks.length > 0 ? (
													sharedLinks.map((item) => {
														const url = toAbsoluteAssetUrl(item.attachment?.url || "");
														return (
															<button
																key={item.id}
																type="button"
																onClick={() => openAttachmentPreview(item.attachment, url)}
																className="flex w-full items-center gap-2 rounded-xl shadow-borderless dark:shadow-borderlessDark bg-slate-50/50 p-2.5 text-left text-[11px] font-medium transition-colors dark:bg-slate-800/30"
																title="Preview"
															>
																<div className="h-6 w-6 rounded bg-white flex items-center justify-center shadow-xs dark:bg-slate-700">
																	<Plus size={12} className="opacity-30" />
																</div>
																<span className="truncate flex-1">
																	{item.attachment?.name || "File"}
																</span>
															</button>
														);
													})
												) : (
													<p className="text-[10px] text-slate-400 italic text-center py-2">
														No documents shared
													</p>
												)}
											</div>
										)}
										{section.id === "sharedMedia" && (
											<div className="grid grid-cols-3 gap-1.5">
												{sharedMedia.length > 0 ? (
													sharedMedia.slice(0, 6).map((item) => {
														const url = toAbsoluteAssetUrl(item.attachment?.url || "");
														const isVideo = isVideoMessage(item);
														return (
															<button
																key={item.id}
																type="button"
																onClick={() => openAttachmentPreview(item.attachment, url)}
																className="relative aspect-square overflow-hidden rounded-lg"
																title="View"
															>
																{isVideo ? (
																	<>
																		<SignedVideo
																			src={item.attachment?.url || ""}
																			muted={true}
																			playsInline={true}
																			preload="metadata"
																			className="h-full w-full object-cover"
																		/>
																		<div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
																			<div className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-bold text-white">
																				Play
																			</div>
																		</div>
																	</>
																) : (
																	<SignedImage
																		src={item.attachment?.url || ""}
																		alt="Shared media"
																		width={80}
																		height={80}
																		className="h-full w-full object-cover transition-transform hover:scale-110"
																	/>
																)}
															</button>
														);
													})
												) : (
													<p className="col-span-3 text-[10px] text-slate-400 italic text-center py-2">
														No media shared
													</p>
												)}
											</div>
										)}
										{section.id === "sharedPost" && (
											<div className="space-y-2">
												{sharedPosts.length > 0 ? (
													sharedPosts.map((item) => (
														<div
															key={item.id}
															style={{
																background: isLight ? "#f1f5f9" : "rgba(255,255,255,0.03)",
															}}
														>
															<p className="line-clamp-2 leading-relaxed opacity-80">
																{item.message}
															</p>
														</div>
													))
												) : (
													<p className="text-[10px] text-slate-400 italic text-center py-2">
														No posts shared
													</p>
												)}
											</div>
										)}
									</div>
								)}
							</div>
						))}
					</div>
				</>
			) : (
				<div className="flex h-full flex-col items-center justify-center text-slate-400 text-xs italic">
					Details will appear here
				</div>
			)}
		</aside>
	);
}
