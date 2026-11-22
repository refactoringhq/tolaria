import "./CalendarLayout.css";
import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CalendarViewMode } from "../../../collections/collectionTypes";
import type {
	CalendarLayoutBindings,
	CollectionLayoutSharedProps,
} from "../../../collections/layoutRegistry";
import { type AppLocale, translate } from "../../../lib/i18n";
import { useDateDisplayFormat } from "../../../hooks/useAppPreferences";
import type { DateDisplayFormat } from "../../../utils/dateDisplay";
import { trackEvent } from "../../../lib/telemetry";
import type { VaultEntry } from "../../../types";
import { useKanbanSensors } from "../useKanbanDrag";
import { CalendarEmptyState } from "./CalendarEmptyState";
import { CalendarGrid, type CalendarGridState } from "./CalendarGrid";
import { type CalendarItemContext, CalendarItemFace } from "./CalendarItem";
import { CalendarOverview } from "./CalendarOverview";
import { CalendarToolbar } from "./CalendarToolbar";
import { CalendarTray } from "./CalendarTray";
import {
	calendarTitle,
	type DayKey,
	isWeekend,
	localDayKey,
	shiftAnchor,
	visibleWeeks,
	weekStartForLocale,
} from "./calendarDates";
import {
	type CalendarItem,
	type CalendarSources,
	itemsInRange,
	partitionEntries,
	rescheduleWrites,
} from "./calendarModel";
import {
	type LatestDateWriter,
	type LatestDateWriterRef,
	writeDatesInOrder,
} from "./sequentialDateWrites";
import {
	type CalendarActiveDrag,
	type CalendarDrop,
	useCalendarDrag,
	usePendingDates,
} from "./useCalendarDrag";
import {
	type CalendarNavigation,
	useCalendarShortcuts,
} from "./useCalendarShortcuts";

export interface CalendarLayoutProps extends CollectionLayoutSharedProps {
	calendar: CalendarLayoutBindings;
}

interface CalendarBoardProps extends CalendarLayoutProps {
	dateProperty: string;
	dateDisplayFormat: DateDisplayFormat;
}

function shownWeeks(
	anchor: DayKey,
	view: CalendarViewMode,
	locale: AppLocale,
	showWeekends: boolean,
): DayKey[][] {
	const weeks = visibleWeeks(anchor, view, weekStartForLocale(locale));
	return showWeekends
		? weeks
		: weeks.map((week) => week.filter((day) => !isWeekend(day)));
}

/** A stable function that always calls the latest handler, so memoized rows and cells skip re-rendering. */
function useLatestCallback<Args extends unknown[]>(
	handler: (...args: Args) => void,
): (...args: Args) => void {
	const latest = useRef(handler);
	useLayoutEffect(() => {
		latest.current = handler;
	});
	return useCallback((...args: Args) => latest.current(...args), []);
}

function lastShownDay(weeks: DayKey[][]): DayKey {
	const lastWeek = weeks[weeks.length - 1];
	return lastWeek[lastWeek.length - 1];
}

function useCalendarNavigation(calendar: CalendarLayoutBindings) {
	const [anchor, setAnchor] = useState(() => localDayKey(new Date()));
	const { view } = calendar.settings;
	const navigation = useMemo<CalendarNavigation>(
		() => ({
			previous: () => setAnchor((current) => shiftAnchor(current, view, -1)),
			next: () => setAnchor((current) => shiftAnchor(current, view, 1)),
			today: () => setAnchor(localDayKey(new Date())),
			selectMonth: (day: DayKey) => {
				setAnchor(day);
				if (view !== "month") calendar.onSettingsChange({ view: "month" });
			},
			setView: (next) => {
				if (next === view) return;
				trackEvent("calendar_view_changed", { view: next });
				calendar.onSettingsChange({ view: next });
			},
		}),
		[calendar, view],
	);
	useCalendarShortcuts(navigation);
	return { anchor, navigation };
}

function useItemContext(props: CalendarBoardProps): CalendarItemContext {
	const {
		properties,
		allEntries,
		typeEntryMap,
		displayPropsOverride,
		locale,
		calendar,
	} = props;
	const showIcons = calendar.settings.showIcons;
	const showProperties = props.showProperties !== false;
	const onOpen = useLatestCallback(props.onOpen);
	return useMemo(
		() => ({
			cardProperties: properties,
			allEntries,
			typeEntryMap,
			displayPropsOverride,
			itemRole: translate(locale, "layout.cardRole"),
			draggable: calendar.canReschedule,
			showIcons,
			showProperties,
			onOpen,
		}),
		[
			allEntries,
			calendar.canReschedule,
			displayPropsOverride,
			locale,
			onOpen,
			properties,
			showIcons,
			showProperties,
			typeEntryMap,
		],
	);
}

/**
 * The newest vault entries and date writer, so a range's second write never uses a writer from before the
 * first. Every vault entry, not just the list's, so a filtered View that drops the note still sees the write.
 */
function useLatestDateWriter(
	entries: VaultEntry[],
	calendar: CalendarLayoutBindings,
): LatestDateWriterRef {
	const latest = useRef<LatestDateWriter>({
		entries,
		writeDate: calendar.onWriteDate,
	});
	useLayoutEffect(() => {
		latest.current = { entries, writeDate: calendar.onWriteDate };
	});
	return latest;
}

