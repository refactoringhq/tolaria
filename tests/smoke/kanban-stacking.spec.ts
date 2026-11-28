import path from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import {
	createFixtureVaultCopy,
	openFixtureVaultDesktopHarness,
	removeFixtureVaultCopy,
} from "../helpers/fixtureVault";

const position = (column: Locator) =>
	column.evaluate((el) => ({
		left: el.getBoundingClientRect().left,
		right: el.getBoundingClientRect().right,
		angle: parseFloat(getComputedStyle(el).rotate) || 0,
		shift: parseFloat(getComputedStyle(el).translate) || 0,
		layer: Number(getComputedStyle(el).zIndex),
		sideShadow: Number(getComputedStyle(el, "::after").opacity),
	}));

async function seedColumns(page: Page, vault: string) {
	const groups = [
		"Backlog",
		"Brief",
		"Draft",
		"Review",
		"Revisions",
		"Ready",
		"Scheduled",
		"Published",
	];
	const notes = [
		...Array.from({ length: 24 }, (_, index) => ({
			title: `Active example ${index}`,
			group: "Active",
		})),
		...groups.map((group) => ({ title: `${group} example`, group })),
	];
	for (const { title, group } of notes) {
		const response = await page.request.post("/api/vault/save", {
			data: {
				path: path.join(vault, "note", `board-${title}.md`),
				content: `---\nIs A: Note\nStatus: ${group}\n---\n\n# ${title}\n\nA sample note in the Kanban board.`,
			},
		});
		expect(response.ok()).toBe(true);
	}
}

async function checkColumnPocket(page: Page) {
	const column = page.getByTestId("kanban-column").first();
	const pocket = column.locator(".kanban-column-cards");
	const scroller = pocket.locator("[data-virtuoso-scroller]");
	const firstCard = scroller.getByTestId("kanban-card").first();
	await expect(firstCard).toBeVisible();
	const top = (el: Element) => el.getBoundingClientRect().top;
	expect(
		(await firstCard.evaluate(top)) - (await scroller.evaluate(top)),
	).toBeGreaterThan(6);
	await expect(pocket).not.toHaveAttribute("data-scrolled");
	await firstCard.hover();
	await page.mouse.wheel(0, 140);
	await expect(pocket).toHaveAttribute("data-scrolled", "");
	await scroller.evaluate((el) => {
		el.scrollTop = 0;
	});
	await expect(pocket).not.toHaveAttribute("data-scrolled");
}

async function openBoard(page: Page, vault: string) {
	await page.setViewportSize({ width: 1440, height: 840 });
	await openFixtureVaultDesktopHarness(page, vault, {
		expectedReadyTitle: "Review example",
	});
	await page
		.getByTestId("sidebar-top-nav")
		.getByText("All Notes", { exact: true })
		.click();
	await page.getByTestId("layout-menu-button").click();
	await page.getByTestId("layout-option-kanban").click();
	await checkHeaderAlignment(page);
}

async function checkHeaderAlignment(page: Page) {
	const sidebarHeader = page.locator(".sidebar-heading > div").first();
	const boardHeader = page
		.locator(
			'.app__note-list [data-collection-layout="kanban"] > .flex-col > .border-b',
		)
		.first();
	const top = (el: Element) => el.getBoundingClientRect().top;
	await expect
		.poll(async () =>
			Math.abs(
				(await sidebarHeader.evaluate(top)) - (await boardHeader.evaluate(top)),
			),
		)
		.toBeLessThan(1);
	const vault = page
		.getByTestId("sidebar-workspace-header")
		.getByTestId("status-vault-trigger");
	const columnHeader = page
		.getByTestId("kanban-column")
		.first()
		.locator(":scope > div")
		.first();
	const center = (el: Element) => {
		const box = el.getBoundingClientRect();
		return box.top + box.height / 2;
	};
	expect(
		Math.abs(
			(await vault.evaluate(center)) - (await columnHeader.evaluate(center)),
		),
	).toBeLessThan(1);
}

