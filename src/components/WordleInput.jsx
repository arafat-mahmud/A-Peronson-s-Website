import { motion, useReducedMotion } from "framer-motion";

function Tile({ char, status = "empty", delay = 0 }) {
	const reduceMotion = useReducedMotion();
	const bg =
		status === "correct"
			? "bg-emerald-500 text-white border-emerald-500"
			: status === "present"
				? "bg-amber-400 text-white border-amber-400"
				: status === "absent"
					? "bg-slate-500 text-white border-slate-500"
					: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700";

	if (reduceMotion) {
		return (
			<div
				className={`flex h-12 w-12 items-center justify-center rounded-xl border text-lg font-bold ${bg}`}
			>
				{char}
			</div>
		);
	}

	return (
		<motion.div
			className={`flex h-12 w-12 items-center justify-center rounded-xl border text-lg font-bold ${bg}`}
			initial={{ rotateX: 0 }}
			animate={{ rotateX: 360 }}
			transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
			style={{ transformStyle: "preserve-3d" }}
		>
			{char}
		</motion.div>
	);
}

export default function WordleInput({
	value = "",
	maxLength = 6,
	className = "",
	onChange,
	onSubmit,
	statuses = [],
	placeholder = "●",
}) {
	const reduceMotion = useReducedMotion();
	const chars = value.split("").concat(new Array(maxLength - value.length).fill(""));
	const filled = value.length === maxLength;

	function handleChange(e) {
		const val = e.target.value.replace(/\s/g, "").toUpperCase().slice(0, maxLength);
		onChange?.(val);
		if (val.length === maxLength) {
			onSubmit?.(val);
		}
	}

	return (
		<div className={`flex flex-col items-center gap-4 ${className}`}>
			<div className="flex gap-2">
				{chars.map((ch, i) => (
					<Tile
						key={i}
						char={ch || ""}
						status={statuses[i] || "empty"}
						delay={reduceMotion ? 0 : i * 0.08}
					/>
				))}
			</div>
			<input
				type="text"
				value={value}
				onChange={handleChange}
				maxLength={maxLength}
				className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-lg font-bold tracking-[0.25em] text-slate-900 outline-none focus:ring-2 focus:ring-sky-400/50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
				placeholder={placeholder}
				autoComplete="off"
			/>
		</div>
	);
}
