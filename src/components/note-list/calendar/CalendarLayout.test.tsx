import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarLayoutBindings } from "../../../collections/layoutRegistry";
import { AppPreferencesProvider } from "../../../hooks/useAppPreferences";
import type { AppLocale } from "../../../lib/i18n";
import { makeEntry } from "../../../test-utils/noteListTestUtils";
import type { VaultEntry } from "../../../types";
import { CalendarLayout } from "./CalendarLayout";

const { trackEvent, dndMonitor } = vi.hoisted(() => ({
	trackEvent: vi.fn(),
	dndMonitor: { current: null as unknown },
}));
vi.mock("../../../lib/telemetry", () => ({ trackEvent }));
vi.mock("@dnd-kit/core", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@dnd-kit/core")>();
	return {
		...actual,
		useDndMonitor: (...args: unknown[]) => {
			dndMonitor.current = args[0];
		},
	};
});

const launch = makeEntry({
	path: "/v/launch.md",
	title: "Launch",
	icon: "🚀",
	properties: { due: "2026-11-19", end: "2026-11-24", owner: "Ada" },
});
const review = makeEntry({
	path: "/v/review.md",
	title: "Review",
	properties: { due: "2026-11-03" },
});
const someday = makeEntry({
	path: "/v/someday.md",
	title: "Someday",
	properties: {},
});
const broken = makeEntry({
	path: "/v/broken.md",
	title: "Broken",
	properties: { due: "soon" },
});
const entries = [launch, review, someday, broken];

function bindings(
	overrides: Partial<CalendarLayoutBindings> = {},
): CalendarLayoutBindings {
	return {
		settings: {
			dateProperty: "due",
			endDateProperty: "end",
			view: "month",
			showWeekends: true,
		},
		dateProperty: "due",
		dateOptions: ["due", "end"],
		canReschedule: true,
		onSettingsChange: vi.fn(),
		onWriteDate: vi.fn().mockResolvedValue(undefined),
		onCreate: vi.fn(),
		onUseList: vi.fn(),
		...overrides,
	};
}

function renderCalendar({
	calendar = bindings(),
	items = entries,
	locale = "en" as AppLocale,
	dateDisplayFormat = "friendly" as const,
	properties = [] as string[],
	showProperties = true,
} = {}) {
	const onOpen = vi.fn();
	const view = render(
		<AppPreferencesProvider
			appLocale={locale}
			dateDisplayFormat={dateDisplayFormat}
		>
			<CalendarLayout
				entries={items}
				allEntries={items}
				properties={properties}
				showProperties={showProperties}
				locale={locale}
				typeEntryMap={{}}
				selectedNotePath="/v/review.md"
				onOpen={onOpen}
				calendar={calendar}
			/>
		</AppPreferencesProvider>,
	);
	return { ...view, onOpen, calendar };
}

function day(key: string): HTMLElement {
	const cell = screen
		.getAllByTestId("calendar-day")
		.find((element) => element.dataset.day === key);
	if (!cell) throw new Error(`No day ${key}`);
	return cell;
}

function busyEntries(prefix: string): VaultEntry[] {
	return Array.from({ length: 6 }, (_, index) =>
		makeEntry({
			path: `/v/${prefix}-${index}.md`,
			title: `${prefix} ${index}`,
			properties: { due: "2026-11-10" },
		}),
	);
}

function emitDndMonitorEvent(name: "onDragStart" | "onDragEnd") {
	const callbacks = dndMonitor.current as {
		onDragStart?: unknown;
		onDragEnd?: unknown;
	} | null;
	const callback =
		name === "onDragStart" ? callbacks?.onDragStart : callbacks?.onDragEnd;
	if (typeof callback === "function") {
		act(() => (callback as (event: unknown) => void)({}));
	}
}

