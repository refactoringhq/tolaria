import { CaretLeft, CaretRight, Tray } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { CalendarViewMode } from "../../../collections/collectionTypes";
import { type AppLocale, translate } from "../../../lib/i18n";
import { NOTE_LIST_ACTION_BUTTON_CLASSNAME } from "../NoteListHeader";
import type { CalendarNavigation } from "./useCalendarShortcuts";

interface CalendarToolbarProps {
	title: string;
	view: CalendarViewMode;
	locale: AppLocale;
	navigation: CalendarNavigation;
	trayCount: number;
	trayOpen: boolean;
	onToggleTray: () => void;
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
			variant="outline"
			size="xs"
			className="h-6 px-2 text-xs"
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
					value === "week" || value === "quarter" || value === "year"
						? value
						: "month",
				)
			}
			className="gap-0"
		>
			<TabsList
				className="!h-7 p-0.5"
				aria-label={translate(locale, "calendar.viewLabel")}
			>
				{(
					Object.entries({
						month: "M",
						week: "W",
						quarter: "Q",
						year: "Y",
					}) as [CalendarViewMode, string][]
				).map(([period, shortcut]) => (
					<TabsTrigger
						key={period}
						value={period}
						className="h-6 px-2.5 text-xs"
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

function TrayButton({
	count,
	label,
	onToggle,
	open,
}: {
	count: number;
	label: string;
	onToggle: () => void;
	open: boolean;
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="xs"
			className={cn(
				"h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:!bg-accent hover:!text-foreground",
				open && "!bg-accent !text-foreground",
			)}
			title={label}
			aria-label={label}
			aria-pressed={open}
			onClick={onToggle}
			data-testid="calendar-tray-toggle"
		>
			<Tray size={16} />
			<span className="tabular-nums">{count}</span>
		</Button>
	);
}

export function CalendarToolbar({
	title,
	view,
	locale,
	navigation,
	trayCount,
	trayOpen,
	onToggleTray,
}: CalendarToolbarProps) {
	const labels = navigationLabels(view, locale);
	const trayLabel = translate(locale, "calendar.tray.toggle", {
		count: trayCount,
	});
	return (
		<div
			className="calendar-toolbar flex h-11 shrink-0 items-center gap-2 px-3"
			data-testid="calendar-toolbar"
		>
			<h2
				className="m-0 min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground"
				aria-live="polite"
				data-testid="calendar-title"
			>
				{title}
			</h2>
			<TodayButton locale={locale} onToday={navigation.today} />
			<PeriodButtons labels={labels} navigation={navigation} />
			<CalendarViewTabs locale={locale} navigation={navigation} view={view} />
			<TrayButton
				count={trayCount}
				label={trayLabel}
				onToggle={onToggleTray}
				open={trayOpen}
			/>
		</div>
	);
}
