import { EllipsisVertical, MessageCircle, Phone, Plus, Search, SendHorizontal } from "lucide-react";
import { ThreeDot } from "react-loading-indicators";
import { Link } from "react-router-dom";
import JourneyTimeline from "../../components/JourneyTimeline.jsx";
import LazyImage from "../../components/ui/LazyImage.jsx";
import UploadProgressBar from "../../components/ui/UploadProgressBar.jsx";
import { ROUTES } from "../../lib/routes.js";
import {
	dateDividerLabel,
	formatPresence,
	formatTime,
	getInitials,
	getTimezoneAbbr,
	lockStatusLabel,
} from "./chatUtils.js";

export default function MessageArea({
	activeThread,
	activeMessages,
	draftMessage,
	setDraftMessage,
	canSendMessage,
	isLockRestricted,
	isLockOwner,
	isAdminUser,
	isLight,
	theme,
	currentUser,
	activeAvatar,
	activeThreadDisplayName,
	presenceStatus,
	presenceLastSeen,
	lockMeta,
	hasRecordedCall,
	scheduleStatus,
	uploading,
	uploadProgress,
	uploadStatus,
	policyFeedback,
	countdownSeconds,
	aiSuggesting,
	aiError,
	sendMessage,
	sendAttachment,
	openAttachmentPreview,
	requestAiSuggestion,
	prequalNeedsInfo,
	prequalHardBlocked,
	prequalCanOverride,
	prequal,
	notice,
	renderMessageBody,
	openGrantModal,
	openTransferModal,
	startInstantCall,
	requestAccess,
	setPrequalOverride,
	fileInputRef,
}) {
	const activeThreadInitials = getInitials(activeThreadDisplayName);
	const todayLabel = dateDividerLabel(activeMessages.at(-1)?.timestamp);
	const timezoneAbbr = getTimezoneAbbr();

	return (
		<main
			class="rounded-[24px] p-0 flex flex-col h-full overflow-hidden shadow-borderless dark:shadow-borderlessDark"
			style={{ background: theme.panelBg, boxShadow: theme.shadow }}
		>
			{activeThread ? (
				<>
					<div class="flex items-center justify-between px-6 py-4 shadow-dividerB dark:shadow-dividerBDark">
						<div class="flex items-center gap-3">
							<div class="relative">
								{activeAvatar ? (
									<LazyImage
										src={activeAvatar}
										alt={activeThreadDisplayName}
										width={40}
										height={40}
										class="h-10 w-10 rounded-full object-cover shadow-sm"
										eager={true}
									/>
								) : (
									<div class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
										{activeThreadInitials}
									</div>
								)}
								<span
									class="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full"
									style={{
										background:
											presenceStatus(activeThread?.senderId) === "online" ? "#22c55e" : "#94a3b8",
										boxShadow: `0 0 0 2px ${isLight ? "#e2e8f0" : "rgba(255,255,255,0.18)"}`,
									}}
								/>
							</div>
							<div>
								<p class="text-sm font-bold tracking-tight">{activeThreadDisplayName}</p>
								<p class="text-[11px] font-medium text-slate-400">
									{presenceStatus(activeThread?.senderId) === "online"
										? "Online"
										: formatPresence(presenceLastSeen(activeThread?.senderId))}
								</p>
								{lockMeta && !activeThread?.isFriendThread ? (
									<span class="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
										{lockStatusLabel(lockMeta, activeThread)}
									</span>
								) : null}
							</div>
						</div>
						<div class="flex items-center gap-3">
							<Link
								to={
									activeThread?.matchId
										? `${ROUTES.CONTRACTS}?journey_match_id=${encodeURIComponent(activeThread.matchId)}`
										: ROUTES.CONTRACTS
								}
								class="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-800/40"
							>
								Contract draft
							</Link>
							{isLockOwner ? (
								<button
									onClick={openGrantModal}
									class="rounded-full shadow-borderless dark:shadow-borderlessDark px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60"
									title="Grant access to another member"
								>
									Grant access
								</button>
							) : null}
							{isLockOwner || isAdminUser ? (
								<button
									onClick={openTransferModal}
									class="rounded-full shadow-borderless dark:shadow-borderlessDark px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60"
									title="Transfer this conversation to another agent"
								>
									Transfer
								</button>
							) : null}
							<button
								onClick={() => startInstantCall(activeThread)}
								class="flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-slate-400 transition-colors hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800/50"
								title="Start call"
							>
								<Phone size={16} />
							</button>
							<button class="flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-slate-400 transition-colors hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800/50">
								<Search size={16} />
							</button>
							<button class="flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-slate-400 transition-colors hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800/50">
								<EllipsisVertical size={16} />
							</button>
						</div>
					</div>

					<div class="px-6 pb-3">
						<JourneyTimeline title="Journey Timeline" matchId={activeThread?.matchId || ""} />
					</div>

					{hasRecordedCall ? null : (
						<div class="mx-6 mt-4 rounded-xl shadow-borderless dark:shadow-borderlessDark bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
							<div class="flex flex-wrap items-center justify-between gap-3">
								<span>
									Video calls are recommended for trust. No recorded call exists yet for this
									conversation.
								</span>
								<button
									type="button"
									onClick={() => startInstantCall(activeThread)}
									class="rounded-full bg-amber-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-amber-500"
								>
									Start call
								</button>
							</div>
						</div>
					)}

					<div
						data-lenis-prevent={true}
						class="flex-1 space-y-4 overflow-auto p-6 custom-scrollbar"
						style={{ background: isLight ? "#f8fafc" : "transparent" }}
					>
						<div class="flex justify-center mb-6">
							<span class="rounded-full bg-transparent shadow-borderless dark:shadow-borderlessDark px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">
								{todayLabel}
							</span>
						</div>
						{activeMessages.length > 0 ? (
							activeMessages.map((message) => {
								const isOwn = message.sender_id === currentUser?.id;
								const isBot = message?.type === "bot" || Boolean(message?.meta?.bot);
								const readCutoff = activeThread?.lastReadAt
									? new Date(activeThread.lastReadAt).getTime()
									: 0;
								const messageTs = new Date(message.timestamp || 0).getTime();
								const isRead =
									Number.isFinite(readCutoff) &&
									Number.isFinite(messageTs) &&
									messageTs <= readCutoff;
								const showReadTick = !isOwn && isRead;
								return (
									<div key={message.id} class={`flex${isOwn ? "justify-end" : "justify-start"}`}>
										<div
											class={`group relative max-w-[80%] sm:max-w-[70%] rounded-[20px] px-4 py-3 text-[13.5px] shadow-sm transition-all ${
												isOwn
													? "bg-gtBlue text-white rounded-br-none"
													: isBot
														? `${isLight ? "bg-[var(--theme-blue-50)] ring-1 ring-[var(--theme-blue-200)]" : "bg-[var(--theme-custom-0b1224)] ring-1 ring-white/5"} rounded-bl-none`
														: `${isLight ? "bg-white ring-1 ring-slate-200/70" : "bg-[var(--theme-custom-2a2744)]"} rounded-bl-none`
											}`}
											style={isOwn ? undefined : { color: theme.textPrimary }}
										>
											{isBot ? (
												<div class="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-gtBlue">
													AI Assistant
												</div>
											) : null}
											{renderMessageBody(message, isOwn)}
											<div
												class={`mt-1 flex items-center gap-2 text-[10px] font-medium opacity-0 transition-opacity group-hover:opacity-60${isOwn ? "text-white" : "text-slate-400"}`}
											>
												<span>
													{formatTime(message.timestamp)}
													{timezoneAbbr ? ` ${timezoneAbbr}` : ""}
												</span>
												{message.policy_status && message.policy_status !== "delivered" ? (
													<span class="inline-flex items-center rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600">
														{message.policy_status === "needs_review" ? "Needs review" : "Queued"}
													</span>
												) : null}
												{message.policy_priority ? (
													<span class="inline-flex items-center rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-600">
														{message.policy_priority}
													</span>
												) : null}
												{showReadTick ? (
													<span class="inline-flex items-center rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600">
														✓ Read
													</span>
												) : null}
											</div>
										</div>
									</div>
								);
							})
						) : (
							<div class="flex h-full items-center justify-center text-sm font-medium text-slate-400 italic">
								No messages yet. Start the conversation!
							</div>
						)}
					</div>

					<div class="p-4 shadow-dividerT dark:shadow-dividerTDark">
						{isLockRestricted ? (
							<div class="mb-3 flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
								<span>
									Conversation locked by{" "}
									{lockMeta?.claimed_by_name ||
										(lockMeta?.lock_type === "verified_first"
											? "verified supplier"
											: "another agent")}
									.
								</span>
								<button
									type="button"
									onClick={requestAccess}
									class="rounded-full bg-amber-600 px-3 py-1 text-[11px] font-semibold text-white"
								>
									Request access
								</button>
							</div>
						) : null}
						{prequalNeedsInfo ? (
							<div class="mb-3 rounded-xl shadow-borderless dark:shadow-borderlessDark bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<span>
										AI pre-qual flagged missing info.{" "}
										{prequal?.missing
											? `Missing: ${prequal.missing}.`
											: "Request more details before negotiating."}
									</span>
									{prequalCanOverride ? (
										<button
											type="button"
											onClick={() => setPrequalOverride(true)}
											class="rounded-full bg-amber-600 px-3 py-1 text-[11px] font-semibold text-white"
										>
											Allow send anyway
										</button>
									) : null}
								</div>
								{prequalHardBlocked ? (
									<div class="mt-1 text-[10px] text-amber-800">
										Only verified suppliers can override this pre-qualification gate.
									</div>
								) : null}
							</div>
						) : null}
						<div class="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-500">
							<span>AI Suggested Reply</span>
							<button
								type="button"
								onClick={requestAiSuggestion}
								disabled={aiSuggesting || !activeThread?.matchId}
								class="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
							>
								{aiSuggesting ? (
									<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
								) : (
									"Generate"
								)}
							</button>
						</div>
						{aiError ? (
							<div class="mb-2 text-[11px] font-semibold text-rose-600">{aiError}</div>
						) : null}
						<div
							class="relative flex items-center gap-2 rounded-[18px] p-1.5"
							style={{ background: theme.inputBg }}
						>
							<button
								class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
								onClick={() => fileInputRef.current?.click()}
								disabled={uploading || !canSendMessage}
							>
								{uploading ? (
									<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
								) : (
									<Plus size={20} />
								)}
							</button>
							<textarea
								rows={1}
								class="flex-1 resize-none bg-transparent px-2 py-2 text-[14px] leading-5 outline-none placeholder:text-slate-400"
								style={{ color: theme.textPrimary, maxHeight: 140 }}
								placeholder={
									canSendMessage
										? "Write a message..."
										: "Conversation locked. Request access to reply."
								}
								disabled={!canSendMessage}
								value={draftMessage}
								onChange={(event) => setDraftMessage(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter" && !event.shiftKey) {
										event.preventDefault();
										sendMessage();
									}
								}}
							/>
							<input
								ref={fileInputRef}
								type="file"
								class="hidden"
								onChange={(event) => {
									const file = event.target.files?.[0];
									if (file) {
										sendAttachment(file);
									}
								}}
								disabled={!canSendMessage}
							/>
							<button
								class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gtBlue text-white shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
								onClick={sendMessage}
								disabled={!canSendMessage}
							>
								<SendHorizontal size={18} />
							</button>
						</div>
						{policyFeedback.reason ? (
							<p class="mt-2 px-4 text-[11px] font-medium text-rose-500">
								Blocked: {policyFeedback.reason}
								{countdownSeconds > 0 ? ` • Retry in ${countdownSeconds}s` : ""}
							</p>
						) : null}
						{uploading && (
							<div class="px-4 mt-2">
								<UploadProgressBar progress={uploadProgress} />
							</div>
						)}
						{uploadStatus || scheduleStatus ? (
							<p class="mt-2 px-4 text-[11px] font-medium text-gtBlue">
								{uploadStatus || scheduleStatus}
							</p>
						) : null}
					</div>
				</>
			) : (
				<div class="flex h-full flex-col items-center justify-center text-slate-400 gap-4">
					<div class="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center dark:bg-slate-800/30">
						<MessageCircle size={32} class="opacity-20" />
					</div>
					<p class="text-sm font-medium">Select a conversation to start chatting</p>
				</div>
			)}
		</main>
	);
}
