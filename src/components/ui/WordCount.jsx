export default function WordCount({ text = "", limit }) {
	const words = text.trim() ? text.trim().split(/\s+/).length : 0;
	const over = words > limit;
	return (
		<span
			className={`mt-1 block text-right text-xs ${over ? "font-semibold text-red-500" : "text-slate-400"}`}
		>
			{words.toLocaleString()} / {limit.toLocaleString()} words
			{over ? " — limit exceeded" : ""}
		</span>
	);
}
