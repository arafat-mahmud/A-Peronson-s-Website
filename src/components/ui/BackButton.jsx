export default function BackButton({
	onClick,
	disabled = false,
	className = "",
	children = "Back",
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={[
				"inline-flex items-center gap-2 font-semibold focus:outline-none",
				"rounded-xl px-3 py-2 transition disabled:opacity-60",
				className,
			].join(" ")}
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				aria-hidden={true}
				className="shrink-0"
			>
				<path
					d="M15 18l-6-6 6-6"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
			<span>{children}</span>
		</button>
	);
}
