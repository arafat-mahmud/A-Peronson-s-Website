export default function GrantTransferModal({
	showModal,
	mode,
	userId,
	setUserId,
	setShowModal,
	onSubmit,
}) {
	if (!showModal) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
			<div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-950">
				<h3 className="text-lg font-semibold text-slate-900 dark:text-white">
					{mode === "grant" ? "Grant access" : "Transfer conversation"}
				</h3>
				<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
					{mode === "grant"
						? "Enter the user ID to grant access to this conversation."
						: "Enter the agent/user ID to transfer ownership."}
				</p>
				<input
					value={userId}
					onChange={(e) => setUserId(e.target.value)}
					placeholder="User ID"
					className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
				/>
				<div className="mt-5 flex justify-end gap-3">
					<button
						type="button"
						onClick={() => setShowModal(false)}
						className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onSubmit}
						disabled={!userId.trim()}
						className="rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{mode === "grant" ? "Grant" : "Transfer"}
					</button>
				</div>
			</div>
		</div>
	);
}
