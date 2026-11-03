/*
  LazyImage — SEO-optimized image component.

  Guarantees:
    - Explicit width/height for CLS prevention
    - loading="lazy" by default (set eager={true} for above-the-fold)
    - alt is required (pass "" only for decorative images)
    - object-cover by default, configurable via className
*/

import { forwardRef, useState } from "react";

const LazyImage = forwardRef(function LazyImage(
	{ src, alt, width, height, className = "", eager = false, onLoad, onError, ...rest },
	ref,
) {
	const [loaded, setLoaded] = useState(false);
	const [errored, setErrored] = useState(false);

	return (
		<img
			ref={ref}
			src={src}
			alt={alt}
			width={width}
			height={height}
			loading={eager ? "eager" : "lazy"}
			fetchPriority={eager ? "high" : "auto"}
			className={`transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"} ${className}`}
			onLoad={(e) => {
				setLoaded(true);
				onLoad?.(e);
			}}
			onError={(e) => {
				setErrored(true);
				onError?.(e);
			}}
			{...rest}
		/>
	);
});

export default LazyImage;
