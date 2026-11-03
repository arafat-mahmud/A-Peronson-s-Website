import os from "node:os";
import blessed from "blessed";
import { CATEGORY_LEVELS } from "../log/categories.js";
import { parserCount } from "../log/parsers.js";
import { BottomPanels } from "./bottomPanels.js";
import { ContextMenu } from "./contextMenu.js";
import { pulseColor } from "./effects.js";
import { FilterBar } from "./filterBar.js";
import { Inspector } from "./inspector.js";
import { LogList } from "./logList.js";
import {
	BookmarksOverlay,
	DiffOverlay,
	Notifications,
	RegexTester,
	SessionRecorderOverlay,
	ThemePickerOverlay,
	WorkspacesOverlay,
} from "./overlays.js";
import { Overview } from "./overview.js";
import { HeatmapPanel, LatencyHistogramPanel, MetricsPanel, TimelinePanel } from "./panels.js";
import { Sidebar } from "./sidebar.js";
import { store } from "./state.js";
import { StatusBar } from "./statusBar.js";
import { HubTabs } from "./tabs.js";
import { COLORS, getGlowIntensity, setGlowIntensity } from "./theme.js";
import { TopBar } from "./topbar.js";
import { getWorkerPool, scanMessagesAsync } from "./workerPool.js";
import { listStates, loadState, saveState } from "./workspace.js";
import { LogWsClient } from "./wsClient.js";

const DEFAULT_WS = process.env.LOG_WS_URL || "ws://localhost:4000/ws/logs";

// row budgets (rows, not px)
const TOPBAR_H = 1;
const TABBAR_H = 1;
const OVERVIEW_H = 5;
const TOOLBAR_H = 1;
const TELEMETRY_H = 8;
const FOOTER_H = 1;

export class LogDashboardApp {
	constructor({ cool = false } = {}) {
		this.screen = null;
		this.cool = cool;
		this.client = new LogWsClient({ url: DEFAULT_WS });
		this.selectedEntry = null;
		this.panelSize = { sidebar: 22, inspector: 50 };
		this._dragging = null;
		this._glow = false;
		this._searchMode = false;
		this._searchBox = null;
		this._diffFirst = null;
		this._bookmarkCache = new Map();
		this.servers = new Map([[process.env.LOG_WS_NAME || "local", { url: DEFAULT_WS }]]);
		this._serverNames = [];
		this._regexHits = 0;
	}

	build() {
		const screen = (this.screen = blessed.screen({
			smartCSR: false,
			forceUnicode: true,
			title: "GARTEX HUB — LOG TERMINAL",
			fullUnicode: true,
			mouse: true,
			debug: false,
		}));
		screen.key(["C-q"], () => this.shutdown());

		if (this.cool) {
			setGlowIntensity(80);
		}

		this.buildLayout();
		this.buildOverlays();
		this.bindKeyboard();
		this.bindStore();
		this.bindMouseDrag();
		this.bindClient();
		this._restoreLayout();

		if (this.cool) {
			this._startBorderPulse();
		}

		this.screen.render();
		this.flash(
			this.cool
				? "🚀 MODE MORE COOL — full neon (border pulse, max glow)"
				: "connected to log stream",
		);
	}

