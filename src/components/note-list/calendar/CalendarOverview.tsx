import { Button } from "@/components/ui/button";
import { type AppLocale, getLocaleDateLocale } from "../../../lib/i18n";
import {
	type DateDisplayFormat,
	formatDateValueForDisplay,
} from "../../../utils/dateDisplay";
import {
	addDays,
	type DayKey,
	dayKeyFromParts,
	dayOfMonth,
	isWeekend,
	weekdayLabels,
	weekStartForLocale,
} from "./calendarDates";
import type { CalendarItem } from "./calendarModel";

interface CalendarOverviewProps {
	anchor: DayKey;
	view: "quarter" | "year";
	items: CalendarItem[];
	locale: AppLocale;
	showWeekends: boolean;
	today: DayKey;
	dateDisplayFormat?: DateDisplayFormat;
	onSelectMonth: (day: DayKey) => void;
}

function monthName(day: DayKey, locale: AppLocale): string {
	const [year, month, date] = day.split("-").map(Number);
	return new Intl.DateTimeFormat(getLocaleDateLocale(locale), {
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(Date.UTC(year, month - 1, date)));
}

function monthItemCounts(
	first: DayKey,
	last: DayKey,
	items: CalendarItem[],
): Map<DayKey, number> {
	const counts = new Map<DayKey, number>();
	for (const item of items) {
		const from = item.start < first ? first : item.start;
		const to = item.end > last ? last : item.end;
		for (let day = from; day <= to; day = addDays(day, 1))
			counts.set(day, (counts.get(day) ?? 0) + 1);
	}
	return counts;
}

function weekdayColumn(
	day: DayKey,
	locale: AppLocale,
	showWeekends: boolean,
	weekdayIndexes: number[],
): number {
	const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
	const column = (weekday - weekStartForLocale(locale) + 7) % 7;
	return showWeekends ? column + 1 : weekdayIndexes.indexOf(column) + 1;
}

function monthDays(
	year: number,
	month: number,
	count: number,
	showWeekends: boolean,
): DayKey[] {
	return Array.from({ length: count }, (_, index) =>
		dayKeyFromParts({ year, month, day: index + 1 }),
	).filter((day) => showWeekends || !isWeekend(day));
}

function MonthOverview({
	month,
	items,
	locale,
	dateDisplayFormat,
	showWeekends,
	today,
	onSelectMonth,
}: Omit<CalendarOverviewProps, "anchor" | "view"> & { month: DayKey }) {
	const [year, monthNumber] = month.split("-").map(Number);
	const first = dayKeyFromParts({ year, month: monthNumber, day: 1 });
	const startOffset =
		(new Date(`${first}T00:00:00Z`).getUTCDay() -
			weekStartForLocale(locale) +
			7) %
		7;
	const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
	const last = dayKeyFromParts({ year, month: monthNumber, day: daysInMonth });
	const countByDay = monthItemCounts(first, last, items);
	const weekdays = weekdayLabels(
		Array.from({ length: 7 }, (_, index) =>
			addDays(first, index - startOffset),
		),
		locale,
	);
	const dayCount = showWeekends ? 7 : 5;
	const weekdayIndexes = showWeekends
		? Array.from({ length: 7 }, (_, index) => index)
		: weekdays
				.map(({ day }, index) => ({ day, index }))
				.filter(({ day }) => !isWeekend(day))
				.map(({ index }) => index);
	return (
		<section
			className="calendar-overview-month"
			aria-label={monthName(first, locale)}
		>
			<Button
				type="button"
				variant="ghost"
				className="calendar-overview-month__title"
				onClick={() => onSelectMonth(first)}
			>
				{monthName(first, locale)}
			</Button>
			<div
				className="calendar-overview-month__weekdays"
				style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))` }}
			>
				{weekdays
					.filter(({ day }) => showWeekends || !isWeekend(day))
					.map(({ day, label }) => (
						<span key={day}>{label}</span>
					))}
			</div>
			<div
				className="calendar-overview-month__days"
				style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))` }}
			>
				{monthDays(year, monthNumber, daysInMonth, showWeekends).map((day) => {
					const count = countByDay.get(day) ?? 0;
					const formattedDay = formatDateValueForDisplay(
						day,
						dateDisplayFormat ?? "friendly",
						locale,
					);
					const column = weekdayColumn(
						day,
						locale,
						showWeekends,
						weekdayIndexes,
					);
					return (
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							key={day}
							style={{ gridColumn: column }}
							className={`calendar-overview-day${day === today ? " calendar-overview-day--today" : ""}`}
							title={`${formattedDay}: ${count}`}
							onClick={() => onSelectMonth(day)}
							aria-label={`${formattedDay}, ${count}`}
						>
							<span>{dayOfMonth(day)}</span>
							{count > 0 && (
								<i className="calendar-overview-day__mark" aria-hidden="true" />
							)}
						</Button>
					);
				})}
			</div>
		</section>
	);
}

export function CalendarOverview(props: CalendarOverviewProps) {
	const [year, month] = props.anchor.split("-").map(Number);
	const firstMonth =
		props.view === "year" ? 1 : Math.floor((month - 1) / 3) * 3 + 1;
	const months = props.view === "year" ? 12 : 3;
	return (
		<div
			className={`calendar-overview calendar-overview--${props.view}`}
			data-testid={`calendar-overview-${props.view}`}
		>
			{Array.from({ length: months }, (_, index) => (
				<MonthOverview
					key={index}
					{...props}
					month={dayKeyFromParts({ year, month: firstMonth + index, day: 1 })}
				/>
			))}
		</div>
	);
}
