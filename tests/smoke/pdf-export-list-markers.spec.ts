import { expect, type Page, test } from "@playwright/test";
import {
	createFixtureVaultCopy,
	openFixtureVaultDesktopHarness,
	removeFixtureVaultCopy,
} from "../helpers/fixtureVault";

const NOTE_TITLE = "Print List Markers";

const NOTE_CONTENT = [
	"---",
	"Is A: Note",
	"---",
	`# ${NOTE_TITLE}`,
	"",
	"- First bullet",
	"    - Nested bullet",
	"        - Deep bullet",
	"- Second bullet",
	"",
	"1. First step",
	"2. Second step",
	"",
	"- [ ] Open task",
	"- [x] Done task",
	"",
].join("\n");

let tempVaultDir: string;

interface PrintedMarker {
	backgroundImage: string;
	content: string;
	fontSize: string;
	text: string;
}

async function printedMarkers(page: Page, contentType: string) {
	return page.evaluate((type) => {
		const blocks = document.querySelectorAll(
			`[data-note-pdf-export-root="true"] .bn-block-content[data-content-type="${type}"]`,
		);
		return Array.from(blocks, (block): PrintedMarker => {
			const marker = getComputedStyle(block, "::before");
			return {
				backgroundImage: marker.backgroundImage,
				content: marker.content,
				fontSize: marker.fontSize,
				text: block.textContent ?? "",
			};
		});
	}, contentType);
}

async function openNoteInPrintMedia(page: Page) {
	await page
		.getByTestId("note-list-container")
		.getByText(NOTE_TITLE, { exact: true })
		.click();
	await expect(
		page.locator(".bn-editor").getByText("Deep bullet"),
	).toBeVisible();
	await page.emulateMedia({ media: "print" });
}

test.describe("PDF export list markers", () => {
	test.beforeEach(async ({ page }) => {
		tempVaultDir = createFixtureVaultCopy();
		const response = await page.request.post("/api/vault/save", {
			data: {
				path: `${tempVaultDir}/note/print-list-markers.md`,
				content: NOTE_CONTENT,
			},
		});
		expect(response.ok()).toBe(true);
		await openFixtureVaultDesktopHarness(page, tempVaultDir, {
			expectedReadyTitle: NOTE_TITLE,
		});
	});

	test.afterEach(() => {
		removeFixtureVaultCopy(tempVaultDir);
	});

	test("bullet markers print as text glyphs instead of background images", async ({
		page,
	}) => {
		await openNoteInPrintMedia(page);

		const bullets = await printedMarkers(page, "bulletListItem");
		expect(bullets.map((bullet) => [bullet.text, bullet.content])).toEqual([
			["First bullet", '"•"'],
			["Nested bullet", '"◦"'],
			["Deep bullet", '"▪"'],
			["Second bullet", '"•"'],
		]);
		for (const bullet of bullets) {
			expect(bullet.backgroundImage).toBe("none");
			expect(Number.parseFloat(bullet.fontSize)).toBeGreaterThan(0);
		}

		const numbered = await printedMarkers(page, "numberedListItem");
		expect(numbered.map((item) => item.content.replace(/["\s]/g, ""))).toEqual([
			"1.",
			"2.",
		]);

		await expect(
			page.locator(
				'[data-note-pdf-export-root="true"] [data-content-type="checkListItem"] input[type="checkbox"]',
			),
		).toHaveCount(2);
	});

	test("task checkboxes print with the light palette in dark mode", async ({
		page,
	}) => {
		await page.evaluate(() => {
			document.documentElement.classList.add("dark");
			document.documentElement.dataset.theme = "dark";
		});
		await openNoteInPrintMedia(page);

		const checkboxSchemes = await page
			.locator(
				'[data-note-pdf-export-root="true"] [data-content-type="checkListItem"] input[type="checkbox"]',
			)
			.evaluateAll((inputs) =>
				inputs.map((input) => getComputedStyle(input).colorScheme),
			);
		expect(checkboxSchemes).toEqual(["light", "light"]);
	});
});
