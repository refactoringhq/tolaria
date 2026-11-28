import path from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import {
	createFixtureVaultCopy,
	openFixtureVaultDesktopHarness,
	removeFixtureVaultCopy,
} from "../helpers/fixtureVault";

let vault: string;
function dayKey(date: Date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const today = dayKey(new Date());
const tomorrowDate = new Date();
tomorrowDate.setDate(tomorrowDate.getDate() + 1);
const tomorrow = dayKey(tomorrowDate);

test.beforeEach(async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	vault = createFixtureVaultCopy();
	for (let index = 0; index < 12; index += 1) {
		const response = await page.request.post("/api/vault/save", {
			data: {
				path: path.join(vault, `crowded-${index}.md`),
				content: `---\ntype: Note\n_organized: true\ndue: ${today}\nsource: https://example.com/calendar\n---\n# Crowded calendar ${index}\n`,
			},
		});
		expect(response.ok()).toBe(true);
	}
	await openFixtureVaultDesktopHarness(page, vault, {
		expectedReadyTitle: "Crowded calendar 10",
	});
	await page
		.getByTestId("sidebar-top-nav")
		.getByText("All Notes", { exact: true })
		.click();
	await page.getByTestId("layout-menu-button").click();
	await page.getByTestId("layout-option-calendar").click();
	await expect(page.getByTestId("calendar-toolbar")).toBeVisible();
});

test.afterEach(() => removeFixtureVaultCopy(vault));

test("shows the forbidden cursor only while attempting a read-only drag", async ({
	page,
}) => {
	await page.getByTestId("calendar-date-menu-button").click();
	await page.getByTestId("calendar-date-option-$created").click();
	const card = page.getByRole("button", {
		name: "Crowded calendar 0",
		exact: true,
	});
	await card.scrollIntoViewIfNeeded();
	await card.hover();
	await expect(card).toHaveCSS("cursor", "pointer");
	const box = await card.boundingBox();
	if (!box) throw new Error("Missing read-only card geometry");
	await page.mouse.move(box.x + 15, box.y + 15);
	await page.mouse.down();
	await expect(card).toHaveCSS("cursor", "pointer");
	await page.mouse.move(box.x + 35, box.y + 15, { steps: 5 });
	await expect(card).toHaveCSS("cursor", "not-allowed");
	await page.mouse.up();
	await expect(card).toHaveCSS("cursor", "pointer");
	await expect(page.getByTestId("kanban-panel-close")).toHaveCount(0);
	await page.mouse.click(box.x + 15, box.y + 15);
	await expect(page.getByTestId("kanban-panel-close")).toBeVisible();
});

async function dragCard(
	page: Page,
	card: Locator,
	target: Locator,
	grip: "title" | "padding" = "title",
) {
	await card.scrollIntoViewIfNeeded();
	const from = await card.boundingBox();
	const to = await target.boundingBox();
	if (!from || !to) throw new Error("Missing calendar drag geometry");
	const x = grip === "title" ? from.x + from.width / 2 : from.x + 3;
	const y = grip === "title" ? from.y + 15 : from.y + from.height - 3;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x + 10, y, {
		steps: 3,
	});
	await expect(card).toHaveClass(/calendar-item-slot--placeholder/);
	await page.mouse.move(to.x + to.width / 2, Math.max(120, to.y + 16), {
		steps: 20,
	});
	await page.mouse.up();
}

async function savedDate(page: Page, index: number) {
	const response = await page.request.get(
		`/api/vault/list?path=${encodeURIComponent(vault)}`,
	);
	const entries = (await response.json()) as Array<{
		path: string;
		properties: Record<string, unknown>;
	}>;
	return entries.find(
		(entry) => entry.path === path.join(vault, `crowded-${index}.md`),
	)?.properties.due;
}

