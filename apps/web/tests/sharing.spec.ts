import {
	type APIRequestContext,
	type Browser,
	type BrowserContext,
	expect,
	type Page,
	type TestInfo,
	test,
} from "@playwright/test";
import { COLLAB_TOKEN, REMOTE_URL } from "../playwright.config";
import { GRANTEE, OWNER, ShareFront, USER_COOKIE } from "./shareFront";

/**
 * TOL-237: the owner invites another beta user to a note or the whole vault from the note's
 * Share button, the invitee opens it from "Shared with me", edits it as an editor or only
 * reads it as a viewer, and a revoke reaches a note that is already open. The front end is
 * the stand-in of shareFront.ts; the vault server, its access tickets and its websockets are
 * the real ones. Runs in every layout: desktop Chromium and WebKit, iPhone, iPad.
 *
 * The windows run without the offline service worker (offline.spec.ts covers it). In WebKit,
 * which the iPhone and iPad layouts also use, the worker installs about 2 s after the first
 * load and takes over the page; an "Open" from "Shared with me" at that moment sometimes never
 * reached the network, and every later load of the window stalled with it, until the test
 * timed out (web-gates, iphone-15 and ipad). The same family as TOL-230.
 */

const AUTH = { authorization: `Bearer ${COLLAB_TOKEN}` };
/** The browser never holds the server token for a shared vault: the front mints tickets. */
const PLACEHOLDER_TOKEN = "via-share-front";
const OPEN_MS = 15_000;
const LINE = "A line to share.";

test.describe.configure({ retries: 0, mode: "serial" });

let front: ShareFront;

test.beforeAll(async ({ baseURL }) => {
	front = new ShareFront({
		previewUrl: baseURL ?? "",
		remoteUrl: REMOTE_URL,
		token: COLLAB_TOKEN,
	});
	await front.start();
});

test.afterAll(async () => {
	await front.stop();
});

/** What the running test opened and created: closed and deleted after it, even after a timeout. */
const windows: BrowserContext[] = [];
const notes: SharedNote[] = [];

test.afterEach(async ({ request }) => {
	for (const context of windows.splice(0)) await context.close();
	for (const note of notes.splice(0)) await deleteNote(request, note);
	await front.reset();
});

interface SharedNote {
	path: string;
	title: string;
}

/** A note of this test's own, so the other specs' notes and the other layouts are untouched. */
async function createNote(
	request: APIRequestContext,
	testInfo: TestInfo,
	name: string,
): Promise<SharedNote> {
	const slug = `${testInfo.project.name}-${name}-${Date.now()}`.replace(
		/[^a-z0-9-]/giu,
		"-",
	);
	const note = { path: `sharing/${slug}.md`, title: `Shared ${slug}` };
	const response = await request.put(`${REMOTE_URL}/v1/files/${note.path}`, {
		headers: { ...AUTH, "if-none-match": "*" },
		data: `---\ntype: Note\n---\n# ${note.title}\n\n${LINE}\n`,
	});
	expect(response.status()).toBe(201);
	notes.push(note);
	return note;
}

/** Deletes the test's note, so the vault's note list stays as the other specs expect. */
async function deleteNote(
	request: APIRequestContext,
	note: SharedNote,
): Promise<void> {
	const read = await request.get(`${REMOTE_URL}/v1/files/${note.path}`, {
		headers: AUTH,
	});
	expect(read.status(), `reading ${note.path} to delete it`).toBe(200);
	const deleted = await request.delete(`${REMOTE_URL}/v1/files/${note.path}`, {
		headers: { ...AUTH, "if-match": read.headers().etag ?? "" },
	});
	expect(deleted.status(), `deleting ${note.path}`).toBe(200);
}

async function noteContent(
	request: APIRequestContext,
	note: SharedNote,
): Promise<string> {
	const response = await request.get(`${REMOTE_URL}/v1/files/${note.path}`, {
		headers: AUTH,
	});
	expect(response.status()).toBe(200);
	return response.text();
}

/** A window of one user: the owner with the server token on its own vault, the invitee with none. */
async function windowOf(
	browser: Browser,
	testInfo: TestInfo,
	userId: string,
): Promise<BrowserContext> {
	const context = await browser.newContext({
		...testInfo.project.use,
		baseURL: front.origin,
		storageState: undefined,
		serviceWorkers: "block",
	});
	windows.push(context);
	const url = new URL(front.origin);
	await context.addCookies([
		{ name: USER_COOKIE, value: userId, domain: url.hostname, path: "/" },
	]);
	const token = userId === OWNER.userId ? COLLAB_TOKEN : PLACEHOLDER_TOKEN;
	await context.addInitScript((credential) => {
		window.localStorage.setItem(
			"tolaria:claude-code-onboarding-dismissed",
			"1",
		);
		window.TOLARIA_REMOTE_URL = window.location.origin;
		window.TOLARIA_REMOTE_TOKEN = credential;
	}, token);
	return context;
}

function editorHeading(page: Page) {
	return page.locator(".bn-editor h1").first();
}

async function openOwnNote(page: Page, note: SharedNote): Promise<void> {
	await page.goto(`/?note=${encodeURIComponent(note.path)}`, {
		waitUntil: "load",
	});
	await expect(editorHeading(page)).toContainText(note.title, {
		timeout: OPEN_MS,
	});
}

async function openShareDialog(page: Page): Promise<void> {
	await page.getByTestId("share-note-button").click({ timeout: OPEN_MS });
	await expect(page.getByTestId("share-dialog")).toBeVisible();
}

async function chooseOption(
	page: Page,
	trigger: string,
	option: string,
): Promise<void> {
	await page.getByTestId(trigger).click();
	await page.getByRole("option", { name: option }).click();
}

