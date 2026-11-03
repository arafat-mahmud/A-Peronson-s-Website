// The official GarTexHub emblem (from the client's logo, IMG-20260929-WA0006).
// Fixed width/height so it never shifts layout; WebP with a PNG fallback.
const SIZES = [64, 128, 192];

function srcSet(ext) {
	return SIZES.map((size) => `/brand/gartexhub-mark-${size}.${ext} ${size}w`).join(", ");
}

export default function BrandMark({ size = 40, className = "", alt = "GarTexHub logo" }) {
	return (
		<picture class="inline-flex shrink-0">
			<source type="image/webp" srcSet={srcSet("webp")} sizes={`${size}px`} />
			<img
				src="/brand/gartexhub-mark-128.png"
				srcSet={srcSet("png")}
				sizes={`${size}px`}
				width={size}
				height={size}
				alt={alt}
				decoding="async"
				class={className}
				style={{ width: size, height: size }}
			/>
		</picture>
	);
}
