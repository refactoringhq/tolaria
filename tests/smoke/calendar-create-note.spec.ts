import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
	createFixtureVaultCopy,
	openFixtureVaultDesktopHarness,
	removeFixtureVaultCopy,
} from "../helpers/fixtureVault";

let tempVaultDir: string;

function dayKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

async function rootMarkdownFiles(page: Page): Promise<string[]> {
	const response = await page.request.get(
		`/api/vault/list?path=${encodeURIComponent(tempVaultDir)}`,
	);
	const entries = (await response.json()) as Array<{
		filename: string;
		path: string;
	}>;
	return entries
		.filter(
			(entry) =>
				path.dirname(entry.path) === tempVaultDir &&
				entry.filename.endsWith(".md"),
		)
		.map((entry) => entry.filename);
}

test.beforeEach(async ({ page }) => {
	tempVaultDir = createFixtureVaultCopy();
	const today = dayKey(new Date());
	const seedPath = path.join(tempVaultDir, "note", "note-b.md");
	const seedResponse = await page.request.get(
		`/api/vault/content?path=${encodeURIComponent(seedPath)}`,
	);
	const seedContent = (await seedResponse.json()) as { content: string };
	await page.request.post("/api/vault/save", {
		data: {
			path: seedPath,
			content: seedContent.content.replace(
				"Status: Active\n",
				`Status: Active\ndue: ${today}\n`,
			),
		},
	});
	await openFixtureVaultDesktopHarness(page, tempVaultDir);
});

test.afterEach(() => {
	removeFixtureVaultCopy(tempVaultDir);
});

test("creates a note from an empty calendar day with its date prefilled @smoke", async ({
	page,
}) => {
	const before = new Set(await rootMarkdownFiles(page));
	const currentDay = dayKey(new Date());
	const target = new Date();
	target.setDate(target.getDate() + 1);
	const targetDay = dayKey(target);

	await page
		.getByTestId("sidebar-top-nav")
		.getByText("All Notes", { exact: true })
		.click();
	const vaultList = await page.request.get(
		`/api/vault/list?path=${encodeURIComponent(tempVaultDir)}`,
	);
	const vaultEntries = (await vaultList.json()) as Array<{
		path: string;
		properties: Record<string, unknown>;
	}>;
	expect(
		vaultEntries.find((entry) => entry.path.endsWith("/note-b.md"))?.properties
			.due,
	).toBe(currentDay);
	await page.getByTestId("layout-menu-button").click();
	await page.getByTestId("layout-option-calendar").click();
	await expect(page.getByTestId("calendar-toolbar")).toBeVisible({
		timeout: 5_000,
	});

	await page
		.locator(`[data-day="${targetDay}"] [data-testid="calendar-day-add"]`)
		.click();
	await expect(page.getByTestId("kanban-panel-close")).toBeVisible({
		timeout: 5_000,
	});
	await expect
		.poll(
			() =>
				rootMarkdownFiles(page).then((files) =>
					files.filter((name) => !before.has(name)),
				),
			{
				timeout: 10_000,
			},
		)
		.toHaveLength(1);

	const createdName = (await rootMarkdownFiles(page)).find(
		(name) => !before.has(name),
	);
	expect(createdName).toBeTruthy();
	const createdPath = path.join(tempVaultDir, createdName as string);
	const contentResponse = await page.request.get(
		`/api/vault/content?path=${encodeURIComponent(createdPath)}`,
	);
	const content = (await contentResponse.json()) as { content: string };
	expect(content.content).toContain(`due: ${targetDay}`);
});
