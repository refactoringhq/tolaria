import { useDraggable } from "@dnd-kit/core";
import { type MouseEvent, memo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { VaultEntry } from "../../types";
import { NoteTitleIcon } from "../NoteTitleIcon";
import { PropertyChips } from "../note-item/PropertyChips";
import { cardDisplayProperties, cardId } from "./kanbanModel";

/** A ghost Button reset to a block-level card slot, so the whole card is one native, focusable control. */
const KANBAN_CARD_SLOT_CLASSNAME =
	"kanban-card-slot block h-auto w-full whitespace-normal rounded-lg p-0 text-left font-normal hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring [&_svg]:!size-[11px]";

export interface KanbanCardContext {
	cardProperties: string[];
	allEntries: VaultEntry[];
	typeEntryMap: Record<string, VaultEntry>;
	displayPropsOverride?: string[] | null;
	showProperties: boolean;
	/** Localized screen-reader role description for a card. */
	cardRole: string;
	onOpen: (entry: VaultEntry, event: MouseEvent) => void;
}

interface KanbanCardFaceProps {
	entry: VaultEntry;
	context: KanbanCardContext;
	className?: string;
}

/** The visual card, shared by the in-column card and the lifted drag overlay. */
export function KanbanCardFace({
	entry,
	context,
	className,
}: KanbanCardFaceProps) {
	const displayProps = cardDisplayProperties(
		entry,
		context.cardProperties,
		context.typeEntryMap,
		context.displayPropsOverride,
	);
	return (
		<Card
			className={cn(
				"kanban-card gap-0 rounded-lg px-3 py-2.5 text-left shadow-xs",
				className,
			)}
		>
			<span
				className="block truncate text-[13px] font-medium text-foreground"
				data-testid="kanban-card-title"
			>
				<NoteTitleIcon
					icon={entry.icon}
					size={15}
					className="mr-1"
					testId="kanban-card-title-icon"
				/>
				{entry.title}
			</span>
			{displayProps.length > 0 && context.showProperties && (
				<PropertyChips
					entry={entry}
					displayProps={displayProps}
					allEntries={context.allEntries}
					typeEntryMap={context.typeEntryMap}
					onOpenNote={context.onOpen}
				/>
			)}
		</Card>
	);
}

interface KanbanCardProps {
	entry: VaultEntry;
	context: KanbanCardContext;
	selected: boolean;
	justDropped: boolean;
}

export const KanbanCard = memo(function KanbanCard({
	entry,
	context,
	selected,
	justDropped,
}: KanbanCardProps) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: cardId(entry.path),
		data: { entry },
	});
	return (
		<Button
			ref={setNodeRef}
			type="button"
			variant="ghost"
			{...attributes}
			{...listeners}
			aria-roledescription={context.cardRole}
			aria-label={entry.title}
			className={cn(
				KANBAN_CARD_SLOT_CLASSNAME,
				isDragging && "kanban-card-slot--placeholder",
			)}
			onClick={(event) => context.onOpen(entry, event)}
			data-testid="kanban-card"
			data-selected={selected ? "true" : undefined}
		>
			<KanbanCardFace
				entry={entry}
				context={context}
				className={cn(
					selected && "kanban-card--selected",
					justDropped && "kanban-card--dropped",
				)}
			/>
		</Button>
	);
});
