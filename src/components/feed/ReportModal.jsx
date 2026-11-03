import { X } from "lucide-react";
import { useMemo, useState } from "react";

const PRESET_REASONS = [
	"Misleading information",
	"Spam or scam",
	"Inappropriate content",
	"Copyright/brand violation",
	"Other",
];

export default function ReportModal({ open, onClose, onSubmit, item }) {
	const [reason, setReason] = useState(PRESET_REASONS[0]);
	const [details, setDetails] = useState("");

	const defaultDetails = useMemo(() => {
		if (!item?.entityType) {
			return "";
		}
		return item.entityType === "buyer_request"
			? "Potentially fake or harmful buying request"
			: "Product post appears misleading or inappropriate";
	}, [item?.entityType]);

	if (!open) {
		return null;
	}

	function submit() {
		const chosen = reason === "Other" ? details.trim() || defaultDetails : reason;
		onSubmit(chosen);
	}

	return (
		<div className="fixed inset-0 z-50">
			<button
				type="button"
				aria-label="Close report modal"
				onClick={onClose}
				className="absolute inset-0 bg-black/40"
			/>
			<div className="absolute left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl shadow-borderless dark:shadow-borderlessDark">
				<header className="flex items-center justify-between px-5 py-4 shadow-dividerB dark:shadow-dividerBDark">
					<div>
						<p className="text-sm font-semibold text-slate-900">Report this post</p>
						<p className="text-[11px] text-slate-500 truncate">{item?.author?.name || "Post"}</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded-full p-2 hover:bg-slate-100"
						aria-label="Close"
					>
						<X size={18} />
					</button>
				</header>

				<div className="p-5 space-y-4">
					<div>
						<label className="block text-xs font-semibold text-slate-700 mb-1">Reason</label>
						<select
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							className="w-full rounded-xl shadow-borderless dark:shadow-borderlessDark bg-white px-3 py-2 text-sm"
						>
							{PRESET_REASONS.map((r) => (
								<option key={r} value={r}>
									{r}
								</option>
							))}
						</select>
					</div>

					{reason === "Other" ? (
						<div>
							<label className="block text-xs font-semibold text-slate-700 mb-1">
								Details (optional)
							</label>
							<textarea
								value={details}
								onChange={(e) => setDetails(e.target.value)}
								placeholder={defaultDetails}
								className="w-full min-h-[96px] rounded-xl shadow-borderless dark:shadow-borderlessDark bg-white px-3 py-2 text-sm"
							/>
						</div>
					) : null}

					<div className="flex gap-2 justify-end">
						<button
							type="button"
							onClick={onClose}
							className="rounded-full px-4 py-2 text-sm font-semibold shadow-borderless dark:shadow-borderlessDark hover:bg-slate-50"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={submit}
							className="rounded-full px-4 py-2 text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700"
						>
							Submit report
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
