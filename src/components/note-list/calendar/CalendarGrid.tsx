import { useDndMonitor, useDroppable } from "@dnd-kit/core";
import { Plus } from "@phosphor-icons/react";
import { type CSSProperties, memo, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { type AppLocale, translate } from "../../../lib/i18n";
import {
	CalendarItemButton,
	type CalendarItemContext,
	CalendarItemGhost,
} from "./CalendarItem";
import {
	type DayKey,
	dayOfMonth,
	fullDayLabel,
	isWeekend,
	monthDayLabel,
	weekdayLabels,
} from "./calendarDates";
import { DAY_HEADER_PX, measurableLanes, stackWeek } from "./calendarLanes";
import {
	type CalendarItem,
	type CalendarSegment,
	itemsOnDay,
	weekSegments,
} from "./calendarModel";
import { dayDropId } from "./useCalendarDrag";
import { useLaneMeasure } from "./useLaneMeasure";

const MIN_WEEK_ROW_PX = 150;

export interface CalendarGridState {
	today: DayKey;
	/** Any day in the month being shown; days outside it are muted. */
	anchor: DayKey;
	monthView: boolean;
	view?: string;
	selectedNotePath?: string | null;
	droppedPath: string | null;
	/** Days the dragged note would cover if dropped now. */
	preview: { start: DayKey; end: DayKey } | null;
	canCreate: boolean;
	onCreate: (day: DayKey) => void;
}

interface CalendarGridProps {
	weeks: DayKey[][];
	items: CalendarItem[];
	context: CalendarItemContext;
	state: CalendarGridState;
	locale: AppLocale;
}

/** Per-row state as primitives, so a memoized row only re-renders when something it shows changes. */
interface RowState {
	today: DayKey;
	/** `YYYY-MM` of the month shown; null in week view, where no day is muted. */
	month: string | null;
	view?: string;
	selectedNotePath: string | null;
	droppedPath: string | null;
	previewStart: DayKey | null;
	previewEnd: DayKey | null;
	canCreate: boolean;
	onCreate: (day: DayKey) => void;
}

function previewForWeek(
	week: DayKey[],
	preview: CalendarGridState["preview"],
): Pick<RowState, "previewStart" | "previewEnd"> {
	if (
		!preview ||
		preview.start > week[week.length - 1] ||
		preview.end < week[0]
	)
		return { previewStart: null, previewEnd: null };
	return { previewStart: preview.start, previewEnd: preview.end };
}

interface DayCellProps {
	day: DayKey;
	isToday: boolean;
	outside: boolean;
	target: boolean;
	monthView: boolean;
	view?: string;
	canCreate: boolean;
	onCreate: (day: DayKey) => void;
	locale: AppLocale;
}

function dayCellProps(
	day: DayKey,
	row: RowState,
	locale: AppLocale,
): DayCellProps {
	return {
		day,
		isToday: day === row.today,
		outside: row.month !== null && day.slice(0, 7) !== row.month,
		target:
			row.previewStart !== null &&
			row.previewEnd !== null &&
			day >= row.previewStart &&
			day <= row.previewEnd,
		monthView: row.month !== null,
		view: row.view,
		canCreate: row.canCreate,
		onCreate: row.onCreate,
		locale,
	};
}

function DayNumber({
	day,
	isToday,
	monthView,
	locale,
}: Pick<DayCellProps, "day" | "isToday" | "monthView" | "locale">) {
	const label =
		monthView && dayOfMonth(day) === 1
			? monthDayLabel(day, locale)
			: String(dayOfMonth(day));
	return (
		<span
			className={cn(
				"calendar-day__number",
				isToday && "calendar-day__number--today",
			)}
			aria-current={isToday ? "date" : undefined}
		>
			{label}
		</span>
	);
}

function CreateOnDayButton({
	day,
	canCreate,
	onCreate,
	locale,
}: Pick<DayCellProps, "day" | "canCreate" | "onCreate" | "locale">) {
	if (!canCreate) return null;
	const label = translate(locale, "calendar.addOnDay", {
		date: fullDayLabel(day, locale),
	});
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-xs"
			className="calendar-day__add !h-5 !w-5 !min-w-0 !rounded !p-0 text-muted-foreground hover:!bg-accent hover:!text-foreground [&_svg]:!size-3.5"
			title={label}
			aria-label={label}
			onClick={() => onCreate(day)}
			data-testid="calendar-day-add"
		>
			<Plus size={14} />
		</Button>
	);
}

