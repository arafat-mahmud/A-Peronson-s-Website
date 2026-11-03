import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiRequest, getToken } from "../lib/auth.js";

export const fetchAdminConfig = createAsyncThunk(
	"config/fetchAdminConfig",
	async (_, { rejectWithValue }) => {
		try {
			const data = await apiRequest("/admin/config/total-config", {
				method: "GET",
				token: getToken(),
			});
			return data;
		} catch (e) {
			return rejectWithValue(e.message);
		}
	},
);

export const fetchInventory = createAsyncThunk(
	"config/fetchInventory",
	async (_, { rejectWithValue }) => {
		try {
			return await apiRequest("/admin/config/inventory", {
				method: "GET",
				token: getToken(),
			});
		} catch (e) {
			return rejectWithValue(e.message);
		}
	},
);

export const fetchUiConfig = createAsyncThunk(
	"config/fetchUiConfig",
	async (_, { rejectWithValue }) => {
		try {
			return await apiRequest("/admin/config/ui", {
				method: "GET",
				token: getToken(),
			});
		} catch (e) {
			return rejectWithValue(e.message);
		}
	},
);

export const fetchCapabilities = createAsyncThunk(
	"config/fetchCapabilities",
	async (moduleId, { rejectWithValue }) => {
		const endpoint =
			moduleId === "infra"
				? "/admin/config/infra-capabilities"
				: moduleId === "network"
					? "/admin/config/network-capabilities"
					: moduleId === "ultra-security"
						? "/admin/config/ultra-capabilities"
						: null;
		if (!endpoint) {
			return rejectWithValue("Invalid module");
		}
		try {
			return await apiRequest(endpoint, { method: "GET", token: getToken() });
		} catch (e) {
			return rejectWithValue(e.message);
		}
	},
);

export const fetchActions = createAsyncThunk(
	"config/fetchActions",
	async (_, { rejectWithValue }) => {
		try {
			return await apiRequest("/admin/config/actions", {
				method: "GET",
				token: getToken(),
			});
		} catch (e) {
			return rejectWithValue(e.message);
		}
	},
);

export const fetchActionGroups = createAsyncThunk(
	"config/fetchActionGroups",
	async (_, { rejectWithValue }) => {
		try {
			const data = await apiRequest("/admin/config/actions/groups", {
				method: "GET",
				token: getToken(),
			});
			return data;
		} catch (e) {
			return rejectWithValue(e.message);
		}
	},
);

export const fetchRoles = createAsyncThunk("config/fetchRoles", async (_, { rejectWithValue }) => {
	try {
		const [rolesData, rolesList] = await Promise.all([
			apiRequest("/admin/config/roles", { method: "GET", token: getToken() }),
			apiRequest("/admin/config/roles-list", {
				method: "GET",
				token: getToken(),
			}),
		]);
		return { ...rolesData, roles: rolesList || [] };
	} catch (e) {
		return rejectWithValue(e.message);
	}
});

const DEFAULT_PIE_PALETTE = ["#6dabdf", "#6aa1d4", "#0f172a"];
const DEFAULT_EMPTY_STATE_COPY = {
	"verification.pending.short": "No pending verifications.",
	"verification.pending": "No pending verifications in queue.",
	"disputes.none": "No active disputes.",
	"firewall.rules.none": "No rules yet.",
	"cron.jobs.none": "No cron jobs yet.",
};
const DEFAULT_SECTION_METRICS = {
	wallet: [{ label: "Balance", path: "wallet.total_balance_usd", format: "currency" }],
};

const initialState = {
	config: null,
	loading: false,
	error: null,
	inventory: [],
	inventoryLoading: false,
	uiConfig: {
		chart_palette: DEFAULT_PIE_PALETTE,
		section_metrics: DEFAULT_SECTION_METRICS,
		empty_states: DEFAULT_EMPTY_STATE_COPY,
	},
	uiConfigLoading: false,
	capabilities: [],
	capabilitiesLoading: false,
	actions: [],
	actionsLoading: false,
	actionGroups: null,
	actionGroupsLoading: false,
	roleConfig: {
		known_roles: ["buyer", "factory", "buying_house", "owner", "admin", "agent"],
		allowed_roles: ["owner", "admin"],
		roles: [],
	},
	roleConfigLoading: false,
};

