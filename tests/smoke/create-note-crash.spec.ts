import { expect, test } from "@playwright/test";

/** Errors that indicate the app has crashed (not just minor internal warnings). */
function isCrashError(msg: string): boolean {
	return (
		msg.includes("Maximum update depth") ||
		msg.includes("Invalid hook call") ||
		msg.includes("#185")
	);
}

test("create note via Cmd+N does not crash", async ({ page }) => {
	const errors: string[] = [];
	page.on("pageerror", (err) => {
		if (isCrashError(err.message)) errors.push(err.message);
	});

	await page.goto(process.env.BASE_URL ?? "http://localhost:5201");
	await page.waitForSelector('[data-testid="sidebar-top-nav"]', {
		timeout: 10000,
	});
	await page.waitForTimeout(500);

	await page.keyboard.press("Meta+n");
	await page.waitForTimeout(2000);

	expect(errors).toHaveLength(0);
	const noteList = page.locator('[data-testid="note-list-container"]');
	await expect(noteList.getByText(/Untitled Note/i).first()).toBeVisible({
		timeout: 5000,
	});
	await expect(page.getByRole("textbox").last()).toBeVisible();
});

test("create note via sidebar + button does not crash", async ({ page }) => {
	const errors: string[] = [];
	page.on("pageerror", (err) => {
		if (isCrashError(err.message)) errors.push(err.message);
	});

	await page.goto(process.env.BASE_URL ?? "http://localhost:5201");
	await page.waitForSelector('[data-testid="sidebar-top-nav"]', {
		timeout: 10000,
	});
	await page.waitForTimeout(500);

	await page.locator('button[aria-label="Create new note"]').first().click();
	await page.waitForTimeout(2000);

	expect(errors).toHaveLength(0);
	await expect(page.locator(".bn-editor")).toBeVisible({ timeout: 5_000 });
	await expect(page.getByTestId("breadcrumb-filename-trigger")).toContainText(
		/untitled-note-\d+/i,
	);
});
