import "./CalendarLayout.css";
import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CalendarViewMode } from "../../../collections/collectionTypes";
import type {
	CalendarLayoutBindings,
	CollectionLayoutSharedProps,
} from "../../../collections/layoutRegistry";
import { useDateDisplayFormat } from "../../../hooks/useAppPreferences";
import { type AppLocale, translate } from "../../../lib/i18n";
import { trackEvent } from "../../../lib/telemetry";
import type { VaultEntry } from "../../../types";
import { useKanbanSensors } from "../useKanbanDrag";
import { CalendarEmptyState } from "./CalendarEmptyState";
import { CalendarGrid, type CalendarGridState } from "./CalendarGrid";
import { type CalendarItemContext, CalendarItemFace } from "./CalendarItem";
import { CalendarOverview } from "./CalendarOverview";
import { CalendarToolbar, CalendarTrayToggle } from "./CalendarToolbar";
import { CalendarTray } from "./CalendarTray";
import {
	calendarTitle,
	type DayKey,
	isWeekend,
	localDayKey,
	visibleWeeks,
	weekStartForLocale,
} from "./calendarDates";
import {
	type CalendarSources,
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
import { useCalendarNavigation } from "./useCalendarNavigation";

export interface CalendarLayoutProps extends CollectionLayoutSharedProps {
	calendar: CalendarLayoutBindings;
}

interface CalendarBoardProps extends CalendarLayoutProps {
	dateProperty: string;
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
			showProperties: true,
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

function useCalendarBoardModel(props: CalendarBoardProps) {
	const { entries, calendar, locale, dateProperty, selectedNotePath } = props;
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
	const viewport = useCalendarNavigation(calendar);
	const { anchor, view, visibleDay } = viewport;
	const weeks = useMemo(
		() => shownWeeks(anchor, view, locale, settings.showWeekends),
		[anchor, locale, settings.showWeekends, view],
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
		anchor: visibleDay,
		monthView: view === "month",
		view,
		selectedNotePath,
		droppedPath: drag.droppedPath,
		preview: drag.preview,
		canCreate: calendar.canReschedule,
		onCreate,
	};
	return { context, drag, gridState, partition, viewport, weeks };
}

interface CalendarPanelsProps {
	board: CalendarBoardProps;
	model: ReturnType<typeof useCalendarBoardModel>;
}

function CalendarSurface({ board, model }: CalendarPanelsProps) {
	const dateDisplayFormat = useDateDisplayFormat();
	const {
		locale,
		calendar: { settings },
	} = board;
	const { context, gridState, partition, viewport, weeks } = model;
	const {
		anchor,
		navigation,
		onVisibleWeek,
		revision,
		view,
		visibleDay,
		visibleWeek,
	} = viewport;
	return (
		<div className="calendar-surface flex min-h-0 min-w-0 flex-1 flex-col">
			<CalendarToolbar
				title={calendarTitle({ anchor: visibleDay, shownWeek: visibleWeek ?? weeks[0], view, locale, dateDisplayFormat })}
				view={view}
				locale={locale}
				navigation={navigation}
			/>
			{view === "year" ? (
				<CalendarOverview
					anchor={anchor}
					view={view}
					items={partition.items}
					locale={locale}
					dateDisplayFormat={dateDisplayFormat}
					showWeekends={settings.showWeekends}
					today={gridState.today}
					onSelectMonth={navigation.selectMonth}
				/>
			) : (
				<CalendarGrid
					key={`${view}:${revision}:${locale}:${settings.showWeekends}`}
					weeks={weeks}
					items={partition.items}
					context={context}
					state={gridState}
					locale={locale}
					onVisibleWeek={onVisibleWeek}
				/>
			)}
		</div>
	);
}

function CalendarPanels({ board, model }: CalendarPanelsProps) {
	const { context, partition } = model;
	const { dateProperty, locale, selectedNotePath } = board;
	const [trayOpen, setTrayOpen] = useState(true);
	return (
		<section
			className="calendar-board flex min-h-0 flex-1 gap-3 px-3 pb-3"
			aria-label={translate(locale, "calendar.gridLabel", {
				property: dateProperty,
			})}
			data-testid="calendar-board"
		>
			<CalendarSurface board={board} model={model} />
			{trayOpen ? (
				<CalendarTray
					unscheduled={partition.unscheduled}
					invalid={partition.invalid}
					dateProperty={dateProperty}
					context={context}
					locale={locale}
					selectedNotePath={selectedNotePath}
					onClose={() => setTrayOpen(false)}
				/>
			) : (
				<CalendarTrayToggle
					count={partition.unscheduled.length + partition.invalid.length}
					locale={locale}
					onOpen={() => setTrayOpen(true)}
				/>
			)}
		</section>
	);
}

function CalendarBoard(props: CalendarBoardProps) {
	const model = useCalendarBoardModel(props);
	const { context, drag } = model;
	return (
		<DndContext
			sensors={useKanbanSensors()}
			collisionDetection={pointerWithin}
			onDragStart={drag.onDragStart}
			onDragOver={drag.onDragOver}
			onDragEnd={drag.onDragEnd}
			onDragCancel={drag.onDragCancel}
		>
			<CalendarPanels board={props} model={model} />
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
	const { dateProperty } = props.calendar;
	if (!dateProperty)
		return (
			<CalendarEmptyState calendar={props.calendar} locale={props.locale} />
		);
	return <CalendarBoard {...props} dateProperty={dateProperty} />;
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
