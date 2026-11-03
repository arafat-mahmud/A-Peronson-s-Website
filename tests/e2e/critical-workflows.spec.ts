import { devices, expect, test } from "@playwright/test";

// Client-critical browser workflows (tracker in Claude.md §6), on a phone viewport.
// Run against a production build that also proxies the API, e.g.
//   NODE_ENV=production pnpm run build && node scripts/perf/serve-dist.mjs dist 4173
//   E2E_BASE_URL=http://localhost:4173 pnpm exec playwright test tests/e2e/critical-workflows.spec.ts
// Tests that create data run only with E2E_ALLOW_WRITES=1 (never against the live site).

const BASE = process.env.E2E_BASE_URL || "http://localhost:4000";
const WRITES = process.env.E2E_ALLOW_WRITES === "1";

test.use({
	...devices["Pixel 7"],
	serviceWorkers: "block",
	...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}),
});

async function appUp(request): Promise<boolean> {
	try {
		const res = await request.get(`${BASE}/`);
		return res.ok() && (await res.text()).includes('id="root"');
	} catch {
		return false;
	}
}

test.describe("critical workflows", () => {
	test.beforeEach(async ({ request }) => {
		test.skip(!(await appUp(request)), `web app not served at ${BASE}`);
	});

	test("header shows the brand, not a cart icon, with the right descriptor (#12-13)", async ({
		page,
	}) => {
		await page.goto(`${BASE}/`);
		const home = page.getByRole("link", { name: "GarTexHub home" });
		await expect(home).toBeVisible();
		await expect(home).toContainText("Garments & Textile Sourcing");
		await expect(page.getByRole("heading", { level: 1 })).toContainText(
			"Garment Sourcing Platform",
		);
	});

	test("guest menu has no Settings or Dark mode; account items sit in the list (#2, #16)", async ({
		page,
	}) => {
		await page.goto(`${BASE}/`);
		await page.getByRole("button", { name: "Open menu" }).click();
		// The drawer: innermost element holding the "Navigation" title and the Signup link.
		const drawer = page
			.locator("div")
			.filter({ has: page.getByText("Navigation", { exact: true }) })
			.filter({ has: page.getByRole("link", { name: "Signup" }) })
			.last();
		await expect(drawer.getByRole("link", { name: "Login" })).toBeVisible();
		await expect(drawer.getByText("Settings", { exact: true })).toHaveCount(0);
		await expect(drawer.getByText(/dark mode/i)).toHaveCount(0);
	});

	test("footer links open the next page at the top (#14)", async ({ page }) => {
		await page.goto(`${BASE}/`);
		await page.locator("footer").scrollIntoViewIfNeeded();
		await page.locator("footer").getByRole("link", { name: "About" }).first().click();
		await expect(page).toHaveURL(/\/about$/);
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
	});

	test("signup: form first, 3 password rules, mismatch only after confirming (#8b, #10)", async ({
		page,
	}) => {
		await page.goto(`${BASE}/signup`);
		const password = page.locator('input[type="password"]').first();
		await expect(password).toBeVisible();
		await password.fill("abc");
		await expect(page.getByText(/At least 8 characters/)).toBeVisible();
		await expect(page.getByText(/Includes a letter/)).toBeVisible();
		await expect(page.getByText(/Includes a number/)).toBeVisible();
		await expect(page.getByText(/do not match/i)).toHaveCount(0);
	});

	test("verification standards are public and Get verified leads to login (#15)", async ({
		page,
	}) => {
		await page.goto(`${BASE}/help#verification`);
		await expect(page.locator("#verification")).toBeVisible();
		await page.goto(`${BASE}/verification`);
		await expect(page).toHaveURL(/\/login/);
	});

	test("the assistant answers a common question for guests (#5)", async ({ page }) => {
		await page.goto(`${BASE}/help`);
		await page.getByRole("button", { name: "Open assistant" }).click();
		const input = page.getByPlaceholder("Type your question...");
		await input.fill("How do I get verified?");
		await input.press("Enter");
		await expect(page.getByText(/verif/i).last()).toBeVisible();
		await expect(page.getByText(/Authentication required/i)).toHaveCount(0);
	});

	test("login links to the password reset page", async ({ page }) => {
		await page.goto(`${BASE}/login`);
		await page.getByRole("link", { name: /forgot password/i }).click();
		await expect(page).toHaveURL(/\/forgot-password$/);
		await expect(page.getByRole("heading", { name: /forgot your password/i })).toBeVisible();
	});

	test("forgot password gives the same answer for unknown emails (no enumeration)", async ({
		page,
	}) => {
		test.skip(!WRITES, "set E2E_ALLOW_WRITES=1 (local only)");
		await page.goto(`${BASE}/forgot-password`);
		await page.getByLabel("Email").fill(`nobody-${Date.now()}@example.test`);
		await page.getByRole("button", { name: "Send reset link" }).click();
		await expect(page.getByRole("status")).toContainText(/if an account exists/i);
	});

	test("a new factory account reaches onboarding (#9, #19)", async ({ page }) => {
		test.skip(!WRITES, "set E2E_ALLOW_WRITES=1 (local only)");
		await page.goto(`${BASE}/signup`);
		await page.getByRole("button", { name: "Factory", exact: true }).click();
		const stamp = Date.now();
		await page.getByRole("textbox", { name: "Full Name" }).fill("E2E Factory");
		await page.getByRole("textbox", { name: "Email" }).fill(`e2e-${stamp}@example.test`);
		await page.getByRole("textbox", { name: "Password", exact: true }).fill("Factory-2026");
		await page.getByRole("textbox", { name: "Confirm Password" }).fill("Factory-2026");
		await page.getByRole("textbox", { name: "Organization Name" }).fill(`E2E Factory ${stamp}`);
		await page.getByRole("combobox", { name: "Industry" }).selectOption({ index: 1 });
		const country = page.getByRole("combobox", { name: "Country" });
		await country.fill("Bangla");
		await page
			.getByRole("option", { name: /Bangladesh/ })
			.first()
			.click();
		await page.getByRole("textbox", { name: "Number of Employees" }).fill("250");
		await page.getByRole("textbox", { name: "Capacity quantity" }).fill("50000");
		await page.getByRole("combobox", { name: "Capacity unit" }).selectOption({ label: "Pieces" });
		await page.getByRole("button", { name: "Select your position" }).click();
		await page.getByRole("option", { name: "Owner", exact: true }).click();
		await page.getByRole("button", { name: "Create account" }).click();
		await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
	});
});
