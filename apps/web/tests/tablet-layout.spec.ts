import { expect, type Locator, type Page, type TestInfo, test } from "@playwright/test";

/**
 * TOL-194: on a tablet the web app shows two panes, the note list and the note, with the
 * sidebar collapsed until asked for (it floats over the list in portrait). Shortcuts are
 * browser-safe, and holding an arrow key moves the caret one step per key repeat.
 */

const TABLET_PROJECTS = ["ipad", "ipad-landscape"];
const DESKTOP_PROJECTS = ["chromium", "webkit"];
const NOTE_TITLE = "Build Laputa App";
const REPEATS = 20;

test.describe.configure({ retries: 0 });

function isTablet(testInfo: TestInfo): boolean {
	return TABLET_PROJECTS.includes(testInfo.project.name);
}

function isPortrait(page: Page): boolean {
	const viewport = page.viewportSize() as { width: number; height: number };
	return viewport.height > viewport.width;
}

/** ⌥⌘ on Apple devices, Ctrl+Alt elsewhere: what the app reads from the user agent. */
async function webChord(page: Page): Promise<string> {
	const apple = await page.evaluate(() => /Mac OS X|Macintosh/.test(navigator.userAgent));
	return apple ? "Meta+Alt" : "Control+Alt";
}

async function openNote(page: Page): Promise<void> {
	await page.goto("/", { waitUntil: "domcontentloaded" });
	const noteList = page.getByTestId("note-list-container");
	await noteList.getByText(NOTE_TITLE, { exact: true }).click({ timeout: 20_000 });
	await expect(page.locator(".bn-editor").first()).toContainText("bold text", { timeout: 15_000 });
}

async function expectFullyOnScreen(page: Page, locator: Locator): Promise<void> {
	const width = page.viewportSize()?.width ?? 0;
	const box = await locator.boundingBox();
	expect(box).not.toBeNull();
	expect(Math.round((box?.x ?? 0) + (box?.width ?? 0))).toBeLessThanOrEqual(width);
}

async function expectTwoPanes(page: Page): Promise<void> {
	await expect(page.locator(".app__sidebar")).toHaveCount(0);
	await expect(page.getByTestId("note-list-container")).toBeVisible();
	await expect(page.locator(".app__editor")).toBeVisible();
	await expectFullyOnScreen(page, page.locator(".app__editor"));
}

async function shot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
	await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
}

test("tablet: two panes, and the sidebar expands and collapses", async ({ page }, testInfo) => {
	test.skip(!isTablet(testInfo), "tablet layout only");
	await openNote(page);
	await expectTwoPanes(page);
	await shot(page, testInfo, "tablet-sidebar-collapsed");

	await page.getByRole("button", { name: "Expand sidebar" }).click();
	const sidebar = page.locator(".app__sidebar");
	await expect(sidebar).toBeVisible();
	await expectFullyOnScreen(page, page.locator(".app__editor"));
	await shot(page, testInfo, "tablet-sidebar-expanded");

	if (isPortrait(page)) {
		// The sidebar floats over the list; a tap beside it closes it.
		expect((await sidebar.boundingBox())?.x).toBe(0);
		const listLeft = (await page.getByTestId("note-list-container").boundingBox())?.x ?? -1;
		expect(listLeft).toBeLessThanOrEqual(1);
		await page.locator(".bn-editor").first().click();
	} else {
		await page.getByRole("button", { name: "Collapse sidebar" }).click();
	}
	await expectTwoPanes(page);
});

test("tablet: a tap focuses the editor at once", async ({ page }, testInfo) => {
	test.skip(!isTablet(testInfo), "tablet layout only");
	await openNote(page);
	await page.locator(".bn-editor .bn-inline-content").first().tap();
	await expect.poll(() => page.evaluate(() => document.activeElement?.closest(".bn-editor") !== null)).toBe(true);
});

/** Whether the app took a key chord: it prevents the browser's default for its shortcuts. */
async function appTakes(page: Page, chord: string): Promise<boolean> {
	await page.evaluate(() => {
		window.addEventListener("keydown", (event) => {
			document.documentElement.dataset.lastKeyTaken = String(event.defaultPrevented);
		}, { once: true });
	});
	await page.keyboard.press(chord);
	return page.evaluate(() => document.documentElement.dataset.lastKeyTaken === "true");
}

