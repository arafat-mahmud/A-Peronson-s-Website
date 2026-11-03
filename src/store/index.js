/* global process */
import { configureStore } from "@reduxjs/toolkit";
import logger from "redux-logger";
import configReducer from "./configSlice.js";
import themeReducer from "./themeSlice.js";
import toastReducer from "./toastSlice.js";
import userReducer from "./userSlice.js";

const isDev = typeof process !== "undefined" && process.env?.NODE_ENV !== "production";

export const store = configureStore({
	reducer: {
		theme: themeReducer,
		toast: toastReducer,
		user: userReducer,
		config: configReducer,
	},
	middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(isDev ? logger : []),
	devTools: isDev,
});
