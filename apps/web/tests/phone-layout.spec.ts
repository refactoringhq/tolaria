import {
	type APIRequestContext,
	expect,
	type Page,
	type TestInfo,
	test,
} from "@playwright/test";
import { COLLAB_TOKEN } from "../playwright.config";

/**
 * TOL-193: at phone width the web app is a single-pane stack, the note list and then the
 * note. Browser back and the in-app back control return to the list through the TOL-175 URL,
 * and the caret stays above the on-screen keyboard. Wider layouts keep every pane.
 */

const PHONE_PROJECTS = ["iphone-15"];
const AUTH = { authorization: `Bearer ${COLLAB_TOKEN}` };
const NOTES = {
	ada: { path: "people/ada.md", title: "Ada", body: "Works on" },
	heron: { path: "projects/heron.md", title: "Heron", body: "Owned by" },
} as const;
/** About what the iPhone keyboard covers of a 659 px tall viewport. */
const KEYBOARD_HEIGHT = 300;

type SeededNote = (typeof NOTES)[keyof typeof NOTES];

test.describe.configure({ retries: 0 });

function isPhone(testInfo: TestInfo): boolean {
	return PHONE_PROJECTS.includes(testInfo.project.name);
}

async function openRemoteVault(page: Page, url = "/"): Promise<void> {
	await page.addInitScript((token) => {
		window.TOLARIA_REMOTE_URL = window.location.origin;
		window.TOLARIA_REMOTE_TOKEN = token;
	}, COLLAB_TOKEN);
	await page.goto(url);
}

function noteParam(page: Page): string | null {
	return new URL(page.url()).searchParams.get("note");
}

function noteList(page: Page) {
	return page.getByTestId("note-list-container");
}

async function expectListPane(page: Page): Promise<void> {
	await expect(
		noteList(page).getByText(NOTES.ada.title, { exact: true }),
	).toBeVisible({ timeout: 15_000 });
	await expect(page.locator(".app__editor")).toBeHidden();
	await expect.poll(() => noteParam(page)).toBeNull();
}

async function expectNotePane(page: Page, note: SeededNote): Promise<void> {
	await expect.poll(() => noteParam(page)).toBe(note.path);
	await expect(page.locator(".bn-editor")).toContainText(note.body, {
		timeout: 10_000,
	});
	await expect(page.getByTestId("phone-back-to-notes")).toBeVisible();
	await expect(noteList(page)).toBeHidden();
}

async function tapNote(page: Page, title: string): Promise<void> {
	await noteList(page).getByText(title, { exact: true }).click();
}

async function shot(page: Page, testInfo: TestInfo, name: string) {
	await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
}

test("phone: list, then the note, and browser back returns to the list", async ({
	page,
}, testInfo) => {
	test.skip(!isPhone(testInfo), "phone layout only");
	await openRemoteVault(page);
	await expectListPane(page);
	await shot(page, testInfo, "phone-list");

	await tapNote(page, NOTES.ada.title);
	await expectNotePane(page, NOTES.ada);
	await shot(page, testInfo, "phone-note");

	await page.goBack();
	await expectListPane(page);
	await shot(page, testInfo, "phone-back-to-list");

	await page.goForward();
	await expectNotePane(page, NOTES.ada);
});

test("phone: the in-app back control returns to the list, and the open note opens again", async ({
	page,
}, testInfo) => {
	test.skip(!isPhone(testInfo), "phone layout only");
	await openRemoteVault(page);
	await tapNote(page, NOTES.heron.title);
	await expectNotePane(page, NOTES.heron);

	await page.getByTestId("phone-back-to-notes").click();
	await expectListPane(page);
	await shot(page, testInfo, "phone-in-app-back");

	await tapNote(page, NOTES.heron.title);
	await expectNotePane(page, NOTES.heron);
	await page.goBack();
	await expectListPane(page);
});