function DayCellView({
	day,
	isToday,
	outside,
	target,
	monthView,
	canCreate,
	onCreate,
	locale,
}: DayCellProps) {
	const { setNodeRef } = useDroppable({ id: dayDropId(day) });
	return (
		<div
			ref={setNodeRef}
			className={cn(
				"calendar-day",
				isWeekend(day) && "calendar-day--weekend",
				outside && "calendar-day--outside",
				target && "calendar-day--target",
			)}
			data-day={day}
			data-testid="calendar-day"
		>
			<div className="calendar-day__header">
				<DayNumber
					day={day}
					isToday={isToday}
					monthView={monthView}
					locale={locale}
				/>
				<CreateOnDayButton
					day={day}
					canCreate={canCreate}
					onCreate={onCreate}
					locale={locale}
				/>
			</div>
		</div>
	);
}

const DayCell = memo(DayCellView);

interface MoreButtonProps {
	day: DayKey;
	count: number;
	items: CalendarItem[];
	context: CalendarItemContext;
	locale: AppLocale;
	style: CSSProperties;
	selectedNotePath?: string | null;
}

function MoreOnDay({
	day,
	count,
	items,
	context,
	locale,
	style,
	selectedNotePath,
}: MoreButtonProps) {
	const [open, setOpen] = useState(false);
	useDndMonitor({
		onDragEnd: () => setOpen(false),
		onDragCancel: () => setOpen(false),
	});
	const dayItems = useMemo(() => itemsOnDay(items, day), [day, items]);
	const popoverContext = useMemo<CalendarItemContext>(
		() => ({
			...context,
			draggable: context.draggable,
			onOpen: (entry, event) => {
				setOpen(false);
				context.onOpen(entry, event);
			},
		}),
		[context],
	);
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="xs"
					className="calendar-more !h-5 justify-start rounded px-1.5 text-[11px] font-medium text-muted-foreground hover:!bg-accent hover:!text-foreground"
					style={style}
					data-testid="calendar-more"
				>
					{translate(locale, "calendar.more", { count })}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="calendar-more-popover w-64 p-2"
				data-testid="calendar-more-popover"
			>
				<p className="calendar-more-popover__header m-0 px-1 py-1.5 text-xs font-semibold text-muted-foreground">
					{fullDayLabel(day, locale)}
				</p>
				<div className="calendar-scroll flex max-h-72 flex-col gap-1 overflow-y-auto">
					{dayItems.map((item) => (
						<CalendarItemButton
							key={item.entry.path}
							dragId={`calendar-more:${day}:${item.entry.path}`}
							item={item}
							context={popoverContext}
							selected={item.entry.path === selectedNotePath}
							justDropped={false}
							anchor={day}
							className="h-auto shrink-0"
						/>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}

/** Columns from the grid; every card shares one grid row and sits `top` pixels down its day's stack. */
function segmentStyle(segment: CalendarSegment, top = 0): CSSProperties {
	return {
		gridColumn: `${segment.startColumn + 1} / span ${segment.span}`,
		gridRow: 1,
		marginTop: top,
	};
}

interface WeekRowProps extends RowState {
	week: DayKey[];
	items: CalendarItem[];
	context: CalendarItemContext;
	locale: AppLocale;
}

/** Fits the row from its measured item area and the natural height of its cards (TOL-393). */
function useWeekStack(segments: CalendarSegment[], week: DayKey[]) {
	const [stackRef, measure] = useLaneMeasure();
	const layout = useMemo(
		() => stackWeek(segments, week, measure),
		[measure, segments, week],
	);
	const lanes = measurableLanes(measure.available);
	const measuredOnly = layout.hidden.filter((segment) => segment.lane < lanes);
	return { stackRef, layout, measuredOnly };
}

function stackStyle(week: DayKey[]): CSSProperties {
	return {
		gridTemplateColumns: `repeat(${week.length}, minmax(0, 1fr))`,
		top: DAY_HEADER_PX,
		zIndex: 1,
	};
}

function WeekRowView(props: WeekRowProps) {
	const { week, items, context, locale, selectedNotePath, droppedPath } = props;
	const segments = useMemo(() => weekSegments(items, week), [items, week]);
	const { stackRef, layout, measuredOnly } = useWeekStack(segments, week);
	return (
		<div
			className="calendar-week"
			style={{ minHeight: Math.max(MIN_WEEK_ROW_PX, layout.minHeight) }}
			data-testid="calendar-week"
		>
			<div
				className="calendar-week__days"
				style={{
					gridTemplateColumns: `repeat(${week.length}, minmax(0, 1fr))`,
				}}
			>
				{week.map((day) => (
					<DayCell key={day} {...dayCellProps(day, props, locale)} />
				))}
			</div>
			<div
				ref={stackRef}
				className="calendar-week__lanes"
				style={stackStyle(week)}
			>
				{layout.visible.map(({ segment, top }) => (
					<CalendarItemButton
						key={segment.item.entry.path}
						dragId={`calendar-item:${week[0]}:${segment.item.entry.path}`}
						item={segment.item}
						context={context}
						selected={segment.item.entry.path === selectedNotePath}
						justDropped={segment.item.entry.path === droppedPath}
						style={segmentStyle(segment, top)}
						continuesBefore={segment.continuesBefore}
						continuesAfter={segment.continuesAfter}
					/>
				))}
				{measuredOnly.map((segment) => (
					<CalendarItemGhost
						key={segment.item.entry.path}
						item={segment.item}
						context={context}
						style={segmentStyle(segment)}
					/>
				))}
				{layout.overflow.map(({ day, column, count, top }) => (
					<MoreOnDay
						key={day}
						day={day}
						count={count}
						items={items}
						context={context}
						locale={locale}
						style={{ gridColumn: column + 1, gridRow: 1, marginTop: top }}
						selectedNotePath={selectedNotePath}
					/>
				))}
			</div>
		</div>
	);
}

const WeekRow = memo(WeekRowView);

function rowStateFor(
	state: CalendarGridState,
): Omit<RowState, "previewStart" | "previewEnd"> {
	return {
		today: state.today,
		month: state.monthView ? state.anchor.slice(0, 7) : null,
		view: state.view,
		selectedNotePath: state.selectedNotePath ?? null,
		droppedPath: state.droppedPath,
		canCreate: state.canCreate,
		onCreate: state.onCreate,
	};
}

export function CalendarGrid({
	weeks,
	items,
	context,
	state,
	locale,
}: CalendarGridProps) {
	const headers = useMemo(
		() => weekdayLabels(weeks[0], locale),
		[locale, weeks],
	);
	const rowState = rowStateFor(state);
	return (
		<div
			className="calendar-grid flex min-h-0 flex-1 flex-col"
			data-view={state.view ?? (state.monthView ? "month" : "week")}
		>
			<div
				className="calendar-weekdays"
				style={{
					gridTemplateColumns: `repeat(${weeks[0].length}, minmax(0, 1fr))`,
				}}
			>
				{headers.map(({ day, label }) => (
					<span
						key={day}
						className={cn(
							"calendar-weekday",
							isWeekend(day) && "calendar-weekday--weekend",
						)}
					>
						{label}
					</span>
				))}
			</div>
			<div
				className="calendar-weeks calendar-scroll overflow-y-auto"
				data-testid="calendar-weeks"
			>
				{weeks.map((week) => (
					<WeekRow
						key={week[0]}
						week={week}
						items={items}
						context={context}
						locale={locale}
						{...rowState}
						{...previewForWeek(week, state.preview)}
					/>
				))}
			</div>
		</div>
	);
}
