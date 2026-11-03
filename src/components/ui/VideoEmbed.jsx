import { ExternalLink, Play } from "lucide-react";

function extractYouTubeId(url) {
	if (!url) return null;
	const patterns = [
		/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
	];
	for (const p of patterns) {
		const m = url.match(p);
		if (m) return m[1];
	}
	return null;
}

function extractVimeoId(url) {
	if (!url) return null;
	const m = url.match(/vimeo\.com\/(\d+)/);
	return m ? m[1] : null;
}

function isDirectVideoUrl(url) {
	if (!url) return false;
	return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

export default function VideoEmbed({ url, className = "" }) {
	if (!url) return null;

	const ytId = extractYouTubeId(url);
	const vimeoId = extractVimeoId(url);
	const isDirect = isDirectVideoUrl(url);

	if (ytId) {
		return (
			<div className={`relative overflow-hidden rounded-xl ${className}`}>
				<iframe
					src={`https://www.youtube.com/embed/${ytId}`}
					title="Product video"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
					allowFullScreen
					className="aspect-video w-full"
				/>
			</div>
		);
	}

	if (vimeoId) {
		return (
			<div className={`relative overflow-hidden rounded-xl ${className}`}>
				<iframe
					src={`https://player.vimeo.com/video/${vimeoId}`}
					title="Product video"
					allow="autoplay; fullscreen; picture-in-picture"
					sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
					allowFullScreen
					className="aspect-video w-full"
				/>
			</div>
		);
	}

	if (isDirect) {
		return (
			<div className={`relative overflow-hidden rounded-xl ${className}`}>
				<video src={url} controls preload="metadata" className="w-full" />
			</div>
		);
	}

	return (
		<a
			href={url}
			target="_blank"
			rel="noreferrer"
			className={`inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 ${className}`}
		>
			<Play className="h-4 w-4" /> Watch video <ExternalLink className="h-3.5 w-3.5" />
		</a>
	);
}
