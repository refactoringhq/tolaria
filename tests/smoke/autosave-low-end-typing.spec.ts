import path from "node:path";
import type { EditorView } from "@codemirror/view";
import { expect, type Page, test } from "@playwright/test";
import {
	createFixtureVaultCopy,
	openFixtureVault,
	openFixtureVaultDesktopHarness,
	removeFixtureVaultCopy,
} from "../helpers/fixtureVault";

interface AutosaveProbeWindow {
	__autosaveProbe?: Array<{ path: string; content: string }>;
}

let tempVaultDir: string;

async function openNote(page: Page, title: string) {
	const note = page
		.getByTestId("note-list-container")
		.getByText(title, { exact: true });
	await expect(note).toBeVisible({ timeout: 10_000 });
	await note.click();
}

async function openRawMode(page: Page) {
	const rawEditor = page.getByRole("button", {
		name: "Open the raw editor",
		exact: true,
	});
	await expect(rawEditor).toBeVisible({ timeout: 10_000 });
	await expect(rawEditor).toBeEnabled();
	await rawEditor.click();
	await expect(page.locator(".cm-content")).toBeVisible({ timeout: 10_000 });
}

async function setRawEditorContent(page: Page, content: string) {
	await page.evaluate((nextContent) => {
		const el = document.querySelector(".cm-content");
		if (!el) throw new Error("CodeMirror content element is missing");
		const view = (el as HTMLElement & { cmTile?: { view?: EditorView } }).cmTile
			?.view;
		if (!view) throw new Error("CodeMirror view is missing");
		view.dispatch({
			changes: { from: 0, to: view.state.doc.length, insert: nextContent },
		});
	}, content);
}

async function installAutosaveProbe(page: Page) {
	await page.evaluate(() => {
		const probeWindow = window as typeof window & AutosaveProbeWindow;
		const nativeFetch = window.fetch.bind(window);
		const calls: Array<{ path: string; content: string }> = [];
		probeWindow.__autosaveProbe = calls;

		const getRequestUrl = (input: RequestInfo | URL): string => {
			if (typeof input === "string") return input;
			return input instanceof Request ? input.url : input.toString();
		};

		const getRequestBody = async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			if (init?.body === undefined && input instanceof Request)
				return input.clone().text();
			return String(init?.body ?? "");
		};

		window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const requestUrl = getRequestUrl(input);
			if (requestUrl.endsWith("/api/vault/save")) {
				const bodyText = await getRequestBody(input, init);
				const body = JSON.parse(bodyText) as {
					path?: unknown;
					content?: unknown;
				};
				calls.push({
					path: String(body.path ?? ""),
					content: String(body.content ?? ""),
				});
			}
			return nativeFetch(input, init);
		};
	});
}

function isTransientNavigationError(error: unknown): boolean {
	return (
		error instanceof Error &&
		(error.message.includes("ERR_ABORTED") || error.message.includes("Timeout"))
	);
}

async function openFixtureVaultAfterTransientReload(
	page: Page,
	vaultPath: string,
) {
	page.setDefaultNavigationTimeout(20_000);
	try {
		await openFixtureVault(page, vaultPath);
	} catch (error) {
		if (!isTransientNavigationError(error)) throw error;
		await openFixtureVault(page, vaultPath);
	}
}

async function warmAppBundle(page: Page) {
	try {
		await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
	} catch (error) {
		if (!isTransientNavigationError(error)) throw error;
		await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
	}
	await page.waitForFunction(
		() => Boolean(document.querySelector("#root")?.childElementCount),
		undefined,
		{ timeout: 30_000 },
	);
}

async function readAutosaveProbe(page: Page) {
	return page.evaluate(() => {
		const probeWindow = window as typeof window & AutosaveProbeWindow;
		return probeWindow.__autosaveProbe ?? [];
	});
}

test.beforeAll(async ({ browser }, testInfo) => {
	testInfo.setTimeout(180_000);
	const warmupPage = await browser.newPage();
	try {
		await warmAppBundle(warmupPage);
	} finally {
		await warmupPage.close();
	}
});

test.beforeEach(() => {
	tempVaultDir = createFixtureVaultCopy();
});

test.afterEach(() => {
	removeFixtureVaultCopy(tempVaultDir);
});

test("@smoke autosave waits for idle typing and persists the latest draft only", async ({ page }, testInfo) => {
	testInfo.setTimeout(60_000);
	await openFixtureVaultAfterTransientReload(page, tempVaultDir);
	await page.waitForLoadState("networkidle");
	await installAutosaveProbe(page);

	const notePath = path.join(tempVaultDir, "note", "note-b.md");
	const firstDraft = `# Note B\n\nLow-end autosave first draft ${Date.now()}`;
	const latestDraft = `${firstDraft}\n\nLatest draft after continued typing`;

	await openNote(page, "Note B");
	await openRawMode(page);
	await setRawEditorContent(page, firstDraft);
	await page.waitForTimeout(900);
	await setRawEditorContent(page, latestDraft);
	await page.waitForTimeout(450);

	expect(await readAutosaveProbe(page)).toEqual([]);

	await expect
		.poll(() => readAutosaveProbe(page), { timeout: 5_000 })
		.toEqual([
			expect.objectContaining({ path: notePath, content: latestDraft }),
		]);
	const persisted = await page.request.get("/api/vault/content", {
		params: { path: notePath, vault_path: tempVaultDir },
	});
	expect(persisted.ok()).toBe(true);
	expect(await persisted.json()).toEqual({ content: latestDraft });
});

test("@smoke rich autosave preserves a large imported CRLF note across typing pauses", async ({ page }, testInfo) => {
	// Opening and rendering the large fixture needs its own budget in shared CI.
	// Each save still has to persist the exact content within ten seconds.
	testInfo.setTimeout(120_000);
	const file = path.join(tempVaultDir, "note", "imported-autosave.md");
	const source =
		"# Imported Autosave\r\n\r\n" +
		Array.from(
			{ length: 3000 },
			(_, index) => `* Imported line ${index} with &amp; source spelling.\r\n`,
		).join("");
	const saved = await page.request.post("/api/vault/save", {
		data: { path: file, content: source },
	});
	expect(saved.ok()).toBe(true);
	const readSaved = async () => {
		const response = await page.request.get("/api/vault/content", {
			params: { path: file, vault_path: tempVaultDir },
		});
		expect(response.ok()).toBe(true);
		return ((await response.json()) as { content: string }).content;
	};
	await openFixtureVaultDesktopHarness(page, tempVaultDir);
	await openNote(page, "Imported Autosave");
	const paragraph = page
		.locator(".bn-block-content p")
		.filter({ hasText: "Imported line 0 with" })
		.first();
	await expect(paragraph).toBeVisible();
	await expect(page.locator('.bn-editor[contenteditable="true"]')).toBeVisible({
		timeout: 30000,
	});
	await paragraph.click();
	await page.keyboard.press("Home");
	await page.keyboard.type("First ");
	await expect(paragraph).toContainText("First Imported line 0");
	await expect
		.poll(readSaved, { timeout: 10000 })
		.toBe(source.replace("Imported line 0", "First Imported line 0"));
	await page.keyboard.type("Second ");
	await expect
		.poll(readSaved, { timeout: 10000 })
		.toBe(source.replace("Imported line 0", "First Second Imported line 0"));
});
