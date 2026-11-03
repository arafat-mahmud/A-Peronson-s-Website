import PropTypes from "prop-types";
import { useEffect, useState } from "react";

NeonAtom.propTypes = {
	size: PropTypes.number,
	className: PropTypes.string,
	text: PropTypes.string,
	fill: PropTypes.bool,
	timeout: PropTypes.number,
};

export default function NeonAtom({
	size = 180,
	className = "",
	text = "",
	fill = false,
	timeout = 0,
}) {
	const [timedOut, setTimedOut] = useState(false);

	useEffect(() => {
		if (timeout <= 0) {
			return;
		}
		const id = setTimeout(() => setTimedOut(true), timeout);
		return () => clearTimeout(id);
	}, [timeout]);

	// Past the timeout the page is usually a moment away (a slow network or a
	// server waking up), so the spinner stays and the user gets a way out -
	// not a dead end that replaces the page that is about to arrive.
	const slowNotice = timedOut ? (
		<div className="mt-4 flex flex-col items-center gap-2 text-center" role="status">
			<p className="text-sm text-slate-300">This is taking longer than usual…</p>
			<button
				type="button"
				onClick={() => window.location.reload()}
				className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 hover:bg-white/15"
			>
				Reload
			</button>
		</div>
	) : null;

	const s = fill ? 200 : size;
	const orbitSize = s * 0.89;
	const coreSize = s * 0.2;
	const particleSize = s * 0.089;

	const rings = [
		{
			color: "#00ffff",
			shadow: "#00bfff",
			orbitTransform: "rotateY(70deg) rotateZ(20deg)",
			orbitAnim: "na-orbit1 3s linear infinite",
			particleTransform: "rotateZ(-20deg) rotateY(-70deg)",
			particleAnim: "na-particle1 3s linear infinite",
			glow: "#00ffff",
		},
		{
			color: "#ff00ff",
			shadow: "#8a2be2",
			orbitTransform: "rotateY(60deg) rotateX(60deg) rotateZ(-30deg)",
			orbitAnim: "na-orbit2 3s linear infinite",
			particleTransform: "rotateZ(30deg) rotateX(-60deg) rotateY(-60deg)",
			particleAnim: "na-particle2 3s linear infinite",
			glow: "#ff00ff",
		},
		{
			color: "#00bfff",
			shadow: "#0040ff",
			orbitTransform: "rotateY(-60deg) rotateX(60deg) rotateZ(100deg)",
			orbitAnim: "na-orbit3 3s linear infinite",
			particleTransform: "rotateZ(-100deg) rotateX(-60deg) rotateY(60deg)",
			particleAnim: "na-particle3 3s linear infinite",
			glow: "#00bfff",
		},
	];

	return (
		<div
			className={`flex flex-col items-center justify-center gap-3 overflow-hidden ${
				fill
					? "min-h-screen w-full bg-[#050212] bg-[radial-gradient(circle_at_center,#150833_0%,#050212_60%)]"
					: ""
			} ${className}`}
		>
			<style>{`
        @keyframes na-float {
          0% { transform: translateY(-${s * 0.083}px) rotateX(5deg) rotateY(5deg); }
          100% { transform: translateY(${s * 0.083}px) rotateX(-5deg) rotateY(-5deg); }
        }
        @keyframes na-pulse {
          0% { transform: scale(0.9); box-shadow: 0 0 ${s * 0.083}px #ff00ff, 0 0 ${s * 0.167}px #8a2be2, 0 0 ${s * 0.25}px #0040ff; }
          100% { transform: scale(1.1); box-shadow: 0 0 ${s * 0.139}px #ff00ff, 0 0 ${s * 0.278}px #8a2be2, 0 0 ${s * 0.444}px #00ffff; }
        }
        @keyframes na-orbit1 { 0% { transform: rotateY(70deg) rotateZ(20deg); } 100% { transform: rotateY(70deg) rotateZ(380deg); } }
        @keyframes na-particle1 { 0% { transform: rotateZ(-20deg) rotateY(-70deg); } 100% { transform: rotateZ(-380deg) rotateY(-70deg); } }
        @keyframes na-orbit2 { 0% { transform: rotateY(60deg) rotateX(60deg) rotateZ(-30deg); } 100% { transform: rotateY(60deg) rotateX(60deg) rotateZ(330deg); } }
        @keyframes na-particle2 { 0% { transform: rotateZ(30deg) rotateX(-60deg) rotateY(-60deg); } 100% { transform: rotateZ(-330deg) rotateX(-60deg) rotateY(-60deg); } }
        @keyframes na-orbit3 { 0% { transform: rotateY(-60deg) rotateX(60deg) rotateZ(100deg); } 100% { transform: rotateY(-60deg) rotateX(60deg) rotateZ(460deg); } }
        @keyframes na-particle3 { 0% { transform: rotateZ(-100deg) rotateX(-60deg) rotateY(60deg); } 100% { transform: rotateZ(-460deg) rotateX(-60deg) rotateY(60deg); } }
      `}</style>
			<div
				className="relative"
				style={{
					width: s,
					height: s,
					perspective: 800,
					transformStyle: "preserve-3d",
					animation: "na-float 3s ease-in-out infinite alternate",
				}}
			>
				<div
					className="absolute inset-0 m-auto rounded-full z-10"
					style={{
						width: coreSize,
						height: coreSize,
						background: "radial-gradient(circle at 30% 30%, #ff00ff, #8a2be2)",
						animation: "na-pulse 1.5s ease-in-out infinite alternate",
					}}
				/>

				{rings.map((ring, i) => (
					<div
						key={i}
						className="absolute inset-0 m-auto rounded-full border border-white/5"
						style={{
							width: orbitSize,
							height: orbitSize,
							borderColor: `${ring.color}4D`,
							boxShadow: `inset 0 0 ${s * 0.083}px ${ring.color}33, 0 0 ${s * 0.083}px ${ring.color}33`,
							transformStyle: "preserve-3d",
							transform: ring.orbitTransform,
							animation: ring.orbitAnim,
						}}
					>
						<div
							className="absolute rounded-full z-20"
							style={{
								top: -particleSize / 2,
								left: 0,
								right: 0,
								margin: "0 auto",
								width: particleSize,
								height: particleSize,
								transformOrigin: "50% 50% 0",
								background: ring.color,
								boxShadow: `0 0 ${s * 0.083}px ${ring.color}, 0 0 ${s * 0.139}px ${ring.shadow}, 0 0 ${s * 0.194}px #fff`,
								transform: ring.particleTransform,
								animation: ring.particleAnim,
							}}
						/>
					</div>
				))}
			</div>
			{text && (
				<span className="text-sm text-gray-400 animate-pulse tracking-wider uppercase">{text}</span>
			)}
			{slowNotice}
		</div>
	);
}