function useDropHandler(latest: LatestDateWriterRef, sources: CalendarSources) {
	return useCallback(
		({ item, next, fromTray }: CalendarDrop) => {
			trackEvent("calendar_note_rescheduled", {
				source: fromTray ? "tray" : "grid",
				range: item.start !== item.end ? 1 : 0,
			});
			const scheduled = fromTray
				? { ...item, start: next.start, end: next.start }
				: item;
			void writeDatesInOrder(
				item.entry,
				rescheduleWrites(scheduled, next, sources),
				latest,
			);
		},
		[latest, sources],
	);
}

function DragPreview({
	active,
	context,
}: {
	active: CalendarActiveDrag | null;
	context: CalendarItemContext;
}) {
	if (!active) return null;
	return (
		<div className="calendar-drag-lift">
			<CalendarItemFace
				entry={active.item.entry}
				context={context}
				className="calendar-item--lifted"
			/>
		</div>
	);
}

function CalendarBoard(props: CalendarBoardProps) {
	const { entries, calendar, locale, dateProperty, selectedNotePath, dateDisplayFormat } = props;
	const { settings } = calendar;
	const sources = useMemo<CalendarSources>(
		() => ({ dateProperty, endDateProperty: settings.endDateProperty }),
		[dateProperty, settings.endDateProperty],
	);
	const [pending, setPending] = usePendingDates(entries, sources);
	const partition = useMemo(
		() => partitionEntries(entries, sources, pending),
		[entries, pending, sources],
	);
	const { anchor, navigation } = useCalendarNavigation(calendar);
	const [trayOpen, setTrayOpen] = useState(true);
	const weeks = useMemo(
		() => shownWeeks(anchor, settings.view, locale, settings.showWeekends),
		[anchor, locale, settings.showWeekends, settings.view],
	);
	const visibleItems = useMemo<CalendarItem[]>(
		() => itemsInRange(partition.items, weeks[0][0], lastShownDay(weeks)),
		[partition.items, weeks],
	);
	const context = useItemContext(props);
	const latestWriter = useLatestDateWriter(props.allEntries, calendar);
	const drag = useCalendarDrag({
		setPending,
		onDrop: useDropHandler(latestWriter, sources),
	});
	const onCreate = useLatestCallback(calendar.onCreate);
	const gridState: CalendarGridState = {
		today: localDayKey(new Date()),
		anchor,
		monthView: settings.view === "month",
		view: settings.view,
		selectedNotePath,
		droppedPath: drag.droppedPath,
		preview: drag.preview,
		canCreate: calendar.canReschedule,
		onCreate,
	};
	const trayCount = partition.unscheduled.length + partition.invalid.length;

	return (
		<DndContext
			sensors={useKanbanSensors()}
			collisionDetection={pointerWithin}
			onDragStart={drag.onDragStart}
			onDragOver={drag.onDragOver}
			onDragEnd={drag.onDragEnd}
			onDragCancel={drag.onDragCancel}
		>
			<section
				className="calendar-board flex min-h-0 flex-1 flex-col"
				aria-label={translate(locale, "calendar.gridLabel", {
					property: dateProperty,
				})}
				data-testid="calendar-board"
			>
				<CalendarToolbar
					title={calendarTitle({ anchor, shownWeek: weeks[0], view: settings.view, locale, dateDisplayFormat })}
					view={settings.view}
					locale={locale}
					navigation={navigation}
					trayCount={trayCount}
					trayOpen={trayOpen}
					onToggleTray={() => setTrayOpen((open) => !open)}
				/>
				<div className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
					{settings.view === "quarter" || settings.view === "year" ? (
						<CalendarOverview
							anchor={anchor}
							view={settings.view}
							items={partition.items}
							locale={locale}
							showWeekends={settings.showWeekends}
							today={gridState.today}
							onSelectMonth={navigation.selectMonth}
						/>
					) : (
						<CalendarGrid
							weeks={weeks}
							items={visibleItems}
							context={context}
							state={gridState}
							locale={locale}
						/>
					)}
					{trayOpen && (
						<CalendarTray
							unscheduled={partition.unscheduled}
							invalid={partition.invalid}
							dateProperty={dateProperty}
							context={context}
							locale={locale}
							selectedNotePath={selectedNotePath}
							onClose={() => setTrayOpen(false)}
						/>
					)}
				</div>
			</section>
			{createPortal(
				<DragOverlay dropAnimation={null} zIndex={12000}>
					<DragPreview active={drag.active} context={context} />
				</DragOverlay>,
				document.body,
			)}
		</DndContext>
	);
}

/** Notes placed on the days of a date property, in a month or week grid (TOL-381). */
export function CalendarLayout(props: CalendarLayoutProps) {
	const dateDisplayFormat = useDateDisplayFormat();
	const { dateProperty } = props.calendar;
	if (!dateProperty)
		return (
			<CalendarEmptyState calendar={props.calendar} locale={props.locale} />
		);
	return <CalendarBoard {...props} dateProperty={dateProperty} dateDisplayFormat={dateDisplayFormat} />;
}

/** The configured date property has no values in this list. */
export function CalendarMissingProperty({
	calendar,
	locale,
	property,
}: {
	calendar: CalendarLayoutBindings;
	locale: AppLocale;
	property: string;
}) {
	return (
		<CalendarEmptyState
			calendar={calendar}
			locale={locale}
			property={property}
		/>
	);
}