test("drags a hidden card from the more menu to another day", async ({
	page,
}) => {
	const day = page.locator(`[data-day="${today}"]`);
	const row = page.getByTestId("calendar-week").filter({ has: day });
	await row.getByTestId("calendar-more").click();
	const popover = page.getByTestId("calendar-more-popover");
	await expect(popover).toBeVisible();
	await dragCard(
		page,
		popover.getByRole("button", { name: "Crowded calendar 10", exact: true }),
		page.locator(`[data-day="${tomorrow}"]`),
	);
	await expect.poll(() => savedDate(page, 10)).toBe(tomorrow);
});

for (const grip of ["title", "padding"] as const) {
	test(`lifts a tall weekly card from its ${grip}`, async ({ page }) => {
		await page.getByRole("tab", { name: "Week", exact: true }).click();
		await page.getByTestId("list-properties-btn").click();
		for (const property of ["due", "source"]) {
			await page.getByRole("checkbox", { name: property, exact: true }).check();
		}
		await page.keyboard.press("Escape");
		const card = page.getByRole("button", {
			name: "Crowded calendar 10",
			exact: true,
		});
		await expect(card.getByTestId("property-chips")).toBeVisible();
		await dragCard(page, card, page.locator(`[data-day="${tomorrow}"]`), grip);
		await expect.poll(() => savedDate(page, 10)).toBe(tomorrow);
	});
}

test("shows all weekly cards and drags after scrolling a crowded week", async ({
	page,
	browserName,
}) => {
	await page.getByRole("tab", { name: "Week", exact: true }).click();
	await expect(page.getByTestId("calendar-more")).toHaveCount(0);
	const card = page.getByRole("button", {
		name: "Crowded calendar 10",
		exact: true,
	});
	await expect(card).toHaveCount(1);
	const scroller = page.getByTestId("calendar-weeks");
	const row = page.getByTestId("calendar-week").filter({ has: card });
	expect(
		await row.evaluate((element) => element.offsetHeight),
	).toBeGreaterThanOrEqual(
		await scroller.evaluate((element) => element.clientHeight),
	);
	const firstDay = row.getByTestId("calendar-day").first();
	expect(
		await firstDay.evaluate((element) => element.clientHeight),
	).toBeGreaterThanOrEqual(
		(await row.evaluate((element) => element.clientHeight)) - 1,
	);
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.screenshot({
		path: `/tmp/tolaria-calendar-week-${browserName}.png`,
	});
	await dragCard(page, card, page.locator(`[data-day="${tomorrow}"]`));
	await expect.poll(() => savedDate(page, 10)).toBe(tomorrow);
});

test("keeps the calendar margins on the app background in light and dark mode", async ({
	page,
	browserName,
}) => {
	const board = page.getByTestId("calendar-board");
	const calendar = board.locator(".calendar-surface");
	const tray = board.getByTestId("calendar-tray");
	for (const theme of ["light", "dark"]) {
		await page.evaluate((theme) => {
			document.documentElement.classList.toggle("dark", theme === "dark");
			document.documentElement.dataset.theme = theme;
		}, theme);
		await expect(board).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
		await expect(calendar.getByTestId("calendar-toolbar")).toBeVisible();
		await expect(calendar.getByTestId("calendar-tray")).toHaveCount(0);
		await expect(tray).toHaveCSS(
			"background-color",
			await calendar.evaluate(
				(element) => getComputedStyle(element).backgroundColor,
			),
		);
		await expect(calendar).not.toHaveCSS("box-shadow", "none");
		await expect(tray).not.toHaveCSS("box-shadow", "none");
		await page.screenshot({
			path: `/tmp/tolaria-calendar-${theme}-${browserName}.png`,
		});
		await page.getByRole("tab", { name: "Week", exact: true }).click();
		await page.mouse.move(0, 0);
		await expect(page.getByRole("tooltip")).toHaveCount(0);
		await page.getByRole("tablist", { name: "Calendar view" }).screenshot({
			path: `/tmp/tolaria-calendar-switcher-${theme}-${browserName}.png`,
		});
	}
});
