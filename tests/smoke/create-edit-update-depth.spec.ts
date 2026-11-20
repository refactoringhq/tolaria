import { expect, test } from "@playwright/test";
import {
	createFixtureVaultCopy,
	openFixtureVaultTauri,
	removeFixtureVaultCopy,
} from "../helpers/fixtureVault";

let vaultPath: string;

test.beforeEach(async ({ page }) => {
	vaultPath = createFixtureVaultCopy();
	await openFixtureVaultTauri(page, vaultPath);
});

test.afterEach(() => removeFixtureVaultCopy(vaultPath));

test("new-note title updates settle while sidebar tooltips and the note list rerender @smoke", async ({
	page,
}) => {
	const errors: string[] = [];
	const collect = (message: string) => {
		if (/Maximum update depth|#185/.test(message)) errors.push(message);
	};
	page.on("pageerror", (error) => collect(error.message));
	page.on("console", (message) => {
		if (message.type() === "error") collect(message.text());
	});

	await page.locator('button[aria-label="Create new note"]').click();
	const editor = page.locator(".bn-editor");
	await expect(editor).toBeVisible();
	await expect(editor).toBeFocused();
	await page.keyboard.type("Update depth regression", { delay: 20 });
	await page.keyboard.press("Enter");
	await page.keyboard.type(
		"Editing remains available after creating the note.",
		{ delay: 10 },
	);

	const noteList = page.getByTestId("note-list-container");
	await expect(
		noteList.getByText("Update depth regression", { exact: true }),
	).toBeVisible();
	const back = page
		.locator("aside")
		.getByRole("button", { name: "Go Back", exact: true });
	await back.hover();
	await expect(page.getByRole("tooltip")).toContainText("Go Back");
	await noteList.getByText("Alpha Project", { exact: true }).click();
	await noteList.getByText("Update depth regression", { exact: true }).click();
	await expect(editor).toContainText(
		"Editing remains available after creating the note.",
	);
	await editor.getByRole("heading", { level: 1 }).click();
	await page.keyboard.press("End");
	await page.keyboard.type(" revised", { delay: 20 });
	await expect(
		noteList.getByText("Update depth regression revised", { exact: true }),
	).toBeVisible();
	expect(errors).toEqual([]);
});
