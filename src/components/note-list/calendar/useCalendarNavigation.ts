import { createContext, useCallback, useMemo, useState } from "react";
import type { CalendarLayoutBindings } from "../../../collections/layoutRegistry";
import { trackEvent } from "../../../lib/telemetry";
import { type DayKey, localDayKey, shiftAnchor } from "./calendarDates";
import {
	type CalendarNavigation,
	useCalendarShortcuts,
} from "./useCalendarShortcuts";

export const CalendarHeaderSlot = createContext<HTMLElement | null>(null);

interface CalendarPosition {
	anchor: DayKey;
	revision: number;
	visibleWeek: DayKey[] | null;
}

function today() {
	return localDayKey(new Date());
}

export function useCalendarNavigation(calendar: CalendarLayoutBindings) {
	const [position, setPosition] = useState<CalendarPosition>(() => ({
		anchor: today(),
		revision: 0,
		visibleWeek: null,
	}));
	const { anchor, revision, visibleWeek } = position;
	// Older vaults can still contain Quarter. Use the supported overview for those saved layouts.
	const view =
		calendar.settings.view === "quarter" ? "year" : calendar.settings.view;
	const visibleDay = visibleWeek?.at(-1) ?? anchor;
	const jumpTo = useCallback((day: DayKey) => {
		setPosition(({ revision }) => ({
			anchor: day,
			revision: revision + 1,
			visibleWeek: null,
		}));
	}, []);
	const onVisibleWeek = useCallback((week: DayKey[]) => {
		setPosition((current) =>
			current.visibleWeek?.[0] === week[0]
				? current
				: { ...current, visibleWeek: week },
		);
	}, []);
	const navigation = useMemo<CalendarNavigation>(
		() => ({
			previous: () => jumpTo(shiftAnchor(visibleDay, view, -1)),
			next: () => jumpTo(shiftAnchor(visibleDay, view, 1)),
			today: () => jumpTo(today()),
			selectMonth: (day) => {
				jumpTo(day);
				calendar.onSettingsChange({ view: "month" });
			},
			setView: (next) => {
				if (next === view) return;
				jumpTo(visibleDay);
				trackEvent("calendar_view_changed", { view: next });
				calendar.onSettingsChange({ view: next });
			},
		}),
		[calendar, jumpTo, view, visibleDay],
	);
	useCalendarShortcuts(navigation);
	return {
		anchor,
		navigation,
		onVisibleWeek,
		revision,
		view,
		visibleDay,
		visibleWeek,
	};
}
