import { ArrowDown, ArrowUp } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { type AppLocale, translate } from "../lib/i18n";
import {
	getDefaultDirection,
	type SortDirection,
	type SortOption,
} from "../utils/noteListHelpers";

function selectOnKeyboard(
	event: React.KeyboardEvent<HTMLButtonElement>,
	value: SortOption,
	direction: SortDirection,
	onSelect: (option: SortOption, direction: SortDirection) => void,
) {
	if (event.key !== "Enter" && event.key !== " ") return;
	event.preventDefault();
	onSelect(value, direction);
}

function sortDirectionClass(
	isActive: boolean,
	activeDirection: SortDirection,
	buttonDirection: SortDirection,
) {
	return cn(
		"flex items-center rounded p-0.5 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
		isActive && activeDirection === buttonDirection
			? "text-foreground"
			: "text-muted-foreground opacity-40",
	);
}

export interface SortDropdownRowProps {
	index: number;
	groupLabel: string;
	value: SortOption;
	label: string;
	current: SortOption;
	direction: SortDirection;
	buttonRef: (node: HTMLButtonElement | null) => void;
	showSeparator: boolean;
	locale: AppLocale;
	onSelect: (option: SortOption, direction: SortDirection) => void;
}

export function SortDropdownRow(options: SortDropdownRowProps) {
	const {
		index,
		groupLabel,
		value,
		label,
		current,
		direction,
		buttonRef,
		showSeparator,
		locale,
		onSelect,
	} = options;
	const isActive = value === current;
	const defaultDirection = isActive ? direction : getDefaultDirection(value);
	const itemData = {
		"data-sort-group-label": groupLabel,
		"data-sort-item-index": String(index),
	};

	return (
		<>
			{showSeparator && (
				<div
					className="mx-2 my-1 border-t border-border"
					data-testid="sort-separator"
				/>
			)}
			<div
				className={cn(
					"flex items-center justify-between gap-1 rounded px-1 text-[12px] text-popover-foreground hover:bg-accent",
					isActive && "bg-accent font-medium",
				)}
				style={{ minHeight: 28 }}
			>
				<SortMenuOptionButton
					buttonRef={buttonRef}
					value={value}
					label={label}
					isActive={isActive}
					defaultDirection={defaultDirection}
					onSelect={onSelect}
					itemData={itemData}
				/>
				<SortDirectionButtons
					value={value}
					direction={direction}
					isActive={isActive}
					onSelect={onSelect}
					itemData={itemData}
					locale={locale}
				/>
			</div>
		</>
	);
}

function SortMenuOptionButton(props: {
	buttonRef: (node: HTMLButtonElement | null) => void;
	value: SortOption;
	label: string;
	isActive: boolean;
	defaultDirection: SortDirection;
	onSelect: (option: SortOption, direction: SortDirection) => void;
	itemData: Record<string, string>;
}) {
	const {
		buttonRef,
		value,
		label,
		isActive,
		defaultDirection,
		onSelect,
		itemData,
	} = props;
	return (
		<button
			ref={buttonRef}
			type="button"
			role="menuitemradio"
			aria-checked={isActive}
			className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left text-inherit hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			onClick={(event) => {
				event.stopPropagation();
				onSelect(value, defaultDirection);
			}}
			onKeyDown={(event) =>
				selectOnKeyboard(event, value, defaultDirection, onSelect)
			}
			data-testid={`sort-option-${value}`}
			{...itemData}
		>
			<span className="truncate">{label}</span>
		</button>
	);
}

function SortDirectionButtons(props: {
	value: SortOption;
	direction: SortDirection;
	isActive: boolean;
	onSelect: (option: SortOption, direction: SortDirection) => void;
	itemData: Record<string, string>;
	locale: AppLocale;
}) {
	const { value, direction, isActive, onSelect, itemData, locale } = props;
	return (
		<span className="flex items-center gap-0.5">
			<SortDirectionButton
				value={value}
				direction="asc"
				activeDirection={direction}
				isActive={isActive}
				onSelect={onSelect}
				icon={<ArrowUp size={12} />}
				itemData={itemData}
				locale={locale}
			/>
			<SortDirectionButton
				value={value}
				direction="desc"
				activeDirection={direction}
				isActive={isActive}
				onSelect={onSelect}
				icon={<ArrowDown size={12} />}
				itemData={itemData}
				locale={locale}
			/>
		</span>
	);
}

function SortDirectionButton(options: {
	value: SortOption;
	direction: SortDirection;
	activeDirection: SortDirection;
	isActive: boolean;
	onSelect: (option: SortOption, direction: SortDirection) => void;
	icon: React.ReactNode;
	itemData: Record<string, string>;
	locale: AppLocale;
}) {
	const {
		value,
		direction,
		activeDirection,
		isActive,
		onSelect,
		icon,
		itemData,
		locale,
	} = options;
	return (
		<button
			type="button"
			className={sortDirectionClass(isActive, activeDirection, direction)}
			onClick={(event) => {
				event.stopPropagation();
				onSelect(value, direction);
			}}
			data-testid={`sort-dir-${direction}-${value}`}
			title={translate(
				locale,
				direction === "asc"
					? "noteList.sort.ascending"
					: "noteList.sort.descending",
			)}
			{...itemData}
		>
			{icon}
		</button>
	);
}
