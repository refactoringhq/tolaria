import { fireEvent, render, screen, within } from "@testing-library/react";
import { CalendarOverview } from "./CalendarOverview";
import type { CalendarItem } from "./calendarModel";

const item = (start: string, end = start): CalendarItem => ({
	start,
	end,
	entry: {
		path: `${start}.md`,
		name: "Test",
		title: "Test",
		properties: {},
		createdAt: null,
		modifiedAt: null,
	} as CalendarItem["entry"],
});

describe("CalendarOverview", () => {
	it("formats month headings with the selected date display format", () => {
		render(
			<CalendarOverview
				anchor="2026-11-19"
				view="quarter"
				items={[]}
				locale="en"
				dateDisplayFormat="iso"
				showWeekends
				today="2026-11-19"
				onSelectMonth={vi.fn()}
			/>,
		);
		expect(
			screen.getByRole("region", { name: "2026-11-01" }),
		).toBeInTheDocument();
	});

	it("renders compact year and quarter month collections and marks scheduled days", () => {
		const { rerender } = render(
			<CalendarOverview
				anchor="2026-11-19"
				view="year"
				items={[item("2026-02-03"), item("2026-02-04", "2026-02-06")]}
				locale="en"
				showWeekends
				today="2026-11-19"
				onSelectMonth={vi.fn()}
			/>,
		);
		expect(screen.getAllByRole("region")).toHaveLength(12);
		expect(screen.getByTestId("calendar-overview-year")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "2026-02-03, 1" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "2026-02-05, 1" }),
		).toBeInTheDocument();
		rerender(
			<CalendarOverview
				anchor="2026-11-19"
				view="quarter"
				items={[]}
				locale="en"
				showWeekends
				today="2026-11-19"
				onSelectMonth={vi.fn()}
			/>,
		);
		expect(screen.getAllByRole("region")).toHaveLength(3);
	});

	it("opens a selected day in its month view", () => {
		const onSelectMonth = vi.fn();
		render(
			<CalendarOverview
				anchor="2026-11-19"
				view="quarter"
				items={[]}
				locale="en"
				showWeekends
				today="2026-11-19"
				onSelectMonth={onSelectMonth}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "2026-11-19, 0" }));
		expect(onSelectMonth).toHaveBeenCalledWith("2026-11-19");
	});

	it("keeps the locale weekday order when weekends are hidden", () => {
		render(
			<CalendarOverview
				anchor="2026-11-19"
				view="quarter"
				items={[]}
				locale="en"
				showWeekends={false}
				today="2026-11-19"
				onSelectMonth={vi.fn()}
			/>,
		);

		const weekdays = within(screen.getAllByRole("region")[0]).getAllByText(
			/^(Mon|Tue|Wed|Thu|Fri)$/,
		);
		expect(weekdays.map((day) => day.textContent)).toEqual([
			"Mon",
			"Tue",
			"Wed",
			"Thu",
			"Fri",
		]);
	});
});
