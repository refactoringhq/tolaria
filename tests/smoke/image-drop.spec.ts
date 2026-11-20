import { expect, test } from "@playwright/test";
import {
	createFixtureVaultCopy,
	openFixtureVault,
	removeFixtureVaultCopy,
} from "../helpers/fixtureVault";

let vault: string;

test.beforeEach(async ({ page }) => {
	vault = createFixtureVaultCopy();
	await openFixtureVault(page, vault);
});

test.afterEach(() => {
	removeFixtureVaultCopy(vault);
});

for (const newNote of [false, true]) {
	test(`image file drops insert each image once in a ${newNote ? "new" : "populated"} note @smoke`, async ({
		page,
	}) => {
		if (newNote)
			await page.locator('button[aria-label="Create new note"]').click();
		else
			await page
				.locator('[data-testid="note-list-container"]')
				.getByText("Note B", { exact: true })
				.click();
		const editor = page.locator(".bn-editor");
		await expect(editor).toBeVisible();
		await editor.click();
		const originalText = await editor.innerText();
		await editor.evaluate((element) => {
			const data = new DataTransfer();
			const png = Uint8Array.from(
				atob(
					"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=",
				),
				(character) => character.charCodeAt(0),
			);
			for (const name of ["first.png", "second.png"])
				data.items.add(new File([png], name, { type: "image/png" }));
			data.items.add(
				new File(["readme"], "readme.txt", { type: "text/plain" }),
			);
			element.dispatchEvent(
				new DragEvent("drop", {
					bubbles: true,
					cancelable: true,
					dataTransfer: data,
				}),
			);
		});
		await expect(editor.locator('[data-content-type="image"]')).toHaveCount(2);
		if (!newNote)
			await expect(editor).toContainText(originalText.trim(), {
				useInnerText: true,
			});
		await expect(editor.locator("img.bn-visual-media")).toHaveCount(2);
	});
}