	buildLayout() {
		const screen = this.screen;
		const bodyTop = TOPBAR_H + TABBAR_H;

		this.topbar = new TopBar({
			parent: screen,
			top: 0,
			left: 0,
			right: 0,
			height: TOPBAR_H,
			animMs: this.cool ? 250 : 400,
		});
		this.topbar.onAction = (key) => this.handleTopbarAction(key);
		this.topbar.setCool(this.cool);

		this.tabBar = new HubTabs({
			parent: screen,
			top: TOPBAR_H,
			left: 0,
			right: 0,
			height: TABBAR_H,
		});
		this.tabBar.onSelectTab = (name) => this.switchServer(name);
		this.tabBar.onScrub = (ms) => this.scrubTime(ms);
		this.tabBar.addServer({ name: "local", url: DEFAULT_WS, online: true });
		this.tabBar.setActive("local");

		this.sidebar = new Sidebar({
			parent: screen,
			top: bodyTop,
			left: 0,
			height: `100%-${bodyTop + FOOTER_H}`,
			width: this.panelSize.sidebar,
		});

		this.overview = new Overview({
			parent: screen,
			top: bodyTop,
			left: this.panelSize.sidebar,
			right: this.panelSize.inspector,
			height: OVERVIEW_H,
		});

		this.filterBar = new FilterBar({
			parent: screen,
			top: bodyTop + OVERVIEW_H,
			left: this.panelSize.sidebar,
			right: this.panelSize.inspector,
			height: TOOLBAR_H,
		});

		this.logList = new LogList({
			parent: screen,
			top: bodyTop + OVERVIEW_H + TOOLBAR_H,
			left: this.panelSize.sidebar,
			right: this.panelSize.inspector,
			height: `100%-${bodyTop + OVERVIEW_H + TOOLBAR_H + TELEMETRY_H + FOOTER_H}`,
			animMs: this.cool ? 150 : 250,
		});

		this.bottomPanels = new BottomPanels({
			parent: screen,
			top: `100%-${TELEMETRY_H + FOOTER_H}`,
			left: this.panelSize.sidebar,
			right: this.panelSize.inspector,
			height: TELEMETRY_H,
		});

		this.inspector = new Inspector({
			parent: screen,
			top: bodyTop,
			right: 0,
			height: `100%-${bodyTop + FOOTER_H}`,
			width: this.panelSize.inspector,
		});

		this.statusBar = new StatusBar({
			parent: screen,
			top: "100%-1",
			left: 0,
			right: 0,
			height: FOOTER_H,
			animMs: this.cool ? 250 : 400,
		});

		// resizable splitters
		this.splitSidebar = blessed.box({
			parent: screen,
			top: bodyTop,
			left: this.panelSize.sidebar - 1,
			width: 1,
			height: `100%-${bodyTop + FOOTER_H}`,
			tags: true,
			style: { bg: COLORS.border },
			content: "",
		});
		this.splitInspector = blessed.box({
			parent: screen,
			top: bodyTop,
			right: this.panelSize.inspector - 1,
			width: 1,
			height: `100%-${bodyTop + FOOTER_H}`,
			style: { bg: COLORS.border },
		});

		this.sidebar.onSelect = (cat) => store.setCategory(cat);
		this.sidebar.onClick = (cat) => this.sidebar.clearUnread(cat);
		this.filterBar.onToggleLevel = (level) => {
			store.toggleLevel(level);
			this.filterBar.toggleLevel(level);
		};
		this.filterBar.onToggleCategory = (cat) => {
			this.filterBar.toggleCategory(cat);
			const key = cat;
			// map category chip to a sidebar section if possible
			const map = {
				requests: "requests",
				syslog: "syslog",
				redis: "redis",
				workers: "workers",
				auth: "auth",
				assistant: "assistant",
				image_queue: "image_queue",
				prisma: "prisma",
			};
			if (map[key]) {
				store.setCategory(map[key]);
				this.sidebar.setActive(map[key]);
			}
		};
		this.filterBar.onSearch = () => this.openSearch();
		this.filterBar.onFocusSearch = () => this.openSearch();
		this.filterBar.onAction = (key) => {
			switch (key) {
				case "filter":
					this.openSearch();
					break;
				case "regex":
					this.regexTester.open(this.selectedEntry?.message || "");
					break;
				case "time":
					this.toggleTravel();
					break;
				case "export":
					this.client.send("snapshot");
					this.flash("exported snapshot to buffer");
					break;
				case "pause":
					this.togglePause();
					break;
				case "follow":
					this.toggleFollow();
					break;
				case "bookmarks":
					this.showBookmarks();
					break;
				default:
					break;
			}
		};

		this.onClickRow = (idx, entry) => {
			store.select(entry.id);
		};
		this.logList.onClickRow = this.onClickRow;
		this.logList.onDoubleClickRow = (idx) => {
			const entry = this.logList.entries[idx];
			if (entry) {
				this.openFullEntry(entry);
			}
		};
		this.logList.onNavigate = (idx) => {
			const entry = this.logList.entries[idx];
			if (entry) {
				store.select(entry.id);
			}
		};
		this.logList.onContextMenu = (x, y, idx) => {
			const entry = this.logList.entries[idx];
			if (entry) {
				store.select(entry.id);
			}
			this.openContextMenu(x, y);
		};
		this.logList.onToggleGroup = (key) => {
			store.collapseGroup(key);
		};
		this.bottomPanels.onChoose = (key) => {
			if (key === "record_30") {
				this.startRecorder({ label: "Last 30 min", windowMs: 30 * 60 * 1000 });
			} else if (key === "record_60") {
				this.startRecorder({ label: "Last hour", windowMs: 60 * 60 * 1000 });
			}
		};
	}

	handleTopbarAction(key) {
		switch (key) {
			case "record":
				if (store.recorder?.active) {
					this.stopRecorder();
				} else {
					this.sessionOverlay.open();
				}
				break;
			case "pause":
				this.togglePause();
				break;
			case "follow":
				this.toggleFollow();
				break;
			case "glow":
				this.toggleGlow();
				break;
			default:
				break;
		}
	}

	toggleGlow() {
		this._glow = !this._glow;
		setGlowIntensity(this._glow ? 60 : 18);
		this.topbar.setGlow(this._glow);
		this.screen.render();
		this.flash(this._glow ? "neon glow enabled" : "neon glow reduced");
	}

