import { expect, type Locator, type Page, test } from "@playwright/test";
import {
	createFixtureVaultCopy,
	openFixtureVault,
	removeFixtureVaultCopy,
} from "../helpers/fixtureVault";

let tempVaultDir: string;

type LayoutName = "kanban" | "calendar" | "graph";

const LAYOUT_SURFACE: Record<LayoutName, string> = {
	kanban: "kanban-board",
	calendar: "calendar-toolbar",
	graph: "graph-layout",
};

async function showAllNotesAs(page: Page, layout: LayoutName): Promise<void> {
	await page
		.getByTestId("sidebar-top-nav")
		.getByText("All Notes", { exact: true })
		.click();
	if (layout === "graph")
		await page.evaluate(() => localStorage.setItem("ff_graph_layout", "true"));
	await page.getByTestId("layout-menu-button").click();
	await expect(page.getByTestId(`layout-option-${layout}`)).toBeVisible();
	await page.getByTestId(`layout-option-${layout}`).click();
	await expect(
		page.locator(`.app__note-list [data-collection-layout="${layout}"]`),
	).toBeVisible({ timeout: 5_000 });
}

function aiPanel(page: Page): Locator {
	return page.locator('.app__editor [data-ai-workspace-mode="side"]');
}

// Presses closer together than the app's shortcut echo window (150 ms) count as one, as in the List layout.
const SHORTCUT_ECHO_WINDOW_MS = 200;

async function toggleAiPanel(page: Page): Promise<void> {
	await page.waitForTimeout(SHORTCUT_ECHO_WINDOW_MS);
	// The app reads the platform from the user agent; Playwright's WebKit reports a Mac one even on Linux.
	const macUserAgent = await page.evaluate(() =>
		navigator.userAgent.includes("Macintosh"),
	);
	await page.keyboard.press(macUserAgent ? "Meta+Shift+L" : "Control+Shift+L");
}

// The panel can remount while it docks, so read its box until it settles beside the layout.
async function isBesideLayout(page: Page): Promise<boolean> {
	const panel = await aiPanel(page).boundingBox();
	const noteList = await page.locator(".app__note-list").boundingBox();
	if (!panel || !noteList) return false;
	return panel.width >= 300 && noteList.x + noteList.width <= panel.x + 1;
}

async function expectBesideLayout(page: Page): Promise<void> {
	await expect.poll(() => isBesideLayout(page), { timeout: 5_000 }).toBe(true);
}

test.describe("AI panel in non-list layouts", () => {
	test.beforeEach(async ({ page }) => {
		test.setTimeout(45_000);
		tempVaultDir = createFixtureVaultCopy();
		await openFixtureVault(page, tempVaultDir);
	});

	test.afterEach(() => {
		removeFixtureVaultCopy(tempVaultDir);
	});

	for (const layout of ["kanban", "calendar"] as const) {
		test(`opens and closes the AI panel beside the ${layout} with no note open`, async ({
			page,
		}) => {
			await showAllNotesAs(page, layout);
			await expect(page.getByTestId("kanban-panel-close")).toHaveCount(0);

			await toggleAiPanel(page);
			await expect(aiPanel(page)).toBeVisible();
			await expectBesideLayout(page);
			await expect(
				page.getByTestId(LAYOUT_SURFACE[layout]).first(),
			).toBeVisible();

			await toggleAiPanel(page);
			await expect(aiPanel(page)).toHaveCount(0);
			await toggleAiPanel(page);
			await expect(aiPanel(page)).toBeVisible();
		});
	}

	test("keeps the AI panel open while a Kanban note opens and closes", async ({
		page,
	}) => {
		await showAllNotesAs(page, "kanban");
		await toggleAiPanel(page);
		await expect(aiPanel(page)).toBeVisible();

		await page.getByTestId("kanban-card").first().click();
		await expect(page.getByTestId("kanban-panel-close")).toBeVisible();
		await expect(aiPanel(page)).toBeVisible();
		await expect
			.poll(async () => {
				const panel = await aiPanel(page).boundingBox();
				const editor = await page.locator(".app__editor").boundingBox();
				return panel && editor ? editor.width - panel.width : 0;
			})
			.toBeGreaterThanOrEqual(400);

		await page.getByTestId("kanban-panel-close").click();
		await expect(page.getByTestId("kanban-panel-close")).toHaveCount(0);
		await expect(aiPanel(page)).toBeVisible();
		await expectBesideLayout(page);
	});

	test("opens the AI panel beside the graph with no note open", async ({
		page,
	}, testInfo) => {
		test.skip(
			testInfo.project.name !== "chromium",
			"WebGL canvas checks run in Chromium",
		);
		await showAllNotesAs(page, "graph");
		await toggleAiPanel(page);
		await expect(aiPanel(page)).toBeVisible();
		await expectBesideLayout(page);
	});
});
