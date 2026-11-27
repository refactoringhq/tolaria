import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVertical, SlidersHorizontal } from "@phosphor-icons/react";
import {
	type KeyboardEvent,
	type ReactNode,
	type RefObject,
	useCallback,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { type AppLocale, translate } from "../../lib/i18n";
import { renderComputedProperties } from "./computedListProperties";
import {
	type NoteListPropertiesScope,
	usePopoverEscapeHandlers,
	usePopoverOpenChange,
	usePopoverOpenEvent,
	usePopoverSearchFocus,
} from "./noteListPropertiesEvents";

type NoteListPropertyKey = string;

export interface ListPropertiesPopoverProps {
	scope: NoteListPropertiesScope;
	availableProperties: NoteListPropertyKey[];
	currentDisplay: NoteListPropertyKey[];
	onSave: (value: NoteListPropertyKey[] | null) => void;
	triggerTitle: string;
	triggerClassName?: string;
	usePickerTitle?: boolean;
	locale?: AppLocale;
}

function propertyInputId(id: NoteListPropertyKey): string {
	return `list-prop-${id.replace(/[^a-z0-9_-]+/gi, "-")}`;
}

function getSelectedProperties(
	currentDisplay: NoteListPropertyKey[],
	availableProperties: NoteListPropertyKey[],
) {
	return currentDisplay.filter((property) =>
		availableProperties.includes(property),
	);
}

function getOrderedItems(
	currentDisplay: NoteListPropertyKey[],
	availableProperties: NoteListPropertyKey[],
) {
	const selected = getSelectedProperties(currentDisplay, availableProperties);
	const unselected = availableProperties.filter(
		(property) => !selected.includes(property),
	);
	return [...selected, ...unselected];
}

function normalizePropertyQuery(query: string) {
	return query.trim().toLowerCase();
}

function filterOrderedItems(
	orderedItems: NoteListPropertyKey[],
	query: string,
) {
	const normalized = normalizePropertyQuery(query);
	if (normalized === "") return orderedItems;
	return orderedItems.filter((property) =>
		property.toLowerCase().includes(normalized),
	);
}

function toggleDisplayProperty(
	currentDisplay: NoteListPropertyKey[],
	key: NoteListPropertyKey,
) {
	if (currentDisplay.includes(key)) {
		const filtered = currentDisplay.filter((property) => property !== key);
		return filtered.length > 0 ? filtered : null;
	}

	return [...currentDisplay, key];
}

function reorderDisplayProperties(
	event: DragEndEvent,
	currentDisplay: NoteListPropertyKey[],
	availableProperties: NoteListPropertyKey[],
) {
	const { active, over } = event;
	if (!over || active.id === over.id) return undefined;

	const selected = getSelectedProperties(currentDisplay, availableProperties);
	const oldIndex = selected.indexOf(String(active.id) as NoteListPropertyKey);
	const newIndex = selected.indexOf(String(over.id) as NoteListPropertyKey);
	if (oldIndex === -1 || newIndex === -1) return undefined;

	const hiddenFields = currentDisplay.filter(
		(property) => !availableProperties.includes(property),
	);
	return [...arrayMove(selected, oldIndex, newIndex), ...hiddenFields];
}

function SortablePropertyItem({
	id,
	checked,
	locale = "en",
	onToggle,
}: {
	id: NoteListPropertyKey;
	checked: boolean;
	locale?: AppLocale;
	onToggle: (key: NoteListPropertyKey) => void;
}) {
	const { attributes, listeners, setNodeRef, transform, transition } =
		useSortable({ id });
	const style = { transform: CSS.Transform.toString(transform), transition };
	const inputId = propertyInputId(id);
	const dragAttributes = { ...attributes, tabIndex: -1 };

	return (
		<div
			ref={setNodeRef}
			style={style}
			className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted"
			data-testid={`list-prop-item-${id}`}
		>
			<Checkbox
				id={inputId}
				checked={checked}
				onCheckedChange={() => onToggle(id)}
				aria-label={id}
			/>
			<label
				htmlFor={inputId}
				className="flex flex-1 cursor-pointer items-center gap-2 text-[13px]"
			>
				<span className="truncate">{id}</span>
			</label>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				className="shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
				aria-label={translate(locale, "noteList.properties.reorder", {
					name: id,
				})}
				{...dragAttributes}
				{...listeners}
			>
				<DotsSixVertical size={14} />
			</Button>
		</div>
	);
}

function ListPropertiesSearchInput({
	inputRef,
	query,
	open,
	listboxId,
	locale = "en",
	onQueryChange,
	onKeyDown,
}: {
	inputRef: RefObject<HTMLInputElement | null>;
	query: string;
	open: boolean;
	listboxId: string;
	locale?: AppLocale;
	onQueryChange: (value: string) => void;
	onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
	return (
		<div className="mb-2">
			<Input
				ref={inputRef}
				value={query}
				onChange={(event) => onQueryChange(event.target.value)}
				onKeyDown={onKeyDown}
				placeholder={translate(locale, "noteList.properties.searchPlaceholder")}
				role="combobox"
				aria-autocomplete="list"
				aria-controls={listboxId}
				aria-expanded={open}
				aria-label={translate(locale, "noteList.properties.searchLabel")}
				className="h-8 text-[13px]"
				data-testid="list-properties-combobox-input"
			/>
		</div>
	);
}

function ListPropertiesOptionsList({
	listboxId,
	filteredItems,
	selectedSet,
	drag,
	locale = "en",
	onToggle,
	computed,
}: {
	listboxId: string;
	filteredItems: NoteListPropertyKey[];
	selectedSet: Set<NoteListPropertyKey>;
	drag: { sensors: ReturnType<typeof useSensors>; onDragEnd: (event: DragEndEvent) => void };
	locale?: AppLocale;
	onToggle: (key: string) => void;
	computed: ReactNode;
}) {
	return (
		<div
			className="max-h-60 overflow-y-auto"
			data-testid="list-properties-scroll-area"
		>
			{computed}
			{filteredItems.length > 0 ? (
				<DndContext
					sensors={drag.sensors}
					collisionDetection={closestCenter}
					onDragEnd={drag.onDragEnd}
				>
					<div id={listboxId} role="listbox" aria-multiselectable="true">
						<SortableContext
							items={filteredItems}
							strategy={verticalListSortingStrategy}
						>
							{filteredItems.map((key) => (
								<SortablePropertyItem
									key={key}
									id={key}
									checked={selectedSet.has(key)}
									locale={locale}
									onToggle={onToggle}
								/>
							))}
						</SortableContext>
					</div>
				</DndContext>
			) : (
				!computed && (
					<div className="px-1 py-2 text-[12px] text-muted-foreground">
						{translate(locale, "noteList.properties.noMatches")}
					</div>
				)
			)}
		</div>
	);
}

function ListPropertiesPopoverPanel(options: {
	inputRef: RefObject<HTMLInputElement | null>;
	query: string;
	currentDisplay: string[];
	open: boolean;
	listboxId: string;
	filteredItems: NoteListPropertyKey[];
	selectedSet: Set<NoteListPropertyKey>;
	sensors: ReturnType<typeof useSensors>;
	locale?: AppLocale;
	onQueryChange: (value: string) => void;
	onSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
	onPanelKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
	onDragEnd: (event: DragEndEvent) => void;
	onToggle: (key: string) => void;
}) {
	const {
		inputRef,
		query,
		currentDisplay,
		open,
		listboxId,
		filteredItems,
		selectedSet,
		sensors,
		locale = "en",
		onQueryChange,
		onSearchKeyDown,
		onPanelKeyDown,
		onDragEnd,
		onToggle,
	} = options;
	return (
		<PopoverContent
			align="end"
			className="w-64 overflow-hidden p-2"
			onOpenAutoFocus={(event) => event.preventDefault()}
			data-testid="list-properties-popover"
		>
			<div onKeyDownCapture={onPanelKeyDown}>
				<div className="mb-2 px-1 text-[11px] font-medium text-muted-foreground">
					{translate(locale, "noteList.properties.showInNoteList")}
				</div>
				<ListPropertiesSearchInput
					inputRef={inputRef}
					query={query}
					open={open}
					listboxId={listboxId}
					locale={locale}
					onQueryChange={onQueryChange}
					onKeyDown={onSearchKeyDown}
				/>
				<ListPropertiesOptionsList
					computed={renderComputedProperties(
						currentDisplay,
						normalizePropertyQuery(query),
						locale,
						onToggle,
					)}
					listboxId={listboxId}
					filteredItems={filteredItems}
					selectedSet={selectedSet}
					drag={{ sensors, onDragEnd }}
					locale={locale}
					onToggle={onToggle}
				/>
			</div>
		</PopoverContent>
	);
}

function selectedPropertiesSet(
	currentDisplay: string[],
	availableProperties: string[],
) {
	return new Set(getSelectedProperties(currentDisplay, availableProperties));
}

function usePropertiesPopoverItems(
	currentDisplay: string[],
	availableProperties: string[],
	query: string,
) {
	const orderedItems = useMemo(
		() => getOrderedItems(currentDisplay, availableProperties),
		[availableProperties, currentDisplay],
	);
	const filteredItems = useMemo(
		() => filterOrderedItems(orderedItems, query),
		[orderedItems, query],
	);
	const selectedSet = useMemo(
		() => selectedPropertiesSet(currentDisplay, availableProperties),
		[availableProperties, currentDisplay],
	);
	return { filteredItems, selectedSet };
}

function usePopoverActions(
	currentDisplay: string[],
	availableProperties: string[],
	onSave: ListPropertiesPopoverProps["onSave"],
) {
	const handleToggle = useCallback(
		(key: string) => onSave(toggleDisplayProperty(currentDisplay, key)),
		[currentDisplay, onSave],
	);
	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			const reordered = reorderDisplayProperties(
				event,
				currentDisplay,
				availableProperties,
			);
			if (reordered) onSave(reordered);
		},
		[availableProperties, currentDisplay, onSave],
	);
	return { handleToggle, handleDragEnd };
}

