import {
	expect,
	type Locator,
	type Page,
	type TestInfo,
	test,
} from "@playwright/test";

/**
 * TOL-419: with a finger, the editor's toolbars and the status bar measure at least 44 × 44 px,
 * a tap never leaves a hover tooltip on screen, and the status bar stays above the on-screen
 * keyboard. A mouse keeps the compact desktop toolbars and its hover tooltips.
 */

const TOUCH_PROJECTS = ["iphone-15", "ipad", "ipad-landscape"];
const TABLET_PROJECTS = ["ipad", "ipad-landscape"];
const DESKTOP_PROJECTS = ["chromium", "webkit"];
const NOTE_TITLE = "Build Laputa App";
const MIN_TARGET_PX = 44;
/** About what the iPad keyboard covers, with its shortcut bar. */
const KEYBOARD_HEIGHT = 380;

test.describe.configure({ retries: 0 });

function isTouch(testInfo: TestInfo): boolean {
	return TOUCH_PROJECTS.includes(testInfo.project.name);
}

function tooltips(page: Page): Locator {
	return page.locator('[data-slot="tooltip-content"]');
}

async function openNote(page: Page, testInfo: TestInfo): Promise<void> {
	await page.goto("/", { waitUntil: "domcontentloaded" });
	const item = page
		.getByTestId("note-list-container")
		.getByText(NOTE_TITLE, { exact: true });
	await expect(item).toBeVisible({ timeout: 20_000 });
	if (isTouch(testInfo)) await item.tap();
	else await item.click();
	await expect(page.locator(".bn-editor").first()).toContainText("bold text", {
		timeout: 15_000,
	});
}

async function visibleControls(container: Locator): Promise<Locator[]> {
	const controls: Locator[] = [];
	for (const control of await container
		.locator('button, [role="button"]')
		.all()) {
		if (await control.isVisible()) controls.push(control);
	}
	return controls;
}

async function expectTouchTargets(
	container: Locator,
	name: string,
): Promise<void> {
	const controls = await visibleControls(container);
	expect(controls.length, `${name} controls`).toBeGreaterThan(0);
	for (const control of controls) {
		const box = await control.boundingBox();
		const label = `${name} control "${(await control.getAttribute("aria-label")) ?? (await control.textContent())}"`;
		expect(
			Math.round(box?.width ?? 0),
			`${label} width`,
		).toBeGreaterThanOrEqual(MIN_TARGET_PX);
		expect(
			Math.round(box?.height ?? 0),
			`${label} height`,
		).toBeGreaterThanOrEqual(MIN_TARGET_PX);
	}
}

/** Selects the first formatted word, as a double tap does: the formatting toolbar follows. */
async function selectBoldWord(page: Page): Promise<void> {
	await page.locator(".bn-editor strong").first().tap();
	await page.evaluate(() => {
		const word = document.querySelector(".bn-editor strong")?.firstChild;
		if (!word) throw new Error("no bold word in the note");
		const range = document.createRange();
		range.setStart(word, 0);
		range.setEnd(word, word.textContent?.length ?? 0);
		const selection = window.getSelection() as Selection;
		selection.removeAllRanges();
		selection.addRange(range);
	});
}

test("touch: the editor toolbar and the status bar measure at least 44 × 44 px", async ({
	page,
}, testInfo) => {
	test.skip(!isTouch(testInfo), "touch layouts only");
	await openNote(page, testInfo);
	await expectTouchTargets(
		page.locator(".breadcrumb-bar__actions"),
		"editor toolbar",
	);
	if (TABLET_PROJECTS.includes(testInfo.project.name)) {
		await expectTouchTargets(page.getByTestId("status-bar"), "status bar");
	}
	await page.screenshot({
		path: testInfo.outputPath("touch-editor-toolbar.png"),
	});
});

