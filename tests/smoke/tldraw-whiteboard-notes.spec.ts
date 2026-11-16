import { expect, type Locator, type Page, test } from "@playwright/test";
import {
	createFixtureVaultCopy,
	openFixtureVault,
	removeFixtureVaultCopy,
} from "../helpers/fixtureVault";
import { executeCommand, openCommandPalette } from "./helpers";

let tempVaultDir: string;

type TauriHarnessWindow = Window &
	typeof globalThis & {
		isTauri?: boolean;
		__TAURI__?: unknown;
		__TAURI_INTERNALS__?: {
			invoke?: () => Promise<never>;
		};
	};

const TAURI_CONTEXT_MENU_TEST =
	"embedded tldraw context menu opens from a native right-click path";

test.use({ serviceWorkers: "block" });

function requireValue<T>(value: T | null, label: string): T {
	if (value === null) throw new Error(`Expected ${label} to exist`);
	return value;
}

test.beforeEach(async ({ page }, testInfo) => {
	testInfo.setTimeout(90_000);
	tempVaultDir = createFixtureVaultCopy();
	if (testInfo.title === TAURI_CONTEXT_MENU_TEST) {
		await installTauriContextMenuHarness(page);
	}
	await openFixtureVault(page, tempVaultDir);
});

test.afterEach(async () => {
	removeFixtureVaultCopy(tempVaultDir);
});

async function openNote(page: Page, title: string): Promise<void> {
	await page
		.locator('[data-testid="note-list-container"]')
		.getByText(title, { exact: true })
		.click();
	await expect(page.locator(".bn-editor")).toBeVisible({ timeout: 5_000 });
}

async function installTauriContextMenuHarness(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const harnessWindow = window as TauriHarnessWindow;
		harnessWindow.isTauri = false;
		harnessWindow.__TAURI__ = harnessWindow.__TAURI__ ?? {};
		harnessWindow.__TAURI_INTERNALS__ = {
			...harnessWindow.__TAURI_INTERNALS__,
			invoke: async () => {
				throw new Error("No native bridge in context menu harness");
			},
		};
	});
}

async function toggleRawMode(
	page: Page,
	visibleSelector: ".bn-editor" | ".cm-content",
): Promise<void> {
	await openCommandPalette(page);
	await executeCommand(page, "Toggle Raw");
	await expect(page.locator(visibleSelector)).toBeVisible({ timeout: 5_000 });
}

async function getRawEditorContent(page: Page): Promise<string> {
	return page.evaluate(() => {
		type CodeMirrorHost = Element & {
			cmTile?: {
				view?: {
					state: {
						doc: {
							toString(): string;
						};
					};
				};
			};
		};

		const host = document.querySelector(".cm-content") as CodeMirrorHost | null;
		return host?.cmTile?.view?.state.doc.toString() ?? host?.textContent ?? "";
	});
}

async function hasSelectedEditorNode(page: Page): Promise<boolean> {
	return page.evaluate(
		() => document.querySelector(".ProseMirror-selectednode") !== null,
	);
}

async function expectNoEditorNodeSelection(page: Page): Promise<void> {
	expect(await hasSelectedEditorNode(page)).toBe(false);
}

async function focusWhiteboardCanvas(page: Page): Promise<Locator> {
	const canvas = page.getByTestId("canvas");
	await expect(canvas).toBeVisible({ timeout: 20_000 });
	await canvas.click({ position: { x: 50, y: 50 } });
	return canvas;
}

