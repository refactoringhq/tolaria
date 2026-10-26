import { execFileSync } from "node:child_process";
import {
	type APIRequestContext,
	expect,
	type Page,
	test,
} from "@playwright/test";
import { COLLAB_TOKEN, REMOTE_GIT_DIR } from "../playwright.config";

/**
 * TOL-202: a note created on the web is created on the server (and pushed to the git remote
 * the desktop pulls), renamed after its first heading like on the desktop, keeps the editor
 * through that rename, and is deleted from the server and the remote.
 */

test.describe.configure({ retries: 0 });

const AUTH = { authorization: `Bearer ${COLLAB_TOKEN}` };

async function configureRemoteVault(page: Page): Promise<void> {
	await page.addInitScript((token) => {
		window.TOLARIA_REMOTE_URL = window.location.origin;
		window.TOLARIA_REMOTE_TOKEN = token;
	}, COLLAB_TOKEN);
}

async function serverPaths(request: APIRequestContext): Promise<string[]> {
	const response = await request.get("/v1/files", { headers: AUTH });
	expect(response.status()).toBe(200);
	const body = (await response.json()) as { files: { path: string }[] };
	return body.files.map((file) => file.path);
}

async function serverContent(
	request: APIRequestContext,
	path: string,
): Promise<string> {
	const response = await request.get(`/v1/files/${path}`, { headers: AUTH });
	return response.ok() ? response.text() : "";
}

/** The files on the git remote's main branch: what the desktop app gets on its next pull. */
function remotePaths(): string[] {
	return execFileSync(
		"git",
		["--git-dir", REMOTE_GIT_DIR, "ls-tree", "-r", "--name-only", "main"],
		{ encoding: "utf8" },
	)
		.split("\n")
		.filter(Boolean);
}

function editor(page: Page) {
	return page.locator(".bn-editor");
}

function editorHasFocus(page: Page): Promise<boolean> {
	return page.evaluate(
		() => document.activeElement?.closest(".bn-editor") != null,
	);
}

/** The untitled notes on the server that were not there before the test. */
async function addedUntitledPaths(
	request: APIRequestContext,
	before: string[],
): Promise<string[]> {
	return (await serverPaths(request)).filter(
		(path) => !before.includes(path) && /^untitled-note-\d+/.test(path),
	);
}

/** The phone shows the note or the list (TOL-193): back to the list there; true on a phone. */
async function showNoteList(page: Page): Promise<boolean> {
	const back = page.getByTestId("phone-back-to-notes");
	if (!(await back.isVisible())) return false;
	await back.click();
	return true;
}

test("a note created on the web is renamed after its heading and deleted", async ({
	page,
	request,
}, testInfo) => {
	const stamp = `${testInfo.project.name}-${Date.now()}`;
	const title = `Lifecycle ${stamp}`;
	const renamedPath = `lifecycle-${stamp}.md`;
	const before = await serverPaths(request);

	await configureRemoteVault(page);
	await page.goto("/", { waitUntil: "load" });
	const noteList = page.getByTestId("note-list-container");
	await expect(noteList.getByText("Welcome", { exact: true })).toBeVisible({
		timeout: 10_000,
	});

	await page.getByRole("button", { name: "Create new note" }).first().click();

	// Created on the server with a fresh untitled name: one click, one note.
	await expect
		.poll(async () => addedUntitledPaths(request, before))
		.toHaveLength(1);
	const [untitledPath] = await addedUntitledPaths(request, before);
	await expect
		.poll(() => remotePaths(), { timeout: 10_000 })
		.toContain(untitledPath);

	// The new note's heading is focused: typing names the note. The caret lands once the
	// note's live document is open.
	await expect(editor(page)).toBeVisible({ timeout: 10_000 });
	await expect(
		editor(page).locator("h1, [data-content-type='heading']").first(),
	).toBeVisible();
	await expect.poll(() => editorHasFocus(page), { timeout: 10_000 }).toBe(true);
	await page.keyboard.type(title);

	// Like the desktop, the untitled note takes its heading's name once typing pauses.
	await expect
		.poll(async () => serverPaths(request), { timeout: 20_000 })
		.toContain(renamedPath);
	expect(await addedUntitledPaths(request, before)).toEqual([]);

	// The editor kept the caret through the rename: typing goes on in the same note.
	await page.keyboard.press("Enter");
	await page.keyboard.type("Typed after the rename.");
	await expect
		.poll(async () => serverContent(request, renamedPath), { timeout: 20_000 })
		.toContain("Typed after the rename.");
	const content = await serverContent(request, renamedPath);
	expect(content).toContain(`# ${title}`);
	await expect
		.poll(() => remotePaths(), { timeout: 10_000 })
		.toContain(renamedPath);

	const phone = await showNoteList(page);
	await expect(
		noteList.getByText(title, { exact: true }),
		"the note list shows the renamed note by its title",
	).toBeVisible();
	if (phone) await noteList.getByText(title, { exact: true }).click();
	await page.getByRole("button", { name: "More note actions" }).click();
	await page.getByRole("menuitem", { name: "Delete this note" }).click();
	await page.getByTestId("confirm-delete-btn").click();

	await expect
		.poll(async () => serverPaths(request), { timeout: 10_000 })
		.not.toContain(renamedPath);
	await expect
		.poll(() => remotePaths(), { timeout: 10_000 })
		.not.toContain(renamedPath);
	await expect(noteList.getByText(title, { exact: true })).toHaveCount(0);

	// Still gone after a reload: the list comes from the server.
	await page.reload({ waitUntil: "load" });
	// Like the desktop, the phone opened the next note in the deleted one's place.
	if (phone)
		await page.getByTestId("phone-back-to-notes").click({ timeout: 10_000 });
	await expect(noteList.getByText("Welcome", { exact: true })).toBeVisible({
		timeout: 10_000,
	});
	await expect(noteList.getByText(title, { exact: true })).toHaveCount(0);
});