	buildOverlays() {
		const screen = this.screen;

		this.contextMenu = new ContextMenu({ parent: screen, right: 0, top: 0, left: 0 });
		this.contextMenu.onAction = (key, idx) => this.handleContextAction(key);

		this.notifications = new Notifications({ parent: screen, top: 3, right: 1 });
		this.notifications.onClick = (entry) => {
			if (entry?.id) {
				store.select(entry.id);
			}
			if (entry) {
				this.inspector.setEntry(entry);
			}
		};

		this.diffOverlay = new DiffOverlay({ parent: screen, top: "center", left: "center" });
		this.regexTester = new RegexTester({ parent: screen, top: "center", left: "center" });
		this.regexTester.onStreamScan = (pattern) => {
			const re = new RegExp(pattern);
			const hay = () => store.entries.filter((e) => re.test(e.message || "")).length;
			// offload the flat filter to a worker thread when the buffer is large
			if (store.entries.length > 2000) {
				return scanMessagesAsync(store.entries.slice(-2000), pattern).then(
					(r) => (r?.hits ? r.hits.length : 0),
					() => hay(),
				);
			}
			return Promise.resolve(hay());
		};
		this.sessionOverlay = new SessionRecorderOverlay({
			parent: screen,
			top: "center",
			left: "center",
		});
		this.sessionOverlay.onChoose = (item) => this.startRecorder(item);
		this.sessionOverlay.onStop = () => this.stopRecorder();
		this.sessionOverlay.onReplay = () => this.replayRecording();
		this.bookmarksOverlay = new BookmarksOverlay({ parent: screen, top: "center", left: "center" });
		this.workspacesOverlay = new WorkspacesOverlay({
			parent: screen,
			top: "center",
			left: "center",
		});
		this.themePicker = new ThemePickerOverlay({
			parent: screen,
			top: "center",
			left: "center",
		});

		this.metricsPanel = new MetricsPanel({
			parent: screen,
			top: "center",
			left: "center",
			width: 52,
			height: 30,
		});
		this.timelinePanel = new TimelinePanel({
			parent: screen,
			top: "center",
			left: "center",
			width: 52,
			height: 14,
		});
		this.heatmapPanel = new HeatmapPanel({
			parent: screen,
			top: "center",
			left: "center",
			width: 52,
			height: 20,
		});
		this.histogramPanel = new LatencyHistogramPanel({
			parent: screen,
			top: "center",
			left: "center",
			width: 52,
			height: 16,
		});

		for (const p of [
			this.metricsPanel,
			this.timelinePanel,
			this.heatmapPanel,
			this.histogramPanel,
		]) {
			p.hide();
			p.on("click", () => p.hide());
		}
		this.timelinePanel.onSpike = (level) => {
			if (level) {
				store.toggleLevel(level);
				this.filterBar.toggleLevel(level);
			}
		};
		this.histogramPanel.onSpike = ({ bucket, count }) => {
			this.flash(`histogram: ${bucket}ms × ${count}`);
		};
	}

	bindKeyboard() {
		const screen = this.screen;
		const key = (keys, fn) => screen.key(keys, () => this.handleKey(fn));
		key(["j"], () => this.logList.navigate(1));
		key(["k"], () => this.logList.navigate(-1));
		key(["down"], () => this.logList.navigate(1));
		key(["up"], () => this.logList.navigate(-1));
		key(["f", "F"], () => this.toggleFollow());
		key(["space"], () => this.togglePause());
		key(["enter"], () => this.openSelected());
		key(["g"], () => store.toggleGrouping());
		key(["escape"], () => this.closeOverlays());
		key(["c"], () => this.copySelected());
		key(["C-c"], () => this.copySelected());
		key(["d"], () => this.diffNext());
		key(["b"], () => this.bookmarkSelected());
		key(["B"], () => this.showBookmarks());
		key(["e"], () => this.ignoreSelected());
		key(["y"], () => this.copyFieldFromInspector());
		key(["r"], () => this.regexTester.open(this.selectedEntry?.message || ""));
		key(["m"], () => this.togglePanel(this.metricsPanel));
		key(["t"], () => this.togglePanel(this.timelinePanel));
		key(["h"], () => this.togglePanel(this.heatmapPanel));
		key(["l"], () => this.togglePanel(this.histogramPanel));
		key(["C-f"], () => this.openFilterPanel());
		key(["tab"], () => this.focusNext());
		key(["s"], () => this.saveWorkspace());
		key(["S"], () => this.showWorkspaces());
		key(["V"], () => this.toggleTravel());
		key(["C-t"], () => this.addServerPrompt());
		key(["C-g"], () => this.themePicker.open());
		key(["/"], () => this.openSearch());
		key(["1"], () => this.switchSection(1));
		key(["2"], () => this.switchSection(2));
		key(["3"], () => this.switchSection(3));
		key(["4"], () => this.switchSection(4));
		key(["5"], () => this.switchSection(5));
		key(["6"], () => this.switchSection(6));
		key(["7"], () => this.switchSection(7));
		key(["8"], () => this.switchSection(8));
		key(["9"], () => this.switchSection(9));
		key(["C-1"], () => this.switchSection(1));
		key(["C-2"], () => this.switchSection(2));
		key(["C-3"], () => this.switchSection(3));
		key(["C-4"], () => this.switchSection(4));
		key(["C-5"], () => this.switchSection(5));
		key(["C-6"], () => this.switchSection(6));
		key(["C-7"], () => this.switchSection(7));
		key(["C-8"], () => this.switchSection(8));
		key(["C-9"], () => this.switchSection(9));
		key(["?"], () => this.showHelp());
	}

	handleKey(fn) {
		if (!this._overlaysOpen()) {
			fn();
		}
	}

