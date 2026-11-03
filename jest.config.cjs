"use strict";
module.exports = {
	// allure-jest/jsdom wraps jest-environment-jsdom: identical DOM behavior
	// plus Allure result emission. Results land in reports/allure-results-jest
	// (gitignored); override the dir per run via ALLURE_RESULTS_DIR.
	testEnvironment: "allure-jest/jsdom",
	testEnvironmentOptions: {
		resultsDir: process.env.ALLURE_RESULTS_DIR || "reports/allure-results-jest",
	},
	testMatch: ["**/tests/**/*.test.js", "**/tests/**/*.spec.js"],
	extensionsToTreatAsEsm: [".jsx"],
	transform: {
		"^.+.[jt]sx?$": "babel-jest",
	},
	moduleNameMapper: {
		"\\.(png|jpg|jpeg|gif|webp|avif|bmp|svg)$": "<rootDir>/tests/__mocks__/fileMock.cjs",
	},
	moduleFileExtensions: ["js", "jsx", "mjs", "cjs", "json", "node"],
	setupFilesAfterEnv: ["<rootDir>/tests/setupTests.js"],
	testTimeout: 20_000,
};
