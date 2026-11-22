import { type AppLocale, getLocaleDateLocale } from "../../../lib/i18n";
import { formatDateValueForDisplay, type DateDisplayFormat } from "../../../utils/dateDisplay";
import {
	type DateParts,
	parseDashDateParts,
	parseSlashDateParts,
} from "../../../utils/dateStringParts";

/** A calendar day as `YYYY-MM-DD`, independent of time zones and daylight saving. */
export type DayKey = string;
export type CalendarView = "month" | "week" | "quarter" | "year";
/** 0 = Sunday … 6 = Saturday, like `Date.getDay()`. */
export type Weekday = number;

const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
const SUNDAY: Weekday = 0;
const MONDAY: Weekday = 1;
const SATURDAY: Weekday = 6;

/** App locales whose CLDR week starts on Sunday; every other app locale starts on Monday. */
const SUNDAY_FIRST_LOCALES: ReadonlySet<AppLocale> = new Set<AppLocale>([
	"en",
	"pt-BR",
	"pt-PT",
	"zh-TW",
	"ja-JP",
	"ko-KR",
	"id-ID",
]);

function pad(value: number, length: number): string {
	return String(value).padStart(length, "0");
}

export function dayKeyFromParts({ year, month, day }: DateParts): DayKey {
	return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function partsFromKey(key: DayKey): DateParts {
	const [year, month, day] = key.split("-").map(Number);
	return { year, month, day };
}

/** Days since 1970-01-01, so day arithmetic never crosses a daylight-saving hour. */
export function dayNumber(key: DayKey): number {
	const { year, month, day } = partsFromKey(key);
	return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function dayKeyFromNumber(value: number): DayKey {
	const date = new Date(value * MS_PER_DAY);
	return dayKeyFromParts({
		year: date.getUTCFullYear(),
		month: date.getUTCMonth() + 1,
		day: date.getUTCDate(),
	});
}

export function addDays(key: DayKey, amount: number): DayKey {
	return dayKeyFromNumber(dayNumber(key) + amount);
}

export function daysBetween(from: DayKey, to: DayKey): number {
	return dayNumber(to) - dayNumber(from);
}

export function localDayKey(date: Date): DayKey {
	return dayKeyFromParts({
		year: date.getFullYear(),
		month: date.getMonth() + 1,
		day: date.getDate(),
	});
}

export function weekdayOf(key: DayKey): Weekday {
	return new Date(dayNumber(key) * MS_PER_DAY).getUTCDay();
}

export function isWeekend(key: DayKey): boolean {
	const weekday = weekdayOf(key);
	return weekday === SATURDAY || weekday === SUNDAY;
}

export function weekStartForLocale(locale: AppLocale): Weekday {
	return SUNDAY_FIRST_LOCALES.has(locale) ? SUNDAY : MONDAY;
}

export function startOfWeek(key: DayKey, weekStart: Weekday): DayKey {
	const offset = (weekdayOf(key) - weekStart + DAYS_PER_WEEK) % DAYS_PER_WEEK;
	return addDays(key, -offset);
}

function shiftMonth(key: DayKey, amount: number): DayKey {
	const { year, month } = partsFromKey(key);
	const index = year * 12 + (month - 1) + amount;
	return dayKeyFromParts({
		year: Math.floor(index / 12),
		month: (index % 12) + 1,
		day: 1,
	});
}

export function isSameMonth(left: DayKey, right: DayKey): boolean {
	return left.slice(0, 7) === right.slice(0, 7);
}

function weekOf(start: DayKey): DayKey[] {
	return Array.from({ length: DAYS_PER_WEEK }, (_, index) =>
		addDays(start, index),
	);
}

/** The week rows a view shows: every week that touches the anchor's month, or just the anchor's week. */
export function visibleWeeks(
	anchor: DayKey,
	view: CalendarView,
	weekStart: Weekday,
): DayKey[][] {
	if (view === "week") return [weekOf(startOfWeek(anchor, weekStart))];
	const parts = partsFromKey(anchor);
	const startMonth =
		view === "quarter"
			? Math.floor((parts.month - 1) / 3) * 3 + 1
			: view === "year"
				? 1
				: parts.month;
	const endMonth =
		view === "quarter" ? startMonth + 3 : view === "year" ? 13 : startMonth + 1;
	const periodStart = dayKeyFromParts({
		year: parts.year,
		month: startMonth,
		day: 1,
	});
	const last = addDays(
		dayKeyFromParts({ year: parts.year, month: endMonth, day: 1 }),
		-1,
	);
	const weeks: DayKey[][] = [];
	for (
		let start = startOfWeek(periodStart, weekStart);
		start <= last;
		start = addDays(start, DAYS_PER_WEEK)
	) {
		weeks.push(weekOf(start));
	}
	return weeks;
}

export function shiftAnchor(
	anchor: DayKey,
	view: CalendarView,
	direction: number,
): DayKey {
	if (view === "week") return addDays(anchor, direction * DAYS_PER_WEEK);
	if (view === "quarter") return shiftMonth(anchor, direction * 3);
	if (view === "year") return shiftMonth(anchor, direction * 12);
	return shiftMonth(anchor, direction);
}

function utcDate(key: DayKey): Date {
	return new Date(dayNumber(key) * MS_PER_DAY);
}

function formatter(
	locale: AppLocale,
	options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
	return new Intl.DateTimeFormat(getLocaleDateLocale(locale), {
		...options,
		timeZone: "UTC",
	});
}

function formatWeekRange(days: DayKey[], locale: AppLocale, dateDisplayFormat: DateDisplayFormat): string {
	if (dateDisplayFormat !== "friendly")
		return `${formatDateValueForDisplay(days[0], dateDisplayFormat, locale)} – ${formatDateValueForDisplay(days[days.length - 1], dateDisplayFormat, locale)}`;
	const format = formatter(locale, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
	const first = utcDate(days[0]);
	const last = utcDate(days[days.length - 1]);
	if (typeof format.formatRange !== "function")
		return `${format.format(first)} – ${format.format(last)}`;
	return format.formatRange(first, last);
}

/**
 * The toolbar title: "November 2026" in month view, the shown days in week view ("Nov 16 – 22, 2026",
 * or "Nov 16 – 20, 2026" without weekends), localized.
 */

interface CalendarTitleOptions {
	anchor: DayKey;
	shownWeek: DayKey[];
	view: CalendarView;
	locale: AppLocale;
	dateDisplayFormat?: DateDisplayFormat;
}

export function calendarTitle({
	anchor,
	shownWeek,
	view,
	locale,
	dateDisplayFormat = "friendly",
}: CalendarTitleOptions): string {
	if (view === "week") return formatWeekRange(shownWeek, locale, dateDisplayFormat);
	if (view === "quarter") {
		const { year, month } = partsFromKey(anchor);
		const firstMonth = Math.floor((month - 1) / 3) * 3 + 1;
		const start = utcDate(dayKeyFromParts({ year, month: firstMonth, day: 1 }));
		const end = utcDate(
			dayKeyFromParts({
				year,
				month: firstMonth + 2,
				day: new Date(Date.UTC(year, firstMonth + 2, 0)).getUTCDate(),
			}),
		);
		if (dateDisplayFormat !== "friendly")
			return `${formatDateValueForDisplay(dayKeyFromParts({ year, month: firstMonth, day: 1 }), dateDisplayFormat, locale)} – ${formatDateValueForDisplay(dayKeyFromParts({ year, month: firstMonth + 3, day: 0 }), dateDisplayFormat, locale)}`;
		const format = formatter(locale, {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
		return typeof format.formatRange === "function"
			? format.formatRange(start, end)
			: `${format.format(start)} – ${format.format(end)}`;
	}
	if (view === "year")
		return formatter(locale, { year: "numeric" }).format(utcDate(anchor));
	return formatter(locale, { month: "long", year: "numeric" }).format(
		utcDate(anchor),
	);
}

export function weekdayLabels(
	days: DayKey[],
	locale: AppLocale,
): { day: DayKey; label: string }[] {
	const format = formatter(locale, { weekday: "short" });
	return days.map((day) => ({ day, label: format.format(utcDate(day)) }));
}

export function dayOfMonth(key: DayKey): number {
	return partsFromKey(key).day;
}

export function monthDayLabel(key: DayKey, locale: AppLocale): string {
	return formatter(locale, { month: "short", day: "numeric" }).format(
		utcDate(key),
	);
}

export function fullDayLabel(key: DayKey, locale: AppLocale): string {
	return formatter(locale, {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	}).format(utcDate(key));
}

/** What a property value means to the calendar: a day, nothing at all, or something that is not a date. */
export type ParsedCalendarDate =
	| { kind: "day"; day: DayKey }
	| { kind: "empty" }
	| { kind: "invalid" };

const EMPTY_DATE: ParsedCalendarDate = { kind: "empty" };
const INVALID_DATE: ParsedCalendarDate = { kind: "invalid" };

function dayDate(parts: DateParts): ParsedCalendarDate {
	return { kind: "day", day: dayKeyFromParts(parts) };
}

function parseDateText(text: string): ParsedCalendarDate {
	if (text === "") return EMPTY_DATE;
	const parts = parseDashDateParts(text) ?? parseSlashDateParts(text);
	if (!parts) return INVALID_DATE;
	return dayDate(parts);
}

export function parseCalendarDate(value: unknown): ParsedCalendarDate {
	if (value === null || value === undefined) return EMPTY_DATE;
	if (typeof value !== "string") return INVALID_DATE;
	return parseDateText(value.trim());
}

/** Rewrites a stored date to a new day, keeping any time-of-day suffix of an ISO value. */
export function rescheduledValue(original: unknown, day: DayKey): string {
	if (typeof original !== "string") return day;
	const text = original.trim();
	const timeIndex = text.indexOf("T");
	if (timeIndex === 10 && parseDashDateParts(text))
		return `${day}${text.slice(timeIndex)}`;
	return day;
}
