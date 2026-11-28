import { useEffect, useRef } from "react";
import type { CalendarViewMode } from "../../../collections/collectionTypes";
import type { DayKey } from "./calendarDates";

export interface CalendarNavigation {
	previous: () => void;
	next: () => void;
	today: () => void;
	selectMonth: (day: DayKey) => void;
	setView: (view: CalendarViewMode) => void;
}

type NavigationAction =
	| "previous"
	| "next"
	| "today"
	| "month"
	| "week"
	| "year";

const NAVIGATION_KEYS = new Map<string, NavigationAction>([
	["ArrowLeft", "previous"],
	["ArrowRight", "next"],
	["t", "today"],
	["m", "month"],
	["w", "week"],
	["y", "year"],
]);

/** Keys typed into fields, the editor panel, or open menus and dialogs never move the calendar. */
const IGNORED_TARGETS =
	'input, textarea, select, [contenteditable="true"], .app__editor, [role="dialog"], [role="menu"], [role="listbox"]';

function hasModifier(event: KeyboardEvent): boolean {
	return event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
}

function navigationAction(event: KeyboardEvent): NavigationAction | undefined {
	if (event.defaultPrevented || hasModifier(event)) return undefined;
	if (event.target instanceof Element && event.target.closest(IGNORED_TARGETS))
		return undefined;
	return (
		NAVIGATION_KEYS.get(event.key) ??
		NAVIGATION_KEYS.get(event.key.toLowerCase())
	);
}

function runNavigation(
	navigation: CalendarNavigation,
	action: NavigationAction,
) {
	switch (action) {
		case "previous":
			navigation.previous();
			break;
		case "next":
			navigation.next();
			break;
		case "today":
			navigation.today();
			break;
		case "month":
		case "week":
		case "year":
			navigation.setView(action);
			break;
	}
}

/** ←/→ move a period, T jumps to today, and M/W/Y switch views. */
export function useCalendarShortcuts(navigation: CalendarNavigation) {
	const latest = useRef(navigation);
	useEffect(() => {
		latest.current = navigation;
	});
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const action = navigationAction(event);
			if (!action) return;
			event.preventDefault();
			runNavigation(latest.current, action);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);
}
