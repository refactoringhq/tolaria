import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { APP_COMMAND_IDS } from "../../src/hooks/appCommandCatalog";
import {
	createFixtureVaultCopy,
	openFixtureVaultDesktopHarness,
	removeFixtureVaultCopy,
} from "../helpers/fixtureVault";
import { triggerShortcutCommand } from "./testBridge";

const SHEET_NOTE = [
	"---",
	"type: Note",
	"_display: sheet",
	"---",
	"Name,Value",
	"x,42",
	"",
].join("\n");

const PREVIOUS_NOTE = [
	"---",
	"type: Note",
	"---",
	"# Previous note",
	"",
	'```html height="80"',
	"<p>Durable block</p>",
	"```",
	"",
].join("\n");

let tempVaultDir: string;

async function readRawSource(page: Page): Promise<string> {
	return page.evaluate(() => {
		const host = document.querySelector(".cm-content") as
			| (Element & {
					cmTile?: { view?: { state: { doc: { toString(): string } } } };
			  })
			| null;
		return host?.cmTile?.view?.state.doc.toString() ?? host?.textContent ?? "";
	});
}

async function readPersistedSource(
	page: Page,
	notePath: string,
): Promise<string> {
	return page.evaluate(async (pathToRead) => {
		const content = await window.__TAURI_INTERNALS__?.invoke(
			"get_note_content",
			{ path: pathToRead },
		);
		return String(content ?? "");
	}, notePath);
}

async function seedNote(
	page: Page,
	notePath: string,
	content: string,
): Promise<void> {
	const response = await page.request.post("/api/vault/save", {
		data: { path: notePath, content },
	});
	expect(response.ok()).toBe(true);
}

test.beforeEach(async ({ page }, testInfo) => {
	testInfo.setTimeout(90_000);
	tempVaultDir = createFixtureVaultCopy();
	await seedNote(
		page,
		path.join(tempVaultDir, "note", "sheet-raw-previous.md"),
		PREVIOUS_NOTE,
	);
	await seedNote(
		page,
		path.join(tempVaultDir, "note", "sheet-raw-data.md"),
		SHEET_NOTE,
	);
	await openFixtureVaultDesktopHarness(page, tempVaultDir, {
		expectedReadyTitle: "Note B",
	});
});

test.afterEach(() => {
	removeFixtureVaultCopy(tempVaultDir);
});

test("sheet source survives raw-mode entry after a durable rich note @smoke", async ({
	page,
}) => {
	const previousPath = path.join(tempVaultDir, "note", "sheet-raw-previous.md");
	const sheetPath = path.join(tempVaultDir, "note", "sheet-raw-data.md");

	await page.locator(`[data-note-path="${previousPath}"]`).click();
	await expect(page.locator(".bn-editor")).toContainText("Previous note", {
		timeout: 5_000,
	});

	await page.locator(`[data-note-path="${sheetPath}"]`).click();
	await expect(page.getByTestId("sheet-editor")).toBeVisible({
		timeout: 5_000,
	});

	await triggerShortcutCommand(page, APP_COMMAND_IDS.editToggleRawEditor);
	await expect(page.getByTestId("raw-editor-codemirror")).toBeVisible({
		timeout: 5_000,
	});
	await expect.poll(() => readRawSource(page)).toBe(SHEET_NOTE);

	await triggerShortcutCommand(page, APP_COMMAND_IDS.fileSave);
	await expect
		.poll(() => readPersistedSource(page, sheetPath))
		.toBe(SHEET_NOTE);

	await triggerShortcutCommand(page, APP_COMMAND_IDS.editToggleRawEditor);
	await expect(page.getByTestId("sheet-editor")).toBeVisible({
		timeout: 5_000,
	});
});

test("sheet save keeps an appended row separate after switching notes @smoke", async ({
	page,
}) => {
	const previousPath = path.join(tempVaultDir, "note", "sheet-raw-previous.md");
	const sheetPath = path.join(tempVaultDir, "note", "sheet-raw-data.md");
	const headerOnlySheet = `${SHEET_NOTE.split("\n").slice(0, 5).join("\n")}\n`;
	await seedNote(page, sheetPath, headerOnlySheet);
	await page.locator(`[data-note-path="${sheetPath}"]`).click();
	await expect(page.getByTestId("sheet-editor")).toBeVisible({
		timeout: 5_000,
	});

	await page.getByTestId("sheet-editor").click();
	await page.keyboard.press("ArrowDown");
	await page.keyboard.press("Enter");
	await page.keyboard.type("=SUM(2,3)");
	await page.keyboard.press("Enter");
	await triggerShortcutCommand(page, APP_COMMAND_IDS.fileSave);
	await expect
		.poll(() => readPersistedSource(page, sheetPath))
		.toContain('Name,Value\n"=SUM(2,3)"');

	await page.locator(`[data-note-path="${previousPath}"]`).click();
	await expect(page.locator(".bn-editor")).toContainText("Previous note", {
		timeout: 5_000,
	});
	await page.locator(`[data-note-path="${sheetPath}"]`).click();
	await expect(page.getByTestId("sheet-editor")).toBeVisible({
		timeout: 5_000,
	});
	await expect
		.poll(() => readPersistedSource(page, sheetPath))
		.toContain('Name,Value\n"=SUM(2,3)"');
});
