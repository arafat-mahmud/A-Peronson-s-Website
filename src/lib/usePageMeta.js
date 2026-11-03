import { useEffect } from "react";

const BASE_URL = "https://gartexhub.onrender.com";
const DEFAULT_IMAGE = "/og-image.png";

const registry = {};

function setMeta(property, content) {
	if (content === null || content === "") {
		return;
	}
	const key = property;
	if (registry[key]) {
		registry[key].setAttribute("content", String(content));
		return;
	}
	let el = document.querySelector(`meta[property="${key}"]`);
	if (!el) {
		el = document.createElement("meta");
		el.setAttribute("property", key);
		document.head.appendChild(el);
	}
	el.setAttribute("content", String(content));
	registry[key] = el;
}

function _removeMeta(property) {
	const el = registry[property];
	if (el) {
		el.remove();
		delete registry[property];
	}
}

function abs(url) {
	if (!url) {
		return;
	}
	if (url.startsWith("http://") || url.startsWith("https://")) {
		return url;
	}
	return `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

const OG_PREFIX = "og";
const _NS = {
	article: "https://ogp.me/ns/article#",
	book: "https://ogp.me/ns/book#",
	profile: "http://ogp.me/ns/profile#",
	music: "https://ogp.me/ns/music#",
	video: "https://ogp.me/ns/video#",
	payment: "https://ogp.me/ns/payment#",
	website: "https://ogp.me/ns/website#",
	product: "https://ogp.me/ns/product#",
};

const OG_TYPES = {
	website: "website",
	article: "article",
	book: "book",
	profile: "profile",
	"music.song": "music.song",
	"music.album": "music.album",
	"music.playlist": "music.playlist",
	"music.radio_station": "music.radio_station",
	"video.movie": "video.movie",
	"video.episode": "video.episode",
	"video.tv_show": "video.tv_show",
	"video.other": "video.other",
};

export default function usePageMeta({
	title,
	type = "website",
	description,
	canonical,
	robots = "index,follow",
	url,
	image = DEFAULT_IMAGE,
	image: imageUrl,
	imageSecureUrl,
	imageType,
	imageWidth,
	imageHeight,
	imageAlt,
	audio,
	determiner,
	locale = "en_US",
	localeAlternate,
	siteName = "GarTexHub",
	video,
	fbAppId,
	twitterCard = "summary_large_image",
	twitterSite,
	twitterCreator,

	article: articleMeta,
	book: bookMeta,
	profile: profileMeta,
	music: musicMeta,
	video: videoMeta,
	payment: paymentMeta,
} = {}) {
	useEffect(() => {
		const prevTitle = document.title;
		if (title) {
			document.title = title;
		}

		setMeta(`${OG_PREFIX}:title`, title);
		setMeta(`${OG_PREFIX}:type`, OG_TYPES[type] || type);
		setMeta(`${OG_PREFIX}:description`, description);
		if (description) {
			let el = document.querySelector('meta[name="description"]');
			if (!el) {
				el = document.createElement("meta");
				el.setAttribute("name", "description");
				document.head.appendChild(el);
			}
			el.setAttribute("content", String(description));
		}

		// Canonical
		const canonicalUrl = canonical || window.location.href;
		let canonicalEl = document.querySelector('link[rel="canonical"]');
		if (!canonicalEl) {
			canonicalEl = document.createElement("link");
			canonicalEl.setAttribute("rel", "canonical");
			document.head.appendChild(canonicalEl);
		}
		canonicalEl.setAttribute("href", canonicalUrl);

		// Robots
		let robotsEl = document.querySelector('meta[name="robots"]');
		if (!robotsEl) {
			robotsEl = document.createElement("meta");
			robotsEl.setAttribute("name", "robots");
			document.head.appendChild(robotsEl);
		}
		robotsEl.setAttribute("content", robots);

		setMeta(`${OG_PREFIX}:url`, url || window.location.href);
		setMeta(`${OG_PREFIX}:locale`, locale);
		if (localeAlternate) {
			(Array.isArray(localeAlternate) ? localeAlternate : [localeAlternate]).forEach((l) =>
				setMeta(`${OG_PREFIX}:locale:alternate`, l),
			);
		}
		setMeta(`${OG_PREFIX}:site_name`, siteName);
		setMeta(`${OG_PREFIX}:determiner`, determiner);
		setMeta(`${OG_PREFIX}:audio`, audio ? abs(audio) : undefined);

		const img = imageUrl || image;
		if (img) {
			const imgAbs = abs(img);
			setMeta(`${OG_PREFIX}:image`, imgAbs);
			setMeta(`${OG_PREFIX}:image:url`, imgAbs);
			setMeta(`${OG_PREFIX}:image:secure_url`, imageSecureUrl ? abs(imageSecureUrl) : imgAbs);
			setMeta(`${OG_PREFIX}:image:type`, imageType);
			setMeta(`${OG_PREFIX}:image:width`, imageWidth);
			setMeta(`${OG_PREFIX}:image:height`, imageHeight);
			setMeta(`${OG_PREFIX}:image:alt`, imageAlt);
		}

		setMeta(`${OG_PREFIX}:video`, video ? abs(video) : undefined);

		if (fbAppId) {
			setMeta("fb:app_id", fbAppId);
		}

		if (twitterCard) {
			let el = document.querySelector('meta[name="twitter:card"]');
			if (!el) {
				el = document.createElement("meta");
				el.setAttribute("name", "twitter:card");
				document.head.appendChild(el);
			}
			el.setAttribute("content", twitterCard);
			registry["twitter:card"] = el;

			const setTwitter = (name, val) => {
				if (!val) {
					return;
				}
				const k = `twitter:${name}`;
				let e = document.querySelector(`meta[name="${k}"]`);
				if (!e) {
					e = document.createElement("meta");
					e.setAttribute("name", k);
					document.head.appendChild(e);
				}
				e.setAttribute("content", String(val));
				registry[k] = e;
			};
			setTwitter("site", twitterSite);
			setTwitter("creator", twitterCreator);
			setTwitter("title", title);
			setTwitter("description", description);
			setTwitter("image", img ? abs(img) : undefined);
		}

		if (articleMeta) {
			const a = articleMeta;
			setMeta("article:published_time", a.publishedTime);
			setMeta("article:modified_time", a.modifiedTime);
			setMeta("article:expiration_time", a.expirationTime);
			setMeta("article:section", a.section);
			if (a.author) {
				(Array.isArray(a.author) ? a.author : [a.author]).forEach((auth) =>
					setMeta("article:author", auth),
				);
			}
			if (a.tag) {
				(Array.isArray(a.tag) ? a.tag : [a.tag]).forEach((t) => setMeta("article:tag", t));
			}
		}

		if (bookMeta) {
			const b = bookMeta;
			setMeta("book:isbn", b.isbn);
			setMeta("book:release_date", b.releaseDate);
			if (b.author) {
				(Array.isArray(b.author) ? b.author : [b.author]).forEach((auth) =>
					setMeta("book:author", auth),
				);
			}
			if (b.tag) {
				(Array.isArray(b.tag) ? b.tag : [b.tag]).forEach((t) => setMeta("book:tag", t));
			}
		}

		if (profileMeta) {
			const p = profileMeta;
			setMeta("profile:first_name", p.firstName);
			setMeta("profile:last_name", p.lastName);
			setMeta("profile:username", p.username);
			setMeta("profile:gender", p.gender);
		}

		if (musicMeta) {
			const m = musicMeta;
			setMeta("music:duration", m.duration);
			setMeta("music:release_date", m.releaseDate);
			if (m.album) {
				setMeta("music:album", m.album);
			}
			if (m.albumDisc) {
				setMeta("music:album:disc", m.albumDisc);
			}
			if (m.albumTrack) {
				setMeta("music:album:track", m.albumTrack);
			}
			if (m.musician) {
				(Array.isArray(m.musician) ? m.musician : [m.musician]).forEach((mu) =>
					setMeta("music:musician", mu),
				);
			}
			if (m.song) {
				(Array.isArray(m.song) ? m.song : [m.song]).forEach((s) => setMeta("music:song", s));
			}
			if (m.songDisc) {
				setMeta("music:song:disc", m.songDisc);
			}
			if (m.songTrack) {
				setMeta("music:song:track", m.songTrack);
			}
			if (m.creator) {
				setMeta("music:creator", m.creator);
			}
		}

		if (videoMeta) {
			const v = videoMeta;
			setMeta("video:duration", v.duration);
			setMeta("video:release_date", v.releaseDate);
			if (v.actor) {
				(Array.isArray(v.actor) ? v.actor : [v.actor]).forEach((a) => {
					setMeta("video:actor", typeof a === "string" ? a : a.profile);
					if (typeof a === "object" && a.role) {
						setMeta("video:actor:role", a.role);
					}
				});
			}
			if (v.director) {
				(Array.isArray(v.director) ? v.director : [v.director]).forEach((d) =>
					setMeta("video:director", d),
				);
			}
			if (v.writer) {
				(Array.isArray(v.writer) ? v.writer : [v.writer]).forEach((w) =>
					setMeta("video:writer", w),
				);
			}
			if (v.tag) {
				(Array.isArray(v.tag) ? v.tag : [v.tag]).forEach((t) => setMeta("video:tag", t));
			}
			if (v.series) {
				setMeta("video:series", v.series);
			}
		}

		if (paymentMeta) {
			const pm = paymentMeta;
			setMeta("payment:description", pm.description);
			setMeta("payment:currency", pm.currency);
			setMeta("payment:amount", pm.amount);
			setMeta("payment:expires_at", pm.expiresAt);
			setMeta("payment:status", pm.status);
			setMeta("payment:id", pm.id);
			setMeta("payment:success_url", pm.successUrl);
		}

		return () => {
			document.title = prevTitle;
			const allKeys = Object.keys(registry);
			allKeys.forEach((k) => {
				const el = registry[k];
				if (el?.parentNode) {
					el.parentNode.removeChild(el);
				}
				delete registry[k];
			});
		};
	}, [
		title,
		type,
		description,
		canonical,
		robots,
		url,
		image,
		imageUrl,
		imageSecureUrl,
		imageType,
		imageWidth,
		imageHeight,
		imageAlt,
		audio,
		determiner,
		locale,
		localeAlternate,
		siteName,
		video,
		fbAppId,
		twitterCard,
		twitterSite,
		twitterCreator,
		articleMeta,
		bookMeta,
		profileMeta,
		musicMeta,
		videoMeta,
		paymentMeta,
	]);
}