function useListPropertiesPopoverState({
	scope,
	availableProperties,
	currentDisplay,
	onSave,
}: Pick<
	ListPropertiesPopoverProps,
	"scope" | "availableProperties" | "currentDisplay" | "onSave"
>) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const listboxId = useId();
	const closePopover = useCallback(() => {
		setQuery("");
		setOpen(false);
	}, []);

	const { filteredItems, selectedSet } = usePropertiesPopoverItems(
		currentDisplay,
		availableProperties,
		query,
	);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
	);

	usePopoverOpenEvent(scope, setOpen);

	usePopoverSearchFocus(open, inputRef);

	const { handleToggle, handleDragEnd } = usePopoverActions(
		currentDisplay,
		availableProperties,
		onSave,
	);

	const { handleSearchKeyDown, handlePanelKeyDown } =
		usePopoverEscapeHandlers(closePopover);

	const handleOpenChange = usePopoverOpenChange(setOpen, setQuery);

	return {
		open,
		query,
		inputRef,
		listboxId,
		filteredItems,
		selectedSet,
		sensors,
		setQuery,
		handleSearchKeyDown,
		handlePanelKeyDown,
		handleDragEnd,
		handleOpenChange,
		handleToggle,
	};
}

export function ListPropertiesPopover({
	scope,
	availableProperties,
	currentDisplay,
	onSave,
	triggerTitle,
	triggerClassName,
	locale = "en",
}: ListPropertiesPopoverProps) {
	const state = useListPropertiesPopoverState({
		scope,
		availableProperties,
		currentDisplay,
		onSave,
	});

	return (
		<Popover open={state.open} onOpenChange={state.handleOpenChange}>
			<ActionTooltip copy={{ label: triggerTitle }}>
				<PopoverTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						className={cn("h-7 w-7 text-muted-foreground", triggerClassName)}
						aria-label={triggerTitle}
						data-testid="list-properties-btn"
					>
						<SlidersHorizontal size={16} />
					</Button>
				</PopoverTrigger>
			</ActionTooltip>
			<ListPropertiesPopoverPanel
				inputRef={state.inputRef}
				query={state.query}
				currentDisplay={currentDisplay}
				open={state.open}
				listboxId={state.listboxId}
				filteredItems={state.filteredItems}
				selectedSet={state.selectedSet}
				sensors={state.sensors}
				locale={locale}
				onQueryChange={state.setQuery}
				onSearchKeyDown={state.handleSearchKeyDown}
				onPanelKeyDown={state.handlePanelKeyDown}
				onDragEnd={state.handleDragEnd}
				onToggle={state.handleToggle}
			/>
		</Popover>
	);
}
