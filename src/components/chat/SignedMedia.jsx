import { useSignedSrcState } from "../../hooks/useSignedSrc.js";
import { describeSignFailure } from "../../lib/signedFile.js";
import LazyImage from "../ui/LazyImage.jsx";

/**
 * <img> / <video> whose src is a signed url.
 *
 * These exist because the src has to be signed by an effect, and a hook cannot
 * be called from a render helper like ChatInterface's renderMessageBody() or
 * from a `.map()` in RightPanel. Rendering nothing until the signature arrives
 * is the point: an empty state keeps the unsigned path out of the DOM, and a
 * refusal simply shows nothing rather than a broken image pointing at bytes the
 * client is not allowed to read.
 *
 * A REFUSAL, though, is not the same as "still loading". A sign that failed
 * because the server is rate limiting the caller will not resolve on its own,
 * and rendering nothing for it leaves a hole in the thread with no sign that
 * anything is wrong. So a failed sign renders a placeholder that says so.
 *
 * Both pass refreshMs 0 — see useSignedSrc for why. The default (half the
 * server's signature lifetime) is right for an interactive surface the user
 * leaves open, and wrong for a thumbnail: every refresh swaps the element's
 * src, which visibly reloads an <img> and restarts a <video>.
 */

/**
 * The placeholder a failed sign renders in place of the media.
 *
 * @param {{ error: string | null, status: number | null }} error - The failure
 *   the hook reported, in the server's own `{ error, status }` shape.
 * @param {string} [className] - The caller's classes, so the placeholder
 *   occupies the same box the media would have.
 */
function SignFailure({ error, className = "" }) {
	return (
		<div
			className={`flex min-h-16 w-full items-center justify-center rounded-xl bg-black/10 px-3 py-2 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 ${className}`}
			role="status"
		>
			{describeSignFailure(error)}
		</div>
	);
}

export function SignedImage({ src, alt, width, height, className = "", eager = false }) {
	const { src: signedSrc, error } = useSignedSrcState(src, { refreshMs: 0 });
	if (!signedSrc) {
		return error ? <SignFailure error={error} className={className} /> : null;
	}
	return (
		<LazyImage
			src={signedSrc}
			alt={alt}
			width={width}
			height={height}
			className={className}
			eager={eager}
		/>
	);
}

export function SignedVideo({
	src,
	className = "",
	controls = false,
	autoPlay = false,
	muted = true,
	playsInline = true,
	preload = "metadata",
	onError = null,
}) {
	const { src: signedSrc, error } = useSignedSrcState(src, { refreshMs: 0 });
	if (!signedSrc) {
		return error ? <SignFailure error={error} className={className} /> : null;
	}
	return (
		<video
			src={signedSrc}
			controls={controls}
			autoPlay={autoPlay}
			muted={muted}
			playsInline={playsInline}
			preload={preload}
			className={className}
			onError={onError}
		/>
	);
}

export default SignedImage;
