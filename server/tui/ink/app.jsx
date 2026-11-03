import os from "node:os";
import { Box, Text, useStdin, useStdout, useWindowSize } from "ink";
import TextInput from "ink-text-input";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogWsClient } from "../wsClient.js";

const ESC = String.fromCharCode(27);
const ESC_RE = `${ESC}\\[<`;
const SGR_RE = new RegExp(ESC_RE + "\\d+(?:;\\d+)*[Mm]", "g");
const SGR_TAIL_RE = new RegExp(ESC_RE + "\\d+$");
const MOUSE_SEQ_RE = new RegExp("^" + ESC_RE + "(\\d+);(\\d+);(\\d+)([Mm])$");

const C = {
	bg: "#090b13",
	panel: "#0e1420",
	card: "#111b2e",
	card2: "#0d1525",
	border: "#1e2d50",
	borderGlow: "#3b5998",
	blue: "#38bdf8",
	cyan: "#22d3ee",
	green: "#34d399",
	amber: "#fbbf24",
	pink: "#fb7185",
	red: "#ef4444",
	purple: "#c084fc",
	violet: "#8b5cf6",
	indigo: "#6366f1",
	text: "#e8edff",
	muted: "#7f8aa8",
	muted2: "#596580",
	neonPink: "#ff2d95",
	neonCyan: "#00fff5",
	neonViolet: "#bf5fff",
	neonGreen: "#39ff14",
};

const LEVELS = ["INFO", "DEBUG", "SUCCESS", "WARN", "ERROR", "CRITICAL"];

const LEVEL_COLOR = {
	INFO: C.blue,
	DEBUG: C.cyan,
	SUCCESS: C.green,
	WARN: C.amber,
	ERROR: C.pink,
	CRITICAL: C.neonPink,
};

const LEVEL_ICON = {
	INFO: "●",
	DEBUG: "◆",
	SUCCESS: "✔",
	WARN: "▲",
	ERROR: "✖",
	CRITICAL: "🔥",
};

const SERVICES = [
	{ key: "requests", label: "Requests", icon: "→", hot: true },
	{ key: "assistant", label: "Assistant", icon: "◉", hot: false },
	{ key: "image_queue", label: "Image Queue", icon: "■", hot: false },
	{ key: "redis", label: "Redis", icon: "◆", hot: true },
	{ key: "prisma", label: "Prisma", icon: "◇", hot: false },
	{ key: "syslog", label: "Syslog", icon: "◌", hot: false },
	{ key: "audit", label: "Audit", icon: "▲", hot: true },
	{ key: "analytics", label: "Analytics", icon: "→", hot: false },
	{ key: "workers", label: "Workers", icon: "■", hot: false },
	{ key: "auth", label: "Auth", icon: "◈", hot: true },
	{ key: "favorites", label: "Favorites", icon: "★", hot: true },
];

const WORKSPACE = [
	{ key: "overview", label: "Overview", icon: "◈" },
	{ key: "live", label: "Live", icon: "●" },
	{ key: "errors", label: "Errors", icon: "×" },
	{ key: "warnings", label: "Warnings", icon: "▲" },
	{ key: "info", label: "Info", icon: "•" },
];

const MAX_ENTRIES = 8000;

