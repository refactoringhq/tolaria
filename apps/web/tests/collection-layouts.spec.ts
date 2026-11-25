import {
	type APIRequestContext,
	expect,
	type Page,
	type TestInfo,
	test,
} from "@playwright/test";
import { COLLAB_TOKEN } from "../playwright.config";

const VIEWPORTS: Record<string, { width: number; height: number }> = {
	chromium: { width: 1440, height: 900 },
	ipad: { width: 820, height: 1180 },
	"iphone-15": { width: 393, height: 852 },
};

const VIEWS = [
	{ name: "list", option: "list", surface: "note-list-container" },
	{ name: "kanban", option: "kanban", surface: "kanban-board" },
	{ name: "calendar", option: "calendar", surface: "calendar-board" },
	{ name: "graph", option: "graph", surface: "graph-layout" },
] as const;

test.describe.configure({ retries: 0 });

async function dispatchTouchPointer(
	page: Page,
	type: "pointerdown" | "pointermove" | "pointerup",
	point: { x: number; y: number },
): Promise<void> {
	await page.evaluate(
		({ pointerType, x, y }) => {
			const event = new PointerEvent(pointerType, {
				bubbles: true,
				cancelable: true,
				pointerId: 1,
				pointerType: "touch",
				isPrimary: true,
				button: 0,
				buttons: pointerType === "pointerup" ? 0 : 1,
				clientX: x,
				clientY: y,
			});
			const target =
				pointerType === "pointerdown"
					? document.elementFromPoint(x, y)
					: document;
			target?.dispatchEvent(event);
		},
		{ pointerType: type, ...point },
	);
}

async function moveTouchPointer(
	page: Page,
	start: { x: number; y: number },
	end: { x: number; y: number },
	steps: number,
): Promise<void> {
	for (let step = 1; step <= steps; step++) {
		await dispatchTouchPointer(page, "pointermove", {
			x: start.x + ((end.x - start.x) * step) / steps,
			y: start.y + ((end.y - start.y) * step) / steps,
		});
		await page.waitForTimeout(16);
	}
}

async function moveHeronOnTouchViewport(
	page: Page,
	card: ReturnType<Page["getByTestId"]>,
	column: ReturnType<Page["getByTestId"]>,
	start: { x: number; y: number },
): Promise<void> {
	await dispatchTouchPointer(page, "pointerdown", start);
	await page.waitForTimeout(40);
	await moveTouchPointer(page, start, { x: start.x + 12, y: start.y }, 3);
	await expect(card).toHaveClass(/kanban-card-slot--placeholder/);
	await page.getByTestId("kanban-board").evaluate((board) => {
		board.scrollLeft = board.scrollWidth;
	});
	const target = await column.boundingBox();
	if (!target) throw new Error("Kanban target did not scroll into view");
	const end = {
		x: target.x + Math.min(target.width / 2, 100),
		y: target.y + 100,
	};
	await moveTouchPointer(page, start, end, 12);
	await expect(column).toHaveClass(/kanban-column--target/);
	await dispatchTouchPointer(page, "pointerup", end);
}

async function moveHeronToNoStatus(
	page: Page,
	testInfo: TestInfo,
): Promise<void> {
	const card = page
		.getByTestId("kanban-board")
		.getByTestId("kanban-card")
		.filter({ hasText: "Heron" });
	const column = page
		.getByTestId("kanban-column")
		.filter({ hasText: "No value" });
	const from = await card.boundingBox();
	const to = await column.boundingBox();
	if (!from || !to) throw new Error("Kanban drag targets are not visible");
	const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
	const end = { x: to.x + to.width / 2, y: to.y + 100 };
	if (testInfo.project.name !== "chromium") {
		await moveHeronOnTouchViewport(page, card, column, start);
		return;
	}
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(start.x + 12, start.y, { steps: 3 });
	await expect(card).toHaveClass(/kanban-card-slot--placeholder/);
	await page.mouse.move(end.x, end.y, { steps: 18 });
	await expect(column).toHaveClass(/kanban-column--target/);
	await page.mouse.up();
}

