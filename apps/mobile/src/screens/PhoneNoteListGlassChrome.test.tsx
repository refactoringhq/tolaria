// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PhoneNoteListGlassChrome } from "./PhoneNoteListGlassChrome";

vi.mock("expo-glass-effect", () => ({
	GlassView: ({ children }: { children?: ReactNode }) =>
		createElement("div", null, children),
}));
vi.mock("expo-symbols", () => ({ SymbolView: () => null }));
vi.mock("react-native", () => ({
	Pressable: ({
		children,
		onPress,
		testID,
	}: {
		children?: ReactNode;
		onPress?: () => void;
		testID?: string;
	}) =>
		createElement(
			"button",
			{ type: "button", "data-testid": testID, onClick: onPress },
			children,
		),
	StyleSheet: { absoluteFill: {}, create: (value: object) => value },
	View: ({ children, testID }: { children?: ReactNode; testID?: string }) =>
		createElement("div", { "data-testid": testID }, children),
}));
vi.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 47 }),
}));
vi.mock("../components/ui/text", () => ({
	Text: ({ children }: { children?: ReactNode }) =>
		createElement("span", null, children),
}));
vi.mock("../ui/theme/useMobileTheme", () => ({
	useMobileColors: () => ({ text: "#111" }),
	useMobileMetrics: () => ({
		phoneChrome: { rowHorizontalPadding: 16 },
		space: { sm: 8 },
	}),
}));
vi.mock("./PhoneEditorTopFade", () => ({ PhoneEditorTopFade: () => null }));

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;

beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	host = document.createElement("div");
	root = createRoot(host);
});

afterEach(async () => {
	await act(async () => root.unmount());
	vi.unstubAllGlobals();
});

it("keeps the sidebar and search tappable and reveals the collapsed title", async () => {
	const openSearch = vi.fn();
	const leading = createElement(
		"button",
		{ type: "button", "data-testid": "sidebar-button" },
		"Sidebar",
	);
	await act(async () =>
		root.render(
			createElement(PhoneNoteListGlassChrome, {
				leading,
				onOpenSearch: openSearch,
				title: "Inbox",
				titleVisible: true,
			}),
		),
	);

	expect(host.querySelector('[data-testid="sidebar-button"]')).not.toBeNull();
	expect(
		host.querySelector('[data-testid="phone-note-list-collapsed-title"]')
			?.textContent,
	).toBe("Inbox");
	await act(async () =>
		host
			.querySelector<HTMLButtonElement>(
				'[data-testid="phone-note-list-search"]',
			)
			?.click(),
	);
	expect(openSearch).toHaveBeenCalledOnce();
});
