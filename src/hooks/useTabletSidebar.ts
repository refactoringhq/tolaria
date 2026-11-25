import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useKeyboardAwareViewport } from "./useKeyboardAwareViewport";
import { useMediaQueryMatch } from "./useMediaQueryMatch";
import type { ViewMode } from "./useViewMode";

/**
 * Tablets (TOL-194): iPad portrait and landscape, wider than the phone stack (TOL-193) and
 * touch-first, so a desktop browser of the same width keeps the desktop layout.
 */
export const TABLET_LAYOUT_QUERY =
	"(min-width: 641px) and (max-width: 1366px) and (pointer: coarse)";
/** On `<html>` while the tablet layout is active; App.css lays the panes out from it. */
export const TABLET_LAYOUT_ATTRIBUTE = "data-tablet-layout";
/** In portrait the open sidebar floats over the note list instead of narrowing the panes. */
const OVERLAY_SIDEBAR_QUERY = "(orientation: portrait)";

interface TabletSidebarOptions {
	enabled: boolean;
	/** Whether the view mode shows the sidebar: the desktop rule, which the tablet narrows. */
	sidebarVisible: boolean;
}

export interface TabletSidebar {
	/** Hides the sidebar on a tablet; false off the tablet, where the view mode decides. */
	collapse: () => boolean;
	/** A chosen view mode opens the sidebar ('all') or closes it. */
	followViewMode: (mode: ViewMode) => void;
	sidebarVisible: boolean;
}

/** Marks the page before it paints, so a tablet never shows the three desktop panes first. */
function useTabletLayoutAttribute(active: boolean): void {
	useLayoutEffect(() => {
		if (!active) return;
		const root = document.documentElement;
		root.setAttribute(TABLET_LAYOUT_ATTRIBUTE, "");
		return () => {
			root.removeAttribute(TABLET_LAYOUT_ATTRIBUTE);
		};
	}, [active]);
}

function isOverlayTap(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) return false;
	if (!window.matchMedia(OVERLAY_SIDEBAR_QUERY).matches) return false;
	// Menus and dialogs opened from the sidebar render outside the shell: they keep it open.
	return (
		target.closest(".app") !== null && target.closest(".app__sidebar") === null
	);
}

/** A tap beside the floating portrait sidebar closes it, as on iPadOS. */
function useCloseOnTapBeside(open: boolean, close: () => void): void {
	useEffect(() => {
		if (!open) return;
		const handlePointerDown = (event: PointerEvent) => {
			if (isOverlayTap(event.target)) close();
		};
		document.addEventListener("pointerdown", handlePointerDown, true);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown, true);
		};
	}, [open, close]);
}

/**
 * The web build's tablet layout: two panes, the note list and the note, with the sidebar
 * collapsed until asked for. The choice lasts for the session and is not written to the
 * vault's view mode, which the desktop shares.
 */
export function useTabletSidebar({
	enabled,
	sidebarVisible,
}: TabletSidebarOptions): TabletSidebar {
	const active = useMediaQueryMatch(TABLET_LAYOUT_QUERY, enabled);
	const [open, setOpen] = useState(false);
	const close = useCallback(() => {
		setOpen(false);
	}, []);
	const collapse = useCallback(() => {
		if (active) close();
		return active;
	}, [active, close]);
	const followViewMode = useCallback((mode: ViewMode) => {
		setOpen(mode === "all");
	}, []);
	const shown = active ? sidebarVisible && open : sidebarVisible;

	useTabletLayoutAttribute(active);
	// The status bar and the toolbars stay above the on-screen keyboard, as on the phone (TOL-419).
	useKeyboardAwareViewport(active);
	useCloseOnTapBeside(active && shown, close);
	return { collapse, followViewMode, sidebarVisible: shown };
}
