import {
	type SuggestionMenuProps,
	useComponentsContext,
	useDictionary,
} from "@blocknote/react";
import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import type { TolariaSlashMenuItem } from "./tolariaEditorFormattingConfig";
import {
	type OpenSubmenu,
	useSubmenuPosition,
} from "./tolariaSlashMenuPosition";
import { Button } from "./ui/button";

type SubmenuKeyboardAction =
	| { kind: "close" }
	| { kind: "move"; delta: number }
	| { kind: "open" }
	| { kind: "select" };

function stopMenuKeyboardEvent(event: KeyboardEvent) {
	event.preventDefault();
	event.stopImmediatePropagation();
}

function nextWrappedIndex(
	index: number,
	delta: number,
	length: number,
): number {
	return (index + delta + length) % length;
}

function closeSubmenuAction(key: string): SubmenuKeyboardAction | null {
	return ["ArrowLeft", "Escape"].includes(key) ? { kind: "close" } : null;
}

function moveSubmenuAction(key: string): SubmenuKeyboardAction | null {
	const delta = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : null;
	return delta === null ? null : { delta, kind: "move" };
}

function selectSubmenuAction(key: string): SubmenuKeyboardAction | null {
	return key === "Enter" ? { kind: "select" } : null;
}

function submenuForKey(items: TolariaSlashMenuItem[], key?: string) {
	return items.find((item) => item.key === key)?.submenuItems ?? [];
}

function submenuKeyboardAction({
	canOpen,
	isOpen,
	key,
}: {
	canOpen: boolean;
	isOpen: boolean;
	key: string;
}): SubmenuKeyboardAction | null {
	if (key === "ArrowRight" && canOpen) return { kind: "open" };
	if (!isOpen) return null;
	return (
		[
			closeSubmenuAction(key),
			moveSubmenuAction(key),
			selectSubmenuAction(key),
		].find((action) => action !== null) ?? null
	);
}

function applySubmenuKeyboardAction(options: {
	action: SubmenuKeyboardAction;
	onItemClick: SuggestionMenuProps<TolariaSlashMenuItem>["onItemClick"];
	openItemSubmenu: (item: TolariaSlashMenuItem) => void;
	selectedItem?: TolariaSlashMenuItem;
	setOpenSubmenu: Dispatch<SetStateAction<OpenSubmenu | null>>;
	setSubmenuIndex: Dispatch<SetStateAction<number>>;
	submenuIndex: number;
	submenuItems: TolariaSlashMenuItem[];
}) {
	const {
		action,
		onItemClick,
		openItemSubmenu,
		selectedItem,
		setOpenSubmenu,
		setSubmenuIndex,
		submenuIndex,
		submenuItems,
	} = options;
	switch (action.kind) {
		case "close":
			setOpenSubmenu(null);
			break;
		case "move":
			setSubmenuIndex((current) =>
				nextWrappedIndex(current, action.delta, submenuItems.length),
			);
			break;
		case "open":
			if (selectedItem) openItemSubmenu(selectedItem);
			break;
		case "select": {
			const submenuItem = submenuItems.at(submenuIndex);
			if (submenuItem) onItemClick?.(submenuItem);
			setOpenSubmenu(null);
			break;
		}
	}
}

