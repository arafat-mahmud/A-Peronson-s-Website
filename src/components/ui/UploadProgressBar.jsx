export default function UploadProgressBar({ progress, className = "" }) {
	if (progress === null || progress === undefined || progress < 0) {
		return null;
	}
	return (
		<div
			className={`h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 ${className}`}
		>
			<div
				className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-300"
				style={{ width: `${Math.min(progress, 100)}%` }}
			/>
		</div>
	);
}
