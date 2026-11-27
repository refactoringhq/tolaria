import { CaretLeft, CaretRight, Tray } from "@phosphor-icons/react";
import { useContext } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CalendarViewMode } from "../../../collections/collectionTypes";
import { type AppLocale, translate } from "../../../lib/i18n";
import { NOTE_LIST_ACTION_BUTTON_CLASSNAME } from "../NoteListHeader";
import { CalendarHeaderSlot } from "./useCalendarNavigation";
import type { CalendarNavigation } from "./useCalendarShortcuts";

interface CalendarToolbarProps {
	title: string;
	view: CalendarViewMode;
	locale: AppLocale;
	navigation: CalendarNavigation;
}

function navigationLabels(view: CalendarViewMode, locale: AppLocale) {
	const week = view === "week";
	return {
		previous: translate(
			locale,
			week ? "calendar.previousWeek" : "calendar.previousMonth",
		),
		next: translate(locale, week ? "calendar.nextWeek" : "calendar.nextMonth"),
	};
}

function withShortcut(label: string, key: string): string {
	return `${label} (${key})`;
}

function TodayButton({
	locale,
	onToday,
}: {
	locale: AppLocale;
	onToday: () => void;
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="xs"
			className="floating-pane-control h-8 rounded-full px-3 text-xs"
			title={withShortcut(translate(locale, "calendar.todayHint"), "T")}
			onClick={onToday}
			data-testid="calendar-today"
		>
			{translate(locale, "calendar.today")}
		</Button>
	);
}

function PeriodButton({
	label,
	direction,
	navigation,
}: {
	label: string;
	direction: "previous" | "next";
	navigation: CalendarNavigation;
}) {
	const Icon = direction === "previous" ? CaretLeft : CaretRight;
	const onClick =
		direction === "previous" ? navigation.previous : navigation.next;
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-xs"
			className={NOTE_LIST_ACTION_BUTTON_CLASSNAME}
			title={withShortcut(label, direction === "previous" ? "←" : "→")}
			aria-label={label}
			onClick={onClick}
			data-testid={`calendar-${direction}`}
		>
			<Icon size={16} />
		</Button>
	);
}

function PeriodButtons({
	labels,
	navigation,
}: {
	labels: ReturnType<typeof navigationLabels>;
	navigation: CalendarNavigation;
}) {
	return (
		<div className="flex items-center gap-0.5">
			<PeriodButton
				label={labels.previous}
				direction="previous"
				navigation={navigation}
			/>
			<PeriodButton
				label={labels.next}
				direction="next"
				navigation={navigation}
			/>
		</div>
	);
}

function CalendarViewTabs({
	locale,
	navigation,
	view,
}: {
	locale: AppLocale;
	navigation: CalendarNavigation;
	view: CalendarViewMode;
}) {
	return (
		<Tabs
			value={view}
			onValueChange={(value) =>
				navigation.setView(
					value === "week" || value === "year" ? value : "month",
				)
			}
			className="gap-0"
		>
			<TabsList
				className="calendar-view-tabs rounded-full p-0.5"
				aria-label={translate(locale, "calendar.viewLabel")}
			>
				{(
					Object.entries({
						week: "W",
						month: "M",
						year: "Y",
					}) as [CalendarViewMode, string][]
				).map(([period, shortcut]) => (
					<TabsTrigger
						key={period}
						value={period}
						className="min-w-0 flex-initial rounded-full px-2 py-0 text-xs !text-foreground"
						title={withShortcut(
							translate(locale, `calendar.${period}`),
							shortcut,
						)}
						data-testid={`calendar-view-${period}`}
					>
						{translate(locale, `calendar.${period}`)}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}

export function CalendarTrayToggle({
	count,
	locale,
	onOpen,
}: {
	count: number;
	locale: AppLocale;
	onOpen: () => void;
}) {
	const label = translate(locale, "calendar.tray.toggle", { count });
	return (
		<Button
			type="button"
			variant="ghost"
			size="xs"
			className="self-start gap-1 rounded-full bg-[var(--surface-note-list)] px-2 text-xs shadow-[var(--shadow-card)]"
			title={label}
			aria-label={label}
			aria-expanded={false}
			onClick={onOpen}
			data-testid="calendar-tray-toggle"
		>
			<Tray size={16} />
			<span className="tabular-nums">{count}</span>
		</Button>
	);
}

function CalendarHeaderControls({
	view,
	locale,
	navigation,
}: Omit<CalendarToolbarProps, "title">) {
	const slot = useContext(CalendarHeaderSlot);
	const labels = navigationLabels(view, locale);
	const content = (
		<div
			className="calendar-controls flex shrink-0 items-center gap-2"
			data-testid="calendar-controls"
		>
			<TodayButton locale={locale} onToday={navigation.today} />
			<PeriodButtons labels={labels} navigation={navigation} />
			<CalendarViewTabs locale={locale} navigation={navigation} view={view} />
		</div>
	);
	return slot ? createPortal(content, slot) : content;
}

export function CalendarToolbar({ title, ...controls }: CalendarToolbarProps) {
	return (
		<div
			className="calendar-toolbar flex h-11 shrink-0 items-center gap-2 px-4"
			data-testid="calendar-toolbar"
		>
			<h2
				className="m-0 min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground"
				aria-live="polite"
				data-testid="calendar-title"
			>
				{title}
			</h2>
			<CalendarHeaderControls {...controls} />
		</div>
	);
}
