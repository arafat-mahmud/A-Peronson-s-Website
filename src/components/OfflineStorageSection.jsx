// HyperCache Phase 7 — Offline Storage settings section.
// Device-level controls: storage mode radio, usage bar, download-for-offline
// pack (feed/profile/product snapshots into Dexie with progress), clear data.
// Rendered inside Settings (profile tab). No new routes.

import { useCallback, useEffect, useState } from "react";
import { apiRequest, getToken } from "../lib/auth.js";
import {
	getStorageMode,
	isPersisted,
	persist,
	quotaInfo,
	STORAGE_MODES,
	setStorageMode,
	storeFootprint,
} from "../offline/cacheManager.js";
import { getDb } from "../offline/db.js";

const MODE_OPTIONS = [
	{
		value: STORAGE_MODES.SMART,
		label: "Smart",
		hint: "Keeps your working set only. Recommended default.",
	},
	{
		value: STORAGE_MODES.FULL,
		label: "Full",
		hint: "Keeps everything for offline use. Uses more storage.",
	},
	{
		value: STORAGE_MODES.WIFI_ONLY,
		label: "Wi-Fi only",
		hint: "Smart retention, but background sync runs on unmetered connections only.",
	},
];

function toEpochMs(value, fallback) {
	if (value === null || value === undefined || value === "") return fallback;
	if (typeof value === "number" && Number.isFinite(value)) {
		return value < 1e12 ? value * 1000 : value;
	}
	const t = new Date(value).getTime();
	return Number.isFinite(t) ? t : fallback;
}

function asArray(data) {
	if (Array.isArray(data)) return data;
	if (Array.isArray(data?.items)) return data.items;
	if (Array.isArray(data?.products)) return data.products;
	if (Array.isArray(data?.data)) return data.data;
	return [];
}

async function fetchFeedSnapshot(token) {
	const data = await apiRequest("/feed?unique=false&type=posts&category=&cursor=0&limit=50", {
		token,
	});
	const rows = asArray(data);
	const now = Date.now();
	const records = rows
		.filter((r) => r?.id != null)
		.map((r) => ({
			id: r.id,
			feed_type: r.feed_type || "",
			category: r.category || "",
			updatedAt: toEpochMs(r.updated_at ?? r.created_at, now),
			raw: r,
		}));
	if (records.length > 0) {
		await getDb().table("feedPosts").bulkPut(records);
	}
	return records.length;
}

async function fetchProfileSnapshot(token) {
	const data = await apiRequest("/users/me", { token });
	const id = data?.id || "me";
	await getDb()
		.table("profiles")
		.put({
			id,
			userId: id,
			updatedAt: Date.now(),
			raw: data || {},
		});
	return 1;
}

async function fetchProductsSnapshot(token) {
	const data = await apiRequest("/products?mine=true", { token });
	const rows = asArray(data);
	const now = Date.now();
	const records = rows
		.filter((r) => r?.id != null)
		.map((r) => ({
			id: r.id,
			category: r.category || "",
			updatedAt: toEpochMs(r.updated_at ?? r.created_at, now),
			raw: r,
		}));
	if (records.length > 0) {
		await getDb().table("products").bulkPut(records);
	}
	return records.length;
}

const SNAPSHOT_STEPS = [
	{ key: "feed", label: "Feed", run: fetchFeedSnapshot },
	{ key: "profile", label: "Profile", run: fetchProfileSnapshot },
	{ key: "products", label: "Products", run: fetchProductsSnapshot },
];

