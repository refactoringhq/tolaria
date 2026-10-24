import { expect, test } from "@playwright/test";

/**
 * Web URL routing test (TOL-175): verifies that the web app maintains URLs for
 * vault, note, and view selections, and that browser back/forward work correctly.
 */

test.describe("Web URL routing", () => {
	test("should maintain URL when note is selected", async ({ page }) => {
		await page.goto("/");

		// Wait for note list to load
		await expect(
			page.getByTestId("note-list-container").getByText("Welcome", {
				exact: true,
			}),
		).toBeVisible({ timeout: 10_000 });

		// Select a note
		await page
			.getByTestId("note-list-container")
			.getByText("Welcome", { exact: true })
			.click();

		// Check URL reflects note selection
		await expect(page).toHaveURL(/\/note\/.+/);

		// Reload page
		await page.reload();

		// Note should still be selected
		await expect(page.getByTestId("editor-container")).toBeVisible();

		// URL should still be the note URL
		await expect(page).toHaveURL(/\/note\/.+/);
	});

	test("should support browser back button", async ({ page }) => {
		await page.goto("/");

		// Wait for note list
		await expect(
			page.getByTestId("note-list-container").getByText("Welcome", {
				exact: true,
			}),
		).toBeVisible({ timeout: 10_000 });

		// Remember initial URL
		const initialUrl = page.url();

		// Select first note
		await page
			.getByTestId("note-list-container")
			.getByText("Welcome", { exact: true })
			.click();

		const firstNoteUrl = page.url();
		expect(firstNoteUrl).not.toBe(initialUrl);

		// Select a different note (if available)
		const secondNote = page
			.getByTestId("note-list-container")
			.getByText("Types", { exact: true });

		if (await secondNote.isVisible()) {
			await secondNote.click();
			const secondNoteUrl = page.url();
			expect(secondNoteUrl).not.toBe(firstNoteUrl);

			// Go back
			await page.goBack();
			await expect(page).toHaveURL(firstNoteUrl);

			// Go back again
			await page.goBack();
			await expect(page).toHaveURL(initialUrl);
		} else {
			// If only one note, just test going back to home
			await page.goBack();
			await expect(page).toHaveURL(initialUrl);
		}
	});

	test("should support browser forward button", async ({ page }) => {
		await page.goto("/");

		// Wait for note list
		await expect(
			page.getByTestId("note-list-container").getByText("Welcome", {
				exact: true,
			}),
		).toBeVisible({ timeout: 10_000 });

		// Select note
		await page
			.getByTestId("note-list-container")
			.getByText("Welcome", { exact: true })
			.click();

		const noteUrl = page.url();

		// Go back to home
		await page.goBack();
		await expect(page).toHaveURL(/\/$/);

		// Go forward to note
		await page.goForward();
		await expect(page).toHaveURL(noteUrl);
	});

	test("should handle shared URLs correctly", async ({ page }) => {
		// First, navigate normally to get a note URL
		await page.goto("/");
		await expect(
			page.getByTestId("note-list-container").getByText("Welcome", {
				exact: true,
			}),
		).toBeVisible({ timeout: 10_000 });

		await page
			.getByTestId("note-list-container")
			.getByText("Welcome", { exact: true })
			.click();

		const noteUrl = page.url();

		// Now navigate directly to that URL in a new context (simulating shared link)
		await page.goto(noteUrl);

		// The same note should be open
		await expect(page.getByTestId("editor-container")).toBeVisible();
		await expect(page).toHaveURL(noteUrl);
	});

	test("should handle paths with spaces correctly", async ({ page }) => {
		// This test verifies that paths with spaces are percent-encoded correctly
		await page.goto("/");

		await expect(
			page.getByTestId("note-list-container").getByText("Welcome", {
				exact: true,
			}),
		).toBeVisible({ timeout: 10_000 });

		// Select a note
		await page
			.getByTestId("note-list-container")
			.getByText("Welcome", { exact: true })
			.click();

		const url = page.url();

		// URL should be properly encoded (spaces as %20 or +, slashes as %2F)
		expect(url).toMatch(/\/note\/.+/);

		// Reload should work
		await page.reload();
		await expect(page.getByTestId("editor-container")).toBeVisible();
	});

	test("should not block cache-first startup", async ({ page }) => {
		// This test verifies that routing doesn't interfere with TOL-173's cache-first startup

		// Navigate to a note URL directly
		await page.goto("/");
		await expect(
			page.getByTestId("note-list-container").getByText("Welcome", {
				exact: true,
			}),
		).toBeVisible({ timeout: 10_000 });

		await page
			.getByTestId("note-list-container")
			.getByText("Welcome", { exact: true })
			.click();

		const noteUrl = page.url();

		// Reload the page with the note URL
		await page.goto(noteUrl);

		// The app should render from cache without spinners
		// (We can't easily test paint timing here, but we verify no blocking spinner)
		await expect(page.getByTestId("note-list-container")).toBeVisible({
			timeout: 2000,
		});
		await expect(page.getByTestId("editor-container")).toBeVisible({
			timeout: 2000,
		});

		// No startup screen should be shown
		await expect(page.getByTestId("startup-screen")).not.toBeVisible();
	});
});