async function invite(page: Page, who: string): Promise<void> {
	await page.getByTestId("share-invitee").fill(who);
	await page.getByTestId("share-invite").click();
}

/** The invitee opens the share from "Shared with me" in the status bar of their own page. */
async function openFromSharedWithMe(page: Page): Promise<void> {
	await page.goto("/", { waitUntil: "load" });
	await page.getByTestId("status-shared-with-me").click({ timeout: OPEN_MS });
	const item = page.getByTestId("shared-with-me-item");
	await expect(item).toHaveCount(1, { timeout: OPEN_MS });
	await item.getByTestId("shared-with-me-open").click();
	await page.waitForURL(/\/vaults\/v_e2e\//u, { timeout: OPEN_MS });
}

async function shot(
	page: Page,
	testInfo: TestInfo,
	name: string,
): Promise<void> {
	await testInfo.attach(name, {
		body: await page.screenshot(),
		contentType: "image/png",
	});
}

test("an editor invited to a note by email edits it, and a revoke closes the open note", async ({
	browser,
	request,
}, testInfo) => {
	const note = await createNote(request, testInfo, "editor");
	const owner = await windowOf(browser, testInfo, OWNER.userId);
	const invitee = await windowOf(browser, testInfo, GRANTEE.userId);
	const ownerPage = await owner.newPage();
	await openOwnNote(ownerPage, note);
	await openShareDialog(ownerPage);
	await invite(ownerPage, GRANTEE.email);
	await expect(ownerPage.getByTestId("share-success")).toBeVisible();
	await expect(ownerPage.getByTestId("share-person")).toContainText(
		`@${GRANTEE.github}`,
	);
	await shot(ownerPage, testInfo, "owner-share-dialog");
	await ownerPage.keyboard.press("Escape");

	const inviteePage = await invitee.newPage();
	await openFromSharedWithMe(inviteePage);
	await expect(editorHeading(inviteePage)).toContainText(note.title, {
		timeout: OPEN_MS,
	});
	await expect(inviteePage.getByTestId("status-shared-role")).toHaveText(
		"Shared · Can edit",
	);
	await expect(inviteePage.getByTestId("shared-read-only-banner")).toHaveCount(
		0,
	);

	const marker = ` edited by ana ${Date.now()}`;
	await inviteePage
		.locator(".bn-editor .bn-inline-content", { hasText: LINE })
		.click();
	await inviteePage.keyboard.press("End");
	await inviteePage.keyboard.type(marker);
	await expect
		.poll(() => noteContent(request, note), { timeout: OPEN_MS })
		.toContain(marker.trim());
	await shot(inviteePage, testInfo, "invitee-editing");

	await openShareDialog(ownerPage);
	await ownerPage.getByTestId("share-person-remove").click();
	await expect(ownerPage.getByTestId("share-people-empty")).toBeVisible();

	const revoked = inviteePage.getByTestId("access-revoked-dialog");
	await expect(revoked).toBeVisible({ timeout: OPEN_MS });
	await expect(revoked).toHaveCSS("opacity", "1");
	await expect(inviteePage.getByTestId("access-revoked-home")).toBeVisible();
	await shot(inviteePage, testInfo, "invitee-revoked");
	// The page stopped: no new collaboration tickets are asked for once access is gone.
	const asked = front.ticketRequests.get(GRANTEE.userId) ?? 0;
	await inviteePage.waitForTimeout(3_000);
	expect(front.ticketRequests.get(GRANTEE.userId) ?? 0).toBe(asked);
});

test("a viewer invited to the vault by GitHub handle reads it but cannot change it", async ({
	browser,
	request,
}, testInfo) => {
	const note = await createNote(request, testInfo, "viewer");
	const owner = await windowOf(browser, testInfo, OWNER.userId);
	const invitee = await windowOf(browser, testInfo, GRANTEE.userId);
	const ownerPage = await owner.newPage();
	await openOwnNote(ownerPage, note);
	await openShareDialog(ownerPage);
	await chooseOption(ownerPage, "share-scope", "Whole vault");
	await invite(ownerPage, "@nobody-e2e");
	await expect(ownerPage.getByTestId("share-error")).toHaveText(
		"No beta account with that email or GitHub username yet.",
	);
	await chooseOption(ownerPage, "share-role", "Can view");
	await invite(ownerPage, `@${GRANTEE.github}`);
	await expect(ownerPage.getByTestId("share-person")).toContainText(
		"Whole vault",
	);
	await ownerPage.keyboard.press("Escape");

	const inviteePage = await invitee.newPage();
	await openFromSharedWithMe(inviteePage);
	await expect(inviteePage.getByTestId("status-shared-role")).toHaveText(
		"Shared · View only",
		{ timeout: OPEN_MS },
	);
	await inviteePage.goto(
		`/vaults/v_e2e/?note=${encodeURIComponent(note.path)}`,
		{ waitUntil: "load" },
	);
	await expect(editorHeading(inviteePage)).toContainText(note.title, {
		timeout: OPEN_MS,
	});
	await expect(inviteePage.getByTestId("shared-read-only-banner")).toBeVisible({
		timeout: OPEN_MS,
	});
	await expect(inviteePage.locator(".bn-editor")).toHaveAttribute(
		"contenteditable",
		"false",
	);
	await shot(inviteePage, testInfo, "viewer-read-only");

	const before = await noteContent(request, note);
	await inviteePage
		.locator(".bn-editor .bn-inline-content", { hasText: LINE })
		.click();
	await inviteePage.keyboard.type(" not allowed");
	await inviteePage.waitForTimeout(1_500);
	expect(await noteContent(request, note)).toBe(before);
});