	_overlaysOpen() {
		const boxes = [
			this.contextMenu,
			this.diffOverlay,
			this.regexTester,
			this.metricsPanel,
			this.timelinePanel,
			this.heatmapPanel,
			this.histogramPanel,
			this.sessionOverlay,
			this.bookmarksOverlay,
			this.workspacesOverlay,
			this.themePicker,
		];
		return boxes.some((b) => b && b.hidden === false);
	}

	togglePanel(panel) {
		if (panel.hidden) {
			panel.show();
			panel.focus();
		} else {
			panel.hide();
		}
		this.screen.render();
	}

	// ── persistence / workspaces ────────────────────────────────────────────
	_saveLayout() {
		return {
			sidebar: this.panelSize.sidebar,
			inspector: this.panelSize.inspector,
			server: this.tabBar?.active || this.activeServer,
			category: store.categoryFilter,
		};
	}

	saveWorkspace() {
		saveState(this._saveLayout());
		this.flash("workspace saved");
	}

	showWorkspaces() {
		this.workspacesOverlay.setNames(listStates());
		this.workspacesOverlay.onPick = (name) => {
			const st = loadState(name);
			if (st.sidebar) {
				this.panelSize.sidebar = st.sidebar;
			}
			if (st.inspector) {
				this.panelSize.inspector = st.inspector;
			}
			if (st.category) {
				store.setCategory(st.category);
			}
			if (st.server && this.servers.has(st.server)) {
				this.switchServer(st.server);
			}
			this.layoutPanels();
			this.flash(`loaded ${name}`);
		};
	}

	// ---- multi-server tabs ──────────────────────────────────────────────────
	addServerPrompt() {
		const box = blessed.textbox({
			parent: this.screen,
			top: this.tabBar.top + 1,
			left: 1,
			width: 70,
			height: 1,
			tags: false,
			inputOnFocus: true,
			style: { bg: COLORS.card, fg: "#E2E8F0", border: { fg: COLORS.accent } },
			border: { type: "line", fg: COLORS.accent },
		});
		box.setValue("ws://host:port/ws/logs");
		box.on("submit", (v) => {
			const url = String(v || "").trim() || DEFAULT_WS;
			const name = `srv${this.servers.size + 1}`;
			this.servers.set(name, { url });
			this.tabBar.addServer({ name, url });
			this.switchServer(name);
			box.destroy();
			this.screen.render();
		});
		box.on("cancel", () => {
			box.destroy();
			this.screen.render();
		});
		box.show();
		box.focus();
		this.screen.render();
	}

	switchServer(name) {
		const info = this.servers.get(name);
		if (!info) {
			return;
		}
		this.tabBar.setActive(name);
		this.activeServer = name;
		// Re-point the transport to the chosen server and reconnect so each tab
		// actually streams from its own backend (real multi-server support).
		if (info.url && info.url !== this.client.url) {
			store.entries = [];
			this.logList.entries = [];
			this.client.url = info.url;
			this.client.close();
			this.client.connect();
			this.tabBar.setServer(name, { url: info.url, online: true });
		}
		this.sidebar.setLiveInfo({
			sources: this.servers.size,
			parsers: parserCount(),
			live: this.client.connected ? 1 : 0,
		});
		this.flash(`connected to ${name}`);
		this.screen.render();
	}

	scrubTime(ms) {
		const off = this.tabBar.shiftTime(ms);
		const cutoff = Date.now() + off;
		this.flash(`scrubbing… t:${new Date(cutoff).toTimeString().slice(0, 8)}`);
		// In time-travel we filter entries by recency window in the state store.
		store.setTimeWindow ? store.setTimeWindow(Math.max(0, Math.abs(off))) : void 0;
		this.refreshLogList();
	}

	toggleTravel() {
		this.tabBar.toggle();
		this.screen.render();
	}

	// ── bookmarks ────────────────────────────────────────────────────────────
	showBookmarks() {
		const bms = store.entries.filter((e) => e.bookmarked).slice(-20);
		this.bookmarksOverlay.setItems(bms);
	}

	// ── session recorder ─────────────────────────────────────────────────────
	startRecorder(item) {
		this.client.send("record_start", { windowMs: item.windowMs });
		store.setRecorder({ active: true, entries: [] });
		this.topbar.setRec(true);
		this.flash(`recording: ${item.label}`);
	}

	stopRecorder() {
		this.client.send("record_stop", {});
		const snapshot = (store.recorder?.entries ?? store.entries).slice(-200);
		this.sessionOverlay.setRecording(false);
		store.setRecorder(null);
		this.topbar.setRec(false);
		this._recording = snapshot;
		this.flash("recording stopped");
	}

	replayRecording() {
		const snap = this._recording;
		if (!(snap && snap.length)) {
			this.flash("nothing to replay");
			return;
		}
		// replay the last 200 captured entries into the log list
		store.entries = [...snap];
		this.refreshLogList();
		this.flash(`replayed ${snap.length} logged entries`);
	}

