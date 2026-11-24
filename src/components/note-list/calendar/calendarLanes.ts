import type { DayKey } from "./calendarDates";
import type { CalendarSegment } from "./calendarModel";

/** Height of a day's number row, above the item stack. */
export const DAY_HEADER_PX = 30;
/** Space between the weekly header separator and the first card. */
export const WEEK_CARD_TOP_GAP_PX = 4;
export const LANE_GAP_PX = 3;
/** The "+N more" button's height (`!h-5`). */
export const MORE_BUTTON_PX = 20;
/** The week row's bottom border, which the item area does not get. */
const ROW_BORDER_PX = 1;
/** Breathing room kept under the last card of a day. */
const BOTTOM_GAP_PX = 4;
/** No card is shorter than this, so no card past `room / (this + gap)` can start inside a row. */
const SHORTEST_CARD_PX = 20;
/** A card's height before it has been measured (tests, first paint): one title line. */
const FALLBACK_CARD_PX = 26;
/** An unmeasured row's item area: three one-line cards and "+N more". */
const FALLBACK_AVAILABLE_PX =
	3 * (FALLBACK_CARD_PX + LANE_GAP_PX) + MORE_BUTTON_PX + BOTTOM_GAP_PX;
/** A normal day always shows this many cards before "+N more" (TOL-393). */
const MIN_SHOWN_CARDS = 2;

/** A week row's item area and each card's natural height, by note path. */
export interface StackMeasure {
	available: number;
	heights: ReadonlyMap<string, number>;
}

export interface StackedSegment {
	segment: CalendarSegment;
	/** Offset from the top of the row's item area. */
	top: number;
}

/** A day with a "+N more", with its column, count and offset under the day's last shown card. */
export interface DayOverflow {
	day: DayKey;
	column: number;
	count: number;
	top: number;
}

export interface WeekStack {
	visible: StackedSegment[];
	/** Bars behind "+N more". */
	hidden: CalendarSegment[];
	/** Items per day that did not fit. */
	hiddenCounts: number[];
	overflow: DayOverflow[];
	/** The smallest row that still shows two cards per day; 0 until measured. */
	minHeight: number;
}

interface StackInput {
	segments: CalendarSegment[];
	week: DayKey[];
	heightOf: (segment: CalendarSegment) => number;
	/** Height the cards and "+N more" may use. */
	room: number;
}

/** One day's stack while cards are placed. */
interface DayStack {
	day: DayKey;
	column: number;
	/** How low the day's cards may reach. */
	limit: number;
	/** Where the next card starts. */
	bottom: number;
	hidden: number;
}

/** The days a bar covers. */
function spannedDays<Day>(days: Day[], segment: CalendarSegment): Day[] {
	return days.slice(segment.startColumn, segment.startColumn + segment.span);
}

/** A bar starts under the lowest card of the days it covers, so it stays one straight bar. */
function topOf(days: { bottom: number }[]): number {
	return Math.max(0, ...days.map((day) => day.bottom));
}

function showOn(days: DayStack[], bottom: number): void {
	for (const day of days) day.bottom = bottom + LANE_GAP_PX;
}

function hideOn(days: DayStack[]): void {
	for (const day of days) day.hidden += 1;
}

interface Placement {
	visible: StackedSegment[];
	hidden: CalendarSegment[];
}

/** Stacks each day's cards top to bottom at natural height; a card that would pass its day's limit hides. */
function place(input: StackInput, days: DayStack[]): Placement {
	const placement: Placement = { visible: [], hidden: [] };
	for (const day of days) Object.assign(day, { bottom: 0, hidden: 0 });
	for (const segment of input.segments) {
		const spanned = spannedDays(days, segment);
		const top = topOf(spanned);
		const bottom = top + input.heightOf(segment);
		if (spanned.every((day) => bottom <= day.limit)) {
			placement.visible.push({ segment, top });
			showOn(spanned, bottom);
		} else {
			placement.hidden.push(segment);
			hideOn(spanned);
		}
	}
	return placement;
}

