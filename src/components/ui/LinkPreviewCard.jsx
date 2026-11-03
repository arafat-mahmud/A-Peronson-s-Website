import { useState } from "react";
import LazyImage from "./LazyImage.jsx";

function getDefaultDomain(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

const FALLBACK_OG = {};

export default function LinkPreviewCard({ url, preview }) {
	const [imgError, setImgError] = useState(false);

	if (!url) {
		return null;
	}

	const og = preview || FALLBACK_OG;
	const domain = og.domain || getDefaultDomain(url);
	const title = og.title || domain;
	const description = og.description || "";
	const image = og.image && !imgError ? og.image : null;
	const favicon = og.favicon || null;

	return (
		<a
			href={url}
			target="_blank"
			rel="noreferrer"
			className="group block overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 transition-shadow hover:shadow-md"
		>
			{image ? (
				<div className="aspect-[2/1] overflow-hidden bg-slate-100 dark:bg-slate-800">
					<LazyImage
						src={image}
						alt={title}
						width={600}
						height={300}
						className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
						onError={() => setImgError(true)}
					/>
				</div>
			) : null}
			<div className="p-3">
				<div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
					{favicon ? (
						<LazyImage
							src={favicon}
							alt={`${domain} favicon`}
							width={16}
							height={16}
							className="h-4 w-4 rounded"
							onError={(e) => {
								e.target.style.display = "none";
							}}
						/>
					) : null}
					<span className="truncate">{domain}</span>
				</div>
				<h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 group-hover:text-gtBlue transition-colors">
					{title}
				</h4>
				{description ? (
					<p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
						{description}
					</p>
				) : null}
			</div>
		</a>
	);
}
