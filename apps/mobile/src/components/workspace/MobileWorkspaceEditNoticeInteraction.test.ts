// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MobileWorkspaceEditNotice } from "./MobileWorkspaceEditNotice";

type SurfaceProps = {
	children?: ReactNode;
	testID?: string;
	style?: unknown;
};
type ButtonProps = SurfaceProps & {
	label?: string;
	onPress?: () => void;
	variant?: string;
};
function Surface({ children, testID }: SurfaceProps) {
	return createElement("div", { "data-testid": testID }, children);
}
function Button({ label, onPress, testID }: ButtonProps) {
	return createElement(
		"button",
		{ "data-testid": testID, onClick: onPress, type: "button" },
		label,
	);
}
vi.mock("react-native", () => ({
	AccessibilityInfo: { announceForAccessibility: vi.fn() },
	StyleSheet: {
		absoluteFill: { position: "absolute" },
		create: (styles: object) => styles,
	},
	View: Surface,
}));
vi.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0 }),
}));
vi.mock("../../i18n/mobileText", () => ({ mobileText: (key: string) => key }));
vi.mock("../../ui/MobileButton", () => ({ MobileButton: Button }));
vi.mock("../../ui/theme/useMobileTheme", () => ({
	useMobileStyles: (factory: (colors: object, metrics: object) => object) => ({
		styles: factory(
			{ borderStrong: "#000", popover: "#fff", text: "#111" },
			{ size: (value: number) => value },
		),
	}),
}));
vi.mock("../ui/text", () => ({ Text: Surface }));
vi.mock("./MobileSwipeableNoteRow", () => ({ MobileListMotion: Surface }));

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	vi.useFakeTimers();
	host = document.createElement("div");
	root = createRoot(host);
});
afterEach(async () => {
	await act(async () => root.unmount());
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

it("shows timed undo feedback and invokes the existing undo action", async () => {
	const undo = vi.fn();
	await render({
		undo,
		undoFeedback: { action: "deleted", id: {} },
	});
	expect(host.textContent).toContain("mobile.workspace.action.deleted");
	await act(async () =>
		host
			.querySelector<HTMLButtonElement>(
				'[data-testid="workspace-action-undo-toast"]',
			)
			?.click(),
	);
	expect(undo).toHaveBeenCalledOnce();
	await act(async () => vi.advanceTimersByTime(4000));
	expect(
		host.querySelector('[data-testid="workspace-edit-notice"]'),
	).toBeNull();
});

it("names the failed action and hides undo while the write failure is active", async () => {
	await render({
		failedAction: "archived",
		retry: vi.fn(),
		sync: { kind: "writeFailed" },
		undo: vi.fn(),
		undoFeedback: { action: "archived", id: {} },
	});
	expect(host.textContent).toContain("mobile.workspace.actionFailure.archived");
	expect(
		host.querySelector('[data-testid="workspace-action-undo-toast"]'),
	).toBeNull();
	expect(
		host.querySelector('[data-testid="workspace-edit-retry"]'),
	).not.toBeNull();
});

function render(props: ComponentProps) {
	return act(async () =>
		root.render(createElement(MobileWorkspaceEditNotice, props)),
	);
}

type ComponentProps = Parameters<typeof MobileWorkspaceEditNotice>[0];
