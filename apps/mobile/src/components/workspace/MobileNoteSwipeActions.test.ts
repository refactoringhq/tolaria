// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SharedValue } from "react-native-reanimated";
import { MobileNoteSwipeActions } from "./MobileNoteSwipeActions";

const checkProps = vi.hoisted(() => ({ size: 0 }));

vi.mock("phosphor-react-native", () => ({
	ArchiveIcon: () => createElement("span", { "data-testid": "archive-icon" }),
	CheckCircle: (props: { size?: number }) => {
		checkProps.size = props.size ?? 0;
		return createElement("span", { "data-testid": "organize-check-icon" });
	},
	Star: () => createElement("span", { "data-testid": "star-icon" }),
	Trash: () => createElement("span", { "data-testid": "trash-icon" }),
}));
vi.mock("react-native", () => ({
	StyleSheet: { create: (styles: unknown) => styles },
	Text: ({ children }: { children?: ReactNode }) =>
		createElement("span", { "data-testid": "visible-text" }, children),
}));
vi.mock("react-native-reanimated", () => ({
	useAnimatedStyle: (style: () => unknown) => style(),
	useDerivedValue: (value: () => unknown) => ({ get: value }),
	default: {
		View: ({
			children,
			testID,
		}: {
			children?: ReactNode;
			testID?: string;
		}) => createElement("div", { "data-testid": testID }, children),
	},
}));
vi.mock("../../qa/mobileMotionFrameProbe", () => ({
	useMobileMotionFrameProbe: () => null,
}));
vi.mock("../../i18n/mobileText", () => ({
	mobileText: (key: string) => key,
}));
vi.mock("../../ui/theme/useMobileTheme", () => ({
	useMobileStyles: (factory: (colors: Record<string, string>) => {
		styles: unknown;
		mobileColors: Record<string, string>;
	}) =>
		factory({
			textInverse: "#fff",
			primary: "#00f",
			green: "#0a0",
			danger: "#f00",
		}),
}));
vi.mock("../ui/button", () => ({
	Button: ({
		children,
		accessibilityLabel,
		testID,
	}: {
		children?: ReactNode;
		accessibilityLabel?: string;
		testID?: string;
	}) =>
		createElement(
			"button",
			{
				type: "button",
				"aria-label": accessibilityLabel,
				"data-testid": testID,
			},
			children,
		),
}));

function shared<T>(value: T): SharedValue<T> {
	return {
		get: () => value,
		set: () => undefined,
		value,
		addListener: () => undefined,
		removeListener: () => undefined,
		modify: () => undefined,
	} as SharedValue<T>;
}

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	host = document.createElement("div");
	root = createRoot(host);
	checkProps.size = 0;
});

afterEach(async () => {
	await act(async () => root.unmount());
	vi.unstubAllGlobals();
});

async function renderActions(fullSwipePreview = false) {
	await act(async () => {
		root.render(
			createElement(MobileNoteSwipeActions, {
				favorite: false,
				noteId: "note-1",
				onArchive: () => undefined,
				onDelete: () => undefined,
				onFavorite: () => undefined,
				onOrganize: () => undefined,
				primarySwipeAction: "organize",
				fullSwipeCommitted: shared(false),
				fullSwipePreview,
				fullSwipeRevealed: shared(false),
				translation: shared(-80),
				width: shared(340),
			}),
		);
	});
}

describe("MobileNoteSwipeActions organize action", () => {
	it("shows only the check icon, with the label kept for accessibility", async () => {
		await renderActions(false);
		const organize = host.querySelector(
			'[data-testid="note-swipe-organize-note-1"]',
		);
		expect(organize).not.toBeNull();
		expect(organize?.getAttribute("aria-label")).toBe(
			"command.note.markOrganized",
		);
		expect(host.querySelector('[data-testid="organize-check-icon"]')).not.toBeNull();
		expect(checkProps.size).toBe(24);
		expect(host.querySelector('[data-testid="visible-text"]')).toBeNull();
		expect(host.textContent).not.toContain("noteList.bulk.organize");
		expect(host.textContent).not.toContain("Organize selected notes");
	});

	it("stays icon-only during the full-row organize reveal", async () => {
		await renderActions(true);
		const organize = host.querySelector(
			'[data-testid="note-swipe-organize-note-1"]',
		);
		expect(organize?.getAttribute("aria-label")).toBe(
			"command.note.markOrganized",
		);
		expect(host.querySelector('[data-testid="visible-text"]')).toBeNull();
		expect(host.textContent).not.toContain("noteList.bulk.organize");
	});
});