const configSlice = createSlice({
	name: "config",
	initialState,
	reducers: {
		clearConfig(state) {
			state.config = null;
			state.inventory = [];
			state.uiConfig = initialState.uiConfig;
			state.capabilities = [];
			state.actions = [];
			state.actionGroups = null;
			state.roleConfig = initialState.roleConfig;
		},
	},
	extraReducers: (builder) => {
		builder
			.addCase(fetchAdminConfig.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(fetchAdminConfig.fulfilled, (state, action) => {
				state.loading = false;
				state.config = action.payload;
			})
			.addCase(fetchAdminConfig.rejected, (state, action) => {
				state.loading = false;
				state.error = action.payload;
			})
			.addCase(fetchInventory.pending, (state) => {
				state.inventoryLoading = true;
			})
			.addCase(fetchInventory.fulfilled, (state, action) => {
				state.inventoryLoading = false;
				if (action.payload && action.payload.length > 0) {
					state.inventory = action.payload;
				}
			})
			.addCase(fetchInventory.rejected, (state) => {
				state.inventoryLoading = false;
			})
			.addCase(fetchUiConfig.pending, (state) => {
				state.uiConfigLoading = true;
			})
			.addCase(fetchUiConfig.fulfilled, (state, action) => {
				state.uiConfigLoading = false;
				state.uiConfig = {
					chart_palette:
						action.payload?.chart_palette?.length >= 2
							? action.payload.chart_palette
							: DEFAULT_PIE_PALETTE,
					section_metrics: action.payload?.section_metrics || DEFAULT_SECTION_METRICS,
					empty_states: action.payload?.empty_states || DEFAULT_EMPTY_STATE_COPY,
				};
			})
			.addCase(fetchUiConfig.rejected, (state) => {
				state.uiConfigLoading = false;
			})
			.addCase(fetchCapabilities.pending, (state) => {
				state.capabilitiesLoading = true;
			})
			.addCase(fetchCapabilities.fulfilled, (state, action) => {
				state.capabilitiesLoading = false;
				state.capabilities = action.payload || [];
			})
			.addCase(fetchCapabilities.rejected, (state) => {
				state.capabilitiesLoading = false;
			})
			.addCase(fetchActions.pending, (state) => {
				state.actionsLoading = true;
			})
			.addCase(fetchActions.fulfilled, (state, action) => {
				state.actionsLoading = false;
				state.actions = action.payload || [];
			})
			.addCase(fetchActions.rejected, (state) => {
				state.actionsLoading = false;
			})
			.addCase(fetchActionGroups.pending, (state) => {
				state.actionGroupsLoading = true;
			})
			.addCase(fetchActionGroups.fulfilled, (state, action) => {
				state.actionGroupsLoading = false;
				state.actionGroups = action.payload && action.payload.length > 0 ? action.payload : null;
			})
			.addCase(fetchActionGroups.rejected, (state) => {
				state.actionGroupsLoading = false;
			})
			.addCase(fetchRoles.pending, (state) => {
				state.roleConfigLoading = true;
			})
			.addCase(fetchRoles.fulfilled, (state, action) => {
				state.roleConfigLoading = false;
				state.roleConfig = {
					known_roles: action.payload.known_roles || initialState.roleConfig.known_roles,
					allowed_roles: action.payload.allowed_roles || initialState.roleConfig.allowed_roles,
					roles: action.payload.roles || [],
				};
			})
			.addCase(fetchRoles.rejected, (state) => {
				state.roleConfigLoading = false;
			});
	},
});

export const { clearConfig } = configSlice.actions;
export default configSlice.reducer;
