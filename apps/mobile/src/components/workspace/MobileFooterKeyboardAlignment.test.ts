// @vitest-environment jsdom
import { act, type CSSProperties, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MobileMarkdownFormattingToolbar } from "./MobileMarkdownFormattingToolbar";
import { MobileNoteListPanelFooter } from "./MobileNoteListPanelFooter.internal";

const keyboard = vi.hoisted(() => ({
	visible: false,
	bottom: 34,
	layout: "tablet" as "phone" | "tablet",
	listeners: new Map<string, Set<() => void>>(),
}));

type SurfaceProps = {
	children?: ReactNode;
	style?: CSSProperties | CSSProperties[];
	contentContainerStyle?: CSSProperties[];
	testID?: string;
};

function Surface({
	children,
	style,
	contentContainerStyle,
	testID,
}: SurfaceProps) {
	return createElement(
		"div",
		{
			style: Object.assign({}, ...[style, contentContainerStyle].flat()),
			"data-testid": testID,
		},
		children,
	);
}

vi.mock("react-native", () => ({
	View: Surface,
	ScrollView: Surface,
	Platform: { OS: "ios" },
	StyleSheet: {
		create: (styles: object) => styles,
		flatten: (styles: CSSProperties[]) => Object.assign({}, ...styles),
		hairlineWidth: 1,
	},
	Keyboard: {
		isVisible: () => keyboard.visible,
		scheduleLayoutAnimation: vi.fn(),
		addListener: (event: string, callback: () => void) => {
			const listeners = keyboard.listeners.get(event) ?? new Set();
			listeners.add(callback);
			keyboard.listeners.set(event, listeners);
			return { remove: () => listeners.delete(callback) };
		},
	},
}));
vi.mock("react-native-gesture-handler", () => ({ ScrollView: Surface }));
vi.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ bottom: keyboard.bottom }),
}));
vi.mock("../../ui/useMobileDeviceLayout", () => ({
	useMobileDeviceLayout: () => keyboard.layout,
}));
vi.mock("../../ui/theme/useMobileTheme", async () => {
	const { mobileMetrics } = await import("../../ui/mobileMetrics");
	const { mobilePalettes } = await import("../../ui/theme/mobilePalette");
	return {
		useMobileStyles: (factory: (colors: object, metrics: object) => object) =>
			factory(mobilePalettes.light, mobileMetrics[1.2]),
	};
});
vi.mock("../ui/button", () => ({
	Button: ({
		children,
		onPress,
		testID,
		style,
	}: SurfaceProps & { onPress?: () => void }) =>
		createElement(
			"button",
			{ type: "button", onClick: onPress, style, "data-testid": testID },
			children,
		),
}));
vi.mock("../ui/text", () => ({
	Text: ({ children }: SurfaceProps) => createElement("span", null, children),
}));
vi.mock("../ui/dropdown-menu", () => ({
	DropdownMenu: Surface,
	DropdownMenuTrigger: Surface,
	DropdownMenuContent: Surface,
	DropdownMenuItem: Surface,
}));
vi.mock("./mobileFormattingCommands", () => ({
	formattingCommands: [
		{
			action: "bold",
			label: "Bold",
			testID: "editor-format-bold",
			icon: () => null,
		},
	],
}));
vi.mock("phosphor-react-native", () => ({
	Archive: () => null,
	Check: () => null,
	DotsThree: () => null,
	ListBullets: () => null,
	Plus: () => null,
	Table: () => null,
	TextH: () => null,
	Keyboard: () => null,
	CaretDown: () => null,
}));
vi.mock("../../qa/MobileLayoutProbeReadout", () => ({
	MobileLayoutProbeReadout: () => null,
}));

const roots: ReturnType<typeof createRoot>[] = [];

beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	keyboard.visible = false;
	keyboard.bottom = 34;
	keyboard.layout = "tablet";
	keyboard.listeners.clear();
});

afterEach(async () => {
	for (const root of roots.splice(0)) await act(async () => root.unmount());
	expect(
		[...keyboard.listeners.values()].every((listeners) => listeners.size === 0),
	).toBe(true);
	vi.unstubAllGlobals();
});

it.each([
	{ layout: "tablet" as const, visible: false },
	{ layout: "tablet" as const, visible: true },
	{ layout: "phone" as const, visible: false },
	{ layout: "phone" as const, visible: true },
])(
	"keeps $layout list and editor footer heights aligned through keyboard changes (initial: $visible)",
	async ({ layout, visible }) => {
		keyboard.layout = layout;
		keyboard.visible = visible;
		const host = document.createElement("div");
		const root = createRoot(host);
		roots.push(root);
		await act(async () =>
			root.render(
				createElement(
					"div",
					null,
					createElement(MobileNoteListPanelFooter, {
						active: "open",
						counts: { open: 1, archived: 1 },
						layoutProbe: null,
						onChange: vi.fn(),
					}),
					createElement(MobileMarkdownFormattingToolbar, { onFormat: vi.fn() }),
				),
			),
		);

		const listFooter = requiredElement(host, "note-list-filter-pills");
		const editorFooter = requiredElement(host, "editor-formatting-toolbar");
		const expectAligned = () =>
			expect(listFooter.style.height).toBe(editorFooter.style.height);
		expectAligned();
		await keyboardEvent("keyboardWillShow");
		expectAligned();
		await keyboardEvent("keyboardWillHide");
		expectAligned();
	},
);

function requiredElement(host: ParentNode, testID: string) {
	const element = host.querySelector<HTMLElement>(`[data-testid="${testID}"]`);
	if (!element) throw new Error(`Missing element: ${testID}`);
	return element;
}

function keyboardEvent(event: string) {
	return act(async () => {
		for (const listener of keyboard.listeners.get(event) ?? []) listener();
	});
}
