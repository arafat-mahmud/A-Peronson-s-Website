import { useInView, useReducedMotion, useSpring } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * Renders a number that counts up to the target value.
 *
 * @param {Object} props
 * @param {number} props.value - The target value.
 * @param {number} [props.decimals=0] - Number of decimal places.
 * @param {string} [props.suffix=""] - String to display after the number.
 * @param {string} [props.className=""] - Additional CSS class names.
 * @returns {JSX.Element} The rendered count up component.
 */
export default function CountUp({ value, decimals = 0, suffix = "", className = "" }) {
	const reduceMotion = useReducedMotion();
	const ref = useRef(null);
	const inView = useInView(ref, { once: true, margin: "-60px" });
	const [displayed, setDisplayed] = useState(reduceMotion ? value : 0);

	const spring = useSpring(0, { stiffness: 60, damping: 20, restDelta: 0.001 });

	useEffect(() => {
		if (!inView || reduceMotion) {
			return;
		}
		spring.set(value);
	}, [inView, value, spring, reduceMotion]);

	useEffect(() => {
		if (reduceMotion) {
			return;
		}
		const unsub = spring.on("change", (v) => {
			setDisplayed(v);
		});
		return () => unsub();
	}, [spring, reduceMotion]);

	const formatted = reduceMotion
		? Number(value).toLocaleString(undefined, {
				minimumFractionDigits: decimals,
				maximumFractionDigits: decimals,
			})
		: displayed.toLocaleString(undefined, {
				minimumFractionDigits: decimals,
				maximumFractionDigits: decimals,
			});

	return (
		<span ref={ref} className={className}>
			{formatted}
			{suffix}
		</span>
	);
}
