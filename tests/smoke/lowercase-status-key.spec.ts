import { expect, type Page, test } from "@playwright/test";
import {
	createFixtureVaultCopy,
	openFixtureVaultDesktopHarness,
	removeFixtureVaultCopy,
} from "../helpers/fixtureVault";
import { triggerMenuCommand } from "./testBridge";

const NO_STATUS_NOTE = "note/no-status-note.md";
const NO_STATUS_CONTENT =
	"---\nIs A: Note\n---\n\n# No Status Note\n\nA note without a status key.\n";
const ALPHA_PROJECT = "project/alpha-project.md";

let tempVaultDir: string;

async function readVaultFile(
	page: Page,
	relativePath: string,
): Promise<string> {
	const notePath = `${tempVaultDir}/${relativePath}`;
	const response = await page.request.get(
		`/api/vault/content?path=${encodeURIComponent(notePath)}`,
	);
	return ((await response.json()) as { content: string }).content;
}

function linesWithout(content: string, key: RegExp): string[] {
	return content.split("\n").filter((line) => !key.test(line));
}

async function openNote(page: Page, title: string): Promise<void> {
	await page
		.locator('[data-testid="note-list-container"]')
		.getByText(title, { exact: true })
		.click();
	await expect(
		page.getByRole("heading", { name: title, level: 1 }),
	).toBeVisible();
	await page.getByRole("button", { name: "Open the properties panel" }).click();
}

async function pickStatus(page: Page, status: string): Promise<void> {
	await page.getByTestId(`status-option-${status}`).click();
}

test.beforeEach(async ({ page }, testInfo) => {
	testInfo.setTimeout(60_000);
	tempVaultDir = createFixtureVaultCopy();
	await openFixtureVaultDesktopHarness(page, tempVaultDir);
	const response = await page.request.post("/api/vault/save", {
		data: {
			content: NO_STATUS_CONTENT,
			path: `${tempVaultDir}/${NO_STATUS_NOTE}`,
		},
	});
	expect(response.ok()).toBe(true);
	await triggerMenuCommand(page, "vault-reload");
});

test.afterEach(() => {
	removeFixtureVaultCopy(tempVaultDir);
});

test("adding a status to a note without one writes a lowercase key and value", async ({
	page,
}) => {
	await openNote(page, "No Status Note");

	const slot = page
		.getByTestId("suggested-property")
		.filter({ hasText: "status" });
	await expect(slot).toBeVisible();
	await expect(
		page.getByTestId("suggested-property").filter({ hasText: /Status/ }),
	).toHaveCount(0);
	await slot.click();
	await pickStatus(page, "in progress");

	await expect
		.poll(() => readVaultFile(page, NO_STATUS_NOTE))
		.toMatch(/^status: "?in progress"?$/mu);
	expect(await readVaultFile(page, NO_STATUS_NOTE)).not.toContain("Status:");
	await expect(page.getByTestId("status-badge")).toHaveText("in progress");
});

test("editing an old-cased Status value keeps the key and the rest of the file", async ({
	page,
}) => {
	const before = await readVaultFile(page, ALPHA_PROJECT);
	await openNote(page, "Alpha Project");

	await page.getByTestId("status-badge").click();
	await pickStatus(page, "done");

	await expect
		.poll(() => readVaultFile(page, ALPHA_PROJECT))
		.toMatch(/^Status: "?done"?$/mu);
	const after = await readVaultFile(page, ALPHA_PROJECT);
	expect(after).not.toMatch(/^status:/mu);
	expect(linesWithout(after, /^Status:/u)).toEqual(
		linesWithout(before, /^Status:/u),
	);
});