export default function OfflineStorageSection() {
	const [mode, setMode] = useState(() => {
		try {
			return getStorageMode();
		} catch {
			return STORAGE_MODES.SMART;
		}
	});
	const [persisted, setPersistedState] = useState(false);
	const [quota, setQuota] = useState({
		usage: 0,
		quota: 0,
		percentUsed: 0,
		display: "n/a",
		quotaDisplay: "n/a",
	});
	const [footprint, setFootprint] = useState({});
	const [progress, setProgress] = useState(null);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");

	const refresh = useCallback(async () => {
		try {
			const [q, fp, p] = await Promise.all([quotaInfo(), storeFootprint(), isPersisted()]);
			setQuota(q);
			setFootprint(fp);
			setPersistedState(Boolean(p));
		} catch {
			/* storage unavailable */
		}
	}, []);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				await persist();
			} catch {
				/* ignore */
			}
			if (!cancelled) await refresh();
		})();
		return () => {
			cancelled = true;
		};
	}, [refresh]);

	const changeMode = (value) => {
		try {
			setMode(setStorageMode(value));
			persist()
				.catch(() => {})
				.finally(() => refresh());
			setMessage(`Storage mode set to ${value}.`);
		} catch (err) {
			setMessage(err?.message || "Could not change storage mode.");
		}
	};

	const downloadForOffline = async () => {
		const token = getToken();
		if (!token) {
			setMessage("Sign in to download content for offline use.");
			return;
		}
		setBusy(true);
		setMessage("");
		const failed = [];
		const counts = {};
		for (let i = 0; i < SNAPSHOT_STEPS.length; i++) {
			const step = SNAPSHOT_STEPS[i];
			setProgress({ done: i, total: SNAPSHOT_STEPS.length, label: `Downloading ${step.label}…` });
			try {
				counts[step.key] = await step.run(token);
			} catch {
				failed.push(step.label);
				counts[step.key] = 0;
			}
			setProgress({
				done: i + 1,
				total: SNAPSHOT_STEPS.length,
				label: `Downloaded ${step.label}`,
			});
		}
		await refresh();
		setBusy(false);
		setProgress(null);
		if (failed.length > 0) {
			setMessage(`Offline pack incomplete — failed: ${failed.join(", ")}.`);
		} else {
			const total = Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0);
			setMessage(`Offline pack ready — ${total} records saved for offline use.`);
		}
	};

	const clearOfflineData = async () => {
		setBusy(true);
		try {
			const db = getDb();
			await Promise.all(db.tables.map((t) => t.clear()));
			setMessage("Offline data cleared.");
		} catch {
			setMessage("Could not clear offline data.");
		}
		await refresh();
		setBusy(false);
	};

	const percent = Math.max(0, Math.min(100, Number(quota.percentUsed) || 0));
	const progressPercent =
		progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
	const footprintEntries = Object.entries(footprint || {}).filter(([, v]) => v > 0);

	return (
		<section
			data-testid="offline-storage-section"
			class="rounded-3xl border border-sky-200/60 bg-white/80 p-5 shadow-[0_20px_60px_-30px_rgba(51,122,176,0.45)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75"
		>
			<div class="mb-4">
				<h3 class="text-lg font-semibold text-slate-900 dark:text-white">Offline Storage</h3>
				<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
					Control how much of GarTexHub stays available when you lose connection.
					{persisted ? " Storage is protected from browser cleanup." : ""}
				</p>
			</div>

			<div role="radiogroup" aria-label="Offline storage mode" class="space-y-2">
				{MODE_OPTIONS.map((opt) => (
					<label
						key={opt.value}
						class="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-sky-300 dark:border-slate-800 dark:bg-slate-900"
					>
						<input
							type="radio"
							name="offline-storage-mode"
							value={opt.value}
							checked={mode === opt.value}
							onChange={() => changeMode(opt.value)}
							disabled={busy}
							data-testid={`offline-mode-${opt.value}`}
							class="mt-1 h-4 w-4 text-sky-600 focus:ring-sky-500"
						/>
						<span>
							<span class="block text-sm font-medium text-slate-900 dark:text-white">
								{opt.label}
							</span>
							<span class="block text-xs text-slate-500 dark:text-slate-400">{opt.hint}</span>
						</span>
					</label>
				))}
			</div>

			<div class="mt-4">
				<div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
					<span>Storage used</span>
					<span data-testid="offline-storage-text">
						{quota.display} of {quota.quotaDisplay}
					</span>
				</div>
				<div
					data-testid="offline-storage-bar"
					role="progressbar"
					aria-valuenow={Math.round(percent)}
					aria-valuemin={0}
					aria-valuemax={100}
					class="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
				>
					<div
						class="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all"
						style={{ width: `${percent}%` }}
					/>
				</div>
				{footprintEntries.length > 0 && (
					<p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
						{footprintEntries.map(([name, count]) => `${name}: ${count}`).join(" · ")}
					</p>
				)}
			</div>

			{progress && (
				<div class="mt-4" data-testid="offline-download-progress">
					<div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
						<span>{progress.label}</span>
						<span>{progressPercent}%</span>
					</div>
					<div class="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
						<div
							class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>
				</div>
			)}

			<div class="mt-4 flex flex-wrap gap-3">
				<button
					type="button"
					onClick={downloadForOffline}
					disabled={busy}
					data-testid="offline-download"
					class="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
				>
					{busy ? "Working…" : "Download for offline"}
				</button>
				<button
					type="button"
					onClick={clearOfflineData}
					disabled={busy}
					data-testid="offline-clear"
					class="inline-flex items-center justify-center rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
				>
					Clear offline data
				</button>
			</div>
			{message && <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">{message}</p>}
		</section>
	);
}