describe("CalendarLayout", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date(2026, 10, 19, 12));
	});
	afterEach(() => vi.useRealTimers());

	it("opens on the current month with today highlighted and neighbouring days muted", () => {
		renderCalendar();
		expect(screen.getByTestId("calendar-title")).toHaveTextContent("Nov 2026");
		expect(screen.getAllByTestId("calendar-week")).toHaveLength(5);
		expect(
			day("2026-11-19").querySelector('[aria-current="date"]'),
		).toHaveTextContent("19");
		expect(day("2026-12-01")).toHaveClass("calendar-day--outside");
		expect(day("2026-11-21")).toHaveClass("calendar-day--weekend");
		expect(day("2026-11-01")).toHaveTextContent("Nov 1");
	});

	it("keeps calendar items and overflow controls above day drop targets for mouse input", () => {
		renderCalendar();
		expect(
			screen
				.getAllByTestId("calendar-week")[0]
				.querySelector(".calendar-week__lanes"),
		).toHaveStyle({ zIndex: "1" });
	});

	it("starts weeks on Monday with localized names in Italian", () => {
		renderCalendar({ locale: "it-IT" });
		expect(screen.getByTestId("calendar-title")).toHaveTextContent("nov 2026");
		expect(screen.getAllByTestId("calendar-day")[0].dataset.day).toBe(
			"2026-10-26",
		);
		expect(screen.getByRole("button", { name: "Oggi" })).toBeInTheDocument();
	});

	it.each(["quarter", "year"] as const)(
		"passes the selected date format through the %s overview integration",
		(view) => {
			renderCalendar({
				calendar: bindings({
					settings: {
						dateProperty: "due",
						endDateProperty: "end",
						view,
						showWeekends: true,
					},
				}),
				dateDisplayFormat: "iso",
			});

			expect(
				screen.getByRole("region", { name: "2026-10-01" }),
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "2026-10-01" }),
			).toBeInTheDocument();
		},
	);

	it("places notes with their icon, spans ranges across week rows, and keeps selection subtle", () => {
		renderCalendar();
		const launchBars = screen.getAllByRole("button", { name: "Launch" });
		expect(launchBars).toHaveLength(2);
		expect(
			within(launchBars[0]).getByTestId("calendar-item-icon"),
		).toHaveTextContent("🚀");
		expect(launchBars[0]).toHaveStyle({ gridColumn: "5 / span 3" });
		expect(launchBars[1]).toHaveStyle({ gridColumn: "1 / span 3" });
		expect(screen.getByRole("button", { name: "Review" })).toHaveAttribute(
			"data-selected",
			"true",
		);
		expect(
			screen
				.getByRole("button", { name: "Review" })
				.querySelector(".calendar-item"),
		).toHaveClass("calendar-item--selected");
		expect(screen.getByRole("button", { name: "Review" })).toHaveClass(
			"focus-visible:ring-0",
		);
	});

	it("renders plain Kanban-style cards without type-color accents", () => {
		renderCalendar();
		const card = screen.getAllByRole("button", { name: "Launch" })[0];
		expect(card.querySelector(".calendar-item")).toHaveClass(
			"rounded-lg",
			"px-3",
			"py-2.5",
			"shadow-xs",
		);
		expect(card.querySelector(".calendar-item")).not.toHaveAttribute("style");
	});

	it("shows card fields chosen through the visible-properties control", () => {
		renderCalendar({ properties: ["owner"] });
		const card = within(screen.getAllByRole("button", { name: "Launch" })[0]);
		expect(card.getByTestId("property-chips")).toHaveTextContent("Ada");
		expect(
			card.getByTestId("calendar-item-title").lastElementChild,
		).toHaveClass("min-w-0", "whitespace-normal", "break-words");
	});

	it("renders all selected card properties and removes unchecked properties", () => {
		const { unmount } = renderCalendar({ properties: ["due", "owner"] });
		const card = within(screen.getAllByRole("button", { name: "Launch" })[0]);
		expect(card.getByTestId("property-chips")).toHaveTextContent(
			"November 19, 2026",
		);
		expect(card.getByTestId("property-chips")).toHaveTextContent("Ada");

		unmount();
		renderCalendar({ properties: ["owner"] });
		const unchecked = within(
			screen.getAllByRole("button", { name: "Launch" })[0],
		).getByTestId("property-chips");
		expect(unchecked).toHaveTextContent("Ada");
		expect(unchecked).not.toHaveTextContent("November 19, 2026");
	});

	it("hides card fields when item properties are disabled", () => {
		renderCalendar({ properties: ["owner"], showProperties: false });
		expect(
			within(
				screen.getAllByRole("button", { name: "Launch" })[0],
			).queryByTestId("property-chips"),
		).not.toBeInTheDocument();
	});

	it("hides note icons when the persisted icon setting is off", () => {
		renderCalendar({
			calendar: bindings({
				settings: {
					dateProperty: "due",
					endDateProperty: "end",
					view: "month",
					showWeekends: true,
					showIcons: false,
				},
			}),
		});
		expect(screen.getAllByTestId("calendar-item").length).toBeGreaterThan(0);
		expect(screen.queryByTestId("calendar-item-icon")).not.toBeInTheDocument();
	});

	it("moves by month, week and back to today with buttons and keyboard shortcuts", () => {
		const { calendar } = renderCalendar();
		fireEvent.click(screen.getByTestId("calendar-next"));
		expect(screen.getByTestId("calendar-title")).toHaveTextContent("Dec 2026");
		fireEvent.keyDown(window, { key: "ArrowRight" });
		expect(screen.getByTestId("calendar-title")).toHaveTextContent("Jan 2027");
		fireEvent.keyDown(window, { key: "ArrowLeft" });
		fireEvent.click(screen.getByTestId("calendar-previous"));
		expect(screen.getByTestId("calendar-title")).toHaveTextContent("Nov 2026");
		fireEvent.click(screen.getByTestId("calendar-next"));
		fireEvent.keyDown(window, { key: "t" });
		expect(screen.getByTestId("calendar-title")).toHaveTextContent("Nov 2026");
		fireEvent.keyDown(window, { key: "w" });
		expect(calendar.onSettingsChange).toHaveBeenCalledWith({ view: "week" });
		expect(trackEvent).toHaveBeenCalledWith("calendar_view_changed", {
			view: "week",
		});
		expect(screen.getByTestId("calendar-today")).toHaveAttribute(
			"title",
			"Go to today (T)",
		);
		expect(screen.getByTestId("calendar-next")).toHaveAttribute(
			"title",
			"Next month (→)",
		);
	});

	it("ignores shortcuts typed into fields or with modifiers", () => {
		renderCalendar();
		const input = document.createElement("input");
		document.body.appendChild(input);
		fireEvent.keyDown(input, { key: "ArrowRight" });
		fireEvent.keyDown(window, { key: "ArrowRight", metaKey: true });
		expect(screen.getByTestId("calendar-title")).toHaveTextContent("Nov 2026");
		input.remove();
	});

	it("shows one week without an hour grid", () => {
		renderCalendar({
			calendar: bindings({
				settings: {
					dateProperty: "due",
					endDateProperty: "end",
					view: "week",
					showWeekends: true,
				},
			}),
		});
		expect(screen.getByTestId("calendar-title")).toHaveTextContent(
			/Nov 15\s*–\s*21, 2026/,
		);
		expect(screen.getAllByTestId("calendar-week")).toHaveLength(1);
		expect(screen.getAllByTestId("calendar-day")).toHaveLength(7);
		expect(screen.getByTestId("calendar-previous")).toHaveAccessibleName(
			"Previous week",
		);
	});

	it("drops weekend columns when weekends are hidden", () => {
		renderCalendar({
			calendar: bindings({
				settings: {
					dateProperty: "due",
					endDateProperty: null,
					view: "week",
					showWeekends: false,
				},
			}),
		});
		expect(
			screen.getAllByTestId("calendar-day").map((cell) => cell.dataset.day),
		).toEqual([
			"2026-11-16",
			"2026-11-17",
			"2026-11-18",
			"2026-11-19",
			"2026-11-20",
		]);
		expect(screen.getByTestId("calendar-title")).toHaveTextContent(
			/Nov 16\s*–\s*20, 2026/,
		);
	});

	it('collapses a busy day into "+N more" and lists every note in its popover', async () => {
		const busy = busyEntries("Busy");
		const { onOpen } = renderCalendar({ items: busy });
		const more = screen.getByTestId("calendar-more");
		expect(more).toHaveTextContent("+3 more");
		vi.useRealTimers();
		fireEvent.click(more);
		const popover = await screen.findByTestId("calendar-more-popover");
		const popoverItems = within(popover).getAllByTestId("calendar-item");
		expect(popoverItems).toHaveLength(6);
		expect(popoverItems[0]).toHaveAttribute("tabindex", "0");
		expect(
			popover.querySelector(".calendar-more-popover__header"),
		).toBeInTheDocument();
		for (const item of popoverItems) {
			expect(item).toHaveClass("h-auto", "shrink-0");
			expect(item.parentElement).toBe(
				popover.querySelector(".calendar-scroll"),
			);
		}
		fireEvent.click(within(popover).getByRole("button", { name: "Busy 4" }));
		expect(onOpen).toHaveBeenCalledWith(busy[4], expect.anything());
		await waitFor(() =>
			expect(
				screen.queryByTestId("calendar-more-popover"),
			).not.toBeInTheDocument(),
		);
	});

	it("keeps overflow items mounted during a drag, then closes the popover", async () => {
		const busy = busyEntries("Drag");
		renderCalendar({ items: busy });
		fireEvent.click(screen.getByTestId("calendar-more"));
		await screen.findByTestId("calendar-more-popover");
		emitDndMonitorEvent("onDragStart");
		await waitFor(() =>
			expect(screen.getByTestId("calendar-more-popover")).toBeInTheDocument(),
		);
		emitDndMonitorEvent("onDragEnd");
		await waitFor(() =>
			expect(
				screen.queryByTestId("calendar-more-popover"),
			).not.toBeInTheDocument(),
		);
	});

	it('creates a note on a day from its "+" button', () => {
		const { calendar } = renderCalendar();
		fireEvent.click(within(day("2026-11-25")).getByTestId("calendar-day-add"));
		expect(calendar.onCreate).toHaveBeenCalledWith("2026-11-25");
		expect(
			within(day("2026-11-25")).getByTestId("calendar-day-add"),
		).toHaveAccessibleName("New note on Wednesday, Nov 25, 2026");
	});

	it("keeps read-only sources from creating or dragging", () => {
		renderCalendar({ calendar: bindings({ canReschedule: false }) });
		expect(screen.queryByTestId("calendar-day-add")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Review" })).toHaveAttribute(
			"aria-disabled",
			"true",
		);
	});

	it("lists unscheduled and invalid notes in a collapsible tray with a count", () => {
		renderCalendar();
		const tray = screen.getByTestId("calendar-tray");
		expect(within(tray).getByTestId("calendar-tray-count")).toHaveTextContent(
			"2",
		);
		expect(
			within(tray)
				.getAllByTestId("calendar-tray-note")
				.map((note) => note.getAttribute("aria-label")),
		).toEqual(["Someday", "Broken"]);
		expect(within(tray).getByTestId("calendar-tray-hint")).toHaveTextContent(
			"Not a date: soon",
		);
		fireEvent.click(screen.getByTestId("calendar-tray-toggle"));
		expect(screen.queryByTestId("calendar-tray")).not.toBeInTheDocument();
		expect(screen.getByTestId("calendar-tray-toggle")).toHaveTextContent("2");
	});

	it("opens a note from the grid and the tray", () => {
		const { onOpen } = renderCalendar();
		fireEvent.click(screen.getByRole("button", { name: "Review" }));
		expect(onOpen).toHaveBeenCalledWith(review, expect.anything());
		fireEvent.click(screen.getByRole("button", { name: "Someday" }));
		expect(onOpen).toHaveBeenLastCalledWith(someday, expect.anything());
	});

	it("explains an empty calendar and offers the timestamp sources or List", () => {
		const calendar = bindings({ dateProperty: null, dateOptions: [] });
		renderCalendar({ calendar, items: [someday] });
		expect(screen.getByTestId("calendar-empty")).toHaveTextContent(
			"No note in this list has a date property yet",
		);
		fireEvent.click(screen.getByTestId("calendar-empty-use-created"));
		expect(calendar.onSettingsChange).toHaveBeenCalledWith({
			dateProperty: "$created",
			endDateProperty: null,
		});
		fireEvent.click(screen.getByTestId("calendar-empty-use-list"));
		expect(calendar.onUseList).toHaveBeenCalled();
	});

	it("stays mounted and stable while entries update in place", () => {
		const { rerender, calendar } = renderCalendar();
		const moved: VaultEntry = { ...review, properties: { due: "2026-11-05" } };
		act(() => {
			rerender(
				<CalendarLayout
					entries={[launch, moved]}
					allEntries={[launch, moved]}
					properties={[]}
					locale="en"
					typeEntryMap={{}}
					onOpen={vi.fn()}
					calendar={calendar}
				/>,
			);
		});
		expect(
			within(screen.getAllByTestId("calendar-week")[0]).getByRole("button", {
				name: "Review",
			}),
		).toBeInTheDocument();
	});
});