test("touch: the formatting toolbar measures at least 44 px and formats the selection", async ({
	page,
}, testInfo) => {
	test.skip(!isTouch(testInfo), "touch layouts only");
	await openNote(page, testInfo);
	await selectBoldWord(page);
	const toolbar = page.locator(".bn-formatting-toolbar");
	await expect(toolbar).toBeVisible();
	await expectTouchTargets(toolbar, "formatting toolbar");
	const box = await toolbar.boundingBox();
	expect(
		Math.round((box?.x ?? 0) + (box?.width ?? 0)),
		"toolbar right edge",
	).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
	await page.screenshot({
		path: testInfo.outputPath("touch-formatting-toolbar.png"),
	});

	await toolbar.locator('[data-test="italic"]').tap();
	await expect(
		page.locator(".bn-editor strong em, .bn-editor em strong").first(),
	).toBeVisible();
});

test("touch: a tap leaves no tooltip on screen", async ({ page }, testInfo) => {
	test.skip(!isTouch(testInfo), "touch layouts only");
	await openNote(page, testInfo);
	await page.getByRole("button", { name: "Add to favorites" }).tap();
	await page.waitForTimeout(300);
	await expect(tooltips(page), "after tapping a toolbar button").toHaveCount(0);

	// A menu hands focus back to its button when an item is chosen: no press precedes that focus.
	await page.getByRole("button", { name: "More note actions" }).tap();
	await page.getByRole("menuitem", { name: "Copy note deeplink" }).tap();
	await page.waitForTimeout(300);
	await expect(tooltips(page), "after choosing a menu item").toHaveCount(0);
	await page.screenshot({
		path: testInfo.outputPath("touch-no-sticky-tooltip.png"),
	});
});

test("touch: on the iPad the status bar stays above the keyboard", async ({
	page,
}, testInfo) => {
	test.skip(
		!TABLET_PROJECTS.includes(testInfo.project.name),
		"the phone shell follows the keyboard since TOL-193",
	);
	// The emulated keyboard: only the visual viewport shrinks, as on iPadOS; the layout keeps its height.
	await page.addInitScript((keyboard: number) => {
		const target = new EventTarget();
		const state = { keyboard: 0 };
		const viewport = Object.defineProperties(target, {
			width: { get: () => window.innerWidth },
			height: { get: () => window.innerHeight - state.keyboard },
			offsetTop: { value: 0 },
			offsetLeft: { value: 0 },
			pageTop: { value: 0 },
			pageLeft: { value: 0 },
			scale: { value: 1 },
		});
		Object.defineProperty(window, "visualViewport", {
			configurable: true,
			get: () => viewport,
		});
		Object.assign(window, {
			__openKeyboard: () => {
				state.keyboard = keyboard;
				target.dispatchEvent(new Event("resize"));
			},
		});
	}, KEYBOARD_HEIGHT);
	await openNote(page, testInfo);
	await page.locator(".bn-editor .bn-inline-content").first().tap();
	await page.evaluate(() =>
		(window as unknown as { __openKeyboard: () => void }).__openKeyboard(),
	);

	const visibleBottom = (page.viewportSize()?.height ?? 0) - KEYBOARD_HEIGHT;
	await expect
		.poll(
			async () =>
				Math.round(
					(await page.getByTestId("status-bar").boundingBox())?.y ?? 0,
				) + MIN_TARGET_PX,
		)
		.toBeLessThanOrEqual(visibleBottom);
	await expectTouchTargets(
		page.getByTestId("status-bar"),
		"status bar above the keyboard",
	);
	await page.screenshot({
		path: testInfo.outputPath("touch-status-bar-above-keyboard.png"),
	});
});

test("mouse: the toolbars stay compact and hover tooltips still appear", async ({
	page,
}, testInfo) => {
	test.skip(
		!DESKTOP_PROJECTS.includes(testInfo.project.name),
		"mouse layouts only",
	);
	await openNote(page, testInfo);
	const control = page
		.locator(".breadcrumb-bar__actions [aria-label]")
		.filter({ visible: true })
		.first();
	expect((await control.boundingBox())?.height ?? 0).toBeLessThan(
		MIN_TARGET_PX,
	);
	await expect(tooltips(page)).toHaveCount(0);

	await control.hover();
	await expect(tooltips(page)).toHaveCount(1);
	await page.screenshot({
		path: testInfo.outputPath("mouse-hover-tooltip.png"),
	});

	await page.mouse.move(0, 0);
	await expect(tooltips(page)).toHaveCount(0);
});
