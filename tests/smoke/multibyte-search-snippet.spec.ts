import fs from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import {
	createFixtureVaultCopy,
	openFixtureVaultDesktopHarness,
	removeFixtureVaultCopy,
} from "../helpers/fixtureVault";

let tempVaultDir: string;

async function showNoteListSearch(page: Page) {
	await page.getByTestId("note-list-container").focus();
	await page.keyboard.press("ControlOrMeta+f");
	await expect(page.getByPlaceholder("Search notes...")).toBeVisible();
}

test.describe("Multibyte note-list search", () => {
	test.beforeEach(async ({ page }) => {
		tempVaultDir = createFixtureVaultCopy();
		fs.cpSync(new URL("../fixtures/multibyte-search", import.meta.url), tempVaultDir, { recursive: true });
		await openFixtureVaultDesktopHarness(page, tempVaultDir, {
			expectedReadyTitle: "Multibyte Search Boundary",
		});
	});

	test.afterEach(() => {
		removeFixtureVaultCopy(tempVaultDir);
	});

	test("searching content near Korean text keeps the result openable @smoke", async ({
		page,
	}) => {
		await showNoteListSearch(page);

		const noteList = page.getByTestId("note-list-container");
		const searchInput = page.getByPlaceholder("Search notes...");
		await searchInput.fill("needle");

		await expect(page.getByTestId("note-list-search-loading")).toHaveCount(0);
		await expect(
			noteList.getByText("Multibyte Search Boundary", { exact: true }),
		).toBeVisible();

		await noteList
			.getByText("Multibyte Search Boundary", { exact: true })
			.click();
		await expect(page.getByTestId("breadcrumb-filename-trigger")).toContainText(
			"multibyte-search-boundary",
		);
	});

	test("opening CRLF Chinese table content keeps the note searchable @smoke", async ({
		page,
	}) => {
		await showNoteListSearch(page);

		const noteList = page.getByTestId("note-list-container");
		const searchInput = page.getByPlaceholder("Search notes...");
		await searchInput.fill("收入");

		await expect(page.getByTestId("note-list-search-loading")).toHaveCount(0);
		await expect(noteList.getByText("上海复盘", { exact: true })).toBeVisible();

		await noteList.getByText("上海复盘", { exact: true }).click();
		await expect(page.getByTestId("breadcrumb-filename-trigger")).toContainText(
			"chinese-crlf-table",
		);
		await expect(
			page.locator(".editor-content-wrapper").getByText("指标"),
		).toBeVisible();
	});
});
