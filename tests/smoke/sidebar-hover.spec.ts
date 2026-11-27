import path from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import type { VaultEntry, ViewFile } from "../../src/types";
import {
	createFixtureVaultCopy,
	openFixtureVault,
	removeFixtureVaultCopy,
} from "../helpers/fixtureVault";

type RowColors = Awaited<ReturnType<typeof rowColors>>;

test.setTimeout(45_000);
test.use({ serviceWorkers: "block", viewport: { width: 1280, height: 900 } });

const rowLabels = [
	"All Notes",
	"Projects",
	"Events",
	"Default View",
	"Purple View",
	"Alpha Project",
	"Hover folder",
];
const views: ViewFile[] = [null, "purple"].map((color, index) => ({
	filename: `hover-${index}.yml`,
	definition: {
		name: index === 0 ? "Default View" : "Purple View",
		icon: null,
		color,
		sort: null,
		filters: { all: [{ field: "type", op: "equals", value: "Project" }] },
	},
}));

async function installViews(page: Page) {
	await page.addInitScript((fixtureViews) => {
		const descriptor = Object.getOwnPropertyDescriptor(
			window,
			"__mockHandlers",
		);
		Object.defineProperty(window, "__mockHandlers", {
			configurable: true,
			get() {
				return { ...descriptor?.get?.(), list_views: () => fixtureViews };
			},
			set(value) {
				descriptor?.set?.(value);
			},
		});
	}, views);
	await page.reload();
	await expect(
		page.locator("nav").getByText("Purple View", { exact: true }),
	).toBeVisible();
}

async function prepareSidebar(page: Page, vaultPath: string) {
	await page.route("**/api/vault/list*", async (route) => {
		const response = await route.fetch();
		const entries: VaultEntry[] = await response.json();
		await route.fulfill({
			response,
			json: entries.map((entry) => ({
				...entry,
				favorite: entry.title === "Alpha Project",
			})),
		});
	});
	await openFixtureVault(page, vaultPath, {
		folders: [{ name: "Hover folder", path: "hover-folder", children: [] }],
	});
	await installViews(page);
}

function sidebarRow(page: Page, label: string): Locator {
	if (label === "Hover folder")
		return page.getByTestId("folder-row:hover-folder").locator("..");
	return page
		.locator("nav")
		.getByText(label, { exact: true })
		.locator('xpath=ancestor::*[contains(@class,"cursor-pointer")][1]');
}

async function rowColors(row: Locator) {
	// WebKit needs a rendered frame before reporting final hover colors.
	await row.page().screenshot({ animations: "disabled" });
	return row.evaluate((element) => {
		const count = element.querySelector('[data-testid$="count-chip"]');
		const label = element.querySelector("button, span.min-w-0");
		return {
			background: getComputedStyle(element).backgroundColor,
			label: getComputedStyle(label ?? element).color,
			titleWeight: getComputedStyle(label ?? element).fontWeight,
			countBackground: count ? getComputedStyle(count).backgroundColor : null,
			countColor: count ? getComputedStyle(count).color : null,
			countWeight: count ? getComputedStyle(count).fontWeight : null,
		};
	});
}

async function settledColors(page: Page, row: Locator) {
	await page
		.getByTestId("note-list-container")
		.hover({ position: { x: 200, y: 60 } });
	await page.waitForTimeout(250);
	return rowColors(row);
}

function expectCountColors(colors: RowColors, label: string, active: boolean) {
	if (colors.countBackground === null) return;
	expect(colors.countBackground, `${label} count has no fill`).toBe(
		"rgba(0, 0, 0, 0)",
	);
	if (active) {
		expect(colors.countColor, `${label} count uses its accent color`).toBe(
			colors.label,
		);
		expect(colors.countWeight, `${label} count matches its title weight`).toBe(
			colors.titleWeight,
		);
	}
}

async function screenshot(page: Page, theme: string, state: string) {
	const directory = process.env.SIDEBAR_HOVER_PROOF_DIR;
	if (!directory) return;
	await page.locator("nav").screenshot({
		path: path.join(
			directory,
			test.info().project.name,
			`${theme}-${state}.png`,
		),
	});
}

async function setHover(page: Page, row: Locator, hovered: boolean) {
	if (hovered) await row.hover();
	else
		await page
			.getByTestId("note-list-container")
			.hover({ position: { x: 200, y: 60 } });
	await page.evaluate(
		() =>
			new Promise((resolve) => {
				requestAnimationFrame(() => requestAnimationFrame(resolve));
			}),
	);
	await expect
		.poll(() => row.evaluate((element) => element.matches(":hover")))
		.toBe(hovered);
}

async function verifyRow(page: Page, theme: string, label: string) {
	const row = sidebarRow(page, label);
	const neutral = sidebarRow(page, "Archive");
	const artifact = label.toLowerCase().replaceAll(" ", "-");
	await row.click();
	const active = await settledColors(page, row);
	expectCountColors(active, label, true);
	await screenshot(page, theme, `${artifact}-active`);
	await neutral.click();
	const idle = await settledColors(page, row);
	expectCountColors(idle, label, false);
	const selected = await rowColors(neutral);
	await setHover(page, row, true);
	await expect
		.poll(() => rowColors(row), `${label} hover should match active colors`)
		.toEqual(active);
	await screenshot(page, theme, `${artifact}-hover`);
	expect(await rowColors(neutral), "hover must preserve selection").toEqual(
		selected,
	);
	await setHover(page, row, false);
	await expect
		.poll(() => rowColors(row), "pointer exit should restore idle colors")
		.toEqual(idle);
}

for (const theme of ["light", "dark"]) {
	test(`sidebar hover matches active colors in ${theme} theme`, async ({
		page,
	}) => {
		const vaultPath = createFixtureVaultCopy();
		try {
			await prepareSidebar(page, vaultPath);
			await page.evaluate((value) => {
				document.documentElement.setAttribute("data-theme", value);
				document.documentElement.classList.toggle("dark", value === "dark");
			}, theme);
			for (const label of rowLabels) await verifyRow(page, theme, label);
		} finally {
			removeFixtureVaultCopy(vaultPath);
		}
	});
}
