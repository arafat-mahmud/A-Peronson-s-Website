import AnimatedModal from "./AnimatedModal.jsx";

/**
 * Renders a confirmation dialog component.
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the dialog is open.
 * @param {Function} props.onClose - Function to call when the dialog should close.
 * @param {Function} props.onConfirm - Function to call when confirmed.
 * @param {string} props.title - The title of the dialog.
 * @param {string} props.message - The message of the dialog.
 * @param {string} [props.confirmLabel="Confirm"] - The confirm button label.
 * @param {string} [props.cancelLabel="Cancel"] - The cancel button label.
 * @param {boolean} [props.destructive=false] - Whether the action is destructive.
 * @returns {JSX.Element} The rendered confirmation dialog component.
 */
export default function ConfirmDialog({
	open,
	onClose,
	onConfirm,
	title,
	message,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	destructive = false,
}) {
	return (
		<AnimatedModal
			open={open}
			onClose={onClose}
			className="w-[90vw] max-w-sm p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700"
		>
			<h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
			<p className="text-sm text-slate-600 dark:text-slate-400 mb-6">{message}</p>
			<div className="flex gap-3 justify-end">
				<button
					type="button"
					onClick={onClose}
					className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
				>
					{cancelLabel}
				</button>
				<button
					type="button"
					onClick={() => {
						onConfirm();
						onClose();
					}}
					className={`px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors ${
						destructive ? "bg-red-500 hover:bg-red-600" : "bg-sky-500 hover:bg-sky-600"
					}`}
				>
					{confirmLabel}
				</button>
			</div>
		</AnimatedModal>
	);
}
