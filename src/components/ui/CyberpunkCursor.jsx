import { useEffect, useMemo, useRef, useState } from "react";

export default function CyberpunkCursor() {
	const canvasRef = useRef(null);
	const coreRef = useRef(null);
	const ringRef = useRef(null);
	const glowRef = useRef(null);
	const dotRef = useRef(null);
	const spinnerRef = useRef(null);

	const [enabled, setEnabled] = useState(false);

	const [theme, setTheme] = useState(() => {
		if (typeof window === "undefined") {
			return "dark";
		}
		const htmlTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
		return htmlTheme;
	});

	useEffect(() => {
		const observer = new MutationObserver(() => {
			const isDark = document.documentElement.classList.contains("dark");
			setTheme(isDark ? "dark" : "light");
		});
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const PHRASE = enabled ? "disable cursor" : "activate cursor";
		let buffer = "";
		let timer = null;

		const resetBuffer = () => {
			buffer = "";
		};

		const onKeyDown = (e) => {
			if (e.repeat) return;
			if (!e.key || e.key.length !== 1) return;
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			clearTimeout(timer);
			timer = setTimeout(resetBuffer, 1500);
			buffer = (buffer + e.key.toLowerCase()).slice(-PHRASE.length);
			if (buffer === PHRASE) {
				clearTimeout(timer);
				setEnabled((prev) => !prev);
			}
		};

		document.addEventListener("keydown", onKeyDown);
		return () => {
			clearTimeout(timer);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [enabled]);

	useEffect(() => {
		if (!enabled) return;

		const body = document.body;
		const html = document.documentElement;
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");

		const core = coreRef.current;
		const ring = ringRef.current;
		const glow = glowRef.current;
		const dot = dotRef.current;
		const spinner = spinnerRef.current;

		if (!(canvas && ctx && core && ring && glow && dot && spinner)) {
			return;
		}

		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		const state = {
			x: window.innerWidth * 0.5,
			y: window.innerHeight * 0.5,
			px: window.innerWidth * 0.5,
			py: window.innerHeight * 0.5,
			rx: window.innerWidth * 0.5,
			ry: window.innerHeight * 0.5,
			gx: window.innerWidth * 0.5,
			gy: window.innerHeight * 0.5,
			visible: false,
			mode: "normal",
			lastEmit: 0,
			hue: 180,
			particles: [],
		};

		const resizeCanvas = () => {
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.floor(window.innerWidth * dpr);
			canvas.height = Math.floor(window.innerHeight * dpr);
			canvas.style.width = `${window.innerWidth}px`;
			canvas.style.height = `${window.innerHeight}px`;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};

		const setPos = (el, x, y) => {
			el.style.left = `${x}px`;
			el.style.top = `${y}px`;
		};

		const emitParticles = (x, y, amount = 2) => {
			if (reduceMotion) {
				return;
			}
			for (let i = 0; i < amount; i += 1) {
				state.particles.push({
					x,
					y,
					vx: (Math.random() - 0.5) * (2.2 + Math.random() * 1.8),
					vy: (Math.random() - 0.5) * (2.2 + Math.random() * 1.8),
					life: 1,
					size: 0.8 + Math.random() * 2.8,
					hue: state.hue + (Math.random() * 32 - 16),
				});
			}
		};

		const emitBurst = (x, y, amount = 10) => {
			if (reduceMotion) {
				return;
			}
			for (let i = 0; i < amount; i += 1) {
				state.particles.push({
					x,
					y,
					vx: (Math.random() - 0.5) * 7,
					vy: (Math.random() - 0.5) * 7,
					life: 1,
					size: 1 + Math.random() * 3.5,
					hue: state.hue + (Math.random() * 70 - 35),
				});
			}
		};

		const spawnWave = (x, y) => {
			const wave = document.createElement("div");
			wave.className = "cp-click-wave";
			setPos(wave, x, y);
			document.body.appendChild(wave);
			wave.addEventListener("animationend", () => wave.remove(), {
				once: true,
			});
		};

		const isTextTarget = (el) =>
			Boolean(el) && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
		const isLoadingTarget = (el) =>
			Boolean(el) && Boolean(el.closest("[data-cursor='loading'], .loading-btn"));
		const isPointerTarget = (el) =>
			Boolean(el) &&
			Boolean(
				el.closest("button, a, [role='button'], .magnetic, .cursor-hoverable, select, summary"),
			);

		const setMode = (mode) => {
			state.mode = mode;
			body.classList.toggle("cp-pointer", mode === "pointer");
			body.classList.toggle("cp-text", mode === "text");
			body.classList.toggle("cp-loading", mode === "loading");
		};

		const applyStateFromElement = (el) => {
			if (isLoadingTarget(el)) {
				setMode("loading");
				return;
			}
			if (isTextTarget(el)) {
				setMode("text");
				return;
			}
			if (isPointerTarget(el)) {
				setMode("pointer");
				return;
			}
			setMode("normal");
		};

		const updateMouse = (e) => {
			state.visible = true;
			state.x = e.clientX;
			state.y = e.clientY;

			state.hue =
				theme === "light"
					? (210 + (state.x / window.innerWidth) * 60) % 360
					: (180 + (state.x / window.innerWidth) * 170 + (state.y / window.innerHeight) * 40) % 360;

			html.style.setProperty("--cursor-hue", String(state.hue));
			html.style.setProperty("--cursor-accent", String((state.hue + 120) % 360));

			const el = document.elementFromPoint(state.x, state.y);
			applyStateFromElement(el);

			const now = performance.now();
			const dx = state.x - state.px;
			const dy = state.y - state.py;
			const dist = Math.hypot(dx, dy);

			if (dist > 10 && now - state.lastEmit > 10) {
				state.lastEmit = now;
				emitParticles(state.x, state.y, state.mode === "pointer" ? 5 : 2);
			}

			state.px = state.x;
			state.py = state.y;

			setPos(core, state.x, state.y);
			setPos(dot, state.x, state.y);
			setPos(spinner, state.x, state.y);
		};

		const magneticEls = [...document.querySelectorAll(".magnetic")];
		const magneticListeners = [];
		magneticEls.forEach((el) => {
			let rect = null;

			const onEnter = () => {
				rect = el.getBoundingClientRect();
			};
			const onMove = (e) => {
				rect = rect || el.getBoundingClientRect();
				const dx = e.clientX - (rect.left + rect.width / 2);
				const dy = e.clientY - (rect.top + rect.height / 2);
				const strength = 0.18;
				el.style.transform = `translate3d(${dx * strength}px, ${dy * strength}px, 0)`;
			};
			const onLeave = () => {
				el.style.transform = "";
			};

			el.addEventListener("mouseenter", onEnter);
			el.addEventListener("mousemove", onMove);
			el.addEventListener("mouseleave", onLeave);
			magneticListeners.push({ el, onEnter, onMove, onLeave });
		});

		const animate = () => {
			if (!state.visible) {
				requestAnimationFrame(animate);
				return;
			}

			state.rx += (state.x - state.rx) * 0.22;
			state.ry += (state.y - state.ry) * 0.22;
			state.gx += (state.x - state.gx) * 0.12;
			state.gy += (state.y - state.gy) * 0.12;

			setPos(ring, state.rx, state.ry);
			setPos(glow, state.gx, state.gy);

			const dx = state.x - state.rx;
			const dy = state.y - state.ry;
			glow.style.transform = `translate(-50%, -50%) translate(${dx * 0.06}px, ${dy * 0.06}px)`;

			ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
			ctx.globalCompositeOperation = "lighter";

			for (let i = state.particles.length - 1; i >= 0; i -= 1) {
				const p = state.particles[i];
				p.x += p.vx;
				p.y += p.vy;
				p.vx *= 0.98;
				p.vy *= 0.98;
				p.life -= 0.025;

				if (p.life <= 0) {
					state.particles.splice(i, 1);
					continue;
				}

				const alpha = Math.max(0, p.life);
				ctx.beginPath();
				ctx.fillStyle = `hsla(${p.hue}, 100%, 65%, ${alpha})`;
				ctx.shadowBlur = 16;
				ctx.shadowColor = `hsla(${p.hue}, 100%, 65%, ${alpha})`;
				ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
				ctx.fill();
			}

			if (state.mode === "text") {
				core.style.borderRadius = "999px";
				ring.style.borderRadius = "10px";
			} else {
				core.style.borderRadius = "50%";
				ring.style.borderRadius = "50%";
			}

			requestAnimationFrame(animate);
		};

		body.style.cursor = "none";
		resizeCanvas();

		const cursorEls = [core, ring, glow, dot, spinner];

		const setCursorVisible = (visible) => {
			cursorEls.forEach((el) => {
				el.style.opacity = visible ? "1" : "0";
			});
		};

		const onResize = resizeCanvas;
		const onMouseMove = updateMouse;
		const onLeave = () => {
			setCursorVisible(false);
			state.visible = false;
		};
		const onEnter = (e) => {
			setCursorVisible(true);
			state.visible = true;
			state.x = e.clientX;
			state.y = e.clientY;
			state.px = e.clientX;
			state.py = e.clientY;
			setPos(core, state.x, state.y);
			setPos(dot, state.x, state.y);
			setPos(spinner, state.x, state.y);
		};
		const onFirstMove = () => setCursorVisible(true);
		const onDown = (e) => {
			body.classList.add("cp-click");
			spawnWave(e.clientX, e.clientY);
			emitBurst(e.clientX, e.clientY, 14);
			window.setTimeout(() => body.classList.remove("cp-click"), 420);
		};
		const onUp = () => body.classList.remove("cp-click");
		const onDomMove = (e) => {
			const el = document.elementFromPoint(e.clientX, e.clientY);
			applyStateFromElement(el);
		};

		window.addEventListener("resize", onResize);
		window.addEventListener("mousemove", onMouseMove, { passive: true });
		document.documentElement.addEventListener("mouseleave", onLeave);
		document.documentElement.addEventListener("mouseenter", onEnter);
		window.addEventListener("mousedown", onDown);
		window.addEventListener("mouseup", onUp);
		document.addEventListener("mousemove", onDomMove, { passive: true });

		setCursorVisible(false);
		window.addEventListener("mousemove", onFirstMove, { once: true });
		animate();

		return () => {
			cursorEls.forEach((el) => {
				el.style.opacity = "";
			});
			body.style.cursor = "";
			window.removeEventListener("resize", onResize);
			window.removeEventListener("mousemove", onMouseMove);
			document.documentElement.removeEventListener("mouseleave", onLeave);
			document.documentElement.removeEventListener("mouseenter", onEnter);
			window.removeEventListener("mousedown", onDown);
			window.removeEventListener("mouseup", onUp);
			document.removeEventListener("mousemove", onDomMove);
			magneticListeners.forEach(({ el, onEnter, onMove, onLeave }) => {
				el.removeEventListener("mouseenter", onEnter);
				el.removeEventListener("mousemove", onMove);
				el.removeEventListener("mouseleave", onLeave);
			});
		};
	}, [theme, enabled]);

	const styles = useMemo(
		() => `
      :root {
        --cursor-x: 0px;
        --cursor-y: 0px;
        --cursor-hue: 180;
        --cursor-accent: 300;

        --shadow-a: rgba(0, 240, 255, 0.55);
        --shadow-b: rgba(255, 0, 200, 0.35);
        --ring: rgba(0, 240, 255, 0.95);
        --ring-2: rgba(255, 0, 200, 0.95);
        --glow-a: rgba(0, 240, 255, 0.25);
        --glow-b: rgba(255, 0, 200, 0.14);
      }

      html[data-theme='light'] {
        --shadow-a: rgba(13, 77, 155, 0.28);
        --shadow-b: rgba(117, 31, 99, 0.16);
        --ring: rgba(10, 40, 78, 0.92);
        --ring-2: rgba(128, 31, 97, 0.82);
        --glow-a: rgba(10, 40, 78, 0.05);
        --glow-b: rgba(128, 31, 97, 0.04);
      }

      #cp-canvas {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 9990;
      }

      .cp-core,
      .cp-ring,
      .cp-glow,
      .cp-dot,
      .cp-spinner {
        position: fixed;
        left: 0;
        top: 0;
        pointer-events: none;
        transform: translate(-50%, -50%);
        z-index: 9999;
        will-change: transform, left, top, width, height, opacity;
      }

      .cp-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255,255,255,1) 0 20%, rgba(0,240,255,1) 35%, rgba(0,240,255,0.2) 100%);
        box-shadow: 0 0 10px var(--shadow-a), 0 0 30px var(--shadow-b);
        z-index: 10002;
      }

      .cp-ring {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 1.5px solid var(--ring);
        box-shadow: 0 0 14px var(--shadow-a), inset 0 0 8px var(--shadow-b);
        mix-blend-mode: screen;
        z-index: 10000;
        transition: width 180ms ease, height 180ms ease, border-color 180ms ease, opacity 180ms ease, box-shadow 180ms ease, border-radius 180ms ease;
      }

      html[data-theme='light'] .cp-ring {
        border: 1px solid rgba(16, 34, 56, 0.25);
        box-shadow: 0 6px 18px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,0.9);
      }

      .cp-glow {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        background: radial-gradient(
          circle,
          hsla(var(--cursor-hue), 100%, 65%, 0.22) 0%,
          hsla(var(--cursor-accent), 100%, 60%, 0.12) 34%,
          rgba(0, 0, 0, 0) 72%
        );
        filter: blur(7px);
        opacity: 0.95;
        mix-blend-mode: screen;
        z-index: 9998;
        transition: width 220ms ease, height 220ms ease, opacity 220ms ease, filter 220ms ease;
      }

      html[data-theme='light'] .cp-glow {
        filter: blur(4px);
        opacity: 0.6;
      }

      .cp-core {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: linear-gradient(135deg, #ffffff, #00f0ff 40%, #ff00c8 100%);
        box-shadow: 0 0 10px rgba(0, 240, 255, 0.9), 0 0 24px rgba(255, 0, 200, 0.55);
        z-index: 10003;
        transition: width 160ms ease, height 160ms ease, border-radius 160ms ease, background 160ms ease, opacity 160ms ease, box-shadow 160ms ease, transform 160ms ease;
      }

      html[data-theme='light'] .cp-core {
        background: linear-gradient(135deg, #102238, #3773a8);
        box-shadow: 0 0 10px rgba(55,115,168,0.25);
      }

      .cp-spinner {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid rgba(0, 240, 255, 0.18);
        border-top-color: var(--ring);
        border-right-color: var(--ring-2);
        opacity: 0;
        z-index: 10001;
        animation: cp-spin 0.85s linear infinite;
        transition: opacity 180ms ease, width 180ms ease, height 180ms ease;
        box-shadow: 0 0 16px var(--shadow-a);
      }

      @keyframes cp-spin { to { transform: translate(-50%, -50%) rotate(360deg); } }

      .cp-pointer .cp-ring {
        width: 52px;
        height: 52px;
        border-color: var(--ring-2);
        box-shadow: 0 0 18px rgba(255, 0, 200, 0.65), 0 0 42px rgba(0, 240, 255, 0.35), inset 0 0 10px rgba(255, 255, 255, 0.08);
      }
      .cp-pointer .cp-core {
        width: 10px;
        height: 10px;
        box-shadow: 0 0 12px rgba(255, 0, 200, 0.95), 0 0 28px rgba(0, 240, 255, 0.8);
      }
      .cp-pointer .cp-glow {
        width: 120px;
        height: 120px;
        filter: blur(10px);
        opacity: 1;
      }

      .cp-text .cp-core {
        width: 3px;
        height: 28px;
        border-radius: 999px;
        background: var(--ring);
        box-shadow: 0 0 10px rgba(0, 240, 255, 0.95), 0 0 24px rgba(255, 0, 200, 0.28);
        animation: cp-textBlink 1s steps(2, jump-none) infinite;
      }
      .cp-text .cp-ring {
        width: 18px;
        height: 42px;
        border-radius: 8px;
        border-color: var(--ring);
        box-shadow: 0 0 14px rgba(0, 240, 255, 0.4);
      }
      .cp-text .cp-glow { width: 60px; height: 60px; opacity: 0.7; }
      @keyframes cp-textBlink { 50% { opacity: 0.45; } }

      .cp-loading .cp-spinner { opacity: 1; width: 34px; height: 34px; }
      .cp-loading .cp-ring {
        width: 40px;
        height: 40px;
        border-color: rgba(0, 240, 255, 0.55);
        box-shadow: 0 0 18px rgba(0, 240, 255, 0.35);
      }
      .cp-loading .cp-core {
        width: 6px;
        height: 6px;
        background: #ffffff;
        box-shadow: 0 0 14px rgba(255,255,255,0.65);
      }
      .cp-loading .cp-glow { width: 110px; height: 110px; opacity: 1; }

      .cp-click .cp-ring { animation: cp-pulseRing 420ms ease-out; }
      .cp-click .cp-core { animation: cp-pulseDot 420ms ease-out; }
      @keyframes cp-pulseRing {
        0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
      }
      @keyframes cp-pulseDot {
        0% { transform: translate(-50%, -50%) scale(1); }
        60% { transform: translate(-50%, -50%) scale(1.6); }
        100% { transform: translate(-50%, -50%) scale(1); }
      }

      .cp-click-wave {
        position: fixed;
        left: 0;
        top: 0;
        width: 18px;
        height: 18px;
        border: 1px solid rgba(0, 240, 255, 0.9);
        border-radius: 50%;
        pointer-events: none;
        transform: translate(-50%, -50%);
        z-index: 9997;
        box-shadow: 0 0 18px rgba(0, 240, 255, 0.7), 0 0 42px rgba(255, 0, 200, 0.3);
        animation: cp-wave 650ms ease-out forwards;
        mix-blend-mode: screen;
      }
      @keyframes cp-wave {
        0% { opacity: 1; transform: translate(-50%, -50%) scale(0.8); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(8); }
      }

      html[data-theme='light'] body {
        background: radial-gradient(circle at top, rgba(55,115,168,0.06), transparent 40%),
                    linear-gradient(135deg, #f5f9ff, #eaf2ff);
      }
      html[data-theme='light'] body::before {
        opacity: 0.25;
      }

      @media (prefers-reduced-motion: reduce) {
        .cp-spinner,
        .cp-core,
        .cp-ring,
        .cp-glow,
        .cp-click-wave { animation: none !important; }
      }
    `,
		[],
	);

	return (
		<>
			<style>{styles}</style>
			{enabled && (
				<>
					<canvas id="cp-canvas" ref={canvasRef} />

					<div ref={glowRef} className="cp-glow" />
					<div ref={ringRef} className="cp-ring" />
					<div ref={coreRef} className="cp-core" />
					<div ref={spinnerRef} className="cp-spinner" />
					<div ref={dotRef} className="cp-dot" />
				</>
			)}
		</>
	);
}
