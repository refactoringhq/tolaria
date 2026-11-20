import { expect, test } from "@playwright/test";
import { executeCommand, openCommandPalette } from "./helpers";

test("clicking + in type section creates note with that type", async ({
	page,
}) => {
	await page.goto("/");
	await page.waitForTimeout(2000);

	// Click on "Projects" in the sidebar to select that type section
	const projectsItem = page
		.locator('[data-testid="sidebar-section-Projects"]')
		.or(page.locator(".app__sidebar").locator("text=Projects").first());
	await projectsItem.click();
	await page.waitForTimeout(1000);

	// Click the "+" button to create a new note
	await page.click('[aria-label="Create new note"]');
	await expect(page.locator(".bn-editor")).toBeVisible({ timeout: 5000 });

	// The new note should use a type-specific untitled filename.
	await expect(page.getByTestId("breadcrumb-filename-trigger")).toContainText(
		/untitled-project-\d+/i,
	);

	// Toggle raw editor to see frontmatter
	await openCommandPalette(page);
	await executeCommand(page, "Toggle Raw");
	await expect(page.locator(".cm-content")).toBeVisible({ timeout: 5000 });

	const rawEditor = page.locator(".cm-content");
	const content = await rawEditor.textContent();
	expect(content).toContain("type: Project");
});

test("clicking + in All Notes creates generic note", async ({ page }) => {
	await page.goto("/");
	await page.waitForTimeout(2000);

	// Click on "All Notes" in sidebar
	await page.locator("text=All Notes").first().click();
	await page.waitForTimeout(500);

	// Click the "+" button
	await page.click('[aria-label="Create new note"]');
	await expect(page.locator(".bn-editor")).toBeVisible({ timeout: 5000 });

	// The new note should be a generic untitled note, not a typed one.
	await expect(page.getByTestId("breadcrumb-filename-trigger")).toContainText(
		/untitled-note-\d+/i,
	);
	await expect(
		page.getByTestId("breadcrumb-filename-trigger"),
	).not.toContainText(/untitled-project-\d+/i);
});
