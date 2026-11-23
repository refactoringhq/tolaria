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
	it.each([
		["friendly", "Nov 1, 2026"],
		["us", "11/1/2026"],
		["european", "1/11/2026"],
		["iso", "2026-11-01"],
	] as const)(
		"keeps month/year headings with %s day labels",
		(format, dayLabel) => {
			render(
				<CalendarOverview
					anchor="2026-11-19"
					view="quarter"
					items={[]}
					locale="en"
					dateDisplayFormat={format}
					showWeekends
					today="2026-11-19"
					onSelectMonth={vi.fn()}
				/>,
			);
			expect(
				screen.getByRole("region", { name: "Nov 2026" }),
			).toBeInTheDocument();
			const day = screen.getByRole("button", { name: `${dayLabel}, 0` });
			expect(day).toHaveAttribute("title", `${dayLabel}: 0`);
		},
	);

	it("localizes month/year headings and day labels", () => {
		render(
			<CalendarOverview
				anchor="2026-11-19"
				view="quarter"
				items={[]}
				locale="it-IT"
				dateDisplayFormat="friendly"
				showWeekends
				today="2026-11-19"
				onSelectMonth={vi.fn()}
			/>,
		);
		expect(
			screen.getByRole("region", { name: "nov 2026" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "16 dic 2026, 0" }),
		).toHaveAttribute("title", "16 dic 2026: 0");
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
			screen.getByRole("button", { name: "Feb 3, 2026, 1" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Feb 5, 2026, 1" }),
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
		fireEvent.click(screen.getByRole("button", { name: "Nov 19, 2026, 0" }));
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
