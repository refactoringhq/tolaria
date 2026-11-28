import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { APP_COMMAND_IDS } from "../../src/hooks/appCommandCatalog";
import {
	createFixtureVaultCopy,
	openFixtureVaultDesktopHarness,
	removeFixtureVaultCopy,
} from "../helpers/fixtureVault";
import { triggerShortcutCommand } from "./testBridge";

let vaultPath: string;

test.beforeEach(() => {
	vaultPath = createFixtureVaultCopy();
	for (const title of ["Focus A", "Focus B", "Focus C"]) {
		writeFileSync(
			join(vaultPath, `${title}.md`),
			`# ${title}\n\nDeletion focus regression.\n`,
		);
	}
});

test.afterEach(() => removeFixtureVaultCopy(vaultPath));

test("deletion follows visible order and preserves keyboard navigation @smoke", async ({
	page,
}) => {
	await openFixtureVaultDesktopHarness(page, vaultPath, {
		expectedReadyTitle: "Focus A",
	});
	await page.evaluate(() => {
		const handlers = window.__mockHandlers;
		if (!handlers) throw new Error("Fixture handlers unavailable");
		const deleteNotes = async (args?: { paths?: string[] }) => {
			const paths = args?.paths ?? [];
			for (const path of paths) {
				const response = await fetch("/api/vault/delete", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ path }),
				});
				if (!response.ok) throw new Error("Fixture deletion failed");
			}
			return paths;
		};
		handlers.batch_delete_notes = deleteNotes;
		handlers.batch_delete_notes_async = deleteNotes;
	});
	await page
		.getByTestId("sidebar-top-nav")
		.getByText("All Notes", { exact: true })
		.click();
	const noteList = page.getByTestId("note-list-container");
	await noteList.focus();
	await page.keyboard.press("ControlOrMeta+f");
	await page.getByPlaceholder("Search notes...").fill("Focus");
	const rows = noteList.locator("[data-note-path]");
	await expect(rows).toHaveCount(3);
	const titles = await rows
		.locator('[data-testid="note-title-row"]')
		.allTextContents();
	const heading = (index: number) =>
		page.getByRole("heading", { name: titles[index].trim(), level: 1 });
	await rows.nth(1).click();
	await expect(heading(1)).toBeVisible();

	// The pointer-driven context menu and keyboard command share the same focus behavior.
	await rows.nth(1).click({ button: "right" });
	await page
		.getByTestId("note-list-context-menu")
		.getByRole("button", { name: /Delete/ })
		.click();
	await page.getByTestId("confirm-delete-btn").click();
	await expect(rows).toHaveCount(2);
	await expect(heading(2)).toBeVisible();
	await expect(noteList).toBeFocused();
	await page.keyboard.press("ArrowUp");
	await expect(heading(0)).toBeVisible();
	await page.keyboard.press("ArrowDown");
	await expect(heading(2)).toBeVisible();

	await triggerShortcutCommand(page, APP_COMMAND_IDS.noteDelete);
	await page.getByTestId("confirm-delete-btn").press("Enter");
	await expect(rows).toHaveCount(1);
	await expect(heading(0)).toBeVisible();
	await expect(noteList).toBeFocused();

	await triggerShortcutCommand(page, APP_COMMAND_IDS.noteDelete);
	await page.getByTestId("confirm-delete-btn").press("Enter");
	await expect(rows).toHaveCount(0);
	await expect(heading(0)).toHaveCount(0);
});