	// ── search ───────────────────────────────────────────────────────────────
	openSearch() {
		if (!this._searchBox) {
			this._searchBox = blessed.textbox({
				parent: this.screen,
				top: "100%-3",
				left: 0,
				width: 60,
				height: 1,
				tags: false,
				inputOnFocus: true,
				style: { bg: COLORS.card, fg: "#E2E8F0", border: { fg: COLORS.accent } },
				border: { type: "line", fg: COLORS.accent },
			});
			this._searchBox.on("submit", (value) => {
				store.setSearch(String(value || "").trim());
				this.filterBar.setSearch(String(value || "").trim());
				this.logList.searchHighlight = String(value || "").trim();
				this.refreshLogList();
				this._searchBox.hide();
				this.screen.render();
			});
			this._searchBox.on("cancel", () => {
				this._searchBox.hide();
				this.screen.render();
			});
		}
		this._searchBox.setValue(store.searchQuery);
		this._searchBox.show();
		this._searchBox.focus();
		this.screen.render();
	}

	openFilterPanel() {
		if (!this._filterBox) {
			this._filterBox = blessed.textbox({
				parent: this.screen,
				top: "100%-3",
				left: 0,
				width: 60,
				height: 1,
				tags: false,
				inputOnFocus: true,
				style: { bg: COLORS.card, fg: "#E2E8F0", border: { fg: "#FBBF24" } },
				border: { type: "line", fg: "#FBBF24" },
			});
			this._filterBox.setValue(store.searchQuery);
			this._filterBox.on("submit", (value) => {
				store.setSearch(String(value || "").trim());
				this.filterBar.setSearch(this._filterBox.getValue());
				this.refreshLogList();
			});
			this._filterBox.on("cancel", () => {
				this._filterBox.hide();
				this.screen.render();
			});
		}
		this._filterBox.show();
		this._filterBox.focus();
		this.screen.render();
	}

	switchSection(n) {
		const cats = [
			"live",
			"errors",
			"warnings",
			"requests",
			"assistant",
			"redis",
			"syslog",
			"workers",
			"favorites",
		];
		const cat = cats[n - 1];
		if (cat) {
			store.setCategory(cat);
			this.sidebar.setActive(cat);
		}
	}

	toggleFollow() {
		store.setFollow(!store.follow);
		this.topbar.setFollow(store.follow);
		if (store.follow) {
			this.logList.follow();
		}
	}

	togglePause() {
		const paused = store.togglePause();
		this.filterBar.setPaused(paused);
		this.topbar.setPaused(paused);
		this.screen.render();
	}

	openSelected() {
		const entry = store.getSelected();
		if (entry) {
			this.inspector.setEntry(entry);
		}
	}

	openFullEntry(entry) {
		this.inspector.setEntry(entry);
		this.inspector.setTab("raw");
	}

	focusNext() {
		const order = [this.logList, this.inspector, this.filterBar];
		const cur = this.screen.focused;
		const idx = order.indexOf(cur);
		const next = order[(idx + 1) % order.length];
		next.focus();
		this.screen.render();
	}

	copySelected() {
		const entry = store.getSelected();
		if (!entry) {
			return;
		}
		const text = JSON.stringify({ ...entry, data: entry.data }, null, 2);
		this.copyText(text);
		this.flash(`copied ${entry.message.slice(0, 30)}`);
	}

	copyFieldFromInspector() {
		const lineIdx = this.inspector.scrollTop + 2;
		const res = this.inspector.copyFieldAtLine(lineIdx);
		if (res?.path) {
			this.copyText(String(res.value ?? ""));
			this.flash(`copied ${res.path}`);
		} else {
			this.flash("no field at cursor");
		}
	}

	diffNext() {
		const entry = store.getSelected();
		if (!entry) {
			return;
		}
		if (!this._diffFirst) {
			this._diffFirst = entry;
			this.flash("first log picked — select second and press d");
			return;
		}
		this.diffOverlay.showDiff(this._diffFirst, entry);
		this.inspector.setDiff({ old: this._diffFirst, next: entry });
		this._diffFirst = null;
	}

	bookmarkSelected() {
		const entry = store.getSelected();
		if (!entry) {
			return;
		}
		this.client.bookmark(entry.id);
		entry.bookmarked = !entry.bookmarked;
		this.flash(entry.bookmarked ? "★ bookmarked" : "☆ unbookmarked");
		this.logList.refresh();
	}

	ignoreSelected() {
		const entry = store.getSelected();
		if (!entry) {
			return;
		}
		this.client.send("ignore", { pattern: entry.message });
		store.ignore(entry.message);
		this.flash("ignored: " + entry.message.slice(0, 30));
		this.refreshLogList();
	}