export function TolariaSlashMenu({
	items,
	loadingState,
	onItemClick,
	selectedIndex,
}: SuggestionMenuProps<TolariaSlashMenuItem>) {
	const Components = useComponentsContext();
	const dictionary = useDictionary();
	const itemElements = useRef(new Map<string, Element>());
	const submenuElement = useRef<HTMLDivElement>(null);
	const [openSubmenu, setOpenSubmenu] = useState<OpenSubmenu | null>(null);
	const [submenuIndex, setSubmenuIndex] = useState(0);
	const submenuItems = submenuForKey(items, openSubmenu?.key);

	const openItemSubmenu = useCallback((item: TolariaSlashMenuItem) => {
		if (!item.submenuItems?.length) {
			setOpenSubmenu(null);
			return;
		}
		const bounds = itemElements.current.get(item.key)?.getBoundingClientRect();
		if (!bounds) return;
		setSubmenuIndex(0);
		setOpenSubmenu({ key: item.key, left: bounds.right, top: bounds.top });
	}, []);

	useSubmenuPosition({
		itemElements,
		openSubmenu,
		setOpenSubmenu,
		submenuElement,
	});

	useLayoutEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const selectedItem =
				selectedIndex === undefined ? undefined : items.at(selectedIndex);
			const action = submenuKeyboardAction({
				canOpen: Boolean(selectedItem?.submenuItems?.length),
				isOpen: Boolean(openSubmenu && submenuItems.length > 0),
				key: event.key,
			});
			if (!action) return;

			stopMenuKeyboardEvent(event);
			applySubmenuKeyboardAction({
				action,
				onItemClick,
				openItemSubmenu,
				selectedItem,
				setOpenSubmenu,
				setSubmenuIndex,
				submenuIndex,
				submenuItems,
			});
		};

		document.addEventListener("keydown", handleKeyDown, true);
		return () => document.removeEventListener("keydown", handleKeyDown, true);
	}, [
		items,
		onItemClick,
		openItemSubmenu,
		openSubmenu,
		selectedIndex,
		submenuIndex,
		submenuItems,
	]);

	if (!Components) return null;

	const renderedItems = items.flatMap((item, index) => {
		const nodes = [];
		if (item.group !== items[index - 1]?.group) {
			nodes.push(
				<Components.SuggestionMenu.Label
					className="bn-suggestion-menu-label"
					key={`group-${item.group}`}
				>
					{item.group}
				</Components.SuggestionMenu.Label>,
			);
		}
		nodes.push(
			<div
				key={item.key}
				onMouseEnter={() => {
					openItemSubmenu(item);
				}}
				ref={(element) => {
					if (element) itemElements.current.set(item.key, element);
					else itemElements.current.delete(item.key);
				}}
				role="menuitem"
				tabIndex={-1}
			>
				<Components.SuggestionMenu.Item
					className="bn-suggestion-menu-item"
					id={`bn-suggestion-menu-item-${index}`}
					isSelected={index === selectedIndex}
					item={item}
					onClick={() => {
						if (item.submenuItems?.length) openItemSubmenu(item);
						else onItemClick?.(item);
					}}
				/>
			</div>,
		);
		return nodes;
	});

	const loader =
		loadingState === "loaded" ? null : (
			<Components.SuggestionMenu.Loader className="bn-suggestion-menu-loader" />
		);

	return (
		<>
			<Components.SuggestionMenu.Root
				id="bn-suggestion-menu"
				className="bn-suggestion-menu tolaria-slash-menu"
			>
				{renderedItems}
				{renderedItems.length === 0 && loadingState !== "loading-initial" && (
					<Components.SuggestionMenu.EmptyItem className="bn-suggestion-menu-item">
						{dictionary.suggestion_menu.no_items_title}
					</Components.SuggestionMenu.EmptyItem>
				)}
				{loader}
			</Components.SuggestionMenu.Root>
			{openSubmenu &&
				submenuItems.length > 0 &&
				createPortal(
					<div
						aria-label={
							items.find((item) => item.key === openSubmenu.key)?.title
						}
						className="tolaria-slash-menu__submenu"
						ref={submenuElement}
						role="menu"
						style={{ left: openSubmenu.left, top: openSubmenu.top }}
					>
						{submenuItems.map((item, index) => (
							<Button
								aria-selected={index === submenuIndex}
								className="tolaria-slash-menu__submenu-item"
								key={item.key}
								onClick={() => onItemClick?.(item)}
								onMouseDown={(event) => {
									event.preventDefault();
								}}
								onMouseEnter={() => {
									setSubmenuIndex(index);
								}}
								role="menuitem"
								size="sm"
								type="button"
								variant="ghost"
							>
								{item.icon}
								<span>{item.title}</span>
							</Button>
						))}
					</div>,
					document.body,
				)}
		</>
	);
}
