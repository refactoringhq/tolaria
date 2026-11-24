import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type APIRequestContext,
	expect,
	type Page,
	test,
} from "@playwright/test";
import { COLLAB_TOKEN, REMOTE_GIT_DIR } from "../playwright.config";

/**
 * TOL-15: the desktop app pushes a change to the paragraph someone is typing in on the web.
 * The server cannot merge the two, so the live note keeps the web edits and the desktop's
 * version becomes a conflict copy: the shell says so, the note list marks the copy, and
 * both versions are in the vault.
 */

const AUTH = { authorization: `Bearer ${COLLAB_TOKEN}` };
const SECOND = "Second paragraph.";

test.describe.configure({ retries: 0 });

interface ConflictNote {
	id: string;
	path: string;
	desktopLine: string;
	webText: string;
}

function noteFor(projectName: string): ConflictNote {
	const id = `tol15-${projectName}-${Date.now()}`;
	return {
		id,
		path: `conflicts/${id}.md`,
		desktopLine: "Second paragraph, rewritten on the desktop.",
		webText: ` Typed on the web ${id}.`,
	};
}

function markdown({ id }: ConflictNote, second = SECOND): string {
	return `# Note ${id}\n\nFirst paragraph.\n\n${second}\n\nThird paragraph.\n`;
}

async function configureRemoteVault(page: Page): Promise<void> {
	await page.addInitScript((token) => {
		window.TOLARIA_REMOTE_URL = window.location.origin;
		window.TOLARIA_REMOTE_TOKEN = token;
	}, COLLAB_TOKEN);
}

function git(cwd: string, args: string[]): string {
	return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function remoteHas(path: string): boolean {
	return git(tmpdir(), [
		"--git-dir",
		REMOTE_GIT_DIR,
		"ls-tree",
		"-r",
		"--name-only",
		"main",
	])
		.split("\n")
		.includes(path);
}

/** A desktop clone of the vault with the note's paragraph rewritten and committed, not pushed. */
function desktopCommit(note: ConflictNote): string {
	const clone = mkdtempSync(join(tmpdir(), "tolaria-desktop-"));
	git(tmpdir(), ["clone", "-q", REMOTE_GIT_DIR, clone]);
	git(clone, ["config", "user.email", "desktop@example.com"]);
	git(clone, ["config", "user.name", "Desktop"]);
	const file = join(clone, note.path);
	writeFileSync(
		file,
		readFileSync(file, "utf8").replace(SECOND, note.desktopLine),
	);
	git(clone, ["commit", "-qam", `Desktop edit of ${note.path}`]);
	return clone;
}

async function serverFile(
	request: APIRequestContext,
	path: string,
): Promise<{ text: string; etag: string | null }> {
	const response = await request.get(`/v1/files/${path}`, { headers: AUTH });
	if (!response.ok()) return { text: "", etag: null };
	return { text: await response.text(), etag: response.headers().etag ?? null };
}

async function serverPaths(request: APIRequestContext): Promise<string[]> {
	const response = await request.get("/v1/files", { headers: AUTH });
	const body = (await response.json()) as { files: { path: string }[] };
	return body.files.map((file) => file.path);
}

async function deleteFile(
	request: APIRequestContext,
	path: string,
): Promise<void> {
	const { etag } = await serverFile(request, path);
	if (etag)
		await request.delete(`/v1/files/${path}`, {
			headers: { ...AUTH, "if-match": etag },
		});
}

function editor(page: Page) {
	return page.locator(".bn-editor");
}

/** The phone shows the note or the list (TOL-193): back to the list there. */
async function showNoteList(page: Page): Promise<void> {
	const back = page.getByTestId("phone-back-to-notes");
	if (await back.isVisible()) await back.click();
}

async function createNote(
	request: APIRequestContext,
	note: ConflictNote,
): Promise<void> {
	const created = await request.put(`/v1/files/${note.path}`, {
		headers: { ...AUTH, "if-none-match": "*" },
		data: markdown(note),
	});
	expect(created.status()).toBe(201);
	await expect.poll(() => remoteHas(note.path), { timeout: 15_000 }).toBe(true);
}

/** The desktop pushes while the web is about to type into the same paragraph. */
async function typeWhileTheDesktopPushes(
	page: Page,
	note: ConflictNote,
	clone: string,
): Promise<void> {
	await configureRemoteVault(page);
	await page.goto(`/?note=${note.path}`, { waitUntil: "networkidle" });
	const second = editor(page)
		.locator(".bn-inline-content", { hasText: SECOND })
		.first();
	await expect(second).toBeVisible({ timeout: 15_000 });
	// The server only sees the push when its own push of the web edit is rejected (ADR 0310):
	// the e2e server does not pull on a timer (playwright.config.ts), which could adopt it first.
	git(clone, ["push", "-q", "origin", "HEAD:main"]);
	await second.click();
	await page.keyboard.press("End");
	await page.keyboard.type(note.webText);
}

/** The note keeps the web edits and the copy holds the desktop's version. Returns the copy. */
async function expectNothingLost(
	page: Page,
	request: APIRequestContext,
	note: ConflictNote,
): Promise<string> {
	const copy =
		(await serverPaths(request)).find((path) =>
			path.startsWith(`conflicts/${note.id} (conflict `),
		) ?? "";
	expect(copy).not.toBe("");
	await expect
		.poll(async () => (await serverFile(request, note.path)).text, {
			timeout: 20_000,
		})
		.toBe(markdown(note, `${SECOND}${note.webText}`));
	expect((await serverFile(request, copy)).text).toBe(
		markdown(note, note.desktopLine),
	);
	await expect(editor(page)).toContainText(`${SECOND}${note.webText}`);
	await expect(editor(page)).not.toContainText(note.desktopLine);
	return copy;
}

async function expectCopyMarkedInNoteList(
	page: Page,
	note: ConflictNote,
): Promise<void> {
	await showNoteList(page);
	const copyRow = page
		.getByTestId("note-list-container")
		.getByTestId("note-title-row")
		.filter({ has: page.getByTestId("conflict-copy-badge") })
		.filter({ hasText: note.id });
	await expect(copyRow).toHaveCount(1, { timeout: 15_000 });
	await expect(copyRow).toContainText("Conflict copy");
}

test("a desktop push mid-edit keeps the web edits and marks the desktop version as a conflict copy", async ({
	page,
	request,
}, testInfo) => {
	const note = noteFor(testInfo.project.name);
	await createNote(request, note);
	const clone = desktopCommit(note);
	let copy = "";
	try {
		await typeWhileTheDesktopPushes(page, note, clone);

		const notice = page.getByTestId("conflict-copy-notice");
		await expect(notice).toBeVisible({ timeout: 20_000 });
		await expect(notice).toContainText(`${note.id} (conflict `);
		copy = await expectNothingLost(page, request, note);

		await page.getByTestId("conflict-copy-notice-dismiss").click();
		await expect(notice).toBeHidden();
		await expectCopyMarkedInNoteList(page, note);
	} finally {
		rmSync(clone, { recursive: true, force: true });
		await page.close();
		// Later projects of the run share the server: leave the seeded list as it was.
		await deleteFile(request, note.path);
		if (copy) await deleteFile(request, copy);
	}
});