test("phone: a shared note URL opens the note, and back control shows the list", async ({
	page,
}, testInfo) => {
	test.skip(!isPhone(testInfo), "phone layout only");
	await openRemoteVault(page, `/?note=${NOTES.ada.path}`);
	await expectNotePane(page, NOTES.ada);

	await page.getByTestId("phone-back-to-notes").click();
	await expectListPane(page);
});

async function createLongNote(
	request: APIRequestContext,
	title: string,
): Promise<string> {
	const path = `scratch/${title.toLowerCase().replaceAll(" ", "-")}.md`;
	const lines = Array.from(
		{ length: 60 },
		(_, index) => `Line ${index + 1} of a long note.`,
	);
	const response = await request.put(`/v1/files/${path}`, {
		headers: { ...AUTH, "if-none-match": "*" },
		data: `---\ntype: Note\n---\n# ${title}\n\n${lines.join("\n\n")}\n`,
	});
	expect(response.status()).toBe(201);
	return path;
}

/** Whether the caret's box lies within the part of the page the keyboard leaves visible. */
async function caretIsVisible(page: Page): Promise<boolean> {
	return page.evaluate(() => {
		const selection = window.getSelection();
		const viewport = window.visualViewport as VisualViewport;
		if (!selection?.rangeCount) return false;
		const range = selection.getRangeAt(0);
		const caret = range.getBoundingClientRect();
		// A collapsed caret can measure zero high: fall back to its line.
		const box = caret.height
			? caret
			: (range.startContainer.parentElement as Element).getBoundingClientRect();
		return box.top >= 0 && box.bottom <= viewport.offsetTop + viewport.height;
	});
}

function isOnScreen(
	box: { y: number; height: number } | null,
	height: number,
): boolean {
	if (!box) return false;
	return box.y > 0 && box.y + box.height < height - 40;
}

/** The lowest paragraph still fully on screen: where the keyboard will land. */
async function tapLowestVisibleLine(page: Page): Promise<void> {
	const height = page.viewportSize()?.height ?? 0;
	const lines = page.locator(".bn-editor .bn-inline-content", {
		hasText: /^Line \d+ of a long note\.$/,
	});
	for (let index = (await lines.count()) - 1; index >= 0; index--) {
		if (isOnScreen(await lines.nth(index).boundingBox(), height)) {
			await lines.nth(index).click();
			return;
		}
	}
	throw new Error("no line of the long note is on screen");
}

test("phone: the caret stays above the keyboard", async ({
	page,
	request,
}, testInfo) => {
	test.skip(!isPhone(testInfo), "phone layout only");
	const title = `Phone keyboard ${Date.now()}`;
	await createLongNote(request, title);
	await openRemoteVault(page);
	await tapNote(page, title);
	await expect(page.locator(".bn-editor")).toContainText("Line 60", {
		timeout: 10_000,
	});

	await tapLowestVisibleLine(page);
	await page.keyboard.press("End");
	const viewport = page.viewportSize() as { width: number; height: number };
	// The emulated keyboard: the visual viewport shrinks from the bottom, as on iOS.
	await page.setViewportSize({
		width: viewport.width,
		height: viewport.height - KEYBOARD_HEIGHT,
	});

	await expect.poll(() => caretIsVisible(page)).toBe(true);
	await page.keyboard.type(" typed above the keyboard");
	await expect(page.locator(".bn-editor")).toContainText(
		"typed above the keyboard",
	);
	await shot(page, testInfo, "phone-keyboard");
});

test("wider layouts keep the note list beside the note", async ({
	page,
}, testInfo) => {
	test.skip(isPhone(testInfo), "tablet and desktop layouts");
	await openRemoteVault(page);
	await tapNote(page, NOTES.ada.title);
	await expect.poll(() => noteParam(page)).toBe(NOTES.ada.path);

	await expect(noteList(page)).toBeVisible();
	await expect(page.locator(".app__editor")).toBeVisible();
	await expect(page.getByTestId("phone-back-to-notes")).toHaveCount(0);
	await expect(page.locator(".app-shell[data-phone-pane]")).toHaveCount(0);
});
