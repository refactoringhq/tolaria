// @vitest-environment jsdom
import { act, createElement, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
	usePhonePanelDragSurface,
	usePhoneWorkspaceNavigation,
} from "./phoneWorkspaceScreenSupport";
import type { PhoneWorkspaceState } from "./phoneWorkspaceTransitions";
import { createdPhoneNoteSelection } from "./usePhoneWorkspaceChromeController";

const viewport = vi.hoisted(() => ({
	width: 874,
	insets: { left: 62, right: 62, top: 0, bottom: 21 },
}));
vi.mock("react-native", () => ({
	useWindowDimensions: () => ({ width: viewport.width }),
}));
vi.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => viewport.insets,
}));

const roots: ReturnType<typeof createRoot>[] = [];
beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	viewport.width = 874;
	viewport.insets = { left: 62, right: 62, top: 0, bottom: 21 };
});
afterEach(async () => {
	for (const root of roots.splice(0)) await act(async () => root.unmount());
	vi.unstubAllGlobals();
});

it("accepts both visible editor edges inside landscape safe areas, not the editing surface", async () => {
	const surface = await mountSurface("editor");
	expect(surface.accepts({ x: 70, y: 160 })).toBe(true);
	expect(surface.accepts({ x: 804, y: 160 })).toBe(true);
	expect(surface.accepts({ x: 400, y: 160 })).toBe(false);
});

it("accepts the list body as a surface for rightward sidebar navigation", async () => {
	const surface = await mountSurface("list");
	expect(surface.accepts({ x: 70, y: 160 })).toBe(true);
	expect(surface.accepts({ x: 400, y: 10 })).toBe(true);
	expect(surface.accepts({ x: 400, y: 160 })).toBe(true);
});

it("updates the gesture bounds when rotation removes the horizontal safe areas", async () => {
	const surface = await mountSurface("editor");
	viewport.width = 402;
	viewport.insets = { left: 0, right: 0, top: 62, bottom: 34 };
	await surface.render();
	expect(surface.accepts({ x: 8, y: 160 })).toBe(true);
	expect(surface.accepts({ x: 394, y: 160 })).toBe(true);
	expect(surface.accepts({ x: 70, y: 160 })).toBe(false);
});

it("discards an eligible new-note draft when returning to the list", async () => {
	const events: string[] = [];
	const discard = vi.fn(() => events.push("discard"));
	const setPhoneState = vi.fn((state: PhoneWorkspaceState) =>
		events.push(state),
	);
	let openList: (() => void) | undefined;
	function Probe() {
		const navigation = usePhoneWorkspaceNavigation({
			controller: { onDiscardPristineNewNote: discard } as never,
			setPhoneState,
			setSourceModeRequest: vi.fn(),
		});
		useLayoutEffect(() => {
			openList = navigation.openList;
		}, [navigation.openList]);
		return null;
	}
	const root = createRoot(document.createElement("div"));
	roots.push(root);
	await act(async () => root.render(createElement(Probe)));

	await act(async () => openList?.());

	expect(discard).toHaveBeenCalledOnce();
	expect(events).toEqual(["discard", "list"]);
});

it("hands a newly created snapshot selection to phone navigation once", () => {
	expect(
		createdPhoneNoteSelection({ previousId: "old-note.md" }, "new-note.md"),
	).toBe("new-note.md");
	expect(
		createdPhoneNoteSelection({ previousId: "old-note.md" }, "old-note.md"),
	).toBeNull();
	expect(createdPhoneNoteSelection(null, "new-note.md")).toBeNull();
});

async function mountSurface(state: PhoneWorkspaceState) {
	const root = createRoot(document.createElement("div"));
	roots.push(root);
	let accepts: ReturnType<typeof usePhonePanelDragSurface>;
	function Probe() {
		const surface = usePhonePanelDragSurface(state);
		useLayoutEffect(() => {
			accepts = surface;
		}, [surface]);
		return null;
	}
	const render = () => act(async () => root.render(createElement(Probe)));
	await render();
	return {
		get accepts() {
			return accepts;
		},
		render,
	};
}