async function heronContent(request: APIRequestContext): Promise<string> {
	const response = await request.get("/v1/files/projects/heron.md", {
		headers: { authorization: `Bearer ${COLLAB_TOKEN}` },
	});
	expect(response.status()).toBe(200);
	return response.text();
}

async function heronIndexStatus(
	request: APIRequestContext,
): Promise<string | null> {
	const response = await request.get("/v1/entries", {
		headers: { authorization: `Bearer ${COLLAB_TOKEN}` },
	});
	expect(response.status()).toBe(200);
	const body = (await response.json()) as {
		entries: { path: string; status?: string | null }[];
	};
	return (
		body.entries.find((entry) => entry.path === "projects/heron.md")?.status ??
		null
	);
}

async function resetHeronStatus(request: APIRequestContext): Promise<void> {
	const response = await request.get("/v1/files/projects/heron.md", {
		headers: { authorization: `Bearer ${COLLAB_TOKEN}` },
	});
	expect(response.status()).toBe(200);
	const content = await response.text();
	const restored = content.replace(/^status:.*$/m, "status: Active");
	const write = await request.put("/v1/files/projects/heron.md", {
		headers: {
			authorization: `Bearer ${COLLAB_TOKEN}`,
			"if-match": response.headers().etag,
		},
		data: restored,
	});
	expect(write.status()).toBe(200);
}

async function openLayout(page: Page, view: (typeof VIEWS)[number]) {
	await page.getByTestId("layout-menu-button").click();
	await page.getByTestId(`layout-option-${view.option}`).click();
	const surface = page.getByTestId(view.surface);
	if (view.name === "calendar" && !(await surface.isVisible())) {
		await page.getByRole("button", { name: "Show by created date" }).click();
	}
	await expect(surface).toBeVisible();
	return surface;
}

async function expectNotesInLayout(
	page: Page,
	view: (typeof VIEWS)[number],
): Promise<void> {
	const surface = page.getByTestId(view.surface);
	const names = ["Welcome", "Heron", "Ada"];
	if (view.name === "graph") {
		await page.getByTestId("graph-zoom-fit").click();
		const labels = surface.getByTestId("graph-label");
		for (const name of names)
			await expect(labels.filter({ hasText: name })).toBeVisible();
		return;
	}
	for (const name of names)
		await expect(surface.getByText(name, { exact: true })).toBeVisible();
}

async function expectResponsiveLayout(
	page: Page,
	testInfo: TestInfo,
): Promise<void> {
	await expect
		.poll(() =>
			page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		)
		.toBe(true);
	if (testInfo.project.name === "chromium") return;
	const size = await page
		.getByTestId("layout-menu-button")
		.evaluate((element) => {
			const { width, height } = element.getBoundingClientRect();
			return { width, height };
		});
	expect(size.width).toBeGreaterThanOrEqual(44);
	expect(size.height).toBeGreaterThanOrEqual(44);
	const undersizedControls = await page.evaluate(() =>
		Array.from(
			document.querySelectorAll<HTMLElement>(
				[
					"[data-testid='layout-menu-button']",
					"[data-testid='group-by-menu-button']",
					"button[aria-label='Search notes']",
					"button[aria-label='Sort notes']",
					"button[aria-label='Card fields']",
					"button[aria-label='Create new note']",
					"[data-testid='note-list-container'] button",
					"[data-testid='kanban-board'] button",
					"[data-testid='calendar-board'] button",
					"[data-testid='graph-layout'] button",
				].join(", "),
			),
		)
			.filter((element) => element.getClientRects().length > 0)
			.map((element) => {
				const { width, height } = element.getBoundingClientRect();
				return {
					label: element.getAttribute("aria-label") ?? element.textContent,
					width,
					height,
				};
			})
			.filter(({ width, height }) => width < 44 || height < 44),
	);
	expect(undersizedControls).toEqual([]);
}

