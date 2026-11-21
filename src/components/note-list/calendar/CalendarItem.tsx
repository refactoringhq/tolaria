import { useDraggable } from "@dnd-kit/core";
import { type CSSProperties, type MouseEvent, memo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VaultEntry } from "../../../types";
import { NoteTitleIcon } from "../../NoteTitleIcon";
import { PropertyChips } from "../../note-item/PropertyChips";
import { cardDisplayProperties } from "../kanbanModel";
import type { CalendarItem } from "./calendarModel";

/** A ghost Button reset to a block slot at its natural height, so an item is one native, focusable control like a Kanban card. */
const CALENDAR_ITEM_SLOT_CLASSNAME =
	"calendar-item-slot block h-auto w-full min-w-0 whitespace-normal rounded-lg p-0 text-left font-normal hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 [&_svg]:!size-[11px]";

export interface CalendarItemContext {
	cardProperties: string[];
	allEntries: VaultEntry[];
	typeEntryMap: Record<string, VaultEntry>;
	displayPropsOverride?: string[] | null;
	/** Localized screen-reader role description for an item. */
	itemRole: string;
	draggable: boolean;
	showIcons?: boolean;
	showProperties?: boolean;
	onOpen: (entry: VaultEntry, event: MouseEvent) => void;
}

export interface CalendarItemFaceProps {
	entry: VaultEntry;
	context: CalendarItemContext;
	className?: string;
	continuesBefore?: boolean;
	continuesAfter?: boolean;
}

function CalendarItemTitle({
	entry,
	showIcon,
}: {
	entry: VaultEntry;
	showIcon: boolean;
}) {
	return (
		<span
			className="flex min-w-0 items-start gap-1 whitespace-normal break-words text-[13px] font-medium leading-5 text-foreground"
			data-testid="calendar-item-title"
		>
			{showIcon && (
				<NoteTitleIcon
					icon={entry.icon}
					size={13}
					testId="calendar-item-icon"
				/>
			)}
			<span className="min-w-0 whitespace-normal break-words">
				{entry.title}
			</span>
		</span>
	);
}

function CalendarItemFields({
	entry,
	context,
	displayProps,
}: {
	entry: VaultEntry;
	context: CalendarItemContext;
	displayProps: string[];
}) {
	if (displayProps.length === 0 || context.showProperties === false)
		return null;
	return (
		<span className="calendar-item__fields block min-w-0 whitespace-normal">
			<PropertyChips
				entry={entry}
				displayProps={displayProps}
				allEntries={context.allEntries}
				typeEntryMap={context.typeEntryMap}
				onOpenNote={context.onOpen}
			/>
		</span>
	);
}

/** The visual item, shared by the grid, the "+N more" popover, the tray and the drag preview. */
export function CalendarItemFace({
	entry,
	context,
	className,
	continuesBefore,
	continuesAfter,
}: CalendarItemFaceProps) {
	const displayProps = cardDisplayProperties(
		entry,
		context.cardProperties,
		context.typeEntryMap,
		context.displayPropsOverride,
	);
	return (
		<span
			className={cn(
				"calendar-item min-w-0 flex flex-col justify-start gap-0.5 rounded-lg px-3 py-2.5 text-left shadow-xs",
				continuesBefore && "calendar-item--continues-before",
				continuesAfter && "calendar-item--continues-after",
				className,
			)}
		>
			<CalendarItemTitle entry={entry} showIcon={context.showIcons !== false} />
			<CalendarItemFields
				entry={entry}
				context={context}
				displayProps={displayProps}
			/>
		</span>
	);
}

export interface CalendarItemButtonProps {
	dragId: string;
	item: CalendarItem;
	context: CalendarItemContext;
	selected: boolean;
	justDropped: boolean;
	className?: string;
	style?: CSSProperties;
	continuesBefore?: boolean;
	continuesAfter?: boolean;
}

/** An item in the grid, the tray or a popover: click opens the note, drag reschedules it. */
export const CalendarItemButton = memo(function CalendarItemButton(
	props: CalendarItemButtonProps,
) {
	const { dragId, item, context, selected, justDropped, style } = props;
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: dragId,
		data: { item },
		disabled: !context.draggable,
	});
	return (
		<Button
			ref={setNodeRef}
			type="button"
			variant="ghost"
			{...attributes}
			{...listeners}
			aria-roledescription={context.itemRole}
			aria-label={item.entry.title}
			className={cn(
				CALENDAR_ITEM_SLOT_CLASSNAME,
				props.className,
				isDragging && "calendar-item-slot--placeholder",
			)}
			style={style}
			onClick={(event) => context.onOpen(item.entry, event)}
			data-testid="calendar-item"
			data-path={item.entry.path}
			data-selected={selected ? "true" : undefined}
		>
			<CalendarItemFace
				entry={item.entry}
				context={context}
				continuesBefore={props.continuesBefore}
				continuesAfter={props.continuesAfter}
				className={cn(
					selected && "calendar-item--selected",
					justDropped && "calendar-item--dropped",
				)}
			/>
		</Button>
	);
});

interface CalendarItemGhostProps {
	item: CalendarItem;
	context: CalendarItemContext;
	style: CSSProperties;
}

/** An invisible copy of an item behind "+N more", laid out only so the row knows its natural height. */
export function CalendarItemGhost({
	item,
	context,
	style,
}: CalendarItemGhostProps) {
	return (
		<Button
			type="button"
			variant="ghost"
			tabIndex={-1}
			aria-hidden="true"
			className={cn(CALENDAR_ITEM_SLOT_CLASSNAME, "invisible")}
			style={style}
			data-path={item.entry.path}
			data-testid="calendar-item-ghost"
		>
			<CalendarItemFace entry={item.entry} context={context} />
		</Button>
	);
}