async function checkEdgeStacks(page: Page) {
	const board = page.getByTestId("kanban-board");
	const columns = board.getByTestId("kanban-column");
	await expect.poll(() => columns.count()).toBeGreaterThan(6);
	await expect(page.getByTestId("layout-option-kanban")).toBeHidden();
	await expect(page.locator(".app > .app__editor")).toBeHidden();
	const first = await position(columns.first());
	const last = await position(columns.last());
	const leftEdge = await board.evaluate(
		(el) =>
			el.getBoundingClientRect().left +
			parseFloat(getComputedStyle(el).paddingLeft),
	);
	expect(Math.abs(first.left - leftEdge)).toBeLessThan(1.5);
	expect(first.sideShadow).toBe(0);
	expect(Math.abs(last.angle)).toBeGreaterThan(0);
	await expect(maxStackOverhang(board, "right")).resolves.toBeLessThanOrEqual(
		14,
	);
	await board.evaluate((el) => {
		el.scrollLeft = 8;
	});
	await expect
		.poll(async () => (await position(columns.first())).left)
		.toBeCloseTo(first.left, 0);
	await board.evaluate((el) => {
		el.scrollLeft = 170;
	});
	await expect
		.poll(async () => {
			const moving = await position(columns.nth(1));
			const pinned = await position(columns.first());
			return moving.layer - pinned.layer;
		})
		.toBeGreaterThan(0);
	await expect
		.poll(async () => (await position(columns.first())).sideShadow)
		.toBeGreaterThan(0);
	await checkLeftStack(board, columns, first.left);
	await expect(maxStackOverhang(board, "left")).resolves.toBeLessThanOrEqual(
		14,
	);
	await checkRightEdge(board, columns);
	await board.evaluate((el) => {
		el.scrollLeft = 0;
	});
	await expect
		.poll(async () => (await position(columns.first())).angle)
		.toBe(0);
}

function maxStackOverhang(board: Locator, edge: "left" | "right") {
	return board.evaluate((el, edge) => {
		const rect = el.getBoundingClientRect();
		const style = getComputedStyle(el);
		const boundary =
			edge === "left"
				? rect.left + parseFloat(style.paddingLeft)
				: rect.right - parseFloat(style.paddingRight);
		const columns = el.querySelectorAll(`[data-kanban-stack="${edge}"]`);
		return Math.max(
			0,
			...Array.from(columns, (column) => {
				const bounds = column.getBoundingClientRect();
				return edge === "left"
					? boundary - bounds.left
					: bounds.right - boundary;
			}),
		);
	}, edge);
}

async function checkLeftStack(
	board: Locator,
	columns: Locator,
	leftEdge: number,
) {
	const stride = await columns
		.first()
		.evaluate(
			(el) =>
				el.offsetWidth +
				parseFloat(getComputedStyle(el.parentElement ?? el).columnGap),
		);
	await board.evaluate(
		(el, leftStack) => {
			el.scrollLeft = leftStack;
		},
		2 * stride + 5,
	);
	await expect
		.poll(async () => (await position(columns.nth(1))).angle)
		.toBeGreaterThan(0);
	const leftDeck = await position(columns.first());
	const nextInDeck = await position(columns.nth(1));
	const leftFront = await position(columns.nth(2));
	expect(nextInDeck.angle).toBeGreaterThan(0);
	expect(leftDeck.shift).toBeLessThan(0);
	expect(nextInDeck.shift).toBeGreaterThan(0);
	expect(Math.abs(leftFront.left - leftEdge)).toBeLessThan(1.5);
	expect(leftFront.layer).toBeGreaterThan(leftDeck.layer);
	expect(Math.abs(leftFront.angle)).toBeLessThan(0.1);
}

async function checkRightEdge(board: Locator, columns: Locator) {
	await board.evaluate((el) => {
		el.scrollLeft = el.scrollWidth;
	});
	await expect.poll(async () => (await position(columns.last())).angle).toBe(0);
	const rightEdge = await board.evaluate(
		(el) =>
			el.getBoundingClientRect().right -
			parseFloat(getComputedStyle(el).paddingRight),
	);
	expect(
		Math.abs(rightEdge - (await position(columns.last())).right),
	).toBeLessThan(8);
}

async function checkEditorResize(page: Page) {
	await page.getByTestId("kanban-card").first().click();
	const handle = page.getByTestId("kanban-editor-resize");
	await expect(handle).toBeVisible();
	const panel = page.locator(".app > .app__editor");
	await expect
		.poll(() =>
			panel.evaluate((el) =>
				parseFloat(getComputedStyle(el).borderTopLeftRadius),
			),
		)
		.toBeGreaterThan(0);
	await expect
		.poll(() => panel.evaluate((el) => getComputedStyle(el).transform))
		.toBe("matrix(1, 0, 0, 1, 0, 0)");
	const panelWidth = () =>
		panel.evaluate((el) => el.getBoundingClientRect().width);
	const width = await panelWidth();
	const grip = await handle.evaluate((el) => {
		const { x, y, width, height } = el.getBoundingClientRect();
		return { x, y, width, height };
	});
	await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
	await page.mouse.down();
	await page.mouse.move(
		grip.x + grip.width / 2 + 100,
		grip.y + grip.height / 2,
		{ steps: 8 },
	);
	await page.mouse.up();
	await expect.poll(panelWidth).toBeLessThan(width - 70);
	const resized = await panelWidth();
	await handle.press("ArrowLeft");
	await expect.poll(panelWidth).toBeGreaterThan(resized + 5);
	await page.getByTestId("kanban-panel-close").click();
	await expect(handle).toHaveCount(0);
}