	openContextMenu(x, y) {
		const entry = store.getSelected();
		const items = [];
		items.push({ key: "copy", label: "Copy", icon: "📋" });
		items.push({ key: "copy_json", label: "Copy JSON", icon: "🧪" });
		if (entry?.stack) {
			items.push({ key: "copy_stack", label: "Copy Stack", icon: "🧱" });
		}
		items.push({ key: "similar", label: "Highlight Similar", icon: "🎯" });
		if (entry?.request_id) {
			items.push({ key: "request_flow", label: "Request Flow", icon: "🔗" });
		}
		items.push({
			key: "bookmark",
			label: entry?.bookmarked ? "Unbookmark" : "Bookmark",
			icon: "★",
		});
		items.push({ key: "pin", label: "Pin", icon: "📌" });
		items.push({ key: "ignore", label: "Ignore Event", icon: "🚫" });
		items.push({ key: "diff", label: "Diff (pick #2)", icon: "⇄" });
		items.push({ key: "record", label: "Record Session…", icon: "⏺" });
		items.push({ key: "export", label: "Export", icon: "⬇" });
		if (entry?.stack || entry?.meta?.source || entry?.data?.source) {
			items.push({ key: "open_source", label: "Open Source", icon: "📍" });
		}
		this.contextMenu.open(x, y, items);
	}

	handleContextAction(key) {
		const entry = store.getSelected();
		switch (key) {
			case "copy":
				this.copySelected();
				break;
			case "copy_json":
				if (entry) {
					this.copyText(JSON.stringify(entry.data ?? null, null, 2));
				}
				break;
			case "copy_stack":
				if (entry?.stack) {
					this.copyText(entry.stack);
				}
				break;
			case "bookmark":
				this.bookmarkSelected();
				break;
			case "pin":
				if (entry) {
					this.client.pin(entry.id);
					entry.pinned = !entry.pinned;
					this.logList.refresh();
				}
				break;
			case "ignore":
				this.ignoreSelected();
				break;
			case "similar":
				if (entry) {
					store.setSimilar(entry);
					this.refreshLogList();
				}
				break;
			case "request_flow":
				if (entry?.request_id) {
					this.client.send("request_flow", { requestId: entry.request_id });
					this.inspector.setTab("flow");
				}
				break;
			case "export":
				this.client.send("snapshot");
				this.flash("exported snapshot to buffer");
				break;
			case "record":
				this.sessionOverlay.open();
				break;
			case "open_source": {
				const src = entry?.meta?.source || entry?.data?.source || entry?.source;
				if (src) {
					this.copyText(String(src));
					this.flash(`copied source: ${String(src).slice(0, 40)}`);
				}
				break;
			}
			case "shell_context":
				this.flash("no shell available");
				break;
			case "diff":
				this.diffNext();
				break;
			default:
				break;
		}
	}

	copyText(text) {
		try {
			process.stdout.write("\x1b]52;c;" + Buffer.from(String(text)).toString("base64") + "\x07");
		} catch {
			// ignore
		}
	}

	flash(msg) {
		this.statusBar.setContent(`{bold}{#38BDF8-fg}${msg}{/bold}{/}`);
		this.screen.render();
		setTimeout(() => this.statusBar.setStats(this.client.stats), 1500);
	}

	closeOverlays() {
		for (const o of [
			this.contextMenu,
			this.diffOverlay,
			this.regexTester,
			this.metricsPanel,
			this.timelinePanel,
			this.heatmapPanel,
			this.histogramPanel,
			this.sessionOverlay,
			this.bookmarksOverlay,
			this.workspacesOverlay,
			this.themePicker,
		]) {
			o.hide();
		}
		this.screen.render();
	}

	showHelp() {
		const help = blessed.box({
			parent: this.screen,
			top: "center",
			left: "center",
			width: 76,
			height: 30,
			tags: true,
			style: { bg: COLORS.card, border: { fg: COLORS.accent } },
			border: { type: "line", fg: COLORS.accent },
			label: " ⌨ keyboard shortcuts ",
			content: [
				"  {bold}{#38BDF8-fg}Topbar{/bold}{/}  {gray-fg}click{/} REC record · Pause · Follow · Glow",
				"  {bold}{#38BDF8-fg}J/K{/bold}{/}   navigate logs",
				"  {bold}{#38BDF8-fg}Enter{/bold}{/} open selected in inspector",
				"  {bold}{#38BDF8-fg}Space{/bold}{/} pause live stream",
				"  {bold}{#38BDF8-fg}F{/bold}{/}     follow latest",
				"  {bold}{#38BDF8-fg}/{/bold}{/}     smart search (user:24 role:admin error 5m regex:/x/)",
				"  {bold}{#38BDF8-fg}C-c{/bold}{/}   copy selected {gray-fg}(C-q quits){/}",
				"  {bold}{#38BDF8-fg}D{/bold}{/}     diff two logs",
				"  {bold}{#38BDF8-fg}B{/bold}{/}     bookmark / {bold}B{/bold} view bookmarks",
				"  {bold}{#38BDF8-fg}E{/bold}{/}     ignore similar",
				"  {bold}{#38BDF8-fg}Y{/bold}{/}     copy JSON field at cursor",
				"  {bold}{#38BDF8-fg}R{/bold}{/}     regex tester",
				"  {bold}{#38BDF8-fg}S{/bold}{/}     save workspace / {bold}Shift+S{/bold} list & load",
				"  {bold}{#38BDF8-fg}C-t{/bold}{/}   add server tab • {bold}V{/bold} time-travel / scrub",
				"  {bold}{#38BDF8-fg}M/T/H/L{/bold}{/} metrics / timeline / heatmap / histogram",
				"  {bold}{#38BDF8-fg}1-9 / C-1-9{/bold}{/} switch sections",
				"  {bold}{#38BDF8-fg}=Tab{/bold}{/} next panel",
				"  {bold}{#38BDF8-fg}? / ? json{/bold}{/}  help / JSON search",
				"  {bold}{#38BDF8-fg}Esc{/bold}{/} close overlays • {bold}C-q{/bold} quit",
				"",
				"  {gray-fg}Right-click a log for the context menu. Shift+wheel scrolls horizontally.{/}",
				"  {gray-fg}Click a timeline bar to filter that level; click a histogram bucket.{/}",
				"  {gray-fg}Launch with --mode-more-cool (or -mmc) for max-neon mode.{/}",
			].join("\n"),
		});
		help.on("click", () => {
			help.destroy();
			this.screen.render();
		});
		this.screen.render();
	}

