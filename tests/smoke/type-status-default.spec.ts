import { expect, test } from "@playwright/test";
import {
	createFixtureVaultCopy,
	openFixtureVaultDesktopHarness,
	removeFixtureVaultCopy,
} from "../helpers/fixtureVault";
import { executeCommand, openCommandPalette } from "./helpers";

test("type-view creation copies semantic status defaults @smoke", async ({
	page,
}) => {
	const vaultPath = createFixtureVaultCopy();
	try {
		await openFixtureVaultDesktopHarness(page, vaultPath);
		await page.evaluate(async (root) => {
			const createNote = window.__mockHandlers?.create_note_content;
			if (typeof createNote !== "function")
				throw new Error("Missing fixture creation handler");
			await createNote({
				path: `${root}/initiative.md`,
				content:
					"---\ntype: Type\nStatus: Active\nBudget:\ncolor: red\n_icon: rocket\n---\n# Initiative\n",
			});
		}, vaultPath);
		await page.reload({ waitUntil: "domcontentloaded" });
		await page
			.locator("aside")
			.getByText("Initiatives", { exact: true })
			.first()
			.click();
		await page.locator('[title="Create new note"]').first().click();
		await expect(page.getByTestId("breadcrumb-filename-trigger")).toContainText(
			/untitled-initiative-\d+/i,
		);
		await openCommandPalette(page);
		await executeCommand(page, "Toggle Raw");
		const raw = page.locator(".cm-content");
		await expect(raw).toContainText("type: Initiative");
		await expect(raw).toContainText(/status: Active/i);
		await expect(raw).not.toContainText("Budget:");
		await expect(raw).not.toContainText("color:");
		await expect(raw).not.toContainText("_icon:");
	} finally {
		removeFixtureVaultCopy(vaultPath);
	}
});
