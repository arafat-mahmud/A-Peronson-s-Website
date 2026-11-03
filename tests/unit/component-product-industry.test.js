/**
 * @jest-environment allure-jest/jsdom
 */
import { jest } from "@jest/globals";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { ThemeProvider } from "../../src/lib/ThemeProvider.jsx";
import themeReducer from "../../src/store/themeSlice.js";

const apiRequest = jest.fn();

jest.unstable_mockModule("../../src/lib/auth.js", () => ({
	API_BASE: "/api",
	apiRequest: (...args) => apiRequest(...args),
	getToken: () => "test-token",
	getCurrentUser: () => ({ id: "factory-1", role: "factory", name: "Test Factory" }),
}));

jest.unstable_mockModule("../../src/lib/events.js", () => ({
	trackClientEvent: jest.fn(),
	getClientId: () => "test-client",
	getSessionId: () => "test-session",
}));

let ProductManagement;

describe("product form industry dropdown (src/pages/ProductManagement.jsx)", () => {
	beforeAll(async () => {
		if (typeof window !== "undefined") {
			if (!window.matchMedia) {
				window.matchMedia = () => ({
					matches: false,
					addListener: () => {},
					removeListener: () => {},
					addEventListener: () => {},
					removeEventListener: () => {},
				});
			}
			if (!window.IntersectionObserver) {
				window.IntersectionObserver = class {
					observe() {}
					unobserve() {}
					disconnect() {}
				};
			}
		}
		({ default: ProductManagement } = await import("../../src/pages/ProductManagement.jsx"));
	});

	beforeEach(() => {
		apiRequest.mockReset();
		apiRequest.mockImplementation(async (path, options = {}) => {
			if (String(path).startsWith("/products?mine=true")) {
				return [];
			}
			if (path === "/products" && options?.method === "POST") {
				return { id: "draft-1" };
			}
			return {};
		});
	});

	function renderPage() {
		return render(
			<Provider store={configureStore({ reducer: { theme: themeReducer } })}>
				<ThemeProvider>
					<ProductManagement />
				</ThemeProvider>
			</Provider>,
		);
	}

	test("create-product modal offers Industry as Garments/Textile select, not a text field", async () => {
		const user = userEvent.setup();
		renderPage();

		await user.click(await screen.findByRole("button", { name: /create product/i }));
		await screen.findByText("Edit product");

		const industry = screen.getByLabelText(/industry/i);
		expect(industry.tagName).toBe("SELECT");
		expect(industry).toBeRequired();

		const options = [...industry.querySelectorAll("option")].map((o) => o.textContent);
		// Labels name the industry (client 02/11/2026); stored values stay garments/textile.
		expect(options).toEqual(expect.arrayContaining(["Garments Industry", "Textile Industry"]));
		expect(options.some((t) => t.includes("Garments, Home Textiles"))).toBe(false);
	});

	test("selecting an industry updates the form value", async () => {
		const user = userEvent.setup();
		renderPage();

		await user.click(await screen.findByRole("button", { name: /create product/i }));
		await screen.findByText("Edit product");

		await user.selectOptions(screen.getByLabelText(/industry/i), "textile");
		expect(screen.getByLabelText(/industry/i)).toHaveValue("textile");

		await user.selectOptions(screen.getByLabelText(/industry/i), "garments");
		expect(screen.getByLabelText(/industry/i)).toHaveValue("garments");
	});
});
