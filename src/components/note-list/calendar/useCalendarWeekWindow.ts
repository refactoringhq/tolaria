import { type UIEvent, useLayoutEffect, useRef, useState } from "react";
import { addDays, type DayKey } from "./calendarDates";

const BUFFER_WEEKS = 6;
const MAX_WEEKS = 48;
const LOAD_AHEAD_PX = 80;

type Week = DayKey[];
type Direction = "previous" | "next";

interface ScrollAnchor {
	week: DayKey;
	inset: number;
}

function weekRows(scroller: HTMLDivElement) {
	return Array.from(
		scroller.querySelectorAll<HTMLElement>(":scope > [data-week-start]"),
	);
}

function visibleRow(rows: HTMLElement[], offset: number) {
	return (
		rows.find((row) => row.offsetTop + row.offsetHeight > offset) ?? rows.at(-1)
	);
}

function loadDirection(
	scroller: HTMLDivElement,
	rows: HTMLElement[],
): Direction | null {
	const first = rows[0];
	const last = rows.at(-1);
	if (!first || !last) return null;
	if (scroller.scrollTop < first.offsetTop - 1) return "previous";
	const viewportEnd = scroller.scrollTop + scroller.clientHeight;
	return last.offsetTop + last.offsetHeight - viewportEnd < LOAD_AHEAD_PX
		? "next"
		: null;
}

function extendWeeks(weeks: Week[], direction: Direction): Week[] {
	const backwards = direction === "previous";
	const edge = backwards ? weeks[0] : weeks[weeks.length - 1];
	const buffer = Array.from({ length: BUFFER_WEEKS }, (_, index) => {
		const offset = backwards ? index - BUFFER_WEEKS : index + 1;
		return edge.map((day) => addDays(day, offset * 7));
	});
	return backwards
		? [...buffer, ...weeks].slice(0, MAX_WEEKS)
		: [...weeks, ...buffer].slice(-MAX_WEEKS);
}

function restoreScroll(scroller: HTMLDivElement, anchor: ScrollAnchor) {
	const row = weekRows(scroller).find(
		(row) => row.dataset.weekStart === anchor.week,
	);
	if (row) scroller.scrollTop = row.offsetTop - anchor.inset;
}

function visibleWeekFor(
	scroller: HTMLDivElement,
	rows: HTMLElement[],
	weeks: Week[],
	weekView: boolean,
) {
	const offset =
		scroller.scrollTop + (weekView ? scroller.clientHeight / 2 : 1);
	const row = visibleRow(rows, offset);
	return weeks.find(([start]) => start === row?.dataset.weekStart);
}

function extensionAtViewport(scroller: HTMLDivElement, rows: HTMLElement[]) {
	const direction = loadDirection(scroller, rows);
	if (!direction) return null;
	const row = visibleRow(rows, scroller.scrollTop);
	if (!row?.dataset.weekStart) return null;
	return {
		direction,
		anchor: {
			week: row.dataset.weekStart,
			inset: row.offsetTop - scroller.scrollTop,
		},
	};
}

function useWeekBuffer(initialWeeks: Week[]) {
	const [weeks, setWeeks] = useState(initialWeeks);
	const scrollerRef = useRef<HTMLDivElement>(null);
	const restore = useRef<ScrollAnchor | null>(null);

	useLayoutEffect(() => {
		const scroller = scrollerRef.current;
		if (!scroller) return;
		if (restore.current) {
			restoreScroll(scroller, restore.current);
			restore.current = null;
			return;
		}
		if (weeks !== initialWeeks || !scroller.clientHeight) return;
		const initialAnchor = { week: initialWeeks[0][0], inset: 0 };
		restoreScroll(scroller, initialAnchor);
		const frame = requestAnimationFrame(() => {
			if (restore.current) return;
			restore.current = initialAnchor;
			setWeeks(extendWeeks(extendWeeks(initialWeeks, "previous"), "next"));
		});
		return () => cancelAnimationFrame(frame);
	}, [initialWeeks, weeks]);
	function extend({
		anchor,
		direction,
	}: {
		anchor: ScrollAnchor;
		direction: Direction;
	}) {
		restore.current = anchor;
		setWeeks((current) => extendWeeks(current, direction));
	}

	return { weeks, scrollerRef, restore, extend };
}

/** Keep the same week at the same pixel when adding dates or dropping distant rows. */
export function useCalendarWeekWindow(
	initialWeeks: Week[],
	weekView: boolean,
	onVisibleWeek: (week: Week) => void,
) {
	const { weeks, scrollerRef, restore, extend } = useWeekBuffer(initialWeeks);

	function onScroll(event: UIEvent<HTMLDivElement>) {
		const scroller = event.currentTarget;
		if (weeks === initialWeeks || restore.current) return;
		if (!scroller.clientHeight) return;
		const rows = weekRows(scroller);
		const week = visibleWeekFor(scroller, rows, weeks, weekView);
		if (week) onVisibleWeek(week);

		const extension = extensionAtViewport(scroller, rows);
		if (extension) extend(extension);
	}

	return { weeks, scrollerRef, onScroll };
}