async function captureLayout(
	page: Page,
	view: (typeof VIEWS)[number],
	testInfo: TestInfo,
): Promise<void> {
	const screenshot = testInfo.outputPath(
		`${testInfo.project.name}-${view.name}.png`,
	);
	await page.screenshot({ path: screenshot, fullPage: false });
	await testInfo.attach(`${testInfo.project.name}-${view.name}`, {
		path: screenshot,
		contentType: "image/png",
	});
}

async function expectSearchFilter(page: Page, view: (typeof VIEWS)[number]) {
	await page.getByRole("button", { name: "Search notes", exact: true }).click();
	const search = page.getByPlaceholder("Search notes...");
	await search.fill("people/ada");
	await expect(page.getByTestId("note-list-search-loading")).toHaveCount(0);
	const surface = page.getByTestId(view.surface);
	for (const name of ["Heron", "Welcome"])
		await expect(surface.getByText(name, { exact: true })).toBeVisible();
	await expect(surface.getByText("Ada", { exact: true })).toHaveCount(0);
	await search.fill("");
}

async function expectStatusMovePersists(
	page: Page,
	request: APIRequestContext,
	testInfo: TestInfo,
): Promise<void> {
	await expect
		.poll(() => heronContent(request))
		.toMatch(/^status:\s*Active\s*$/m);
	await moveHeronToNoStatus(page, testInfo);
	const noStatusColumn = page
		.getByTestId("kanban-column")
		.filter({ hasText: "No value" });
	await expect(
		noStatusColumn.getByText("Heron", { exact: true }),
	).toBeVisible();
	await expect
		.poll(() => heronContent(request))
		.not.toMatch(/^status:\s*Active\s*$/m);
	await expect.poll(() => heronIndexStatus(request)).toBe("");
	await page.reload({ waitUntil: "load" });
	await expect(
		page
			.getByTestId("kanban-column")
			.filter({ hasText: "No value" })
			.getByText("Heron", { exact: true }),
	).toBeVisible({ timeout: 10_000 });
	const screenshot = testInfo.outputPath(
		`${testInfo.project.name}-kanban-updated.png`,
	);
	await page.screenshot({ path: screenshot, fullPage: false });
	await testInfo.attach(`${testInfo.project.name}-kanban-updated`, {
		path: screenshot,
		contentType: "image/png",
	});
	await page.getByTestId("layout-menu-button").click();
	await page.getByTestId("layout-option-list").click();
	await expect(
		page.getByTestId("note-list-container").getByText("Heron", { exact: true }),
	).toBeVisible();
}

test("collection layouts switch, filter, and persist on touch-sized web viewports", async ({
	page,
	request,
}, testInfo) => {
	test.skip(
		!VIEWPORTS[testInfo.project.name],
		"desktop, iPad, and phone viewports only",
	);
	await page.setViewportSize(VIEWPORTS[testInfo.project.name]);
	await resetHeronStatus(request);
	await page.addInitScript(
		({ token }) => {
			window.TOLARIA_REMOTE_URL = window.location.origin;
			window.TOLARIA_REMOTE_TOKEN = token;
			localStorage.setItem("ff_graph_layout", "true");
		},
		{ token: COLLAB_TOKEN },
	);
	await page.goto("/", { waitUntil: "load" });
	await expect(
		page
			.getByTestId("note-list-container")
			.getByText("Welcome", { exact: true }),
	).toBeVisible({ timeout: 10_000 });

	for (const view of VIEWS) {
		await openLayout(page, view);
		await expectNotesInLayout(page, view);
		await expectResponsiveLayout(page, testInfo);
		await captureLayout(page, view, testInfo);

		await page.reload({ waitUntil: "load" });
		await expect(page.getByTestId(view.surface)).toBeVisible({
			timeout: 10_000,
		});
		await expectSearchFilter(page, view);
	}

	await page.getByTestId("layout-menu-button").click();
	await page.getByTestId("layout-option-kanban").click();
	await expectStatusMovePersists(page, request, testInfo);
});
