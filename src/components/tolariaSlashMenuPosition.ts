import {
	type Dispatch,
	type RefObject,
	type SetStateAction,
	useLayoutEffect,
} from "react";

export interface OpenSubmenu {
	key: string;
	left: number;
	top: number;
}

const SUBMENU_VIEWPORT_GUTTER = 8;

function positionSubmenu({
	anchor,
	submenu,
	viewport,
}: {
	anchor: DOMRect;
	submenu: DOMRect;
	viewport: { height: number; width: number };
}): Pick<OpenSubmenu, "left" | "top"> {
	const left =
		anchor.right + submenu.width <= viewport.width - SUBMENU_VIEWPORT_GUTTER
			? anchor.right
			: Math.max(SUBMENU_VIEWPORT_GUTTER, anchor.left - submenu.width);
	const top = Math.min(
		Math.max(SUBMENU_VIEWPORT_GUTTER, anchor.top),
		Math.max(
			SUBMENU_VIEWPORT_GUTTER,
			viewport.height - submenu.height - SUBMENU_VIEWPORT_GUTTER,
		),
	);
	return { left, top };
}

function getSubmenuPosition({
	itemElements,
	openSubmenu,
	submenuElement,
}: {
	itemElements: RefObject<Map<string, Element | null>>;
	openSubmenu: OpenSubmenu | null;
	submenuElement: RefObject<HTMLDivElement | null>;
}): Pick<OpenSubmenu, "left" | "top"> | null {
	const submenuBounds = submenuElement.current?.getBoundingClientRect();
	if (!openSubmenu || !submenuBounds) return null;

	const anchorBounds = itemElements.current
		.get(openSubmenu.key)
		?.getBoundingClientRect();
	if (!anchorBounds) return null;

	return positionSubmenu({
		anchor: anchorBounds,
		submenu: submenuBounds,
		viewport: { height: window.innerHeight, width: window.innerWidth },
	});
}

function updateSubmenuPosition(options: {
	itemElements: RefObject<Map<string, Element | null>>;
	openSubmenu: OpenSubmenu | null;
	setOpenSubmenu: Dispatch<SetStateAction<OpenSubmenu | null>>;
	submenuElement: RefObject<HTMLDivElement | null>;
}) {
	const { openSubmenu, setOpenSubmenu } = options;
	if (!openSubmenu) return;
	const position = getSubmenuPosition(options);
	if (!position) return;
	if (position.left === openSubmenu.left && position.top === openSubmenu.top)
		return;
	const { left, top } = position;
	setOpenSubmenu((current) =>
		current?.key === openSubmenu.key ? { ...current, left, top } : current,
	);
}

export function useSubmenuPosition(options: {
	itemElements: RefObject<Map<string, Element | null>>;
	openSubmenu: OpenSubmenu | null;
	setOpenSubmenu: Dispatch<SetStateAction<OpenSubmenu | null>>;
	submenuElement: RefObject<HTMLDivElement | null>;
}) {
	const { itemElements, openSubmenu, setOpenSubmenu, submenuElement } = options;
	useLayoutEffect(() => {
		updateSubmenuPosition({
			itemElements,
			openSubmenu,
			setOpenSubmenu,
			submenuElement,
		});
	}, [itemElements, openSubmenu, setOpenSubmenu, submenuElement]);
}