const pad = (s, w) => {
	s = String(s);
	return s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length);
};
const trunc = (s, w) => {
	s = String(s);
	return s.length <= w ? s : s.slice(0, Math.max(1, w - 1)) + "…";
};
const stripMouseSgr = (s) => String(s).replace(SGR_RE, "").replace(SGR_TAIL_RE, "");
const pad2 = (n) => String(n).padStart(2, "0");
const fmtTime = (ts) => {
	const d = new Date(ts);
	return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`;
};
const shortId = (id) => (id ? String(id).slice(-6) : "—");

const NEON_CHARS = "─";
const barrier = (w, color) => <Text color={color}>{NEON_CHARS.repeat(Math.max(0, w))}</Text>;
const neonBar = (w, c1, c2) => {
	const half = Math.max(0, Math.floor(w / 2));
	return (
		<Text>
			<Text color={c1}>{NEON_CHARS.repeat(half)}</Text>
			<Text color={c2}>{NEON_CHARS.repeat(Math.max(0, w - half))}</Text>
		</Text>
	);
};

const parseMouse = (seq) => {
	const m = MOUSE_SEQ_RE.exec(seq);
	if (!m) return null;
	const b = +m[1];
	const x = +m[2];
	const y = +m[3];
	if (b & 64) return { scroll: b & 1 ? 1 : -1 };
	if ((b & 3) === 0 && m[4] === "M") return { x, y };
	return null;
};

const hitTest = (g) => {
	const {
		x,
		y,
		columns,
		sidebarW,
		inspW,
		mainW,
		mainRowH,
		showBottom,
		window,
		selectedId,
		height,
	} = g;
	const mainTop = 3;
	const logareaTop = mainTop + 6;
	const logrowsTop = logareaTop + 3;
	const logareaLeft = sidebarW + 3;
	const logareaRight = logareaLeft + mainW - 1;
	const inspLeft = columns - inspW;
	const bottomTop = mainTop + mainRowH - 6;
	const mainColLeft = sidebarW + 3;
	const cardW = showBottom ? Math.max(1, Math.floor((mainW - 2) / 3)) : 0;

	if (y === 1) {
		const x3 = columns - 7;
		const x2 = columns - 16;
		const x1 = columns - (g.paused ? 26 : 24);
		const x0 = columns - (g.rec ? 33 : 30);
		if (x >= x0 && x < x0 + (g.rec ? 10 : 7)) return { type: "top", index: 0 };
		if (x >= x1 && x < x1 + (g.paused ? 11 : 9)) return { type: "top", index: 1 };
		if (x >= x2 && x < x2 + 9) return { type: "top", index: 2 };
		if (x >= x3 && x < x3 + 8) return { type: "top", index: 3 };
		return null;
	}

	if (x >= 2 && x <= 1 + sidebarW) {
		if (y >= 6 && y <= 10) return { type: "nav", section: 0, index: y - 6 };
		if (y >= 13 && y <= 23) return { type: "nav", section: 1, index: y - 13 };
		if (y >= 25 && y <= 28) return { type: "toast", msg: g.footerInfo };
		return null;
	}

	if (x >= inspLeft && x <= columns - 1 && columns >= 96) {
		if (y === mainTop) {
			const tabW = Math.max(3, Math.floor((inspW - 3) / 4));
			for (let i = 0; i < 4; i++) {
				const tLeft = inspLeft + i * (tabW + 1);
				if (x >= tLeft && x <= tLeft + tabW - 1) return { type: "tab", index: i };
			}
		}
		if (y >= mainTop + 1) return { type: "toast", msg: g.inspectorInfo };
		return null;
	}

	if (x >= logareaLeft && x <= logareaRight && y >= logareaTop && y <= logareaTop + height - 1) {
		if (y === logareaTop + 1) {
			if (x <= logareaRight - 21) return { type: "search" };
			if (x <= logareaRight - 11) return { type: "search" };
			return { type: "export" };
		}
		if (y === logareaTop + 2) {
			let cLeft = logareaLeft + 2;
			for (const l of LEVELS) {
				const w = l.length + 4;
				if (x >= cLeft && x <= cLeft + w - 1) return { type: "chip", level: l };
				cLeft += w + 1;
			}
			return null;
		}
		if (y >= logrowsTop) {
			let yPos = logrowsTop;
			for (const l of window) {
				const h = l.id === selectedId ? 2 : 1;
				if (y >= yPos && y < yPos + h) return { type: "log", id: l.id };
				yPos += h;
			}
		}
		return null;
	}

	if (showBottom && y >= bottomTop && y <= bottomTop + 5) {
		const card = Math.floor((x - mainColLeft) / (cardW + 1));
		if (card === 0) return { type: "toast", msg: g.telemetryInfo };
		if (card === 1) return { type: "toast", msg: g.heatmapInfo };
		if (card === 2) {
			if (y === bottomTop + 2 && x <= mainColLeft + 2 * (cardW + 1) + cardW / 2)
				return { type: "record", windowMs: 1_800_000 };
			if (y === bottomTop + 2) return { type: "record", windowMs: 3_600_000 };
			return { type: "toast", msg: g.sessionInfo };
		}
		return null;
	}

	if (y >= mainTop && y <= mainTop + 4) return { type: "toast", msg: g.overviewInfo };
	return null;
};

const HEAT_COLORS = [
	"#0d1525",
	"#131d35",
	"#1a2744",
	"#243154",
	"#352d63",
	"#4b2d72",
	"#63308a",
	"#7c30a0",
	"#96329e",
	"#b03e9a",
	"#cc4d94",
	"#e65d8a",
];

const Chip = ({ label, on, color }) => (
	<Box
		borderStyle="round"
		borderColor={on ? color || C.neonCyan : "#1a2540"}
		paddingX={1}
		backgroundColor={on ? "#0a1830" : "#0c1420"}
	>
		<Text color={on ? color || C.text : "#5a6888"} bold={on}>
			{on ? LEVEL_ICON[label] || "●" : "○"} {label}
		</Text>
	</Box>
);

const Divider = ({ width, color = C.border, glow }) =>
	glow ? (
		<Box>
			<Text color={C.neonViolet}>{NEON_CHARS.repeat(Math.floor(width / 2))}</Text>
			<Text color={C.neonCyan}>
				{NEON_CHARS.repeat(Math.max(0, width - Math.floor(width / 2)))}
			</Text>
		</Box>
	) : (
		<Box>{barrier(width, color)}</Box>
	);

const TextButton = ({ label, color, active }) => (
	<Text
		backgroundColor={active ? "#1a1040" : "#0e1525"}
		color={active ? C.neonCyan : color || "#b9c4df"}
		bold={active}
		paddingX={1}
	>
		{active ? "▸" : " "} {label}
	</Text>
);

const TopBar = ({ rec, paused, following, glow, connected, serverInfo }) => (
	<Box flexDirection="row" alignItems="center" gap={1} paddingX={1} height={1}>
		<Box width={1} backgroundColor={C.neonViolet} justifyContent="center" alignItems="center">
			<Text bold={true} color={C.bg}>
				N
			</Text>
		</Box>
		<Text wrap="truncate-end">
			<Text bold={true} color={C.neonViolet}>
				NEON
			</Text>
			<Text bold={true} color={C.neonCyan}>
				{"//"}OBSERVE
			</Text>
			<Text color={C.muted2}> ◈</Text>
		</Text>
		<Text
			backgroundColor={connected ? "#0a1a15" : "#1a0e0e"}
			color={C.muted}
			paddingX={1}
			wrap="truncate-end"
		>
			<Text color={connected ? C.neonGreen : C.neonPink} bold={true}>
				{connected ? "●" : "○"}
			</Text>{" "}
			{connected ? "LIVE" : "OFFLINE"}
		</Text>
		{serverInfo && (
			<Text color={C.muted2} wrap="truncate-end">
				{serverInfo}
			</Text>
		)}
		<Box marginLeft="auto" flexDirection="row" gap={1} alignItems="center" flexShrink={0}>
			<TextButton label={rec ? "● REC" : "○ REC"} active={rec} color={C.neonPink} />
			<TextButton label={paused ? "▶ PLAY" : "‖ PAUSE"} active={paused} color={C.amber} />
			<TextButton label={following ? "▼ FOLLOW" : "▽ FOLLOW"} active={following} color={C.green} />
			<TextButton label="◐ GLOW" active={glow} color={C.purple} />
		</Box>
	</Box>
);

const NavItem = ({ icon, label, badge, hot, active }) => {
	const badgeStr = badge === undefined ? "" : String(badge);
	return (
		<Box paddingX={1} backgroundColor={active ? "#121d38" : undefined}>
			<Text wrap="truncate-end">
				{active ? (
					<Text color={C.neonCyan} bold={true}>
						▸
					</Text>
				) : (
					<Text color={C.muted2}> </Text>
				)}
				<Text color={active ? C.neonCyan : "#7a88aa"} bold={active}>
					{icon} {pad(label, badge === undefined ? 12 : 9)}
				</Text>
				{badgeStr && (
					<Text color={hot ? C.neonPink : C.violet} bold={true}>
						{badgeStr}
					</Text>
				)}
			</Text>
		</Box>
	);
};

const Sidebar = ({ width, view, counts, categoryCounts, bookmarkedCount, footerInfo }) => (
	<Box
		width={width}
		minWidth={width}
		flexDirection="column"
		borderStyle="single"
		borderColor={C.border}
		backgroundColor={C.panel}
		padding={1}
	>
		<Text color={C.neonViolet} bold={true} wrap="truncate-end">
			◈ WORKSPACE
		</Text>
		{WORKSPACE.map((it) => (
			<NavItem
				key={it.key}
				icon={it.icon}
				label={it.label}
				badge={counts[it.key]}
				active={view === it.key}
			/>
		))}
		<Text color={C.neonViolet} bold={true} wrap="truncate-end" marginTop={1}>
			◈ SERVICES
		</Text>
		{SERVICES.map((it) => (
			<NavItem
				key={it.key}
				icon={it.icon}
				label={it.label}
				badge={it.key === "favorites" ? bookmarkedCount : categoryCounts[it.key]}
				hot={it.hot}
				active={view === it.key}
			/>
		))}
		<Box
			borderStyle="single"
			borderColor={C.border}
			paddingX={1}
			flexDirection="column"
			marginTop={1}
		>
			<Text bold={true} color={C.text} wrap="truncate-end">
				◈ WORKSPACE · production
			</Text>
			<Text color={C.muted} wrap="truncate-end">
				{footerInfo}
			</Text>
			<NeonBar width={width - 8} />
		</Box>
	</Box>
);

const NeonBar = ({ width }) => {
	const third = Math.max(0, Math.floor(width / 3));
	const rest = Math.max(0, width - third * 2);
	return (
		<Text>
			<Text color={C.neonViolet}>{"█".repeat(third)}</Text>
			<Text color={C.neonCyan}>{"█".repeat(third)}</Text>
			<Text color={C.neonPink}>{"█".repeat(rest)}</Text>
		</Text>
	);
};

const Metric = ({ label, value, color, delta, deltaColor = C.green, minW = 11 }) => (
	<Box
		flexGrow={1}
		flexShrink={1}
		minWidth={minW}
		flexDirection="column"
		borderStyle="single"
		borderColor={C.border}
		backgroundColor={C.card}
		paddingX={1}
		justifyContent="center"
	>
		<Text color={C.muted2} bold={true} wrap="truncate-end">
			{label}
		</Text>
		<Text color={color} bold={true} wrap="truncate-end">
			{value}
		</Text>
		<Text color={deltaColor} wrap="truncate-end">
			{delta}
		</Text>
	</Box>
);

const pctDelta = (arr) => {
	if (!arr || arr.length < 2) return null;
	const prev = arr[arr.length - 2];
	const last = arr[arr.length - 1];
	if (!prev) return null;
	const d = ((last - prev) / prev) * 100;
	return { pct: d, up: d >= 0 };
};

const Overview = ({ width, stats }) => {
	const roomy = width >= 78;
	const delta = pctDelta(stats?.lastRates);
	const deltaStr = delta ? `${delta.up ? "▲" : "▼"} ${Math.abs(delta.pct).toFixed(1)}%` : "—";
	const total =
		(stats?.byLevel?.info ?? 0) +
		(stats?.byLevel?.warn ?? 0) +
		(stats?.byLevel?.error ?? 0) +
		(stats?.byLevel?.critical ?? 0);
	return (
		<Box width={width} flexDirection="row" gap={1} flexShrink={0}>
			<Box
				flexGrow={roomy ? 1.6 : 1.5}
				flexShrink={1}
				minWidth={roomy ? 20 : 24}
				flexDirection="column"
				borderStyle="single"
				borderColor={C.neonCyan}
				backgroundColor={C.card}
				paddingX={1}
				justifyContent="center"
			>
				<Text color={C.neonCyan} bold={true} wrap="truncate-end">
					◈ LIVE OBSERVABILITY
				</Text>
				<Text color={C.text} bold={true} wrap="truncate-end">
					Backend / server logs
				</Text>
				<Text color={C.muted2} wrap="truncate-end">
					{total.toLocaleString()} total events · Canonical logger · Audit · Syslog
				</Text>
			</Box>
			{roomy ? (
				<>
					<Metric
						label="INFO"
						value={(stats?.byLevel?.info ?? 0).toLocaleString()}
						color={C.blue}
						delta={deltaStr}
						minW={13}
					/>
					<Metric
						label="WARN"
						value={(stats?.byLevel?.warn ?? 0).toLocaleString()}
						color={C.amber}
						delta="live"
						minW={13}
					/>
					<Metric
						label="ERROR"
						value={(
							(stats?.byLevel?.error ?? 0) + (stats?.byLevel?.critical ?? 0)
						).toLocaleString()}
						color={C.pink}
						delta="live"
						minW={13}
					/>
					<Metric
						label="REQ/S"
						value={String(stats?.reqRate ?? 0)}
						color={C.text}
						delta={`${stats?.rate ?? 0}/s`}
						minW={13}
					/>
				</>
			) : (
				<>
					<Metric
						label="INFO"
						value={(stats?.byLevel?.info ?? 0).toLocaleString()}
						color={C.blue}
						delta={deltaStr}
						minW={12}
					/>
					<Metric
						label="WARN"
						value={(stats?.byLevel?.warn ?? 0).toLocaleString()}
						color={C.amber}
						delta="live"
						minW={12}
					/>
				</>
			)}
		</Box>
	);
};

const Sparkline = ({ data, width, color = C.neonCyan }) => {
	const vals = (data || []).slice(-width);
	if (!vals.length) return <Text color={color}>{"▁".repeat(Math.max(0, width))}</Text>;
	const max = Math.max(...vals);
	const min = Math.min(...vals);
	const range = max - min || 1;
	const chars = "▁▂▃▄▅▆▇█";
	const line = Array.from(
		{ length: width },
		(_, i) => chars[Math.round(((vals[i] ?? min) - min) / range) * 7],
	);
	return <Text color={color}>{line.join("")}</Text>;
};

const SparkCard = ({ data, width }) => (
	<Box
		width={width}
		flexGrow={1}
		minWidth={18}
		flexDirection="column"
		borderStyle="single"
		borderColor={C.border}
		backgroundColor={C.card}
		paddingX={1}
		justifyContent="space-between"
	>
		<Text color={C.neonCyan} bold={true} wrap="truncate-end">
			◈ LIVE TELEMETRY
		</Text>
		<Text color={C.muted2} wrap="truncate-end">
			· last 60 sec
		</Text>
		<Sparkline data={data} width={Math.max(8, width - 4)} />
	</Box>
);

const HeatCard = ({ buckets, width }) => {
	const max = Math.max(...(buckets || []), 1);
	const cells = Array.from({ length: 24 }, (_, i) => (buckets?.[i] ?? 0) / max);
	return (
		<Box
			width={width}
			flexGrow={1}
			minWidth={18}
			flexDirection="column"
			borderStyle="single"
			borderColor={C.border}
			backgroundColor={C.card}
			paddingX={1}
			justifyContent="space-between"
		>
			<Text color={C.neonPink} bold={true} wrap="truncate-end">
				◈ TRAFFIC HEATMAP
			</Text>
			<Box flexDirection="column" gap={0}>
				<Box flexDirection="row" gap={0}>
					{cells.slice(0, 12).map((v, i) => (
						<Text key={i} color={HEAT_COLORS[Math.round(v * 11)]}>
							█
						</Text>
					))}
				</Box>
				<Box flexDirection="row" gap={0}>
					{cells.slice(12).map((v, i) => (
						<Text key={i + 12} color={HEAT_COLORS[Math.round(v * 11)]}>
							█
						</Text>
					))}
				</Box>
			</Box>
			<Text color={C.muted2}>00 04 08 12 16 20</Text>
		</Box>
	);
};

const SessionCard = ({ width, rec, startedAt, onRecord }) => (
	<Box
		width={width}
		flexGrow={1}
		minWidth={18}
		flexDirection="column"
		borderStyle="single"
		borderColor={rec ? C.neonPink : C.border}
		backgroundColor={C.card}
		paddingX={1}
		justifyContent="space-between"
	>
		<Text color={rec ? C.neonPink : C.neonViolet} bold={true} wrap="truncate-end">
			◈ SESSION RECORDER
		</Text>
		<Box flexDirection="row" gap={1}>
			<Text backgroundColor="#0e1a30" color={C.cyan} paddingX={1}>
				30 min
			</Text>
			<Text backgroundColor="#0e1a30" color={C.muted2} paddingX={1}>
				1 hour
			</Text>
		</Box>
		<Box flexDirection="row" justifyContent="space-between">
			<Text color={C.muted2}>State</Text>
			<Text bold={true} color={rec ? C.neonPink : C.muted2}>
				{rec ? `● REC · ${startedAt}` : "○ IDLE"}
			</Text>
		</Box>
	</Box>
);

const categoryTags = (e) => {
	const tags = [String(e.category || "live").toUpperCase()];
	if (e.meta?.status) tags.push(`HTTP ${e.meta.status}`);
	if (e.meta?.method) tags.push(e.meta.method.toUpperCase());
	if (e.groupCount > 1) tags.push(`×${e.groupCount}`);
	return tags;
};

const toView = (e) => ({
	id: e.id,
	ts: fmtTime(e.t || e.ts || Date.now()),
	t: e.t || Date.now(),
	level: String(e.level || "info").toUpperCase(),
	msg: String(e.message || ""),
	src: e.source || e.category || "unknown",
	category: e.category || "live",
	tags: categoryTags(e),
	meta: e.data ?? e.meta ?? {},
	stack: e.stack || null,
	requestId: e.request_id || null,
	bookmarked: !!e.bookmarked,
	groupCount: e.groupCount || 1,
	raw: e,
});

const LogRow = ({ log, selected, mainWidth }) => {
	const lvlColor = LEVEL_COLOR[log.level] || C.text;
	const lvlIcon = LEVEL_ICON[log.level] || "●";
	const leftW = 12 + 9 + 1;
	const tagW = mainWidth < 60 ? 0 : Math.min(18, Math.floor(mainWidth * 0.16));
	const msgW = Math.max(6, mainWidth - leftW - (tagW ? tagW + 2 : 0));
	const bg = selected ? "#111d38" : log.bookmarked ? "#14122a" : log.t % 2 ? "#0d1525" : "#0b1320";
	return (
		<Box flexDirection="column">
			<Box flexDirection="row" backgroundColor={bg} paddingX={1}>
				<Text color={C.muted2}>{pad(log.ts, 12)}</Text>
				<Text color={lvlColor} bold={true}>
					{lvlIcon} {pad(log.level, 7)}
				</Text>
				<Text color={log.bookmarked ? C.amber : C.text}>
					{log.bookmarked ? "★ " : ""}
					{trunc(log.msg, msgW)}
				</Text>
				{tagW > 0 && (
					<Box marginLeft="auto">
						<Text color={C.muted2}> {trunc(log.tags.join(" · "), tagW)}</Text>
					</Box>
				)}
			</Box>
			{selected && (
				<Box flexDirection="row" backgroundColor={bg} paddingX={1}>
					<Text color={C.neonCyan}>{pad(trunc(log.src, 12), 12)}</Text>
					<Text color={C.muted}>
						{log.requestId
							? `req:${shortId(log.requestId)}`
							: trunc(log.src.slice(12) || "", Math.max(1, mainWidth - 13))}
					</Text>
				</Box>
			)}
		</Box>
	);
};

const LogArea = ({
	width,
	height,
	filtered,
	selectedId,
	search,
	searchActive,
	enabled,
	paused,
	queryResult,
	onSearchChange,
	scrollOffset,
	visible,
	canInput,
}) => {
	const start = Math.max(0, Math.min(scrollOffset, Math.max(0, filtered.length - visible)));
	let window = filtered.slice(start, start + visible);
	if (window.some((l) => l.id === selectedId) && window.length > 1) window = window.slice(0, -1);
	return (
		<Box
			width={width}
			flexDirection="column"
			borderStyle="single"
			borderColor={C.border}
			flexShrink={0}
			height={height}
		>
			<Box
				flexDirection="row"
				gap={1}
				paddingX={1}
				alignItems="center"
				backgroundColor="#0c1420"
				flexShrink={0}
			>
				<Box flexGrow={1} backgroundColor="#080e1a" paddingX={1}>
					{searchActive && canInput ? (
						<TextInput
							value={search}
							onChange={(v) => onSearchChange(stripMouseSgr(v))}
							placeholder="Search logs… (Enter = server query)"
							showCursor={true}
						/>
					) : (
						<Text color={search ? C.neonCyan : C.muted2}>
							⌕{" "}
							{trunc(
								search || "error · redis · user:24 · regex:/…/ · 5m — press /",
								Math.max(10, width - 40),
							)}
						</Text>
					)}
					<Text color={C.muted2}> /</Text>
				</Box>
				<TextButton label="☷ Filter" />
				<TextButton label="⇩ Export" />
			</Box>
			<Box flexDirection="row" gap={1} paddingX={1} alignItems="center" flexShrink={0}>
				{LEVELS.map((l) => (
					<Chip key={l} label={l} on={enabled.has(l)} color={LEVEL_COLOR[l]} />
				))}
				<Box marginLeft="auto">
					<Text color={C.muted2}>
						{queryResult ? `☷ SERVER SEARCH ${filtered.length}` : paused ? "‖ PAUSED" : "● LIVE"}
					</Text>
				</Box>
			</Box>
			<Box flexDirection="column" flexGrow={1} minHeight={0}>
				{window.length === 0 && (
					<Text color={C.muted2} paddingLeft={1}>
						No logs match the current filter.
					</Text>
				)}
				{window.map((l) => (
					<LogRow key={l.id} log={l} selected={l.id === selectedId} mainWidth={width - 2} />
				))}
			</Box>
		</Box>
	);
};

const JsonBlock = ({ obj, indent = 0 }) => (
	<>
		{Object.entries(obj || {}).map(([k, v]) => {
			const isStr = typeof v === "string";
			const isNum = typeof v === "number";
			const val = isStr ? `"${v}"` : isNum ? String(v) : JSON.stringify(v);
			const valColor = isStr ? C.green : isNum ? C.blue : C.muted;
			return (
				<Text key={k}>
					{"  ".repeat(indent)}
					<Text color={C.purple}>{k}</Text>
					<Text color="#4a5578">: </Text>
					<Text color={valColor}>{trunc(String(val), 46)}</Text>
				</Text>
			);
		})}
	</>
);

const FlowView = ({ flow, requestId }) => {
	if (!requestId) return <Text color={C.muted2}>No request_id — flow unavailable.</Text>;
	if (!(flow && flow.length))
		return <Text color={C.muted2}>Fetching flow for {shortId(requestId)}…</Text>;
	const sorted = [...flow].sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
	const t0 = sorted[0].t ?? 0;
	const total = Math.max(0, (sorted[sorted.length - 1].t ?? 0) - t0);
	return (
		<Box flexDirection="column">
			<Text wrap="truncate-end">
				{sorted.map((s, i) => (
					<Text key={s.id}>
						<Text color={C.neonViolet}>{i ? " › " : ""}</Text>
						<Text color={C.text}>{trunc(s.message || s.category || "step", 22)}</Text>
					</Text>
				))}
				<Text color={C.neonViolet}> › </Text>
				<Text bold={true} color={C.neonGreen}>
					{total}ms
				</Text>
			</Text>
			{sorted.map((s) => {
				const dur = Number(s.meta?.duration_ms ?? s.data?.duration_ms ?? 0);
				const barLen = Math.min(20, Math.round((dur / Math.max(total, 1)) * 20));
				return (
					<Text key={s.id}>
						<Text color={C.muted2}>+{s.t - t0}ms </Text>
						<Text color={LEVEL_COLOR[s.level?.toUpperCase()] || C.text}>●</Text>{" "}
						<Text color={C.text}>{trunc(s.message || s.category || "?", 24)}</Text>
						<Text color={C.neonViolet}>{"█".repeat(barLen)}</Text>
						<Text color={C.muted2}> {Number.isFinite(dur) ? `${Math.round(dur)}ms` : ""}</Text>
					</Text>
				);
			})}
		</Box>
	);
};

const Inspector = ({ width, log, tab, flow }) => {
	const kv = (label, value, color) => (
		<Box flexDirection="row" gap={1}>
			<Text color="#3d4f70">{pad(label + ":", 10)}</Text>
			<Text color={color || "#b8c4dd"} wrap="truncate-end">
				{value}
			</Text>
		</Box>
	);
	const divider = () => <Text color="#1a2540">{"─".repeat(Math.max(4, width - 4))}</Text>;
	const tabW = Math.max(4, Math.floor((width - 2 - 3) / 4));
	const center = (s, w) => {
		const l = Math.max(0, Math.floor((w - s.length) / 2));
		return " ".repeat(l) + s + " ".repeat(Math.max(0, w - s.length - l));
	};
	const TABS = ["Metadata", "JSON", "Stack", "Raw"];
	const TAB_COLORS = [C.neonCyan, C.purple, C.amber, C.muted];
	const stackLines = (log.stack || "").split("\n").filter(Boolean);
	return (
		<Box width={width} minWidth={width} flexDirection="column" gap={1} minHeight={0}>
			<Box borderStyle="single" borderColor={C.border} flexDirection="row">
				<Text wrap="truncate-end">
					{TABS.map((t, i) => (
						<Text
							key={t}
							backgroundColor={i === tab ? "#141d35" : undefined}
							color={i === tab ? TAB_COLORS[i] : "#4a5578"}
							bold={i === tab}
						>
							{(i ? " " : "") + center(t, tabW)}
						</Text>
					))}
				</Text>
			</Box>
			<Box
				flexDirection="column"
				borderStyle="single"
				borderColor={C.border}
				backgroundColor={C.panel}
				padding={1}
				flexGrow={1}
			>
				{tab === 0 && (
					<>
						<Box flexDirection="row" justifyContent="space-between">
							<Text color={LEVEL_COLOR[log.level] || C.text} bold={true}>
								{LEVEL_ICON[log.level] || "●"} {log.level} · Event Inspector
							</Text>
							<Text color={C.neonCyan}>#{shortId(log.id)}</Text>
						</Box>
						{divider()}
						{kv("Timestamp", log.ts)}
						{kv("Source", log.src, C.neonCyan)}
						{kv("Message", log.msg)}
						{kv("Subsystem", log.category)}
						{kv("Request", log.requestId ? shortId(log.requestId) : "—")}
						{kv("Repeats", log.groupCount > 1 ? `×${log.groupCount}` : "—")}
						{divider()}
						<Text bold={true} color={C.neonViolet}>
							Request Flow
						</Text>
						<FlowView flow={flow} requestId={log.requestId} />
						{divider()}
						<Text bold={true} color={C.neonPink}>
							Payload
						</Text>
						<JsonBlock obj={log.meta} />
					</>
				)}
				{tab === 1 && (
					<>
						<Box flexDirection="row" justifyContent="space-between">
							<Text bold={true} color={C.purple}>
								Structured JSON
							</Text>
							<TextButton label="Copy" />
						</Box>
						{divider()}
						<JsonBlock
							obj={{
								id: log.id,
								timestamp: log.ts,
								level: log.level,
								message: log.msg,
								source: log.src,
								category: log.category,
								request_id: log.requestId,
								group_count: log.groupCount,
								payload: log.meta,
							}}
						/>
					</>
				)}
				{tab === 2 && (
					<>
						<Box flexDirection="row" justifyContent="space-between">
							<Text bold={true} color={C.amber}>
								Stack Trace
							</Text>
							<Text color={C.neonCyan}>{log.src}</Text>
						</Box>
						{divider()}
						{stackLines.length ? (
							stackLines.slice(0, 14).map((f, i) => (
								<Text key={i} color="#8896b4">
									<Text color={C.neonViolet}>↓ </Text>
									{trunc(f, width - 8)}
								</Text>
							))
						) : (
							<Text color={C.muted2}>No stack trace captured for this event.</Text>
						)}
					</>
				)}
				{tab === 3 && (
					<>
						<Box flexDirection="row" justifyContent="space-between">
							<Text bold={true} color={C.muted}>
								Raw Event
							</Text>
							<Text color={C.neonCyan}>console.*</Text>
						</Box>
						{divider()}
						<Text color={C.muted2}>
							[{log.ts}] [{log.level}] [{log.category}] {log.msg}
						</Text>
						<Text color={C.muted2}>source={log.src}</Text>
						<Text color={C.muted2}>
							host={log.raw?.host} pid={log.raw?.pid}
						</Text>
						<Text color={C.muted2}>request_id={log.requestId || "—"}</Text>
						<Text color={C.muted2}>payload={JSON.stringify(log.meta)}</Text>
					</>
				)}
			</Box>
		</Box>
	);
};

const StatusBar = ({ width, stats, paused, cpu, ram, mouseOn, shiftActive }) => {
	const primary = [
		<Text key="live" color={paused ? C.amber : C.neonGreen} bold={true}>
			● {paused ? "PAUSED" : "LIVE"}
		</Text>,
		<Text key="mouse" color={C.muted2}>
			<InputIcon />{" "}
			<Text color={mouseOn && !shiftActive ? C.neonGreen : shiftActive ? C.amber : C.pink}>
				{shiftActive ? "TEXT SEL" : mouseOn ? "NAV" : "OFF"}
			</Text>
		</Text>,
		<Text key="rate" color={C.muted2}>
			<BoltIcon /> <Text color={C.text}>{stats?.rate ?? 0}</Text>/s
		</Text>,
		<Text key="rps" color={C.muted2}>
			<ReqIcon /> <Text color={C.text}>{stats?.reqRate ?? 0}</Text>/s
		</Text>,
		<Text key="cpu" color={C.muted2}>
			<CpuIcon /> <Text color={cpu > 80 ? C.neonPink : C.text}>{cpu}%</Text>
		</Text>,
		<Text key="ram" color={C.muted2}>
			<RamIcon /> <Text color={C.text}>{ram}</Text>GB
		</Text>,
		<Text key="redis" color={C.muted2}>
			DbIcon{" "}
			<Text color={isRedisOk(stats?.redis) ? C.neonGreen : C.neonPink}>
				{isRedisOk(stats?.redis) ? "●" : "○"}
			</Text>
		</Text>,
		<Text key="q" color={C.muted2}>
			Q <Text color={C.text}>{stats?.workQ ?? 0}</Text>
		</Text>,
		<Text key="w" color={C.muted2}>
			W <Text color={C.text}>{stats?.workers ?? 0}</Text>
		</Text>,
	];
	const secondary = [
		<Text key="lat" color={C.muted2}>
			Lat <Text color={C.text}>{fmtMs(stats?.avgLatency)}</Text>
		</Text>,
		<Text key="p95" color={C.muted2}>
			p95 <Text color={C.text}>{fmtMs(stats?.p95)}</Text>
		</Text>,
		<Text key="drop" color={C.muted2}>
			Drop <Text color={C.text}>{stats?.dropped ?? 0}</Text>
		</Text>,
		<Text key="filt" color={C.muted2}>
			Filt <Text color={C.text}>{stats?.filtered ?? 0}</Text>
		</Text>,
		<Text key="rx" color={C.muted2}>
			Reg <Text color={C.text}>{stats?.regexHits || "—"}</Text>
		</Text>,
		<Text key="up" color={C.muted2}>
			Up <Text color={C.text}>{fmtUptime(stats?.uptime)}</Text>
		</Text>,
	];
	return (
		<Box flexDirection="row" gap={1} paddingX={1} alignItems="center">
			{primary}
			{width >= 144 && secondary}
			{width >= 205 && (
				<Box marginLeft="auto">
					<Text color={C.muted2}>
						/ Search · SP Pause · F Follow · J/K Nav · Enter Inspect · B Bookmark · R Record · E
						Export · M Mouse
					</Text>
				</Box>
			)}
		</Box>
	);
};

const InputIcon = () => <Text color={C.neonCyan}>⊞</Text>;
const BoltIcon = () => <Text color={C.amber}>⚡</Text>;
const ReqIcon = () => <Text color={C.blue}>→</Text>;
const CpuIcon = () => <Text color={C.violet}>◈</Text>;
const RamIcon = () => <Text color={C.green}>▣</Text>;

const isRedisOk = (r) => {
	if (r === undefined || r === null || r === "") return false;
	return /ready|connect|ok|up/i.test(String(r));
};

const fmtMs = (ms) => {
	if (!Number.isFinite(Number(ms))) return "—";
	return `${Math.round(Number(ms))}ms`;
};

const fmtUptime = (s) => {
	if (!s) return "—";
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	return h ? `${h}h${m}m` : `${m}m`;
};

const Toast = ({ msg }) => (
	<Box
		position="absolute"
		right={2}
		bottom={3}
		width={46}
		flexDirection="column"
		borderStyle="double"
		borderColor={C.neonCyan}
		backgroundColor="#080e1a"
		paddingX={1}
	>
		<Text bold={true} color={C.neonCyan}>
			✦ {msg}
		</Text>
		<Text color={C.muted2}>NEON{"//"}OBSERVE · live stream</Text>
	</Box>
);

const Modal = ({ log, width, height, onClose }) => {
	const mw = Math.min(70, width - 4);
	const mh = Math.min(26, height - 6);
	const stackLines = (log.stack || "").split("\n").filter(Boolean);
	return (
		<Box
			position="absolute"
			left={Math.floor((width - mw) / 2)}
			top={Math.floor((height - mh) / 2)}
			width={mw}
			height={mh}
			flexDirection="column"
			borderStyle="double"
			borderColor={C.neonCyan}
			backgroundColor="#080e1a"
			padding={1}
		>
			<Text bold={true} color={LEVEL_COLOR[log.level] || C.text}>
				{LEVEL_ICON[log.level] || "●"} {log.level} · {trunc(log.msg, 50)}
			</Text>
			<Text color={C.muted2}>
				{log.ts} · {log.src}
			</Text>
			<Divider width={mw - 4} glow={true} />
			<Box flexDirection="column">
				<Text bold={true} color={C.neonPink}>
					Payload
				</Text>
				<JsonBlock obj={log.meta} />
			</Box>
			{stackLines.length > 0 && (
				<Box flexDirection="column">
					<Text bold={true} color={C.amber}>
						Stack Trace
					</Text>
					{stackLines.slice(0, 8).map((f, i) => (
						<Text key={i} color="#8896b4">
							<Text color={C.neonViolet}>↓ </Text>
							{trunc(f, mw - 6)}
						</Text>
					))}
				</Box>
			)}
			<Text color={C.muted2}>ESC close · J/K navigate · B bookmark</Text>
		</Box>
	);
};

const useSysInfo = () => {
	const [sys, setSys] = useState({ cpu: 0, ram: 0 });
	const last = useRef(null);
	useEffect(() => {
		const sample = () => {
			const cpus = os.cpus();
			let idle = 0;
			let total = 0;
			for (const c of cpus) {
				for (const t of Object.values(c.times)) total += t;
				idle += c.times.idle;
			}
			let cpu = 0;
			if (last.current) {
				const di = idle - last.current.idle;
				const dt = total - last.current.total;
				cpu = dt > 0 ? Math.round((1 - di / dt) * 100) : 0;
			}
			last.current = { idle, total };
			setSys({ cpu, ram: Math.round(((os.totalmem() - os.freemem()) / 1_073_741_824) * 10) / 10 });
		};
		sample();
		const t = setInterval(sample, 2000);
		return () => clearInterval(t);
	}, []);
	return sys;
};

const NeonObserveApp = ({ url, port }) => {
	const { columns, rows } = useWindowSize();
	const { stdout } = useStdout();
	const { stdin } = useStdin();
	const apiPort = port || process.env.PORT || 4000;

	const [connected, setConnected] = useState(false);
	const [entries, setEntries] = useState([]);
	const [stats, setStats] = useState(null);
	const [heatmap, setHeatmap] = useState(null);
	const [bookmarks, setBookmarks] = useState(() => new Set());
	const [flows, setFlows] = useState(() => new Map());
	const [queryResult, setQueryResult] = useState(null);
	const queryResultRef = useRef(queryResult);
	queryResultRef.current = queryResult;
	const [rec, setRec] = useState(false);

	const [selectedId, setSelectedId] = useState(null);
	const [paused, setPaused] = useState(false);
	const pausedRef = useRef(false);
	const [following, setFollowing] = useState(true);
	const [glow, setGlow] = useState(true);
	const [search, setSearch] = useState("");
	const [searchActive, setSearchActive] = useState(false);
	const [enabled, setEnabled] = useState(() => new Set(LEVELS));
	const [view, setView] = useState("live");
	const [tab, setTab] = useState(0);
	const [modalId, setModalId] = useState(null);
	const [toastMsg, setToastMsg] = useState(null);
	const [scrollOffset, setScrollOffset] = useState(0);
	const [mouseOn, setMouseOn] = useState(() => !process.env.NO_MOUSE);
	const mouseOnRef = useRef(mouseOn);
	mouseOnRef.current = mouseOn;
	const [shiftActive, setShiftActive] = useState(false);
	const shiftHeld = useRef(false);
	const mouseWereOnBeforeShift = useRef(false);
	const searchActiveRef = useRef(searchActive);
	searchActiveRef.current = searchActive;
	const modalIdRef = useRef(modalId);
	modalIdRef.current = modalId;

	const toastTimer = useRef(null);
	const toast = useCallback((msg) => {
		setToastMsg(msg);
		clearTimeout(toastTimer.current);
		toastTimer.current = setTimeout(() => setToastMsg(null), 2400);
	}, []);

	const pendingRef = useRef([]);
	const pausedBufRef = useRef([]);
	const clientRef = useRef(null);
	const selectedIdRef = useRef(null);
	selectedIdRef.current = selectedId;
	const viewRef = useRef(view);
	viewRef.current = view;

	useEffect(() => {
		const client = new LogWsClient({ url });
		clientRef.current = client;
		client.on("connected", () => {
			setConnected(true);
			toast("◈ connected to log stream");
		});
		client.on("error", () => toast("log stream error — retrying…"));
		client.on("disconnected", () => setConnected(false));
		client.on("snapshot", (snap) => {
			if (snap.entries?.length) {
				pendingRef.current.push(...snap.entries.map(toView));
			}
			if (snap.stats) setStats(snap.stats);
			if (snap.bookmarks) setBookmarks(new Set(snap.bookmarks));
			if (snap.heatmap) setHeatmap(snap.heatmap);
		});
		client.on("entry", (e) => pendingRef.current.push(toView(e)));
		client.on("group", (e) => pendingRef.current.push(toView(e)));
		client.on("stats", (s) => setStats(s));
		client.on("burst", (b) =>
			toast(b.summary || `${b.total || 0} errors detected in burst window`),
		);
		client.on("query_result", (r) => {
			const list = (r.entries || []).map(toView);
			setQueryResult({ query: r.query, at: Date.now(), entries: list });
			setScrollOffset(0);
			toast(`server search: ${list.length} results`);
		});
		client.on("heatmap", (h) => setHeatmap(h));
		client.on("bookmark_ok", (m) => {
			setBookmarks((prev) => {
				const next = new Set(prev);
				if (m.bookmarked) next.add(m.id);
				else next.delete(m.id);
				return next;
			});
			toast(m.bookmarked ? "★ bookmarked" : "bookmark removed");
		});
		client.on("request_flow", (m) => {
			if (m.requestId) {
				setFlows((prev) => new Map(prev).set(m.requestId, (m.entries || []).map(toView)));
			}
		});
		client.on("record_stop", (m) => {
			setRec(false);
			toast(`session recorded: ${(m.entries || []).length} entries`);
		});
		client.on("recorder", (m) => setRec(!!m.active));
		client.connect();
		return () => {
			client.close();
			clientRef.current = null;
		};
	}, [url, toast]);

	useEffect(() => {
		if (stats?.activeRecorder !== undefined) setRec(!!stats.activeRecorder);
	}, [stats]);

	const flush = () => {
		const batch = pendingRef.current;
		pendingRef.current = [];
		if (!batch.length) return;
		if (pausedRef.current) {
			pausedBufRef.current.push(...batch);
			if (pausedBufRef.current.length > 5000) {
				pausedBufRef.current.splice(0, pausedBufRef.current.length - 5000);
			}
			return;
		}
		if (pausedBufRef.current.length) {
			batch.unshift(...pausedBufRef.current.splice(0));
		}
		setEntries((prev) => {
			const next = queryResultRef.current ? prev : [...prev, ...batch];
			return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
		});
	};
	const flushRef = useRef(flush);
	flushRef.current = flush;
	useEffect(() => {
		const t = setInterval(() => flushRef.current(), 160);
		const h = setInterval(() => clientRef.current?.heatmap(), 30_000);
		return () => {
			clearInterval(t);
			clearInterval(h);
		};
	}, []);

	const togglePause = (next) => {
		setPaused(next);
		pausedRef.current = next;
		if (!next && pausedBufRef.current.length) {
			flush();
		}
	};

	const sys = useSysInfo();

	const filteredRef = useRef([]);
	const filtered = useMemo(() => {
		let list = entries;
		if (queryResult) {
			list = queryResult.entries;
		}
		const q = search.trim().toLowerCase();
		return list.filter(
			(e) =>
				enabled.has(e.level) &&
				viewOk(e, view) &&
				(!q || `${e.msg} ${e.src} ${e.category} ${e.level}`.toLowerCase().includes(q)),
		);
	}, [entries, enabled, view, search, queryResult]);

	useEffect(() => {
		if (following && !queryResult) {
			setScrollOffset(Math.max(0, filtered.length - visible));
		}
	});

	filteredRef.current = filtered;

	const sidebarW = Math.min(30, Math.max(16, Math.floor(columns * 0.22)));
	const inspW = Math.min(42, Math.max(30, Math.floor(columns * 0.27)));
	const mainW = Math.max(10, columns - sidebarW - inspW - 4);
	const showBottom = rows >= 26;
	const cardW = showBottom ? Math.max(18, Math.floor((mainW - 2) / 3)) : 0;
	const mainRowH = Math.max(10, rows - 4);
	const logHeight = Math.max(8, mainRowH - 5 - 2 - (showBottom ? 6 : 0));
	const visible = Math.max(1, logHeight - 4);

	const start = Math.max(0, Math.min(scrollOffset, Math.max(0, filtered.length - visible)));
	const visibleWindow = filtered.slice(start, start + visible);
	const cleanWindow =
		visibleWindow.some((l) => l.id === selectedId) && visibleWindow.length > 1
			? visibleWindow.slice(0, -1)
			: visibleWindow;

	const move = (delta) => {
		const list = filteredRef.current;
		if (!list.length) return;
		const idx = Math.max(
			0,
			list.findIndex((l) => l.id === selectedIdRef.current),
		);
		const next = Math.min(Math.max(0, idx + delta), list.length - 1);
		const e = list[next];
		setSelectedId(e.id);
		setScrollOffset(
			Math.max(0, Math.min(next - Math.floor(visible / 2), Math.max(0, list.length - visible))),
		);
		if (following && next !== 0) setFollowing(false);
		if (e.requestId) clientRef.current?.requestFlow(e.requestId);
	};

	const select = (id) => {
		setSelectedId(id);
		setFollowing(false);
		const e = filtered.find((l) => l.id === id);
		if (e?.requestId) clientRef.current?.requestFlow(e.requestId);
	};

	const setViewFilter = (v) => {
		setView(v);
		setQueryResult(null);
		toast(`view: ${v}`);
	};

	const toggleChip = (level) => {
		setEnabled((prev) => {
			const next = new Set(prev);
			if (next.has(level)) next.delete(level);
			else next.add(level);
			return next;
		});
	};

	const doExport = () => {
		fetch(`http://localhost:${apiPort}/api/logs/export`)
			.then((r) => r.text())
			.then((t) => toast(`exported ${t.trim().split("\n").length} log lines`))
			.catch(() => toast("export failed — server unreachable"));
	};

	const doRecord = (windowMs) => {
		if (rec) {
			clientRef.current?.recordStop();
			return;
		}
		clientRef.current?.recordStart(windowMs ? { windowMs } : {});
		setRec(true);
		toast(
			windowMs ? `recording session (${Math.round(windowMs / 60_000)} min)` : "recording session",
		);
	};

	const selected =
		filtered.find((l) => l.id === selectedId) || filtered[filtered.length - 1] || null;

	const geoRef = useRef({});
	geoRef.current = {
		columns,
		rows,
		sidebarW,
		inspW,
		mainW,
		mainRowH,
		showBottom,
		visible,
		window: cleanWindow,
		selectedId,
		scrollOffset,
		height: logHeight,
		filteredCount: filtered.length,
		rec,
		paused,
		footerInfo: `${new Set(entries.map((e) => e.category)).size} sources · ${clientRef.current?.connected ? "1 live stream" : "offline"}`,
		inspectorInfo: "Event Inspector — click a tab or select a log row",
		telemetryInfo: `LIVE TELEMETRY — ${stats?.rate ?? 0} logs/sec · ${stats?.reqRate ?? 0} req/s`,
		heatmapInfo: `TRAFFIC HEATMAP — ${(heatmap?.buckets || []).reduce((a, b) => a + b, 0)} events`,
		sessionInfo: rec ? "SESSION RECORDER — recording…" : "SESSION RECORDER — idle",
		overviewInfo: `Overview — ${stats?.total ?? 0} total · ${stats?.byLevel?.error ?? 0} errors`,
	};

	const applyTarget = (t) => {
		if (!t) return;
		switch (t.type) {
			case "nav":
				if (t.section === 0) setViewFilter(WORKSPACE[t.index].key);
				else setViewFilter(SERVICES[t.index].key);
				break;
			case "chip":
				toggleChip(t.level);
				break;
			case "search":
				disableMouseRef.current();
				setSearchActive(true);
				break;
			case "export":
				doExport();
				break;
			case "tab":
				setTab(t.index);
				break;
			case "log":
				select(t.id);
				break;
			case "top":
				if (t.index === 0) doRecord(0);
				else if (t.index === 1) togglePause(!paused);
				else if (t.index === 2) setFollowing((f) => !f);
				else if (t.index === 3) setGlow((g) => !g);
				break;
			case "record":
				doRecord(t.windowMs);
				break;
			case "toast":
				toast(t.msg);
				break;
		}
	};
	const applyTargetRef = useRef(applyTarget);
	applyTargetRef.current = applyTarget;

	// Read through keyHandlerRef on every keypress, so a plain function (fresh
	// closure each render) is all it needs; the useCallback dependency list
	// had gone stale and was the only thing that could make it see old state.
	const keyHandler = (input, key) => {
		if (key.ctrlC) {
			disableMouseRef.current();
			process.exit(0);
		}
		if (key.shift && !shiftHeld.current) {
			shiftHeld.current = true;
			mouseWereOnBeforeShift.current = mouseOnRef.current;
			setShiftActive(true);
		} else if (!key.shift && shiftHeld.current) {
			shiftHeld.current = false;
			setShiftActive(false);
			if (mouseWereOnBeforeShift.current) {
				setMouseOn(true);
			}
		}

		if (searchActive) {
			if (key.escape) {
				setSearchActive(false);
				stdinBufRef.current = "";
				if (queryResult) {
					setQueryResult(null);
					toast("back to live stream");
				}
			} else if (key.return && search.trim()) {
				clientRef.current?.query({ q: search.trim() });
				setSearchActive(false);
				stdinBufRef.current = "";
			}
			return;
		}
		if (modalId !== null) {
			if (key.escape || key.return) setModalId(null);
			else if (input === "j" || key.downArrow) move(1);
			else if (input === "k" || key.upArrow) move(-1);
			else if (input === "b") clientRef.current?.bookmark(selected?.id);
			return;
		}
		if (input === "/") {
			disableMouseRef.current();
			setSearchActive(true);
			return;
		}
		if (key.return) {
			if (selected) setModalId(selected.id);
			return;
		}
		if (input === "j" || key.downArrow) {
			move(1);
			return;
		}
		if (input === "k" || key.upArrow) {
			move(-1);
			return;
		}
		if (key.tab) {
			setTab((t) => (t + 1) % 4);
			return;
		}
		if (input === " ") {
			togglePause(!paused);
			toast(paused ? "stream resumed" : "stream paused");
			return;
		}
		if (input === "f") {
			setFollowing((f) => !f);
			return;
		}
		if (input === "F") {
			setViewFilter("favorites");
			return;
		}
		if (input === "r") {
			doRecord(0);
			return;
		}
		if (input === "g") {
			setGlow((g) => !g);
			return;
		}
		if (input === "b") {
			clientRef.current?.bookmark(selected?.id);
			return;
		}
		if (input === "e") {
			setViewFilter("errors");
			return;
		}
		if (input === "E") {
			doExport();
			return;
		}
		if (input === "o") {
			setViewFilter("overview");
			return;
		}
		if (input === "l") {
			setViewFilter("live");
			return;
		}
		if (input === "w") {
			setViewFilter("warnings");
			return;
		}
		if (input === "i") {
			setViewFilter("info");
			return;
		}
		const SERVICE_KEYS = {
			a: "assistant",
			q: "image_queue",
			z: "redis",
			p: "prisma",
			y: "syslog",
			u: "audit",
			n: "analytics",
			x: "workers",
			s: "auth",
		};
		if (SERVICE_KEYS[input]) {
			setViewFilter(SERVICE_KEYS[input]);
			return;
		}
		const levelIdx = ["1", "2", "3", "4", "5", "6"].indexOf(input);
		if (levelIdx >= 0) {
			toggleChip(LEVELS[levelIdx]);
			return;
		}
		if (input === "m") {
			setMouseOn((v) => {
				toast(v ? "mouse off" : "mouse on");
				return !v;
			});
			return;
		}
		if (input === "c") {
			toast("copy: m to disable mouse, then select text");
			return;
		}
		if (key.escape) {
			if (queryResult) {
				setQueryResult(null);
				toast("back to live stream");
			} else {
				setModalId(null);
			}
		}
	};

	const keyHandlerRef = useRef(null);
	keyHandlerRef.current = keyHandler;
	const disableMouseRef = useRef(() => {});
	const stdinBufRef = useRef("");

	useEffect(() => {
		if (!searchActive && modalId === null) {
			const t = setTimeout(() => {
				try {
					const pin = process.stdin;
					if (pin?.setRawMode) {
						pin.setRawMode(true);
						pin.resume();
					}
					process.stdout.write("\x1b[?1000h\x1b[?1002h\x1b[?1006h");
				} catch {}
			}, 10);
			return () => clearTimeout(t);
		}
	}, [searchActive, modalId]);

	useEffect(() => {
		const pin = process.stdin;
		const pout = process.stdout;
		if (!pin || !pin.setRawMode) return;

		pin.setRawMode(true);
		pin.resume();

		const enableMouse = () => {
			try {
				pout.write("\x1b[?1000h\x1b[?1002h\x1b[?1006h");
			} catch {}
		};
		const disableMouse = () => {
			try {
				pout.write("\x1b[?1000l\x1b[?1002l\x1b[?1006l");
			} catch {}
		};
		disableMouseRef.current = disableMouse;

		enableMouse();
		const reenableTimer = setInterval(() => {
			if (
				!searchActiveRef.current &&
				modalIdRef.current === null &&
				mouseOnRef.current &&
				!shiftHeld.current
			) {
				if (pin.setRawMode) pin.setRawMode(true);
				if (pin.isPaused?.()) pin.resume();
				enableMouse();
			} else {
				disableMouse();
			}
		}, 400);

		stdinBufRef.current = "";
		const RAW_MOUSE_RE = new RegExp(ESC + "\\[<(\\d+);(\\d+);(\\d+)([Mm])", "g");

		const parseKeySequence = (raw) => {
			if (raw === "\x03") return { type: "key", key: "ctrlC" };
			if (raw === "\r" || raw === "\n") return { type: "key", key: "return" };
			if (raw === "\t") return { type: "key", key: "tab" };
			if (raw === "\x1b") return { type: "key", key: "escape" };
			if (raw === "\x7f" || raw === "\b") return { type: "key", key: "backspace" };
			if (raw === " ") return { type: "key", key: "space", input: " " };

			if (raw === "\x1b[A") return { type: "key", key: "upArrow" };
			if (raw === "\x1b[B") return { type: "key", key: "downArrow" };
			if (raw === "\x1b[C") return { type: "key", key: "rightArrow" };
			if (raw === "\x1b[D") return { type: "key", key: "leftArrow" };

			if (raw.startsWith("\x1b[1;2")) {
				const arrow = raw.slice(5);
				const keyMap = { A: "upArrow", B: "downArrow", C: "rightArrow", D: "leftArrow" };
				if (keyMap[arrow]) return { type: "key", key: keyMap[arrow], shift: true };
			}

			if (raw.length === 1) {
				const ch = raw;
				const isShift = ch >= "A" && ch <= "Z";
				return { type: "key", key: ch, input: ch.toLowerCase(), shift: isShift };
			}

			return null;
		};

		const handleKeyInput = (parsed) => {
			if (keyHandlerRef.current)
				keyHandlerRef.current(parsed.input || "", {
					ctrlC: parsed.key === "ctrlC",
					escape: parsed.key === "escape",
					return: parsed.key === "return",
					tab: parsed.key === "tab",
					backspace: parsed.key === "backspace",
					space: parsed.key === "space",
					upArrow: parsed.key === "upArrow",
					downArrow: parsed.key === "downArrow",
					leftArrow: parsed.key === "leftArrow",
					rightArrow: parsed.key === "rightArrow",
					shift: !!parsed.shift,
				});
		};

		const onData = (chunk) => {
			const raw = chunk.toString();
			stdinBufRef.current += raw;

			RAW_MOUSE_RE.lastIndex = 0;
			let last = 0;
			let m;
			while ((m = RAW_MOUSE_RE.exec(stdinBufRef.current)) !== null) {
				last = m.index + m[0].length;
				if (
					!searchActiveRef.current &&
					modalIdRef.current === null &&
					mouseOnRef.current &&
					!shiftHeld.current
				) {
					const b = +m[1];
					const x = +m[2];
					const y = +m[3];
					if (b & 64) {
						const scroll = b & 1 ? 1 : -1;
						const g = geoRef.current;
						setScrollOffset((o) =>
							Math.max(0, Math.min(o + scroll, Math.max(0, g.filteredCount - g.visible))),
						);
					} else if ((b & 3) === 0 && m[4] === "M" && x && y) {
						const g = geoRef.current;
						if (x <= g.columns && y <= g.rows) {
							const target = hitTest({ ...g, x, y });
							if (target) applyTargetRef.current(target);
						}
					}
				}
			}
			stdinBufRef.current = stdinBufRef.current.slice(last);

			if (searchActiveRef.current || modalIdRef.current !== null) {
				stdinBufRef.current = stdinBufRef.current
					// biome-ignore lint/suspicious/noControlCharactersInRegex: strips ANSI escape sequences from terminal input
					.replace(/\x1b\[<[^Mm]*[Mm]/g, "")
					// biome-ignore lint/suspicious/noControlCharactersInRegex: strips ANSI escape sequences from terminal input
					.replace(/\x1b\[?[A-Z]/g, "");
				if (stdinBufRef.current === "\x1b") {
					stdinBufRef.current = "";
					keyHandlerRef.current("", { escape: true });
					return;
				}
				if (stdinBufRef.current === "\r" || stdinBufRef.current === "\n") {
					stdinBufRef.current = "";
					keyHandlerRef.current("", { return: true });
					return;
				}
				if (stdinBufRef.current.length > 0 && !stdinBufRef.current.startsWith("\x1b"))
					stdinBufRef.current = "";
				return;
			}

			if (stdinBufRef.current.length > 0) {
				const parsed = parseKeySequence(stdinBufRef.current);
				if (parsed) {
					stdinBufRef.current = "";
					if (parsed.type === "key") handleKeyInput(parsed);
				} else if (
					stdinBufRef.current.length > 6 ||
					(stdinBufRef.current.length > 0 && !stdinBufRef.current.startsWith("\x1b"))
				) {
					stdinBufRef.current = "";
				}
			}
		};

		pin.on("data", onData);
		process.on("exit", disableMouse);
		return () => {
			pin.off("data", onData);
			process.off("exit", disableMouse);
			disableMouse();
			clearInterval(reenableTimer);
		};
	}, []);

	const counts = useMemo(
		() => ({
			overview: stats?.total ?? 0,
			live: entries.length,
			errors: (stats?.byLevel?.error ?? 0) + (stats?.byLevel?.critical ?? 0),
			warnings: stats?.byLevel?.warn ?? 0,
			info:
				(stats?.byLevel?.info ?? 0) + (stats?.byLevel?.debug ?? 0) + (stats?.byLevel?.success ?? 0),
		}),
		[stats, entries],
	);

	const border = glow ? C.border : C.border2;
	const recStartedAt = rec ? fmtTime(stats?.startedAt || Date.now()) : "";

	return (
		<Box flexDirection="column" width={columns} height={rows} backgroundColor={C.bg}>
			<TopBar
				rec={rec}
				paused={paused}
				following={following}
				glow={glow}
				connected={connected}
				serverInfo={
					clientRef.current?.url
						? trunc(clientRef.current.url.replace("ws://", "").replace("/ws/logs", ""), 14)
						: ""
				}
			/>
			<Divider width={columns} color={border} glow={glow} />
			<Box flexDirection="row" gap={1} paddingX={1} height={mainRowH} flexShrink={0}>
				{columns >= 84 && (
					<Sidebar
						width={sidebarW}
						view={view}
						counts={counts}
						categoryCounts={stats?.byCategory || {}}
						bookmarkedCount={bookmarks.size}
						footerInfo={geoRef.current.footerInfo}
						onNav={setViewFilter}
					/>
				)}
				<Box flexDirection="column" flexGrow={1} minWidth={46} height={mainRowH} flexShrink={0}>
					<Overview width={mainW} stats={stats} />
					<Box height={1} />
					<LogArea
						width={mainW}
						height={logHeight}
						filtered={filtered}
						selectedId={selectedId}
						search={search}
						searchActive={searchActive}
						enabled={enabled}
						paused={paused}
						queryResult={queryResult}
						onSearchChange={setSearch}
						scrollOffset={scrollOffset}
						visible={visible}
						canInput={!!stdin?.isTTY}
					/>
					<Box height={1} />
					{showBottom && (
						<Box flexDirection="row" gap={1} flexShrink={0} width={mainW} height={6}>
							<SparkCard data={stats?.lastRates || []} width={cardW} />
							<HeatCard buckets={heatmap?.buckets} width={cardW} />
							<SessionCard width={cardW} rec={rec} startedAt={recStartedAt} onRecord={doRecord} />
						</Box>
					)}
				</Box>
				{columns >= 96 && (
					<Inspector
						width={inspW}
						log={selected || fallbackEntry()}
						tab={tab}
						flow={selected?.requestId ? flows.get(selected.requestId) : null}
					/>
				)}
			</Box>
			<Divider width={columns} color={border} glow={glow} />
			<StatusBar
				width={columns}
				stats={stats}
				paused={paused}
				cpu={sys.cpu}
				ram={sys.ram}
				mouseOn={mouseOn}
				shiftActive={shiftActive}
			/>
			{toastMsg && <Toast msg={toastMsg} />}
			{modalId !== null && (
				<Modal
					log={filtered.find((l) => l.id === modalId) || fallbackEntry()}
					width={columns}
					height={rows}
					onClose={() => setModalId(null)}
				/>
			)}
		</Box>
	);
};

const fallbackEntry = () => ({
	id: "none",
	ts: "--:--:--.---",
	t: Date.now(),
	level: "INFO",
	msg: "No events yet — waiting for the log stream…",
	src: "system",
	category: "live",
	tags: ["LIVE"],
	meta: {},
	stack: null,
	requestId: null,
	bookmarked: false,
	groupCount: 1,
	raw: {},
});

const viewOk = (e, view) => {
	if (view === "overview" || view === "live") return true;
	if (view === "errors") return e.level === "ERROR" || e.level === "CRITICAL";
	if (view === "warnings") return e.level === "WARN";
	if (view === "info") return e.level === "INFO" || e.level === "DEBUG" || e.level === "SUCCESS";
	if (view === "favorites") return e.bookmarked;
	return e.category === view;
};

export default NeonObserveApp;
export { NeonObserveApp, toView, viewOk };
