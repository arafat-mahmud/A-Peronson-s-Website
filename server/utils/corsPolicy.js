// Which browser origins may call the API.
//
// Production allows the listed origins, CORS_ALLOWED_ORIGINS (comma
// separated) and the page's own origin. Development allows every origin (local
// dev servers, device testing, Postman). This is safe because no cookie-based
// session exists: the API authenticates with a JWT in the Authorization
// header, which a browser never attaches to a cross-origin request by itself.

const STATIC_ALLOWED_ORIGINS = [
	"http://localhost:5173", // dev frontend
	"http://localhost:4173", // preview
	"http://127.0.0.1:5173",
	"https://gartexhub.onrender.com", // production
];
function extraAllowedOrigins() {
	return String(process.env.CORS_ALLOWED_ORIGINS || "")
		.split(",")
		.map((value) => value.trim().replace(/\/$/, ""))
		.filter(Boolean);
}

function isSameOrigin(req, origin) {
	try {
		return new URL(origin).host === req.headers.host;
	} catch {
		return false;
	}
}

// Per-request so the page's OWN origin is always allowed: module scripts and
// fonts are fetched with an Origin header, and rejecting that origin used to
// answer the site's own JS/CSS with a 500 on any host name not in the list.
// A foreign origin is not an error either - it simply gets no CORS headers,
// so the browser refuses to hand the response to that page.
export function corsOptions(req, callback) {
	const origin = req.headers.origin;
	const base = {
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
		exposedHeaders: ["Server-Timing", "Retry-After"],
	};
	// No Origin (curl, health checks, server-to-server, mobile apps) is fine:
	// auth is a JWT in the Authorization header, not a cookie, so CSRF does
	// not apply.
	const allowed =
		!origin ||
		STATIC_ALLOWED_ORIGINS.includes(origin) ||
		extraAllowedOrigins().includes(origin) ||
		isSameOrigin(req, origin) ||
		process.env.NODE_ENV !== "production"; // Dev: allow all
	callback(null, { ...base, origin: allowed });
}
