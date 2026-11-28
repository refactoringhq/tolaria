import { execFileSync } from "node:child_process";
import {
	type APIRequestContext,
	type BrowserContext,
	expect,
	type Page,
	test,
	type TestInfo,
} from "@playwright/test";
import { COLLAB_TOKEN, REMOTE_GIT_DIR } from "../playwright.config";

/**
 * TOL-227: moving a note to another folder and renaming a folder on the web go through the
 * server, which moves the files and rewrites the wikilinks to them in one commit. A note that
 * links to them and is open in another tab gets the new links in its live document, without a
 * reload. Names Windows cannot hold are refused with the desktop's message.
 */

test.describe.configure({ retries: 0 });

const AUTH = { authorization: `Bearer ${COLLAB_TOKEN}` };
/** The sidebar, the folder tree and the command palette are laid out for a hardware keyboard and pointer here. */
const DESKTOP_PROJECTS = ["chromium", "webkit"];

/** A vault-relative note path. */
type NotePath = string;

interface SeededNote {
	path: NotePath;
	title: string;
	content: string;
}

function skipUnlessDesktop(testInfo: TestInfo): void {
	test.skip(!DESKTOP_PROJECTS.includes(testInfo.project.name), "desktop layouts only");
}

function stampOf(testInfo: TestInfo): string {
	return `${testInfo.project.name}-${Date.now()}`;
}

async function configureRemoteVault(context: BrowserContext): Promise<void> {
	await context.addInitScript((token) => {
		window.TOLARIA_REMOTE_URL = window.location.origin;
		window.TOLARIA_REMOTE_TOKEN = token;
	}, COLLAB_TOKEN);
}

async function createNote(request: APIRequestContext, { path, content }: SeededNote): Promise<void> {
	const response = await request.put(`/v1/files/${path}`, {
		headers: { ...AUTH, "if-none-match": "*" },
		data: content,
	});
	expect(response.status()).toBe(201);
}

/** Deletes a note this test made, so the shared vault's note list stays as the other specs expect. */
async function deleteNote(request: APIRequestContext, path: NotePath): Promise<void> {
	const read = await request.get(`/v1/files/${path}`, { headers: AUTH });
	const etag = read.headers().etag;
	if (!read.ok() || !etag) return;
	await request.delete(`/v1/files/${path}`, { headers: { ...AUTH, "if-match": etag } });
}

async function serverContent(request: APIRequestContext, path: NotePath): Promise<string> {
	const response = await request.get(`/v1/files/${path}`, { headers: AUTH });
	return response.ok() ? response.text() : "";
}

/** The newest commit on the git remote, what the desktop pulls next: its files (indented) and subject, sorted. */
function lastRemoteCommit(): string[] {
	return execFileSync(
		"git",
		["--git-dir", REMOTE_GIT_DIR, "log", "-1", "--no-renames", "--format=%s", "--name-only", "main"],
		{ encoding: "utf8" },
	)
		.split("\n")
		.filter(Boolean)
		.map((line, index) => (index === 0 ? line : `  ${line}`))
		.sort();
}

/** Opens a note by its deep link (TOL-175): the list holds every other project's notes too. */
async function openNote(page: Page, { path, title }: SeededNote): Promise<void> {
	await page.goto(`/?note=${encodeURIComponent(path)}`, { waitUntil: "load" });
	await expect(page.locator(".bn-editor")).toBeVisible({ timeout: 10_000 });
	await expect(page.locator(".bn-editor h1").first()).toHaveText(title, { timeout: 10_000 });
}

function liveLink(page: Page, target: string) {
	return page.locator(`.bn-editor .wikilink[data-target="${target}"]`);
}

/** The Safari profile reports a Mac, where the palette opens with Cmd+K. */
function paletteShortcut(testInfo: TestInfo): string {
	return testInfo.project.name === "webkit" ? "Meta+k" : "Control+k";
}

async function runCommand(page: Page, testInfo: TestInfo, name: string): Promise<void> {
	await page.keyboard.press(paletteShortcut(testInfo));
	const input = page.locator('input[placeholder="Type a command..."]');
	await expect(input).toBeVisible();
	await input.fill(name);
	await expect(page.locator('[data-selected="true"]').first()).toBeVisible();
	await page.keyboard.press("Enter");
}

async function startFolderRename(page: Page, folder: string): Promise<void> {
	await page.getByTestId(`folder-row:${folder}`).click({ button: "right" });
	await page.getByTestId("folder-context-menu").getByText("Rename folder...").click();
}

async function renameFolderTo(page: Page, folder: string, name: string): Promise<void> {
	await startFolderRename(page, folder);
	const input = page.getByTestId("rename-folder-input");
	await input.fill(name);
	await input.press("Enter");
}

function note(path: NotePath, title: string, body: string): SeededNote {
	return { path, title, content: `# ${title}\n\n${body}\n` };
}

