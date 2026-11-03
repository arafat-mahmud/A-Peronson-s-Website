import { EventEmitter } from "node:events";
import { CATEGORY_LEVELS } from "../log/categories.js";
import { matchQuery } from "../log/search.js";

class StateStore extends EventEmitter {
	constructor() {
		super();
		this.entries = [];
		this.view = "live";
		this.searchQuery = "";
		this.levelFilters = new Set();
		this.categoryFilter = "live";
		this.paused = false;
		this.follow = true;
		this.selectedId = null;
		this.inspectorTab = "metadata";
		this.ignored = new Set();
		this.highlightSimilar = false;
		this.similarKey = null;
		this.grouping = true;
		this.timeWindow = null;
		this.bookmarks = new Map();
		this.recorder = { active: false, entries: [] };
		this.stats = null;
		this.heatmap = null;
		this.burstSummary = null;
		this._expanded = new Set();
		this._regexCache = new Map();
		this._collapsedGroups = new Set();
	}

	setStats(stats) {
		this.stats = stats;
		this.emit("stats", stats);
	}

	addEntry(entry) {
		this.entries.push(entry);
		if (this.entries.length > 30_000) {
			this.entries.splice(0, this.entries.length - 30_000);
		}
		this.emit("entry", entry);
		if (this.follow && !this.paused) {
			this.emit("new_follow_entry", entry);
		}
	}

	get filteredEntries() {
		return this.entries.filter((e) => this.matches(e));
	}

	matches(entry) {
		if (
			this.categoryFilter !== "live" &&
			this.categoryFilter !== "overview" &&
			entry.category !== this.categoryFilter
		) {
			return false;
		}
		const allowed = CATEGORY_LEVELS[this.categoryFilter];
		if (
			allowed &&
			this.categoryFilter !== "overview" &&
			this.categoryFilter !== "live" &&
			!allowed.includes(entry.level)
		) {
			return false;
		}
		if (this.levelFilters.size > 0 && !this.levelFilters.has(entry.level)) {
			return false;
		}
		if (this.ignored.has(entry.message)) {
			return false;
		}
		if (this.searchQuery) {
			let matcher = this._regexCache.get(this.searchQuery);
			if (!matcher) {
				matcher = matchQuery(this.searchQuery);
				this._regexCache.set(this.searchQuery, matcher);
			}
			if (!matcher(entry)) {
				return false;
			}
		}
		if (this.timeWindow) {
			const from = Date.now() - this.timeWindow;
			if (entry.t < from) {
				return false;
			}
		}
		if (this.highlightSimilar && this.similarKey) {
			const key = this._similarKey(entry);
			if (key !== this.similarKey) {
				return false;
			}
		}
		return true;
	}

	_similarKey(entry) {
		return `${entry.level}|${entry.message}`;
	}

	setSimilar(entry) {
		this.similarKey = this._similarKey(entry);
		this.highlightSimilar = true;
		this.emit("filter_change");
	}

	clearSimilar() {
		this.highlightSimilar = false;
		this.similarKey = null;
		this.emit("filter_change");
	}

	toggleLevel(level) {
		if (this.levelFilters.has(level)) {
			this.levelFilters.delete(level);
		} else {
			this.levelFilters.add(level);
		}
		this.emit("filter_change");
	}

	setCategory(cat) {
		this.categoryFilter = cat;
		this.emit("filter_change");
	}

	setSearch(q) {
		this.searchQuery = q;
		this.emit("filter_change");
	}

	setTimeWindow(ms) {
		this.timeWindow = ms > 0 ? ms : null;
		this.emit("filter_change");
	}

	togglePause() {
		this.paused = !this.paused;
		this.emit("pause_change", this.paused);
		return this.paused;
	}

	setFollow(v) {
		this.follow = v;
		this.emit("follow_change", v);
	}

	select(id) {
		this.selectedId = id;
		this.emit("select", id);
	}

	getSelected() {
		return this.entries.find((e) => e.id === this.selectedId) || null;
	}

	setTab(tab) {
		this.inspectorTab = tab;
		this.emit("tab_change", tab);
	}

	toggleExpand(path) {
		if (this._expanded.has(path)) {
			this._expanded.delete(path);
		} else {
			this._expanded.add(path);
		}
		this.emit("expand_change", path);
	}

	isExpanded(path) {
		return this._expanded.has(path);
	}

	toggleGrouping() {
		this.grouping = !this.grouping;
		this.emit("grouping_change", this.grouping);
		return this.grouping;
	}

	collapseGroup(key) {
		if (this._collapsedGroups.has(key)) {
			this._collapsedGroups.delete(key);
		} else {
			this._collapsedGroups.add(key);
		}
		this.emit("filter_change");
	}

	isCollapsed(key) {
		return this._collapsedGroups.has(key);
	}

	ignore(message) {
		this.ignored.add(message);
		this.emit("filter_change");
	}

	setRecorder(state, snapshot = []) {
		this.recorder = state;
		if (state) {
			this.recorder.entries = snapshot;
		}
		this.emit("recorder_change", this.recorder);
	}

	setHeatmap(hm) {
		this.heatmap = hm;
		this.emit("heatmap", hm);
	}

	setBurst(summary) {
		this.burstSummary = summary;
		this.emit("burst", summary);
	}
}

export const store = new StateStore();