async function expectPaintedTldrawIcon(icon: Locator): Promise<void> {
	await expect(icon).toBeVisible({ timeout: 5_000 });
	const paintState = await icon.evaluate((element) => {
		const iconElement = element as HTMLElement;
		const style = getComputedStyle(iconElement);
		const rect = iconElement.getBoundingClientRect();

		return {
			backgroundColor: style.backgroundColor,
			height: rect.height,
			inlineWebkitMask: iconElement.style.getPropertyValue("-webkit-mask"),
			maskImage: style.getPropertyValue("mask-image"),
			webkitMaskImage: style.getPropertyValue("-webkit-mask-image"),
			width: rect.width,
		};
	});

	expect(paintState.width).toBeGreaterThan(0);
	expect(paintState.height).toBeGreaterThan(0);
	expect(paintState.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
	expect(
		[
			paintState.inlineWebkitMask,
			paintState.webkitMaskImage,
			paintState.maskImage,
		].some((value) => value.trim() !== "" && value !== "none"),
	).toBe(true);
}

async function applyZoom(page: Page, percent: number): Promise<void> {
	await page.evaluate((pct) => {
		document.documentElement.style.setProperty("zoom", `${pct}%`);
		window.dispatchEvent(new Event("laputa-zoom-change"));
	}, percent);
	await page.waitForTimeout(250);
}

test("tldraw whiteboard fences render as embedded canvases and remain Markdown-durable", async ({
	page,
}) => {
	await openNote(page, "Whiteboard Embed");

	await expect(page.locator(".tldraw-whiteboard")).toBeVisible({
		timeout: 20_000,
	});
	await expect(page.locator(".tldraw-whiteboard .tl-container")).toBeVisible({
		timeout: 20_000,
	});
	await expect(page.locator(".bn-editor")).toContainText(
		"Context before the board.",
	);
	await expect(page.locator(".bn-editor")).toContainText(
		"Context after the board.",
	);

	await page.waitForTimeout(500);
	await toggleRawMode(page, ".cm-content");
	const rawAfterRichMode = await getRawEditorContent(page);

	expect(rawAfterRichMode).toContain('```tldraw id="planning-map"');
	expect(rawAfterRichMode).toContain('"schemaVersion": 2');
	expect(rawAfterRichMode).not.toContain("@@TOLARIA_TLDRAW");
});

test("embedded tldraw whiteboards follow Tolaria theme changes", async ({
	page,
}) => {
	await openNote(page, "Whiteboard Embed");

	const tldrawContainer = page
		.locator(".tldraw-whiteboard .tl-container")
		.first();
	await expect(tldrawContainer).toBeVisible({ timeout: 20_000 });

	const initialMode = await tldrawContainer.evaluate((element) =>
		element.classList.contains("tl-theme__dark") ? "dark" : "light",
	);

	await page.getByTestId("status-theme-mode").click();
	const toggledMode = initialMode === "dark" ? "light" : "dark";
	await expect(tldrawContainer).toHaveClass(
		toggledMode === "dark" ? /tl-theme__dark/u : /tl-theme__light/u,
	);
	await expect(tldrawContainer).toHaveAttribute("data-color-mode", toggledMode);

	await page.getByTestId("status-theme-mode").click();
	await expect(tldrawContainer).toHaveClass(
		initialMode === "dark" ? /tl-theme__dark/u : /tl-theme__light/u,
	);
	await expect(tldrawContainer).toHaveAttribute("data-color-mode", initialMode);
});

test("embedded tldraw toolbar and style panel icons keep a WebKit paint mask", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await openNote(page, "Whiteboard Embed");

	const whiteboard = page.locator(".tldraw-whiteboard");
	await expect(whiteboard).toBeVisible({ timeout: 20_000 });

	await expectPaintedTldrawIcon(
		whiteboard.locator(".tlui-main-toolbar .tlui-icon").first(),
	);
	await expectPaintedTldrawIcon(
		whiteboard.locator(".tlui-style-panel .tlui-icon").first(),
	);
});

