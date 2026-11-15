import { describe, expect, it } from "vitest";
import { desktopPanelParity } from "../ui/desktopParity";
import { mobileInspectorWidth } from "../ui/mobileMetrics";
import {
	tabletLeftChromeMinWidth,
	tabletReadableEditorMinWidth,
	tabletScreenModeForWindow,
} from "./tabletWorkspaceScreenMode";

const allPanelsMinWidth =
	desktopPanelParity.sidebarWidth +
	desktopPanelParity.noteListWidth +
	mobileInspectorWidth +
	tabletReadableEditorMinWidth;

type ScreenMode = ReturnType<typeof tabletScreenModeForWindow>;
type ScreenModeInput = Parameters<typeof tabletScreenModeForWindow>[0];

const defaultScreenMode: ScreenMode = {
	compactTablet: false,
	defaultPropertiesVisible: false,
	defaultSidebarVisible: true,
	exclusiveSidePanels: false,
	propertiesReplaceSidebar: false,
};

function screenMode(width: number, overrides: Partial<ScreenModeInput> = {}) {
	return tabletScreenModeForWindow({
		height: 768,
		nativeIpad: true,
		screenHeight: 768,
		screenWidth: width,
		width,
		...overrides,
	});
}

function expectedMode(overrides: Partial<ScreenMode> = {}) {
	return { ...defaultScreenMode, ...overrides };
}

describe("tabletScreenModeForWindow", () => {
	it("defaults a standard iPad window to note list and readable editor", () => {
		expect(screenMode(1024)).toEqual(
			expectedMode({
				defaultSidebarVisible: false,
				exclusiveSidePanels: true,
				propertiesReplaceSidebar: true,
			}),
		);
	});

	it("keeps the properties panel closed when an iPad fits only the persistent left chrome", () => {
		expect(screenMode(allPanelsMinWidth - 1)).toEqual(
			expectedMode({
				propertiesReplaceSidebar: true,
			}),
		);
	});

	it("opens the sidebar as soon as the editor remains readable", () => {
		expect(screenMode(tabletLeftChromeMinWidth)).toEqual(
			expectedMode({
				exclusiveSidePanels: true,
				propertiesReplaceSidebar: true,
			}),
		);
	});

	it("opens Properties when the current iPad window fits every desktop panel", () => {
		expect(screenMode(allPanelsMinWidth)).toEqual(
			expectedMode({
				defaultPropertiesVisible: true,
			}),
		);
	});

	it("can force all desktop panels for native layout QA routes", () => {
		expect(
			screenMode(allPanelsMinWidth - 1, { forceDesktopPanels: true }),
		).toEqual(
			expectedMode({
				defaultPropertiesVisible: true,
			}),
		);
	});

	it("keeps existing non-iPad compact tablet behavior", () => {
		expect(
			screenMode(900, {
				height: 1200,
				nativeIpad: false,
				screenHeight: 1200,
			}),
		).toEqual(
			expectedMode({
				compactTablet: true,
				defaultPropertiesVisible: true,
			}),
		);
	});
});
