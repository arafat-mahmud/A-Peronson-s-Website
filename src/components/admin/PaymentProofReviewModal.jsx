import { X } from "lucide-react";
import { useState } from "react";
import { ThreeDot } from "react-loading-indicators";
import { apiRequest, getToken } from "../../lib/auth.js";
import { logger } from "../../lib/logger.js";
import LazyImage from "../ui/LazyImage.jsx";

export default function PaymentProofReviewModal({ proof, onClose, onReview, adminDark }) {
	const [status, setStatus] = useState("");
	const [reason, setReason] = useState("");
	const [busy, setBusy] = useState(false);

	const isBank = proof?.type === "bank_transfer";
	const statusOptions = isBank
		? [
				{ value: "received", label: "Mark as Received", color: "text-emerald-500" },
				{ value: "not_received", label: "Mark as Not Received", color: "text-rose-500" },
			]
		: [
				{ value: "accepted", label: "Accept LC", color: "text-emerald-500" },
				{ value: "rejected", label: "Reject LC", color: "text-rose-500" },
			];

	if (!proof) return null;

	const handleSubmit = async () => {
		if (!status) return;
		setBusy(true);
		try {
			await apiRequest("/admin/actions", {
				method: "POST",
				token: getToken(),
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "payment_proof.review",
					payload: { proof_id: proof.id, status, review_reason: reason },
				}),
			});
			onReview?.();
			onClose();
		} catch (err) {
			logger.error("Review failed", err);
		} finally {
			setBusy(false);
		}
	};

	const overlayClass = adminDark
		? "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
		: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4";
	const panelClass = adminDark
		? "relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl"
		: "relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl";
	const inputClass = adminDark
		? "w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/60"
		: "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400/60";
	const labelClass =
		"text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
	const valueClass = "text-sm text-slate-900 dark:text-white";

	return (
		<div className={overlayClass} onClick={onClose}>
			<div className={panelClass} onClick={(e) => e.stopPropagation()}>
				<button
					type="button"
					onClick={onClose}
					className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:text-slate-600"
				>
					<X size={18} />
				</button>

				<p className="text-base font-bold text-slate-900 dark:text-white">Review Payment Proof</p>
				<p className="mt-1 text-xs text-slate-500">
					{isBank ? "Bank Transfer" : "Letter of Credit"} · {proof.id?.slice(0, 12)}...
				</p>

				{proof.document_url ? (
					<div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
						<p className={`${labelClass} px-3 pt-2`}>Document</p>
						{proof.document_url.match(/\.(png|jpg|jpeg|gif|webp)/i) ? (
							<LazyImage
								src={proof.document_url}
								alt="Payment proof document"
								width={400}
								height={192}
								className="max-h-48 w-full object-contain"
							/>
						) : (
							<a
								href={proof.document_url}
								target="_blank"
								rel="noopener noreferrer"
								className="block px-3 py-2 text-xs text-indigo-500 underline"
							>
								Open document ↗
							</a>
						)}
					</div>
				) : null}

				<div className="mt-4 grid grid-cols-2 gap-3 text-xs">
					<div>
						<p className={labelClass}>Transaction Ref</p>
						<p className={valueClass}>{proof.transaction_reference || proof.lc_number || "—"}</p>
					</div>
					<div>
						<p className={labelClass}>Amount</p>
						<p className={valueClass}>
							{proof.amount ? `${proof.amount} ${proof.currency || ""}` : "—"}
						</p>
					</div>
					<div>
						<p className={labelClass}>{isBank ? "Bank Name" : "Issuing Bank"}</p>
						<p className={valueClass}>{proof.bank_name || proof.issuing_bank || "—"}</p>
					</div>
					<div>
						<p className={labelClass}>{isBank ? "Sender" : "Applicant"}</p>
						<p className={valueClass}>{proof.sender_account_name || proof.applicant_name || "—"}</p>
					</div>
					<div>
						<p className={labelClass}>{isBank ? "Receiver" : "Beneficiary"}</p>
						<p className={valueClass}>
							{proof.receiver_account_name || proof.beneficiary_name || "—"}
						</p>
					</div>
					<div>
						<p className={labelClass}>Date</p>
						<p className={valueClass}>
							{proof.transaction_date
								? new Date(proof.transaction_date).toLocaleDateString()
								: proof.issue_date
									? new Date(proof.issue_date).toLocaleDateString()
									: "—"}
						</p>
					</div>
					{proof.lc_type ? (
						<div>
							<p className={labelClass}>LC Type</p>
							<p className={valueClass}>
								{String(proof.lc_type).toUpperCase()}
								{proof.lc_type === "usance" && proof.usance_days ? ` (${proof.usance_days}d)` : ""}
							</p>
						</div>
					) : null}
					{proof.expiry_date ? (
						<div>
							<p className={labelClass}>Expiry</p>
							<p className={valueClass}>{new Date(proof.expiry_date).toLocaleDateString()}</p>
						</div>
					) : null}
					<div>
						<p className={labelClass}>Current Status</p>
						<p className={`${valueClass} capitalize`}>{proof.status?.replace(/_/g, " ") || "—"}</p>
					</div>
				</div>

				<div className="mt-5 space-y-3">
					<div>
						<p className={labelClass}>Review Decision</p>
						<div className="mt-1 flex gap-2">
							{statusOptions.map((opt) => (
								<button
									key={opt.value}
									type="button"
									onClick={() => setStatus(opt.value)}
									disabled={busy}
									className={`rounded-xl border px-4 py-2 text-xs font-semibold transition ${
										status === opt.value
											? "border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-500 dark:bg-sky-900/30 dark:text-sky-300"
											: "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400"
									}`}
								>
									{opt.label}
								</button>
							))}
						</div>
					</div>

					<div>
						<p className={labelClass}>Review Note</p>
						<textarea
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							rows={3}
							placeholder="Optional reason for this decision..."
							className={`mt-1 resize-none ${inputClass}`}
						/>
					</div>
				</div>

				<div className="mt-5 flex items-center justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="rounded-2xl border border-slate-200 px-5 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-400"
					>
						Cancel
					</button>
					<button
						type="button"
						disabled={!status || busy}
						onClick={handleSubmit}
						className="rounded-2xl bg-sky-500 px-5 py-2 text-xs font-semibold text-white transition hover:bg-sky-600 disabled:opacity-40"
					>
						{busy ? <ThreeDot variant3={true} color="#fff" size={14} /> : "Submit Review"}
					</button>
				</div>
			</div>
		</div>
	);
}