test("browser-safe shortcuts: ⌥⌘ for the app, the browser keeps its own", async ({ page }, testInfo) => {
	test.skip(![...TABLET_PROJECTS, ...DESKTOP_PROJECTS].includes(testInfo.project.name), "hardware keyboard layouts");
	await openNote(page);
	await page.locator(".bn-editor").first().click();
	const chord = await webChord(page);

	// New window, tab switching, print and bookmark stay with the browser.
	for (const key of ["ControlOrMeta+n", "ControlOrMeta+1", "ControlOrMeta+p", "ControlOrMeta+d"]) {
		expect(await appTakes(page, key), key).toBe(false);
	}
	await expect(page.getByTestId("note-list-container")).toBeVisible();

	await page.keyboard.press(`${chord}+Digit3`);
	await expect(page.locator(".app__sidebar")).toBeVisible();
	await page.keyboard.press(`${chord}+Digit2`);
	await expect(page.locator(".app__sidebar")).toHaveCount(0);
	await expect(page.getByTestId("note-list-container")).toBeVisible();
	await page.keyboard.press(`${chord}+Digit1`);
	await expect(page.getByTestId("note-list-container")).toHaveCount(0);
	await page.keyboard.press(`${chord}+Digit2`);
	await expect(page.getByTestId("note-list-container")).toBeVisible();

	await page.keyboard.press(`${chord}+KeyP`);
	const quickOpen = page.getByTestId("quick-open-palette");
	await expect(quickOpen.getByRole("textbox")).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(page.getByTestId("quick-open-palette")).toHaveCount(0);
	await shot(page, testInfo, "tablet-keyboard");
});

/**
 * Records, per arrow keydown, how long the page's keydown handlers kept the main thread (from
 * the first capture listener to the last bubble listener) and whether the caret then moved on.
 */
async function recordArrowKeys(page: Page): Promise<void> {
	await page.evaluate(() => {
		const steps: { cost: number; advanced: boolean }[] = [];
		Reflect.set(window, "arrowKeySteps", steps);
		const caret = () => window.getSelection()?.getRangeAt(0).cloneRange() ?? null;
		let start = 0;
		let before: Range | null = null;
		window.addEventListener("keydown", (event) => {
			if (!event.key.startsWith("Arrow")) return;
			start = performance.now();
			before = caret();
		}, true);
		window.addEventListener("keydown", (event) => {
			if (!event.key.startsWith("Arrow")) return;
			const cost = performance.now() - start;
			const from = before;
			// The caret moves after the event; read it in the next task.
			setTimeout(() => {
				const after = caret();
				const advanced = Boolean(from && after && after.compareBoundaryPoints(Range.START_TO_START, from) > 0);
				steps.push({ cost, advanced });
			}, 0);
		});
	});
}

function recordedSteps(page: Page): Promise<{ cost: number; advanced: boolean }[]> {
	return page.evaluate(() => Reflect.get(window, "arrowKeySteps") as { cost: number; advanced: boolean }[]);
}

test("arrow-key repeat moves the caret at the keyboard's pace", async ({ page }, testInfo) => {
	test.skip(![...TABLET_PROJECTS, ...DESKTOP_PROJECTS].includes(testInfo.project.name), "hardware keyboard layouts");
	await openNote(page);
	await page.locator(".bn-editor h1").first().click();
	await page.keyboard.press("Home");
	await recordArrowKeys(page);

	// Held down: one keydown, then repeats, as a hardware keyboard sends them.
	for (let index = 0; index < REPEATS; index++) await page.keyboard.down("ArrowDown");
	await page.keyboard.up("ArrowDown");

	await expect.poll(async () => (await recordedSteps(page)).length).toBe(REPEATS);
	const steps = await recordedSteps(page);
	await testInfo.attach("arrow-key-steps.json", { body: JSON.stringify(steps), contentType: "application/json" });
	// Every repeat moved the caret: none was dropped or swallowed.
	expect(steps.filter((step) => step.advanced)).toHaveLength(REPEATS);
	// A 30 Hz key repeat leaves 33 ms per step; the page's own handling stays inside one frame.
	const costs = steps.map((step) => step.cost).sort((a, b) => a - b);
	expect(costs[Math.floor(costs.length / 2)]).toBeLessThan(16);
});
