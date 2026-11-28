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

test("scrolls through dates in Month and Week and offers a Year overview", async ({
	page,
}) => {
	await openAllNotesCalendar(page);
	const title = page.getByTestId("calendar-title");
	const scroller = page.getByTestId("calendar-weeks");

	for (const mode of ["month", "week"]) {
		await page.getByTestId(`calendar-view-${mode}`).click();
		const initial = await title.innerText();
		await scroller.hover();
		await page.mouse.wheel(0, 950);
		await expect(title).not.toHaveText(initial);
		const later = await title.innerText();
		await page.mouse.wheel(0, -1600);
		await expect(title).not.toHaveText(later);
	}

	const lastWeek = scroller.getByTestId("calendar-week").last();
	const bufferedEnd = await lastWeek.getAttribute("data-week-start");
	await scroller.evaluate((el) => {
		el.scrollTop = el.scrollHeight;
	});
	await expect(lastWeek).not.toHaveAttribute(
		"data-week-start",
		bufferedEnd ?? "",
	);

	await expect(page.getByRole("tablist").getByRole("tab")).toHaveCount(3);
	await page.getByTestId("calendar-view-year").click();
	await expect(page.getByTestId("calendar-overview-year")).toBeVisible();
	await expect(page.getByTestId("calendar-tray")).toBeVisible();
});

for (const theme of ["light", "dark"]) {
	test(`keeps weekends shaded across month boundaries in ${theme} mode`, async ({
		page,
	}) => {
		await openAllNotesCalendar(page);
		await page.getByRole("button", { name: "Open settings" }).click();
		await page.getByRole("button", { name: "Appearance", exact: true }).click();
		await page.getByTestId(`settings-theme-${theme}`).click();
		await page.getByTestId("settings-save").click();
		await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

		const grid = page.getByTestId("calendar-weeks");
		const weekend = grid
			.locator(".calendar-day--weekend:not(.calendar-day--outside)")
			.first();
		const weekendColor = await weekend.evaluate(
			(day) => getComputedStyle(day).backgroundColor,
		);
		const outsideWeekend = grid
			.locator(".calendar-day--weekend.calendar-day--outside")
			.first();
		const outsideWeekday = grid
			.locator(".calendar-day--outside:not(.calendar-day--weekend)")
			.first();
		await expect(outsideWeekend).toHaveCSS("background-color", weekendColor);
		await expect(outsideWeekday).not.toHaveCSS(
			"background-color",
			weekendColor,
		);

		await page.getByTestId("calendar-view-week").click();
		await expect(grid.locator(".calendar-day--weekend").first()).toHaveCSS(
			"background-color",
			weekendColor,
		);
	});
}

test("opens the calendar note in a rounded, resizable editor", async ({
	page,
}) => {
	await openAllNotesCalendar(page);
	await page
		.getByTestId("calendar-item")
		.filter({ hasText: "Note B" })
		.first()
		.click();
	const panel = page.locator(".app > .app__editor");
	const handle = page.getByTestId("kanban-editor-resize");
	await expect(handle).toBeVisible();
	await expect(panel).not.toHaveCSS("border-top-left-radius", "0px");
	await expect(panel).not.toHaveCSS("border-bottom-left-radius", "0px");
	const width = () =>
		panel.evaluate((editor) => editor.getBoundingClientRect().width);
	const initialWidth = await width();
	await handle.press("ArrowRight");
	await expect.poll(width).toBeLessThan(initialWidth);
});