test("moving a note to a folder on the web rewrites the links to it in one commit", async ({
	browser,
	request,
}, testInfo) => {
	skipUnlessDesktop(testInfo);
	const stamp = stampOf(testInfo);
	const from = `move-from-${stamp}`;
	const to = `move-to-${stamp}`;
	const target = note(`${from}/target.md`, `Target ${stamp}`, "Body.");
	const linker = note(`${from}/linker.md`, `Linker ${stamp}`, `See [[${from}/target]] and [[${target.title}|the target]].`);
	const resident = note(`${to}/resident.md`, `Resident ${stamp}`, "Already here.");
	const moved = `${to}/target`;
	for (const seeded of [target, linker, resident]) await createNote(request, seeded);

	const context = await browser.newContext(testInfo.project.use);
	try {
		await configureRemoteVault(context);
		const reader = await context.newPage();
		await openNote(reader, linker);
		await expect(liveLink(reader, `${from}/target`)).toBeVisible();

		const page = await context.newPage();
		await openNote(page, target);
		await runCommand(page, testInfo, "Move Note to Folder");
		await page.getByTestId(`retarget-note-folder-option:${to}`).click();

		await expect(page.getByText(`Moved to "${to}" and updated 1 note`)).toBeVisible({ timeout: 10_000 });
		await expect
			.poll(() => serverContent(request, linker.path), { timeout: 10_000 })
			.toBe(`# ${linker.title}\n\nSee [[${moved}]] and [[${moved}|the target]].\n`);
		expect(await serverContent(request, `${moved}.md`)).toBe(target.content);
		await expect
			.poll(() => lastRemoteCommit(), { timeout: 10_000 })
			.toEqual([`  ${linker.path}`, `  ${moved}.md`, `  ${target.path}`, `Rename ${target.path} to ${moved}.md`].sort());

		// The linking note, open in the other tab, shows the new links without a reload.
		await expect(liveLink(reader, moved)).toBeVisible({ timeout: 10_000 });
		await expect(liveLink(reader, `${moved}|the target`)).toBeVisible();
		await expect(liveLink(reader, `${from}/target`)).toHaveCount(0);
	} finally {
		await context.close();
		for (const path of [target.path, linker.path, resident.path, `${moved}.md`]) await deleteNote(request, path);
	}
});

test("renaming a folder on the web moves its notes and rewrites the links to them in one commit", async ({
	browser,
	request,
}, testInfo) => {
	skipUnlessDesktop(testInfo);
	const stamp = stampOf(testInfo);
	const folder = `folder-${stamp}`;
	const renamed = `renamed-${stamp}`;
	const inner = note(`${folder}/inner.md`, `Inner ${stamp}`, "Inside the folder.");
	const linker = note(`links-${stamp}/linker.md`, `Folder linker ${stamp}`, `See [[${folder}/inner|the inner note]].`);
	for (const seeded of [inner, linker]) await createNote(request, seeded);

	const context = await browser.newContext(testInfo.project.use);
	try {
		await configureRemoteVault(context);
		const reader = await context.newPage();
		await openNote(reader, linker);
		await expect(liveLink(reader, `${folder}/inner|the inner note`)).toBeVisible();

		const page = await context.newPage();
		await openNote(page, inner);
		await renameFolderTo(page, folder, renamed);

		await expect(page.getByText(`Renamed folder to "${renamed}"`)).toBeVisible({ timeout: 10_000 });
		await expect(page.getByTestId(`folder-row:${renamed}`)).toBeVisible();
		await expect(page.getByTestId(`folder-row:${folder}`)).toHaveCount(0);
		await expect
			.poll(() => serverContent(request, linker.path), { timeout: 10_000 })
			.toBe(`# ${linker.title}\n\nSee [[${renamed}/inner|the inner note]].\n`);
		expect(await serverContent(request, `${renamed}/inner.md`)).toBe(inner.content);
		await expect
			.poll(() => lastRemoteCommit(), { timeout: 10_000 })
			.toEqual([`  ${inner.path}`, `  ${linker.path}`, `  ${renamed}/inner.md`, `Rename folder ${folder} to ${renamed}`].sort());

		// The linking note, open in the other tab, shows the new link without a reload.
		await expect(liveLink(reader, `${renamed}/inner|the inner note`)).toBeVisible({ timeout: 10_000 });
		await expect(liveLink(reader, `${folder}/inner|the inner note`)).toHaveCount(0);
	} finally {
		await context.close();
		for (const path of [inner.path, linker.path, `${renamed}/inner.md`]) await deleteNote(request, path);
	}
});

test("names Windows cannot hold are refused before anything moves", async ({ page, request }, testInfo) => {
	skipUnlessDesktop(testInfo);
	const stamp = stampOf(testInfo);
	const folder = `windows-${stamp}`;
	const plan = note(`${folder}/plan.md`, `Plan ${stamp}`, "Quarterly.");
	await createNote(request, plan);
	const moves: string[] = [];
	page.on("request", (sent) => {
		if (sent.method() === "POST" && /\/v1\/(folders\/)?rename$/u.test(sent.url())) moves.push(sent.url());
	});
	try {
		await configureRemoteVault(page.context());
		await openNote(page, plan);

		await page.getByTestId("breadcrumb-filename-trigger").dblclick();
		await page.getByTestId("breadcrumb-filename-input").fill("quarterly:plan");
		await page.getByTestId("breadcrumb-filename-input").press("Enter");
		await expect(page.getByText("Invalid filename", { exact: true })).toBeVisible({ timeout: 10_000 });

		await renameFolderTo(page, folder, "LPT1");
		await expect(page.getByText("Failed to rename folder: Invalid folder name")).toBeVisible({ timeout: 10_000 });

		expect(moves).toEqual([]);
		expect(await serverContent(request, plan.path)).toBe(plan.content);
	} finally {
		await deleteNote(request, plan.path);
	}
});
