import { expect, type Page, type Route, test } from "@playwright/test";
import {
	createFixtureVaultCopy,
	openFixtureVault,
	removeFixtureVaultCopy,
} from "../helpers/fixtureVault";

let tempVaultDir: string;
let savedMarkdown: string[];

async function continueSaveRoute(route: Route, savedContent: string[]) {
	const body = route.request().postDataJSON() as { content?: unknown };
	if (typeof body.content === "string") savedContent.push(body.content);
	await route.continue();
}

async function installSavedMarkdownProbe(
	page: Page,
	savedContent: string[],
): Promise<void> {
	await page.route("**/api/vault/save", (route) =>
		continueSaveRoute(route, savedContent),
	);
}

test.beforeEach(async ({ page, context }, testInfo) => {
	testInfo.setTimeout(90_000);
	tempVaultDir = createFixtureVaultCopy();
	savedMarkdown = [];
	if (testInfo.project.name === "chromium") {
		await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	}
	await openFixtureVault(page, tempVaultDir);
	await page
		.locator('[data-testid="note-list-container"]')
		.getByText("Note B", { exact: true })
		.click();
	await expect(page.locator(".bn-editor")).toBeVisible({ timeout: 5_000 });
	await installSavedMarkdownProbe(page, savedMarkdown);
});

test.afterEach(async () => {
	removeFixtureVaultCopy(tempVaultDir);
});

test("Markdown paste into an empty bullet renders bold and saves Markdown @smoke", async ({
	page,
}) => {
	const markdown =
		"**be ambitious**, because even if you are not right today, you will be right soon.";
	const items = page.locator(
		'.bn-block-content[data-content-type="bulletListItem"]',
	);
	const trailingParagraph = page
		.locator('.bn-editor [data-content-type="paragraph"]')
		.filter({ hasText: "It also links to" })
		.first();
	await trailingParagraph.click();
	await page.keyboard.press("End");
	await page.keyboard.press("Enter");
	await page.keyboard.type("- Seed bullet item");
	const seedItem = items.filter({ hasText: "Seed bullet item" }).first();
	await expect(seedItem).toBeVisible();
	await seedItem.click();
	await page.keyboard.press("End");
	await page.keyboard.press("Enter");

	const freshItem = items.last();
	await expect(items).toHaveCount(2);
	const clipboardReady = await page.evaluate(async (value) => {
		try {
			await navigator.clipboard.writeText(value);
			return true;
		} catch {
			return false;
		}
	}, markdown);
	if (clipboardReady) {
		await page.keyboard.press(
			process.platform === "darwin" ? "Meta+V" : "Control+V",
		);
	} else {
		await page.evaluate((value) => {
			const clipboardData = new DataTransfer();
			clipboardData.setData("text/plain", value);
			const target =
				window.getSelection()?.anchorNode?.parentElement ??
				document.activeElement;
			target?.dispatchEvent(
				new ClipboardEvent("paste", {
					bubbles: true,
					cancelable: true,
					clipboardData,
				}),
			);
		}, markdown);
	}

	await expect(freshItem.locator("strong, b")).toContainText("be ambitious", {
		timeout: 5_000,
	});
	await expect(freshItem).not.toContainText("**be ambitious**");
	await page.keyboard.press("Control+s");
	await expect
		.poll(() => savedMarkdown.at(-1), { timeout: 10_000 })
		.toContain(`- ${markdown}`);
	await expect(items).toHaveCount(2);
});
