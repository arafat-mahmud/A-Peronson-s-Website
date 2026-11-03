import { useId } from "react";

export default function BotLogo({
	width = 20,
	height = 20,
	className = "",
	variant = "color",
	title = "GarTex Assistant",
}) {
	const uniqueId = useId().replace(/:/g, "");
	const gradId = `gt-bot-grad-${uniqueId}`;
	const glowId = `gt-bot-glow-${uniqueId}`;
	const isColor = variant === "color";
	return (
		<svg
			width={width}
			height={height}
			viewBox="0 0 64 64"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			role="img"
			aria-label={title || undefined}
			aria-hidden={title ? undefined : true}
			focusable="false"
		>
			{title ? <title>{title}</title> : null}
			<defs>
				<linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stopColor="#0A66C2" />
					<stop offset="1" stopColor="#2E8BFF" />
				</linearGradient>
				<radialGradient id={glowId} cx="35%" cy="24%" r="72%">
					<stop offset="0" stopColor="#FFFFFF" stopOpacity="0.34" />
					<stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
				</radialGradient>
			</defs>

			{isColor ? (
				<>
					<rect x="2" y="2" width="60" height="60" rx="18" fill={`url(#${gradId})`} />
					<circle cx="31" cy="30" r="18" fill={`url(#${glowId})`} />
					<path
						d="M19 18.5h26c4.4 0 8 3.6 8 8V41c0 4.4-3.6 8-8 8H19c-4.4 0-8-3.6-8-8V26.5c0-4.4 3.6-8 8-8Z"
						fill="#fff"
						opacity="0.96"
					/>
					<path
						d="M26 16.5c0-2.2 1.8-4 4-4h4c2.2 0 4 1.8 4 4"
						stroke="#fff"
						strokeWidth="2.6"
						strokeLinecap="round"
						strokeLinejoin="round"
						opacity="0.95"
					/>
					<circle cx="26" cy="31" r="3.1" fill="#0A66C2" />
					<circle cx="38" cy="31" r="3.1" fill="#0A66C2" />
					<path
						d="M27 40c1.3 1.1 2.8 1.7 5 1.7s3.7-.6 5-1.7"
						stroke="#0A66C2"
						strokeWidth="2.7"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					<path
						d="M46 19.5l4-4"
						stroke="#fff"
						strokeWidth="2.4"
						strokeLinecap="round"
						strokeLinejoin="round"
						opacity="0.8"
					/>
					<path
						d="M17 47l-4 4"
						stroke="#fff"
						strokeWidth="2.4"
						strokeLinecap="round"
						strokeLinejoin="round"
						opacity="0.45"
					/>
				</>
			) : (
				<g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
					<path
						d="M19 18.5h26c4.4 0 8 3.6 8 8V41c0 4.4-3.6 8-8 8H19c-4.4 0-8-3.6-8-8V26.5c0-4.4 3.6-8 8-8Z"
						strokeWidth="2.5"
					/>
					<path d="M26 16.5c0-2.2 1.8-4 4-4h4c2.2 0 4 1.8 4 4" strokeWidth="2.5" />
					<circle cx="26" cy="31" r="2.8" fill="currentColor" stroke="none" />
					<circle cx="38" cy="31" r="2.8" fill="currentColor" stroke="none" />
					<path d="M27 40c1.3 1.1 2.8 1.7 5 1.7s3.7-.6 5-1.7" strokeWidth="2.5" />
				</g>
			)}
		</svg>
	);
}