test("embedded tldraw interactions stay inside the whiteboard", async ({
	page,
}) => {
	await openNote(page, "Whiteboard Embed");

	const whiteboard = page.locator(".tldraw-whiteboard");
	await expect(whiteboard).toBeVisible({ timeout: 20_000 });

	const boardBox = requireValue(await whiteboard.boundingBox(), "boardBox");

	await page.mouse.click(
		boardBox.x + boardBox.width / 2,
		boardBox.y + boardBox.height / 2,
	);
	await expectNoEditorNodeSelection(page);

	await page.getByTestId("tools.select").click();
	await expectNoEditorNodeSelection(page);

	const pageMenuButton = page.getByTestId("page-menu.button");
	const buttonBox = requireValue(
		await pageMenuButton.boundingBox(),
		"buttonBox",
	);

	await pageMenuButton.click();

	const pageMenu = page.locator(".tlui-page-menu__wrapper");
	await expect(pageMenu).toBeVisible({ timeout: 5_000 });

	const menuBox = requireValue(await pageMenu.boundingBox(), "menuBox");
	expect(menuBox.x).toBeGreaterThanOrEqual(boardBox.x - 1);
	expect(menuBox.x).toBeLessThanOrEqual(buttonBox.x + 1);
	await expectNoEditorNodeSelection(page);

	await page.getByTestId("tools.more-button").click();
	const ellipseTool = page.getByTestId("tools.more.ellipse");
	await expect(ellipseTool).toBeVisible({ timeout: 5_000 });
	await ellipseTool.click();
	await expect(page.getByTestId("tools.ellipse")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expectNoEditorNodeSelection(page);
});

test("embedded tldraw whiteboards can expand to a full-window workspace", async ({
	page,
}) => {
	await openNote(page, "Whiteboard Embed");

	const whiteboard = page.locator(".tldraw-whiteboard");
	await expect(whiteboard).toBeVisible({ timeout: 20_000 });
	const embeddedBox = requireValue(
		await whiteboard.boundingBox(),
		"embeddedBox",
	);

	const fullscreenToggle = page.getByTestId(
		"tldraw-whiteboard-fullscreen-toggle",
	);
	await expect(fullscreenToggle).toBeVisible({ timeout: 5_000 });
	await fullscreenToggle.click();
	await expect(whiteboard).toHaveClass(/tldraw-whiteboard--fullscreen/u);

	const fullscreenBox = requireValue(
		await whiteboard.boundingBox(),
		"fullscreenBox",
	);
	const viewport = requireValue(page.viewportSize(), "viewport");
	expect(fullscreenBox.x).toBeLessThanOrEqual(8);
	expect(fullscreenBox.y).toBeLessThanOrEqual(8);
	expect(fullscreenBox.width).toBeGreaterThanOrEqual(viewport.width - 16);
	expect(fullscreenBox.height).toBeGreaterThanOrEqual(viewport.height - 16);

	await page.getByTestId("tools.more-button").click();
	await expect(page.getByTestId("tools.more.ellipse")).toBeVisible({
		timeout: 5_000,
	});
	await expect(whiteboard).toHaveClass(/tldraw-whiteboard--fullscreen/u);
	await expectNoEditorNodeSelection(page);

	await fullscreenToggle.click();
	await expect(whiteboard).not.toHaveClass(/tldraw-whiteboard--fullscreen/u);

	const restoredBox = requireValue(
		await whiteboard.boundingBox(),
		"restoredBox",
	);
	expect(Math.abs(restoredBox.height - embeddedBox.height)).toBeLessThan(4);
});

test("embedded tldraw dialogs appear and release focus when closed", async ({
	page,
}) => {
	await openNote(page, "Whiteboard Embed");

	const whiteboard = page.locator(".tldraw-whiteboard");
	await expect(whiteboard).toBeVisible({ timeout: 20_000 });

	await focusWhiteboardCanvas(page);
	await page.getByTestId("main-menu.button").click();
	await page.getByTestId("main-menu.keyboard-shortcuts-button").click();

	const shortcutsDialog = page.locator(
		".tldraw-whiteboard .tlui-dialog__content",
	);
	await expect(shortcutsDialog).toBeVisible({ timeout: 5_000 });
	await expect(shortcutsDialog).toContainText("Keyboard shortcuts");

	const dialogBox = requireValue(
		await shortcutsDialog.boundingBox(),
		"dialogBox",
	);
	const boardBox = requireValue(await whiteboard.boundingBox(), "boardBox");
	expect(dialogBox.x).toBeGreaterThanOrEqual(boardBox.x);
	expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(
		boardBox.x + boardBox.width,
	);

	await page.getByTestId("dialog.close").click();
	await expect(shortcutsDialog).toHaveCount(0);

	await page.getByTestId("tools.select").click();
	await expect(page.getByTestId("tools.select")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expectNoEditorNodeSelection(page);
});

test("embedded tldraw insert embed dialog opens without crashing the note", async ({
	page,
}) => {
	await openNote(page, "Whiteboard Embed");

	const whiteboard = page.locator(".tldraw-whiteboard");
	await expect(whiteboard).toBeVisible({ timeout: 20_000 });

	await focusWhiteboardCanvas(page);
	await page.getByTestId("main-menu.button").click();
	await page.getByTestId("main-menu.insert-embed").click();

	const embedDialog = page.locator(".tldraw-whiteboard .tlui-dialog__content");
	await expect(embedDialog).toBeVisible({ timeout: 5_000 });
	await expect(embedDialog).toContainText("Insert embed");
	await expect(page.locator(".error-boundary")).toHaveCount(0);

	const dialogBox = requireValue(await embedDialog.boundingBox(), "dialogBox");
	const boardBox = requireValue(await whiteboard.boundingBox(), "boardBox");
	expect(dialogBox.x).toBeGreaterThanOrEqual(boardBox.x);
	expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(
		boardBox.x + boardBox.width,
	);
});

test(TAURI_CONTEXT_MENU_TEST, async ({ page }) => {
	await openNote(page, "Whiteboard Embed");

	const whiteboard = page.locator(".tldraw-whiteboard");
	await expect(whiteboard).toBeVisible({ timeout: 20_000 });
	const boardBox = requireValue(await whiteboard.boundingBox(), "boardBox");

	const canvas = page.getByTestId("canvas");
	await canvas.click({ position: { x: 160, y: 160 } });
	await canvas.click({ button: "right", position: { x: 160, y: 160 } });

	const contextMenu = page.getByTestId("context-menu");
	await expect(contextMenu).toBeVisible({ timeout: 5_000 });
	const menuBox = requireValue(await contextMenu.boundingBox(), "menuBox");
	expect(menuBox.x).toBeGreaterThanOrEqual(boardBox.x - 1);
	expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(
		boardBox.x + boardBox.width + 1,
	);
	await expectNoEditorNodeSelection(page);

	await page.keyboard.press("Escape");
	await expect(contextMenu).toHaveCount(0);
});

test("embedded tldraw drawing remains usable while zoomed", async ({
	page,
}) => {
	await openNote(page, "Whiteboard Embed");
	await applyZoom(page, 110);

	const whiteboard = page.locator(".tldraw-whiteboard");
	await expect(whiteboard).toBeVisible({ timeout: 20_000 });
	const canvas = await focusWhiteboardCanvas(page);

	await page.getByTestId("tools.draw").click();

	const start = { x: 180, y: 180 };
	const end = { x: 300, y: 270 };
	await canvas.hover({ position: start });
	await page.mouse.down();
	await canvas.hover({ position: end });
	await page.mouse.up();

	const shape = page.locator(".tl-shape").first();
	await expect(shape).toBeVisible({ timeout: 5_000 });
});
