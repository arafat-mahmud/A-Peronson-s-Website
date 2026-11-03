import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getToken, getUserFromApi } from "../lib/auth.js";

export const fetchUser = createAsyncThunk("user/fetchUser", async (_, { rejectWithValue }) => {
	const token = getToken();
	if (!token) {
		return rejectWithValue("No token");
	}
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 15000);
		try {
			const result = await getUserFromApi(token);
			clearTimeout(timeout);
			return result;
		} catch (err) {
			clearTimeout(timeout);
			throw err;
		}
	} catch (err) {
		if (err?.name === "AbortError") {
			return rejectWithValue("Request timed out");
		}
		return rejectWithValue(err.message);
	}
});

const userSlice = createSlice({
	name: "user",
	initialState: {
		user: null,
		loading: false,
		error: null,
	},
	reducers: {
		setUser(state, action) {
			state.user = action.payload;
		},
		clearUser(state) {
			state.user = null;
			state.error = null;
		},
	},
	extraReducers: (builder) => {
		builder
			.addCase(fetchUser.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(fetchUser.fulfilled, (state, action) => {
				state.loading = false;
				state.user = action.payload;
			})
			.addCase(fetchUser.rejected, (state, action) => {
				state.loading = false;
				state.error = action.payload;
			});
	},
});

export const { setUser, clearUser } = userSlice.actions;
export default userSlice.reducer;
