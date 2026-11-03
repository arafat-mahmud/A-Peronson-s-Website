# Performance

Targets (Core Web Vitals, "good"): **LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1**. Lab numbers below are
not field data; confirm with real-user data after a deploy.

## Measuring

```bash
NODE_ENV=production VITE_BASE_URL=/ npx vite build --outDir /tmp/dist-a --emptyOutDir   # build A
node scripts/perf/serve-dist.mjs /tmp/dist-a 4181 &          # Brotli + API proxy, like production
node scripts/perf/serve-dist.mjs /tmp/dist-b 4182 &          # build B, same way
node scripts/perf/lab-benchmark.mjs a=http://localhost:4181 b=http://localhost:4182
```

`lab-benchmark.mjs` uses the same conditions for every target: Pixel 7 emulation, 4× CPU slowdown,
1.6 Mbps down / 750 Kbps up, 150 ms RTT, cold cache, service worker blocked, median of 3 runs
(`RUNS`, `PAGES` env to change). Build into a scratch directory, never into the tracked `dist/`, and
build with `NODE_ENV=production` (the local `.env` may say development).

## Latest results (2026-11-03, lab)

| Page | Metric | Before (697349bf) | After |
| --- | --- | --- | --- |
| `/` | FCP / LCP | 2132 / 3516 ms | 1744 / 2380 ms |
| `/` | TBT / transfer | 537 ms / 823 KB | 72 ms / 393 KB |
| `/signup` | FCP / LCP | 2128 / 2616 ms | 1744 / 2324 ms |
| `/about` | FCP / LCP | 2128 / 3300 ms | 1744 / 2516 ms |

CLS stayed at 0–0.016. The earlier pass (eed7e825 → 1879ed8b) had already cut home LCP 7.8 → 3.8 s and
initial JS+CSS 825 → 261 KB (Brotli).

## What keeps it fast

- **Route-level code splitting:** every page is a lazy chunk; vendor chunks are split by exact package
  (`vite.config.js`), so a page loads only what it imports.
- **Only the active theme's CSS:** the default theme ships in the main stylesheet; the other 11 themes are
  separate CSS chunks loaded by `src/theme/loadThemeStyles.js` when chosen (main CSS 1.15 MB → 546 KB raw).
  A user on a non-default theme sees the default palette for a moment while their theme loads.
- **Heavy components load on use:** the assistant's markdown renderer and the Prism highlighter
  (~370 KB) load when a reply is shown, not on every page.
- **LCP text paints on the first frame:** the home hero headline/subheadline slide in without an opacity
  fade, the per-character heading animation is pure CSS, and the first page of a visit skips the
  route fade. Text that starts at `opacity: 0` only counts as painted when its fade ends.
- **Native scrolling** (no scroll-hijacking library).
- **Caching:** hashed `/assets/*` are immutable for a year; `index.html`, `sw.js` and `manifest.json` are
  revalidated. The service worker is network-first for navigations and precaches only the shell.
- **Server:** list endpoints are paginated/limited; avoid full-table scans in request paths.

## Budgets to watch

Initial JS ≈ 260 KB and CSS ≈ 51 KB (Brotli) for `/`. If a change pushes either up noticeably, find out
which import pulled code into the entry chunk (`vite build` + inspect `dist/assets/index-*.js`).