	_restoreLayout() {
		// best-effort: restore sidebar/inspector widths from last saved layout
		try {
			const st = loadState("default");
			if (st.sidebar) {
				this.panelSize.sidebar = Number(st.sidebar) || 22;
			}
			if (st.inspector) {
				this.panelSize.inspector = Number(st.inspector) || 50;
			}
		} catch {
			// ignore
		}
		// clamp so the log list stays usable on narrow windows, then apply
		const w = this.screen?.width || 120;
		this.panelSize.sidebar = Math.max(12, Math.min(this.panelSize.sidebar, Math.floor(w * 0.25)));
		this.panelSize.inspector = Math.max(
			30,
			Math.min(this.panelSize.inspector, Math.floor(w * 0.4)),
		);
		this.layoutPanels();
	}

	// --mode-more-cool: animate all panel borders with an electric neon pulse.
	_startBorderPulse() {
		const panels = () =>
			[this.sidebar, this.overview, this.logList, this.bottomPanels, this.inspector].filter(
				Boolean,
			);
		let frame = 0;
		this._borderPulse = setInterval(() => {
			if (!this.screen) {
				return;
			}
			const col = pulseColor(COLORS.selected, (frame / 9) * Math.PI * 2, 30);
			frame += 1;
			for (const p of panels()) {
				if (p.destroyed) {
					continue;
				}
				p.style = p.style || {};
				p.style.border = p.style.border || {};
				p.style.border.fg = col;
			}
			this.screen.render();
		}, 180);
	}

	bindStore() {
		store.on("entry", (entry) => {
			if (!store.paused) {
				this.handleNewEntry(entry);
			}
		});
		store.on("new_follow_entry", () => {
			if (store.follow && !store.paused) {
				this.refreshLogList();
				this.logList.follow();
			}
		});
		store.on("filter_change", () => {
			this.logList.searchHighlight = store.searchQuery || "";
			this.sidebar.setActive(store.categoryFilter);
			this.refreshLogList();
		});
		store.on("select", (id) => {
			this.selectedEntry = store.getSelected();
			if (this.selectedEntry) {
				this.inspector.setEntry(this.selectedEntry);
				this.inspector.setTab(store.inspectorTab);
			}
		});
		store.on("stats", (stats) => {
			this.statusBar.setStats(stats);
			this.overview.setStats(stats);
			this.bottomPanels.setStats(stats);
			this.metricsPanel.setStats(stats);
			this.timelinePanel.setStats(stats);
			this.histogramPanel.setStats(stats);
		});
		store.on("pause_change", (paused) => {
			this.filterBar.setPaused(store.paused);
			this.topbar.setPaused(paused);
		});
		store.on("follow_change", (v) => {
			this.topbar.setFollow(v);
			this.screen.render();
		});
		store.on("heatmap", (hm) => {
			this.heatmapPanel.setHeatmap(hm);
			this.bottomPanels.setHeatmap(hm);
		});
		store.on("recorder_change", (r) => {
			this.bottomPanels.setRecState(r?.active ? "RECORDING" : "IDLE");
			this.topbar.setRec(!!r?.active);
		});
		store.on("burst", (summary) => {
			this.sidebar.setBurst(summary);
			if (summary?.summary) {
				this.notifications.push(
					{ id: null, level: "critical", message: summary.summary, ts: new Date().toISOString() },
					`💥 ${summary.summary}`,
				);
			}
		});
	}

	handleNewEntry(entry) {
		const severity = { error: 1, critical: 2, warn: 0 }[entry.level];
		if (severity !== undefined) {
			this.notifications.push(entry, entry.message.slice(0, 60));
		}
		const category = entry.category;
		this.sidebar.bumpUnread(category);
		if (category === "errors" || entry.level === "error" || entry.level === "critical") {
			this.sidebar.bumpUnread("errors");
		}
	}

	refreshLogList() {
		const entries = store.filteredEntries;
		this.logList.setEntries(entries);
		this.sidebar.setActive(store.categoryFilter);
		this.updateHeaderCounts();
	}

	updateHeaderCounts() {
		if (this.client.stats) {
			this.overview.setStats(this.client.stats);
			this.statusBar.setStats(this.client.stats);
		}
		this.screen.render();
	}

