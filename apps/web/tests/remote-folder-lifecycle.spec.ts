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
 * TOL-233: creating and deleting a folder on the web go through the server, one commit each,
 * which the git remote the desktop pulls receives. Another tab of the same vault follows
 * without a reload: the new folder appears in its tree, and a deleted folder's note closes.
 * Nothing outside the deleted folder goes with it. Names Windows cannot hold are refused with
 * the desktop's message before anything is sent.
 */

test.describe.configure({ retries: 0 });

const AUTH = { authorization: `Bearer ${COLLAB_TOKEN}` };
/** The sidebar and the folder tree are laid out for a hardware keyboard and pointer here. */
const DESKTOP_PROJECTS = ["chromium", "webkit"];

interface SeededNote {
	path: string;
	title: string;
	content: string;
}

function skipUnlessDesktop(testInfo: TestInfo): void {
	test.skip(!DESKTOP_PROJECTS.includes(testInfo.project.name), "desktop layouts only");
}

function stampOf(testInfo: TestInfo): string {
	return `${testInfo.project.name}-${Date.now()}`;
}

function note(path: string, title: string): SeededNote {
	return { path, title, content: `# ${title}\n\nBody.\n` };
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

/** Removes a folder this test left behind, so the shared vault stays as the other specs expect. */
async function removeFolder(request: APIRequestContext, path: string): Promise<void> {
	await request.post("/v1/folders/delete", { headers: AUTH, data: { path } });
}

async function serverPaths(request: APIRequestContext): Promise<string[]> {
	const response = await request.get("/v1/files", { headers: AUTH });
	expect(response.status()).toBe(200);
	const body = (await response.json()) as { files: { path: string }[] };
	return body.files.map((file) => file.path);
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

async function openApp(page: Page, url = "/"): Promise<void> {
	await page.goto(url, { waitUntil: "load" });
	await expect(page.getByTestId("create-folder-btn")).toBeVisible({ timeout: 10_000 });
}

async function openNote(page: Page, { path, title }: SeededNote): Promise<void> {
	await openApp(page, `/?note=${encodeURIComponent(path)}`);
	await expect(page.locator(".bn-editor h1").first()).toHaveText(title, { timeout: 10_000 });
}

async function createFolder(page: Page, name: string): Promise<void> {
	await page.getByTestId("create-folder-btn").click();
	const input = page.getByTestId("new-folder-input");
	await input.fill(name);
	await input.press("Enter");
}

test("creating a folder on the web is one commit that another tab shows without a reload", async ({
	browser,
	request,
}, testInfo) => {
	skipUnlessDesktop(testInfo);
	const folder = `made-${stampOf(testInfo)}`;
	const context = await browser.newContext(testInfo.project.use);
	try {
		await configureRemoteVault(context);
		const other = await context.newPage();
		await openApp(other);
		const page = await context.newPage();
		await openApp(page);

		await createFolder(page, folder);

		await expect(page.getByText(`Created folder "${folder}"`)).toBeVisible({ timeout: 10_000 });
		await expect(page.getByTestId(`folder-row:${folder}`)).toBeVisible();
		await expect.poll(() => lastRemoteCommit(), { timeout: 10_000 }).toEqual([`  ${folder}/.keep`, `Create folder ${folder}`]);
		// The placeholder keeps the folder in git; it is not a note in either tab.
		await expect(page.getByText(".keep", { exact: true })).toHaveCount(0);

		await expect(other.getByTestId(`folder-row:${folder}`)).toBeVisible({ timeout: 10_000 });
	} finally {
		await context.close();
		await removeFolder(request, folder);
	}
});

test("deleting a folder on the web takes its notes in one commit and closes them in another tab", async ({
	browser,
	request,
}, testInfo) => {
	skipUnlessDesktop(testInfo);
	const stamp = stampOf(testInfo);
	const folder = `doomed-${stamp}`;
	const inner = note(`${folder}/inner.md`, `Inner ${stamp}`);
	const nested = note(`${folder}/deep/nested.md`, `Nested ${stamp}`);
	const neighbour = note(`${folder}-kept/neighbour.md`, `Neighbour ${stamp}`);
	for (const seeded of [inner, nested, neighbour]) await createNote(request, seeded);

	const context = await browser.newContext(testInfo.project.use);
	try {
		await configureRemoteVault(context);
		const reader = await context.newPage();
		await openNote(reader, inner);
		const page = await context.newPage();
		await openApp(page);

		await page.getByTestId(`folder-row:${folder}`).click({ button: "right" });
		await page.getByTestId("delete-folder-menu-item").click();
		await page.getByTestId("confirm-delete-btn").click();

		await expect(page.getByText(`Deleted folder "${folder}"`)).toBeVisible({ timeout: 10_000 });
		await expect(page.getByTestId(`folder-row:${folder}`)).toHaveCount(0);
		await expect
			.poll(() => lastRemoteCommit(), { timeout: 10_000 })
			.toEqual([`  ${inner.path}`, `  ${nested.path}`, `Delete folder ${folder}`].sort());
		const remaining = await serverPaths(request);
		expect(remaining.filter((path) => path.startsWith(`${folder}/`))).toEqual([]);
		expect(remaining).toContain(neighbour.path);
		await expect(page.getByTestId(`folder-row:${folder}-kept`)).toBeVisible();

		// The other tab drops the folder and the note it had open, without a reload.
		await expect(reader.getByTestId(`folder-row:${folder}`)).toHaveCount(0, { timeout: 10_000 });
		await expect(reader.locator(".bn-editor h1", { hasText: inner.title })).toHaveCount(0);
	} finally {
		await context.close();
		for (const path of [folder, `${folder}-kept`]) await removeFolder(request, path);
	}
});

/** A request that could change the vault: anything but a read. The shared server's HEAD also moves with other specs' pushes. */
function isVaultWrite(method: string, url: string): boolean {
	return method !== "GET" && method !== "HEAD" && new URL(url).pathname.startsWith("/v1/");
}

test("opening the sidebar writes nothing, and a name Windows cannot hold is refused before anything is sent", async ({
	page,
}, testInfo) => {
	skipUnlessDesktop(testInfo);
	const writes: string[] = [];
	page.on("request", (request) => {
		if (isVaultWrite(request.method(), request.url())) writes.push(`${request.method()} ${request.url()}`);
	});
	await configureRemoteVault(page.context());
	await openApp(page);
	await expect(page.getByTestId("folder-row:projects")).toBeVisible();

	await createFolder(page, "LPT1");

	await expect(page.getByText("Failed to create folder: Invalid folder name")).toBeVisible({ timeout: 10_000 });
	expect(writes).toEqual([]);
});
