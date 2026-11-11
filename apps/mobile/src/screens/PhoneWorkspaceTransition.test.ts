// @vitest-environment jsdom
import { act, createElement, type ReactNode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Gesture } from "react-native-gesture-handler";
import { makeMutable } from "react-native-reanimated";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PhoneWorkspaceTransition } from "./PhoneWorkspaceTransition";
import type { usePhonePanelRail } from "./usePhonePanelRail";

const viewport = vi.hoisted(() => ({ width: 390, left: 0, right: 0 }));
type Style = { width?: number; transform?: Array<{ translateX: number }> };
function Surface({
	children,
	style,
	testID,
	className,
}: {
	children: ReactNode;
	style: Style | Style[];
	testID?: string;
	className?: string;
}) {
	const flat: Style = Object.assign({}, ...[style].flat());
	return createElement(
		"div",
		{
			className,
			"data-testid": testID,
			"data-offset": flat.transform?.[0]?.translateX,
			style: { width: flat.width },
		},
		children,
	);
}
vi.mock("react-native", () => ({
	View: Surface,
	StyleSheet: { create: (styles: unknown) => styles, absoluteFillObject: {} },
	useWindowDimensions: () => ({ width: viewport.width }),
}));
vi.mock("react-native-reanimated", () => ({
	default: { View: Surface },
	runOnJS: (callback: (...args: unknown[]) => void) => callback,
	makeMutable: (initial: number) => {
		let value = initial;
		return {
			get: () => value,
			set: (next: number) => {
				value = next;
			},
		};
	},
	useFrameCallback: () => null,
	useAnimatedStyle: (style: () => object) => style(),
}));
vi.mock("../qa/mobileMotionFrameProbe", () => ({
	useMobileMotionFrameProbe: () => null,
}));
vi.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ left: viewport.left, right: viewport.right }),
}));
vi.mock("react-native-gesture-handler", () => ({
	Gesture: { Pan: () => ({}) },
	GestureDetector: ({ children }: { children: ReactNode }) =>
		createElement("div", { "data-detector": "native" }, children),
}));

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
let rail: ReturnType<typeof usePhonePanelRail>;
const mounted = vi.fn(),
	unmounted = vi.fn();
beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	vi.clearAllMocks();
	viewport.width = 390;
	viewport.left = 0;
	viewport.right = 0;
	host = document.createElement("div");
	root = createRoot(host);
	rail = { enabled: true, offset: makeMutable(-304), gesture: Gesture.Pan() };
});
afterEach(async () => {
	await act(async () => root.unmount());
	vi.unstubAllGlobals();
});

it("moves the one retained editor on the same rail without rendering a preview copy", async () => {
	await render();
	rail.offset.set(-694);
	await render();
	expect(host.querySelectorAll("button")).toHaveLength(1);
	expect(host.querySelector('[data-offset="-694"]')).not.toBeNull();
	expect(mounted).toHaveBeenCalledOnce();
	expect(unmounted).not.toHaveBeenCalled();
});

it("leaves room for every pane inside the native hit-test rail", async () => {
	await render();
	expect(host.querySelector("[data-offset]")?.getAttribute("style")).toContain(
		"width: 1474px",
	);
	expect(host.querySelector('[data-detector="native"]')).not.toBeNull();
	expect(mounted).toHaveBeenCalledOnce();
});

it("uses the same retained rail without a native detector on web", async () => {
	rail.enabled = false;
	await render();
	expect(host.querySelector("[data-detector]")).toBeNull();
	expect(
		host.querySelector('[data-testid="phone-transition-stage"]')?.className,
	).toBe("!overflow-clip");
	expect(mounted).toHaveBeenCalledOnce();
});

it("retains the editor when the rail geometry changes on rotation", async () => {
	await render();
	viewport.width = 844;
	rail.offset.set(-1164);
	await render();
	expect(host.querySelector("[data-offset]")?.getAttribute("style")).toContain(
		"width: 2852px",
	);
	expect(mounted).toHaveBeenCalledOnce();
});

it("uses the actual safe-area viewport rather than extending landscape panes off screen", async () => {
	viewport.width = 852;
	viewport.left = 62;
	viewport.right = 62;
	await render();
	expect(host.querySelector("[data-offset]")?.getAttribute("style")).toContain(
		"width: 2504px",
	);
	expect(mounted).toHaveBeenCalledOnce();
});

function Editor() {
	useEffect(() => {
		mounted();
		return () => {
			unmounted();
		};
	}, []);
	return createElement("button", { type: "button" }, "Editor");
}
function render() {
	return act(async () =>
		root.render(
			createElement(PhoneWorkspaceTransition, {
				children: createElement(Editor),
				panelRail: rail,
			}),
		),
	);
}