	bindMouseDrag() {
		const screen = this.screen;
		const bodyTop = TOPBAR_H + TABBAR_H;
		screen.on("mouse", (data) => {
			const x = Math.floor(data.x);
			const y = Math.floor(data.y);
			if (data.action === "mousedown" && data.button === "left") {
				if (Math.abs(x - (this.panelSize.sidebar - 1)) <= 1 && y >= bodyTop) {
					this._dragging = "sidebar";
					return;
				}
				if (Math.abs(x - (screen.width - this.panelSize.inspector - 1)) <= 1 && y >= bodyTop) {
					this._dragging = "inspector";
					return;
				}
			}
			if (data.action === "mouseup" || data.action === "mousemove") {
				if (this._dragging && data.action === "mousemove") {
					if (this._dragging === "sidebar") {
						this.panelSize.sidebar = Math.max(12, Math.min(screen.width - 40, x));
					} else {
						this.panelSize.inspector = Math.max(30, Math.min(screen.width - 30, screen.width - x));
					}
					this.layoutPanels();
				}
				if (data.action === "mouseup") {
					this._dragging = null;
				}
			}
		});
	}

	layoutPanels() {
		const bodyTop = TOPBAR_H + TABBAR_H;
		this.sidebar.width = this.panelSize.sidebar;
		this.inspector.width = this.panelSize.inspector;
		// center column: overview / toolbar / logList / telemetry all span sidebar→inspector
		for (const w of [this.overview, this.filterBar, this.logList, this.bottomPanels]) {
			if (w) {
				w.left = this.panelSize.sidebar;
				w.right = this.panelSize.inspector;
			}
		}
		this.logList.top = bodyTop + OVERVIEW_H + TOOLBAR_H;
		this.logList.height = `100%-${bodyTop + OVERVIEW_H + TOOLBAR_H + TELEMETRY_H + FOOTER_H}`;
		this.splitSidebar.left = this.panelSize.sidebar - 1;
		this.splitInspector.right = this.panelSize.inspector - 1;
		this.screen.render();
		this.logList.refresh();
	}

	bindClient() {
		this.client.on("entry", (entry) => {
			store.addEntry(entry);
		});
		this.client.on("stats", (stats) => {
			store.setStats(stats);
		});
		this.client.on("snapshot", (snap) => {
			store.entries = snap.entries || store.entries;
			store.setStats(snap.stats);
			if (snap.heatmap) {
				store.setHeatmap(snap.heatmap);
			}
			if (Array.isArray(snap.bookmarks)) {
				const bm = new Set(snap.bookmarks);
				for (const e of store.entries) {
					if (bm.has(e.id)) {
						e.bookmarked = true;
					}
				}
			}
			this.refreshLogList();
		});
		this.client.on("request_flow", (msg) => {
			this.inspector.setFlow(msg.entries);
		});
		this.client.on("burst", (msg) => {
			store.setBurst(msg);
		});
		this.client.on("hello", () => {
			this.flash("connected to log stream");
			this._updateConnectionState(true);
		});
		this.client.on("connected", () => this._updateConnectionState(true));
		this.client.on("disconnected", () => this._updateConnectionState(false));
		this.client.on("error", () => {
			this.flash("log stream disconnected — retrying…");
			this._updateConnectionState(false);
		});
		this.client.connect();
	}

	_updateConnectionState(online) {
		this.topbar.setOnline(online);
		this.sidebar.setLiveInfo({
			sources: this.servers.size,
			parsers: parserCount(),
			live: online ? 1 : 0,
		});
		if (this.activeServer && this.tabBar) {
			this.tabBar.setServer(this.activeServer, { online });
		}
		this.screen.render();
	}

	start() {
		this.build();
		this.sidebar.draw();
		this.filterBar.draw();
		this.statusBar.draw();
		this.topbar.draw();
		this.overview.draw();
		this.bottomPanels.draw();
		this.sidebar.setLiveInfo({
			sources: this.servers.size,
			parsers: parserCount(),
			live: this.client.connected ? 1 : 0,
		});
		setInterval(() => {
			if (this.client.stats) {
				this.updateHeaderCounts();
			}
		}, 2000);
		this._burstTimer = setInterval(() => {
			if (this.client.connected) {
				this.client.send("burst", { windowMs: 60_000, minEvents: 3 });
			}
		}, 10_000);
		// Periodic autosave of layout
		this._saveTimer = setInterval(() => saveState(this._saveLayout()), 30_000);
		// Offload heavy scanning to a worker pool
		try {
			getWorkerPool();
		} catch {
			// ignore worker availability
		}
	}

	shutdown() {
		clearInterval(this._burstTimer);
		clearInterval(this._saveTimer);
		if (this._borderPulse) {
			clearInterval(this._borderPulse);
		}
		try {
			this.client.close();
		} catch {
			// ignore
		}
		try {
			getWorkerPool().close();
		} catch {
			// ignore
		}
		if (this.screen) {
			this.screen.destroy();
		}
		process.exit(0);
	}
}
