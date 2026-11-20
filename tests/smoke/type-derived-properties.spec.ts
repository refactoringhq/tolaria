import { expect, type Page, test } from "@playwright/test";
import {
	createFixtureVaultCopy,
	openFixtureVaultDesktopHarness,
	removeFixtureVaultCopy,
} from "../helpers/fixtureVault";
import { executeCommand, openCommandPalette, sendShortcut } from "./helpers";

let tempVaultDir: string;

async function seedTypeDerivedFixtures(
	page: Page,
	vaultPath: string,
): Promise<void> {
	await page.evaluate(
		async ({ rootPath }) => {
			const createNote = window.__mockHandlers?.create_note_content;
			if (typeof createNote !== "function")
				throw new Error("Fixture vault is missing create_note_content");

			await createNote({
				path: `${rootPath}/book.md`,
				content: [
					"---",
					"type: Type",
					"start date:",
					"Rating: 5",
					"Projects: []",
					"Genres:",
					"  - science fiction",
					"  - classic",
					"Mentor: [[person/alice]]",
					"---",
					"# Book",
					"",
				].join("\n"),
			});
			await createNote({
				path: `${rootPath}/dune.md`,
				content:
					"---\ntype: Book\n---\n# Dune\n\nExisting instance without type schema fields.\n",
			});
		},
		{ rootPath: vaultPath },
	);
	await page.route("**/api/vault/list*", async (route) => {
		const response = await route.fetch();
		const entries = (await response.json()) as Array<{
			title: string;
			isA: string | null;
			properties: Record<string, unknown>;
		}>;
		const bookType = entries.find(
			(entry) => entry.isA === "Type" && entry.title === "Book",
		);
		if (bookType) {
			bookType.properties = {
				...bookType.properties,
				Projects: [],
				Genres: ["science fiction", "classic"],
			};
		}
		await route.fulfill({ response, json: entries });
	});
	await page.reload({ waitUntil: "domcontentloaded" });
	await page.locator('[data-testid="note-list-container"]').waitFor();
}

async function openNoteViaQuickOpen(page: Page, query: string): Promise<void> {
	await page.locator("body").click();
	await sendShortcut(page, "p", ["Control"]);
	const searchInput = page.locator('input[placeholder="Search notes..."]');
	await expect(searchInput).toBeVisible();
	await searchInput.fill(query);
	const result = page
		.getByTestId("quick-open-palette")
		.getByText(query)
		.first();
	await expect(result).toBeVisible();
	await result.click();
	await expect(page.getByTestId("breadcrumb-filename-trigger")).toContainText(
		query.toLowerCase(),
		{ timeout: 5_000 },
	);
}

async function createBookAndVerifyDefaults(page: Page): Promise<void> {
	await page
		.locator("aside")
		.getByText("Books", { exact: true })
		.first()
		.click();
	await page.locator('[aria-label="New note"]').first().click();
	await expect(page.getByTestId("breadcrumb-filename-trigger")).toContainText(
		/untitled-book-\d+/i,
		{ timeout: 5_000 },
	);

	const newProperties = page.getByTestId("editable-property");
	await expect(
		newProperties.filter({ hasText: "Projects" }).getByTitle("Add projects"),
	).toBeVisible();
	await expect(
		newProperties.filter({ hasText: "Genres" }).getByTitle("Add genres"),
	).toBeVisible();

	await openCommandPalette(page);
	await executeCommand(page, "Toggle Raw");
	const rawEditor = page.locator(".cm-content");
	await expect(rawEditor).toContainText("type: Book");
	await expect(rawEditor).toContainText("Rating: 5");
	await expect(rawEditor).toContainText('Mentor: "[[person/alice]]"');
	await expect(rawEditor).not.toContainText("start date:");
}

test.describe("Type-derived instance properties", () => {
	test.beforeEach(async ({ page }) => {
		tempVaultDir = createFixtureVaultCopy();
		await openFixtureVaultDesktopHarness(page, tempVaultDir);
		await seedTypeDerivedFixtures(page, tempVaultDir);
		await page.setViewportSize({ width: 1600, height: 900 });
	});

	test.afterEach(() => {
		removeFixtureVaultCopy(tempVaultDir);
	});

	test("type schema placeholders stay visible and valued defaults seed new instances @smoke", async ({
		page,
	}) => {
		await openNoteViaQuickOpen(page, "Dune");
		await sendShortcut(page, "i", ["Control", "Shift"]);

		const startDatePlaceholder = page
			.getByTestId("type-derived-property")
			.filter({ hasText: "Start date" });
		await expect(startDatePlaceholder).toBeVisible();
		await expect(startDatePlaceholder.getByText("Start date")).toHaveClass(
			/text-muted-foreground\/40/,
		);

		const mentorPlaceholder = page
			.getByTestId("type-derived-relationship")
			.filter({ hasText: "Mentor" });
		await expect(mentorPlaceholder).toBeVisible();
		await expect(mentorPlaceholder.getByText("Mentor")).toHaveClass(
			/text-muted-foreground\/40/,
		);

		const projectsRow = page
			.getByTestId("editable-property")
			.filter({ hasText: "Projects" });
		const genresRow = page
			.getByTestId("editable-property")
			.filter({ hasText: "Genres" });
		await expect(projectsRow.getByTitle("Add projects")).toBeVisible();
		await expect(genresRow.getByTitle("Add genres")).toBeVisible();

		await projectsRow.getByTitle("Add projects").click();
		await projectsRow.getByPlaceholder("Projects...").fill("Tolaria");
		await projectsRow.getByPlaceholder("Projects...").press("Enter");
		await expect
			.poll(async () =>
				page.evaluate(
					async ({ notePath }) => {
						const getContent = window.__mockHandlers?.get_note_content;
						if (typeof getContent !== "function")
							throw new Error("Fixture vault is missing get_note_content");
						return getContent({ path: notePath });
					},
					{ notePath: `${tempVaultDir}/dune.md` },
				),
			)
			.toContain('Projects:\n  - "Tolaria"');

		await startDatePlaceholder.click();
		const startDateRow = page
			.getByTestId("editable-property")
			.filter({ hasText: "Start date" });
		await startDateRow.locator("input").fill("2026-05-04");
		await startDateRow.locator("input").blur();

		await createBookAndVerifyDefaults(page);
	});
});
