import { expect, test } from "@playwright/test";
import { COLLAB_TOKEN } from "../playwright.config";

/**
 * TOL-206: the web build ships only English in its first chunk and loads the active locale's
 * catalog on demand. A French browser still gets a French shell, and an English one never
 * downloads another catalog.
 */

const CATALOG_REQUEST =
	/\/assets\/(be-BY|be-Latn|de-DE|es-419|es-ES|fr-FR|id-ID|it-IT|ja-JP|ko-KR|pl-PL|pt-BR|pt-PT|ru-RU|sk-SK|sv-SE|tr-TR|uk-UA|vi|zh-CN|zh-TW)-[\w-]{8}\.js$/;

async function openRemoteVault(page: import("@playwright/test").Page) {
	const catalogs: string[] = [];
	page.on("request", (request) => {
		if (CATALOG_REQUEST.test(new URL(request.url()).pathname)) {
			catalogs.push(new URL(request.url()).pathname);
		}
	});
	await page.addInitScript((token) => {
		window.TOLARIA_REMOTE_URL = window.location.origin;
		window.TOLARIA_REMOTE_TOKEN = token;
	}, COLLAB_TOKEN);
	await page.goto("/");
	return catalogs;
}

test.describe("French browser", () => {
	test.use({ locale: "fr-FR" });

	test("loads the French catalog and shows the shell in French", async ({
		page,
	}) => {
		const catalogs = await openRemoteVault(page);

		// The note list's title: on screen in every layout, the phone's included (TOL-193).
		const inboxTitle = page
			.getByText("Boîte de réception", { exact: true })
			.filter({ visible: true })
			.first();
		await expect(inboxTitle).toBeVisible({ timeout: 10_000 });
		await expect
			.poll(() =>
				inboxTitle.evaluate((element) => element.scrollWidth <= element.clientWidth),
			)
			.toBe(true);
		expect(catalogs.some((path) => path.includes("/fr-FR-"))).toBe(true);
	});
});

test.describe("English browser", () => {
	test.use({ locale: "en-US" });

	test("shows the shell in English without loading another catalog", async ({
		page,
	}) => {
		const catalogs = await openRemoteVault(page);

		const inboxTitle = page
			.getByText("Inbox", { exact: true })
			.filter({ visible: true })
			.first();
		await expect(inboxTitle).toBeVisible({ timeout: 10_000 });
		await expect
			.poll(() =>
				inboxTitle.evaluate((element) => element.scrollWidth <= element.clientWidth),
			)
			.toBe(true);
		expect(catalogs).toEqual([]);
	});
});
