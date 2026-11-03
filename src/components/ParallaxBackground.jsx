import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";

const blobs = [
	{
		className:
			"absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-sky-400/20 blur-3xl dark:bg-sky-500/15",
		speed: 1,
	},
	{
		className:
			"absolute right-[-80px] top-[260px] h-[360px] w-[360px] rounded-full bg-blue-500/20 blur-3xl dark:bg-blue-500/10",
		speed: 1.4,
	},
	{
		className:
			"absolute left-[-120px] top-[760px] h-[280px] w-[280px] rounded-full bg-cyan-400/15 blur-3xl dark:bg-cyan-400/10",
		speed: 1.2,
	},
];

function ParallaxBlob({ blob, scrollY, scrollRange }) {
	const y = useTransform(scrollY, [0, scrollRange], [0, -(blob.speed * 60)]);
	const springY = useSpring(y, { stiffness: 80, damping: 20, restDelta: 0.01 });
	return <motion.div style={{ y: springY }} className={blob.className} />;
}

export default function ParallaxBackground({ className = "", scrollRange = 800, customBlobs }) {
	const reduceMotion = useReducedMotion();
	const { scrollY } = useScroll();

	if (reduceMotion) {
		return null;
	}

	const items = customBlobs || blobs;

	return (
		<div className={`absolute inset-0 -z-10 overflow-hidden ${className}`}>
			{items.map((blob, i) => (
				<ParallaxBlob key={i} blob={blob} scrollY={scrollY} scrollRange={scrollRange} />
			))}
		</div>
	);
}