async function checkContinuousScroll(page: Page) {
	const board = page.getByTestId("kanban-board");
	const scrollState = () =>
		board.evaluate((el) => ({
			position: el.scrollLeft,
			end: el.scrollWidth - el.clientWidth,
		}));
	const { end } = await scrollState();
	const point = await board.evaluate((el) => {
		const box = el.getBoundingClientRect();
		return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	});
	await page.mouse.move(point.x, point.y);
	for (const fraction of [0.2, 0.45, 0.7, 0.95]) {
		await page.mouse.wheel(end * 0.27, 0);
		await expect
			.poll(async () => (await scrollState()).position)
			.toBeGreaterThan(end * fraction);
		expect(Math.abs((await scrollState()).end - end)).toBeLessThan(8);
	}
	await board.evaluate((el) => {
		el.scrollLeft = 0;
	});
}

test("Kanban stacks at both edges and opens a resizable editor", async ({
	page,
}) => {
	const vault = createFixtureVaultCopy();
	try {
		await seedColumns(page, vault);
		await openBoard(page, vault);
		await checkColumnPocket(page);
		await checkEdgeStacks(page);
		await checkContinuousScroll(page);
		await checkEditorResize(page);
	} finally {
		removeFixtureVaultCopy(vault);
	}
});

test("Hidden columns shares the Kanban lane dimensions and joins the right stack", async ({
	page,
}) => {
	const vault = createFixtureVaultCopy();
	try {
		await seedColumns(page, vault);
		await openBoard(page, vault);
		const board = page.getByTestId("kanban-board");
		await board
			.getByRole("button", { name: "Hide Active", exact: true })
			.click();
		const hidden = board.getByTestId("kanban-hidden-columns");
		await expect(hidden).toHaveAttribute("data-kanban-stack", "right");
		await expect(hidden).toHaveCSS("position", "sticky");
		const dimensions = (el: Element) => [el.clientWidth, el.clientHeight];
		expect(await hidden.evaluate(dimensions)).toEqual(
			await board.getByTestId("kanban-column").first().evaluate(dimensions),
		);
		await board.evaluate((el) => {
			el.scrollLeft = el.scrollWidth;
		});
		await expect(hidden).toHaveAttribute("data-kanban-stack", "moving");
		await hidden
			.getByRole("button", { name: "Show Active", exact: true })
			.click();
		await expect(hidden).toHaveCount(0);
		await expect(board.locator('[data-kanban-column="Active"]')).toHaveCount(1);
	} finally {
		removeFixtureVaultCopy(vault);
	}
});

test("Kanban column reorder stays steady over a neighboring column", async ({
	page,
}) => {
	const vault = createFixtureVaultCopy();
	try {
		await seedColumns(page, vault);
		await openBoard(page, vault);
		await checkColumnReorder(page);
	} finally {
		removeFixtureVaultCopy(vault);
	}
});

async function checkColumnReorder(page: Page) {
	const columns = page.getByTestId("kanban-column");
	const from = columns.filter({
		has: page.getByRole("button", { name: "Backlog", exact: true }),
	});
	const to = columns.filter({
		has: page.getByRole("button", { name: "Brief", exact: true }),
	});
	const center = (el: Element) => {
		const box = el.getBoundingClientRect();
		return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
	};
	const start = await from
		.getByRole("button", { name: "Backlog", exact: true })
		.evaluate(center);
	const end = await to
		.getByRole("button", { name: "Brief", exact: true })
		.evaluate(center);
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(end.x, end.y, { steps: 12 });
	const displacement = await to.evaluate(async (el) => {
		const values = new Set<string>();
		const until = performance.now() + 350;
		while (performance.now() < until) {
			values.add(el.style.transform);
			await new Promise(requestAnimationFrame);
		}
		return [...values];
	});
	expect(displacement).toHaveLength(1);
	await page.mouse.up();
	await expect(columns.nth(1)).toHaveAttribute("data-kanban-column", "Brief");
	await expect(columns.nth(2)).toHaveAttribute("data-kanban-column", "Backlog");
}
