import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarLayoutBindings } from "../../../collections/layoutRegistry";
import { makeEntry } from "../../../test-utils/noteListTestUtils";
import { CalendarLayout } from "./CalendarLayout";

vi.mock("../../../lib/telemetry", () => ({ trackEvent: vi.fn() }));

const DAY = "2026-11-04";
const calendar: CalendarLayoutBindings = {
	settings: {
		dateProperty: "date",
		endDateProperty: null,
		view: "month",
		showWeekends: true,
	},
	dateProperty: "date",
	dateOptions: ["date"],
	canReschedule: true,
	onSettingsChange: vi.fn(),
	onWriteDate: vi.fn().mockResolvedValue(undefined),
	onCreate: vi.fn(),
	onUseList: vi.fn(),
};

/** Notes on one day, shaped like Luca's screenshot: a long title plus a date and a link property. */
function notesOnDay(count: number) {
	return Array.from({ length: count }, (_, index) =>
		makeEntry({
			path: `/v/essay-${index}.md`,
			title: `For us, AI is finally delivering ${index}`,
			properties: { date: DAY, source: "https://refactoring.fm" },
		}),
	);
}

interface RowGeometry {
	/** Height of a week row's item area (row minus the day number). */
	lanes: number;
	/** Natural height of every card. */
	card: number;
}

/** The prototype that owns `offsetHeight` (the one every card element inherits it from). */
function cardPrototype(): { readonly offsetHeight: number } {
	const divPrototype = Object.getPrototypeOf(document.createElement("div"));
	return Object.getPrototypeOf(divPrototype);
}

/** JSDOM has no layout: give a 600px month grid, its item areas and its cards real heights. */
function stubGeometry({ lanes, card }: RowGeometry) {
	vi.spyOn(cardPrototype(), "offsetHeight", "get").mockImplementation(function (
		this: Element,
	) {
		return this.hasAttribute("data-path") ? card : 0;
	});
	vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(
		function (this: Element) {
			return this.classList.contains("calendar-week__lanes") ? lanes : 0;
		},
	);
	vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
		function (this: Element) {
			const height = this.classList.contains("calendar-weeks") ? 600 : 0;
			return { height, width: 0, top: 0, left: 0 } as DOMRect;
		},
	);
}

function renderDay(count: number, properties: string[] = ["source"]) {
	const entries = notesOnDay(count);
	render(
		<CalendarLayout
			entries={entries}
			allEntries={entries}
			properties={properties}
			locale="en"
			typeEntryMap={{}}
			onOpen={vi.fn()}
			calendar={calendar}
		/>,
	);
}

function shownCards(): HTMLElement[] {
	return screen.getAllByTestId("calendar-item");
}

describe("calendar day cells fit cards at their natural height (TOL-393)", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date(2026, 10, 19, 12));
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('shows both cards of a two-note day instead of only "+2 more"', () => {
		stubGeometry({ lanes: 90, card: 40 });
		renderDay(2);
		expect(shownCards()).toHaveLength(2);
		expect(screen.queryByTestId("calendar-more")).not.toBeInTheDocument();
	});

	it("stacks cards at their natural height instead of stretching them over the cell", () => {
		stubGeometry({ lanes: 90, card: 40 });
		renderDay(1);
		const [card] = shownCards();
		expect(card).toHaveClass("h-auto");
		expect(card).not.toHaveClass("h-full");
		expect(card.parentElement).toHaveClass("calendar-week__lanes");
	});

	it('shows three short cards when they fit and folds only the rest into "+N more"', () => {
		stubGeometry({ lanes: 90, card: 26 });
		renderDay(3);
		expect(shownCards()).toHaveLength(3);
		expect(screen.queryByTestId("calendar-more")).not.toBeInTheDocument();
	});

	it('keeps two cards and counts the hidden ones in "+N more" on a busy day', () => {
		stubGeometry({ lanes: 90, card: 26 });
		renderDay(6);
		expect(shownCards()).toHaveLength(2);
		expect(screen.getByTestId("calendar-more")).toHaveTextContent("+4 more");
	});

	it("fits fewer of the taller cards with properties and grows the row so two always fit", () => {
		stubGeometry({ lanes: 90, card: 58 });
		renderDay(5, ["date", "source"]);
		expect(shownCards()).toHaveLength(1);
		expect(screen.getByTestId("calendar-more")).toHaveTextContent("+4 more");
		const week = screen
			.getAllByTestId("calendar-week")
			.find((row) => row.querySelector(`[data-day="${DAY}"]`));
		expect(week?.style.minHeight).toBe(
			`${30 + 1 + 58 + 3 + 58 + 3 + 20 + 4}px`,
		);
	});

	it("recounts the cards that fit when the app zoom changes", async () => {
		stubGeometry({ lanes: 90, card: 26 });
		renderDay(6);
		expect(shownCards()).toHaveLength(2);
		stubGeometry({ lanes: 200, card: 26 });
		act(() => {
			window.dispatchEvent(new Event("laputa-zoom-change"));
		});
		await waitFor(() => expect(shownCards()).toHaveLength(6));
		expect(screen.queryByTestId("calendar-more")).not.toBeInTheDocument();
	});

	it("recounts the cards that fit when the window resizes a row", () => {
		const rows: Array<() => void> = [];
		vi.stubGlobal(
			"ResizeObserver",
			class {
				constructor(private readonly callback: () => void) {}
				observe(element: Element) {
					if (element.classList.contains("calendar-week__lanes"))
						rows.push(this.callback);
				}
				disconnect() {}
			},
		);
		stubGeometry({ lanes: 90, card: 26 });
		renderDay(6);
		expect(shownCards()).toHaveLength(2);
		stubGeometry({ lanes: 60, card: 26 });
		act(() => {
			for (const resized of rows) resized();
		});
		expect(shownCards()).toHaveLength(1);
		expect(screen.getByTestId("calendar-more")).toHaveTextContent("+5 more");
		vi.unstubAllGlobals();
	});

	it("keeps every month week row at least 150px with many notes on one day", () => {
		stubGeometry({ lanes: 20, card: 58 });
		renderDay(15, ["date", "source"]);

		const rows = screen.getAllByTestId("calendar-week");
		expect(rows.length).toBeGreaterThanOrEqual(4);
		expect(
			getComputedStyle(screen.getByTestId("calendar-weeks")).gridAutoRows,
		).toBe("max-content");
		for (const row of rows) {
			expect(Number.parseFloat(row.style.minHeight)).toBeGreaterThanOrEqual(
				150,
			);
		}
		const days = screen
			.getAllByTestId("calendar-day")
			.map((cell) => cell.dataset.day);
		expect(new Set(days).size).toBe(days.length);
	});
});
