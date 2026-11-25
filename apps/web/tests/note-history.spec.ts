import {
	type APIRequestContext,
	expect,
	type Page,
	type TestInfo,
	test,
} from "@playwright/test";
import { COLLAB_TOKEN, REMOTE_URL } from "../playwright.config";

/**
 * TOL-421: a note edited twice on the web has its versions in the history drawer; an earlier
 * one is compared with the note now and restored, which saves it as a new version, and the
 * edit it replaced is still in the history. The vault server and its git history are real.
 */

const AUTH = { authorization: `Bearer ${COLLAB_TOKEN}` };
const LINE = "A line to change.";
const OPEN_MS = 15_000;
const SAVE_MS = 20_000;

test.describe.configure({ retries: 0 });
// Not about offline read: the WebKit service-worker stall (TOL-230) must not block this spec.
test.use({ serviceWorkers: "block" });

interface HistoryNote {
	path: string;
	title: string;
}

const created: HistoryNote[] = [];

test.afterEach(async ({ request }) => {
	for (const note of created.splice(0)) await deleteNote(request, note);
});

async function createNote(
	request: APIRequestContext,
	testInfo: TestInfo,
): Promise<HistoryNote> {
	const slug = `${testInfo.project.name}-${Date.now()}`.replace(
		/[^a-z0-9-]/giu,
		"-",
	);
	const note = { path: `history/${slug}.md`, title: `History ${slug}` };
	const response = await request.put(`${REMOTE_URL}/v1/files/${note.path}`, {
		headers: { ...AUTH, "if-none-match": "*" },
		data: `---\ntype: Note\n---\n# ${note.title}\n\n${LINE}\n`,
	});
	expect(response.status()).toBe(201);
	created.push(note);
	return note;
}

async function deleteNote(
	request: APIRequestContext,
	note: HistoryNote,
): Promise<void> {
	const read = await request.get(`${REMOTE_URL}/v1/files/${note.path}`, {
		headers: AUTH,
	});
	if (read.status() !== 200) return;
	await request.delete(`${REMOTE_URL}/v1/files/${note.path}`, {
		headers: { ...AUTH, "if-match": read.headers().etag ?? "" },
	});
}

async function serverContent(
	request: APIRequestContext,
	note: HistoryNote,
): Promise<string> {
	const response = await request.get(`${REMOTE_URL}/v1/files/${note.path}`, {
		headers: AUTH,
	});
	return response.text();
}

async function openNote(page: Page, note: HistoryNote): Promise<void> {
	await page.addInitScript((token) => {
		window.TOLARIA_REMOTE_URL = window.location.origin;
		window.TOLARIA_REMOTE_TOKEN = token;
	}, COLLAB_TOKEN);
	await page.goto(`/?note=${encodeURIComponent(note.path)}`, {
		waitUntil: "load",
	});
	await expect(page.locator(".bn-editor h1").first()).toContainText(
		note.title,
		{ timeout: OPEN_MS },
	);
}

/** Types `text` at the end of the note's line, and waits until the server saved it. */
async function appendToLine(
	page: Page,
	request: APIRequestContext,
	{ note, text }: { note: HistoryNote; text: string },
): Promise<void> {
	await page
		.locator(".bn-editor .bn-inline-content", { hasText: LINE })
		.first()
		.click();
	await page.keyboard.press("End");
	// One insertion, so the edit is saved as one version.
	await page.keyboard.insertText(text);
	await expect
		.poll(async () => serverContent(request, note), { timeout: SAVE_MS })
		.toContain(text);
}

async function openHistory(page: Page) {
	await page.getByTestId("breadcrumb-overflow-menu-trigger").click();
	await page.getByTestId("note-history-menu-item").click();
	const drawer = page.getByTestId("note-history-drawer");
	await expect(drawer).toBeVisible();
	return drawer;
}

async function shot(page: Page, testInfo: TestInfo, name: string) {
	const path = testInfo.outputPath(`${name}.png`);
	await page.screenshot({ path });
	await testInfo.attach(name, { path, contentType: "image/png" });
}

test("an earlier version is compared with the note and restored as a new version", async ({
	page,
	request,
}, testInfo) => {
	const note = await createNote(request, testInfo);
	await openNote(page, note);
	await appendToLine(page, request, { note, text: " first edit" });
	await appendToLine(page, request, { note, text: " second edit" });

	const drawer = await openHistory(page);
	const checkpoints = drawer.getByTestId("note-history-checkpoint");
	await expect(checkpoints).toHaveCount(3, { timeout: OPEN_MS });
	await expect(checkpoints.first()).toContainText("Latest");
	await shot(page, testInfo, "history-drawer");

	// The version after the first edit: the second edit is only in the note now.
	await checkpoints.nth(1).click();
	const diff = drawer.getByTestId("note-history-diff");
	await expect(diff.locator('[data-diff-kind="removed"]')).toContainText(
		"first edit second edit",
	);
	await expect(diff.locator('[data-diff-kind="added"]')).toHaveText(
		/first edit$/u,
	);
	await shot(page, testInfo, "history-diff");

	await drawer.getByTestId("note-history-restore").click();
	await expect(drawer.getByTestId("note-history-restore-status")).toHaveText(
		"Restored. The version it replaced is still in the history.",
	);
	await expect(checkpoints).toHaveCount(4, { timeout: OPEN_MS });
	expect(await serverContent(request, note)).not.toContain("second edit");
	await shot(page, testInfo, "history-after-restore");

	// The edit the restore replaced is still in the history.
	await checkpoints.nth(1).click();
	await expect(diff.locator('[data-diff-kind="added"]')).toContainText(
		"first edit second edit",
	);
	await shot(page, testInfo, "history-later-edit-kept");

	await page.keyboard.press("Escape");
	await expect(drawer).toBeHidden();
	const editorLine = page
		.locator(".bn-editor .bn-inline-content", { hasText: LINE })
		.first();
	await expect(editorLine).toHaveText(`${LINE} first edit`, {
		timeout: OPEN_MS,
	});
	await shot(page, testInfo, "note-after-restore");
});
