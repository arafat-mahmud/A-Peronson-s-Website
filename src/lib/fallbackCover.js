// Default profile banner when a company has not uploaded a cover image.
//
// It used to fetch a random wallpaper from a third-party API (wallhaven.cc)
// in the browser on every profile view: the request is blocked by CORS, so the
// hook returned "" and pages rendered <img src=""> - a broken image - while
// telling a third party about every visit. This is a local SVG in the brand
// navy/teal with a fine woven-thread texture: no request, no layout shift.

const COVER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="320" viewBox="0 0 1200 320">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#14527e"/><stop offset="0.55" stop-color="#1c5381"/><stop offset="1" stop-color="#058080"/>
</linearGradient>
<pattern id="w" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
<path d="M0 12h24M12 0v24" stroke="#ffffff" stroke-opacity="0.07" stroke-width="2"/>
</pattern>
</defs>
<rect width="1200" height="320" fill="url(#g)"/>
<rect width="1200" height="320" fill="url(#w)"/>
</svg>`;

const COVER_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(COVER_SVG)}`;

/** Returns the fallback cover URL (the hook shape is kept for its callers). */
export function useFallbackCover(enabled) {
	return enabled ? COVER_URL : "";
}
