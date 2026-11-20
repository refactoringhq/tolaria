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

async function seededDueValue(page: Page): Promise<unknown> {
	const vaultList = await page.request.get(
		`/api/vault/list?path=${encodeURIComponent(tempVaultDir)}`,
	);
	const vaultEntries = (await vaultList.json()) as Array<{
		path: string;
		properties: Record<string, unknown>;
	}>;
	return vaultEntries.find((entry) => entry.path.endsWith("/note-b.md"))
		?.properties.due;
}

async function openAllNotesCalendar(page: Page): Promise<void> {
	await page
		.getByTestId("sidebar-top-nav")
		.getByText("All Notes", { exact: true })
		.click();
	expect(await seededDueValue(page)).toBe(dayKey(new Date()));
	await page.getByTestId("layout-menu-button").click();
	await page.getByTestId("layout-option-calendar").click();
	await expect(page.getByTestId("calendar-toolbar")).toBeVisible({
		timeout: 5_000,
	});
}

async function newRootMarkdownFiles(
	page: Page,
	before: Set<string>,
): Promise<string[]> {
	const files = await rootMarkdownFiles(page);
	return files.filter((name) => !before.has(name));
}

async function noteContent(page: Page, filename: string): Promise<string> {
	const notePath = path.join(tempVaultDir, filename);
	const response = await page.request.get(
		`/api/vault/content?path=${encodeURIComponent(notePath)}`,
	);
	const body = (await response.json()) as { content: string };
	return body.content;
}

test("creates a note from an empty calendar day with its date prefilled @smoke", async ({
	page,
}) => {
	const before = new Set(await rootMarkdownFiles(page));
	const target = new Date();
	target.setDate(target.getDate() + 1);
	const targetDay = dayKey(target);

	await openAllNotesCalendar(page);
	await page
		.locator(`[data-day="${targetDay}"] [data-testid="calendar-day-add"]`)
		.click();
	await expect(page.getByTestId("kanban-panel-close")).toBeVisible({
		timeout: 5_000,
	});
	await expect
		.poll(() => newRootMarkdownFiles(page, before), { timeout: 10_000 })
		.toHaveLength(1);

	const [createdName] = await newRootMarkdownFiles(page, before);
	expect(createdName).toBeTruthy();
	expect(await noteContent(page, createdName)).toContain(`due: ${targetDay}`);
});
