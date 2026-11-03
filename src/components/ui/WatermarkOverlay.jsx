import { useMemo } from "react";

export default function WatermarkOverlay({ text, className = "" }) {
	const watermarkText = useMemo(() => {
		if (text) return text;
		const now = new Date();
		const ts = now.toISOString().slice(0, 16).replace("T", " ");
		return `GarTexHub · ${ts}`;
	}, [text]);

	return (
		<div
			className={`pointer-events-none absolute inset-0 z-10 overflow-hidden ${className}`}
			aria-hidden="true"
		>
			<div
				className="absolute inset-0 flex flex-wrap items-center justify-center opacity-[0.08]"
				style={{
					backgroundImage: `repeating-linear-gradient(
						-45deg,
						transparent,
						transparent 180px,
						rgba(0,0,0,0.04) 180px,
						rgba(0,0,0,0.04) 182px
					)`,
				}}
			>
				{Array.from({ length: 12 }).map((_, i) => (
					<span
						key={i}
						className="absolute select-none whitespace-nowrap text-sm font-bold tracking-wider text-slate-900 dark:text-white"
						style={{
							transform: `rotate(-45deg) translate(${(i % 4) * 260 - 300}px, ${(Math.floor(i / 4)) * 180 - 150}px)`,
							opacity: 0.6,
						}}
					>
						{watermarkText}
					</span>
				))}
			</div>
		</div>
	);
}
