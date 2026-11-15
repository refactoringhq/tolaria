import { desktopPanelParity } from "../ui/desktopParity";
import { mobileInspectorWidth } from "../ui/mobileMetrics";

export const tabletReadableEditorMinWidth = 520;

export const tabletLeftChromeMinWidth =
	desktopPanelParity.sidebarWidth +
	desktopPanelParity.noteListWidth +
	tabletReadableEditorMinWidth;

const tabletSidePanelSwapMinWidth =
	desktopPanelParity.noteListWidth +
	mobileInspectorWidth +
	tabletReadableEditorMinWidth;

const tabletAllPanelsMinWidth =
	desktopPanelParity.sidebarWidth +
	desktopPanelParity.noteListWidth +
	mobileInspectorWidth +
	tabletReadableEditorMinWidth;

export function tabletScreenModeForWindow({
	forceDesktopPanels = false,
	height,
	nativeIpad,
	screenHeight,
	screenWidth,
	width,
}: {
	forceDesktopPanels?: boolean;
	height: number;
	nativeIpad: boolean;
	screenHeight: number;
	screenWidth: number;
	width: number;
}) {
	const adaptiveIpad = nativeIpad && !forceDesktopPanels;

	return {
		compactTablet: compactTabletForWindow({
			forceDesktopPanels,
			height,
			nativeIpad,
			screenHeight,
			screenWidth,
			width,
		}),
		...tabletPanelDefaults({
			adaptiveIpad,
			forceDesktopPanels,
			nativeIpad,
			width,
		}),
	};
}

function compactTabletForWindow({
	forceDesktopPanels,
	height,
	nativeIpad,
	screenHeight,
	screenWidth,
	width,
}: {
	forceDesktopPanels: boolean;
	height: number;
	nativeIpad: boolean;
	screenHeight: number;
	screenWidth: number;
	width: number;
}) {
	return (
		!forceDesktopPanels &&
		!nativeIpad &&
		width < 1080 &&
		width < height &&
		screenWidth < screenHeight
	);
}

function tabletPanelDefaults({
	adaptiveIpad,
	forceDesktopPanels,
	nativeIpad,
	width,
}: {
	adaptiveIpad: boolean;
	forceDesktopPanels: boolean;
	nativeIpad: boolean;
	width: number;
}) {
	return {
		defaultPropertiesVisible:
			forceDesktopPanels ||
			(nativeIpad ? width >= tabletAllPanelsMinWidth : true),
		defaultSidebarVisible: !adaptiveIpad || width >= tabletLeftChromeMinWidth,
		exclusiveSidePanels: adaptiveIpad && width < tabletSidePanelSwapMinWidth,
		propertiesReplaceSidebar: adaptiveIpad && width < tabletAllPanelsMinWidth,
	};
}