/**
 * A day that hides a card keeps room for "+N more" under its last shown card, which can hide more; repeat
 * until no new day overflows.
 */
function placeWithOverflow(input: StackInput, days: DayStack[]): Placement {
	const withMore = input.room - LANE_GAP_PX - MORE_BUTTON_PX;
	let placement = place(input, days);
	for (let pass = 0; pass < days.length; pass += 1) {
		const added = days.filter((day) => day.hidden > 0 && day.limit > withMore);
		if (added.length === 0) break;
		for (const day of added) day.limit = withMore;
		placement = place(input, days);
	}
	return placement;
}

interface DayDemand {
	bottom: number;
	count: number;
	/** Bottom of the day's second card (or its only one). */
	needed: number;
}

function recordCard(day: DayDemand, bottom: number): void {
	day.count += 1;
	day.bottom = bottom + LANE_GAP_PX;
	if (day.count <= MIN_SHOWN_CARDS) day.needed = bottom;
}

function demandOf(day: DayDemand): number {
	const more = day.count > MIN_SHOWN_CARDS ? LANE_GAP_PX + MORE_BUTTON_PX : 0;
	return day.needed + more;
}

/** The tallest day's first two cards, plus "+N more" when it holds more, over the day number and border. */
function minHeightFor(input: StackInput): number {
	const days = input.week.map(() => ({ bottom: 0, count: 0, needed: 0 }));
	for (const segment of input.segments) {
		const spanned = spannedDays(days, segment);
		const bottom = topOf(spanned) + input.heightOf(segment);
		for (const day of spanned) recordCard(day, bottom);
	}
	const tallest = Math.max(0, ...days.map(demandOf));
	return tallest > 0
		? DAY_HEADER_PX + ROW_BORDER_PX + tallest + BOTTOM_GAP_PX
		: 0;
}

/**
 * Fits a week's cards into its row (TOL-393): each day stacks as many cards as fit at their natural
 * height, and only the ones that don't fit go behind that day's "+N more".
 */
export function stackWeek(
	segments: CalendarSegment[],
	week: DayKey[],
	measure: StackMeasure,
): WeekStack {
	const measured = measure.available > 0;
	const input: StackInput = {
		segments,
		week,
		heightOf: (segment) =>
			measure.heights.get(segment.item.entry.path) || FALLBACK_CARD_PX,
		room:
			(measured ? measure.available : FALLBACK_AVAILABLE_PX) - BOTTOM_GAP_PX,
	};
	const days = week.map((day, column) => ({
		day,
		column,
		limit: input.room,
		bottom: 0,
		hidden: 0,
	}));
	const placement = placeWithOverflow(input, days);
	return {
		...placement,
		hiddenCounts: days.map((day) => day.hidden),
		overflow: days
			.filter((day) => day.hidden > 0)
			.map(({ day, column, hidden, bottom }) => ({
				day,
				column,
				count: hidden,
				top: bottom,
			})),
		minHeight: measured ? minHeightFor(input) : 0,
	};
}

/** Weekly view scrolls the full stack instead of folding cards into overflow. */
export function stackFullWeek(
	segments: CalendarSegment[],
	week: DayKey[],
	measure: StackMeasure,
): WeekStack {
	const layout = stackWeek(segments, week, { ...measure, available: Infinity });
	const bottom = layout.visible.reduce((maximum, { segment, top }) => {
		const height =
			measure.heights.get(segment.item.entry.path) || FALLBACK_CARD_PX;
		return Math.max(maximum, top + height);
	}, 0);
	return {
		...layout,
		minHeight:
			DAY_HEADER_PX +
			WEEK_CARD_TOP_GAP_PX +
			ROW_BORDER_PX +
			bottom +
			BOTTOM_GAP_PX,
	};
}

/** Lanes worth laying out (and measuring) for a row of `available` pixels. */
export function measurableLanes(available: number): number {
	if (available <= 0) return 4;
	return Math.floor(available / (SHORTEST_CARD_PX + LANE_GAP_PX)) + 2;
}
