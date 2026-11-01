// @vitest-environment jsdom
import {
	act,
	type ContextType,
	type CSSProperties,
	createElement,
	type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
	MobileVaultControlsContext,
	MobileVaultDisplayContext,
} from "../../workspace/MobileVaultContext";
import { MobileSidebarSettings } from "./MobileSidebarSettings";

const preferences = vi.hoisted(() => ({
	open: vi.fn(),
	settings: { autoGit: true },
}));
type Props = {
	children?: ReactNode;
	style?: CSSProperties | CSSProperties[];
	testID?: string;
	accessibilityLabel?: string;
	disabled?: boolean;
	onPress?: () => void;
	numberOfLines?: number;
};
const style = (value: Props["style"]) => Object.assign({}, ...[value].flat());
function Surface(props: Props) {
	return createElement(
		"div",
		{
			style: style(props.style),
			"data-testid": props.testID,
			"data-number-of-lines": props.numberOfLines,
		},
		props.children,
	);
}
function Control(props: Props) {
	return createElement(
		"button",
		{
			type: "button",
			style: style(props.style),
			"data-testid": props.testID,
			"aria-label": props.accessibilityLabel,
			disabled: props.disabled,
			onClick: props.onPress,
		},
		props.children,
	);
}
vi.mock("react-native", () => ({
	View: Surface,
	ActivityIndicator: () => null,
	StyleSheet: { create: (value: object) => value },
}));
vi.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ bottom: 34 }),
}));
vi.mock("expo-symbols", () => ({ SymbolView: () => null }));
vi.mock("../../settings/useMobileSettings", () => ({
	useMobileSettings: () => preferences,
}));
vi.mock("../../ui/theme/useMobileTheme", () => ({
	useMobileColors: () => ({
		control: "#eee",
		text: "#222",
		textMuted: "#777",
		danger: "#c22",
		yellow: "#eab308",
	}),
}));
vi.mock("../ui/button", () => ({ Button: Control }));
vi.mock("../ui/text", () => ({ Text: Surface }));
vi.mock("phosphor-react-native", () => ({
	ArrowClockwise: () => null,
	Command: () => null,
	GearSix: () => null,
}));

type Controls = NonNullable<ContextType<typeof MobileVaultControlsContext>>;
const now = Date.UTC(2026, 9, 18, 9);
const defaults: Controls = {
	rootUri: "file:///owned/",
	git: true,
	busy: false,
	status: "pending",
	historyAvailable: true,
	lastSuccessAt: now - 120_000,
	open: vi.fn(async () => {}),
	sync: vi.fn(async () => {}),
};
let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	vi.useFakeTimers();
	vi.setSystemTime(now);
	vi.clearAllMocks();
	preferences.settings.autoGit = true;
	host = document.createElement("div");
	root = createRoot(host);
});
afterEach(async () => {
	await act(async () => root.unmount());
	expect(vi.getTimerCount()).toBe(0);
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

it("places sync to the left of Command and Settings and invokes the existing sync callback", async () => {
	await render(defaults);
	expect(
		[...host.querySelectorAll("button")].map((button) => button.dataset.testid),
	).toEqual([
		"sidebar-sync-action",
		"sidebar-command-palette-action",
		"open-mobile-settings",
	]);
	expect(host.textContent).toBe("GitHub2m ago");
	expect(
		host
			.querySelector('[data-testid="sidebar-sync-action"]')
			?.getAttribute("aria-label"),
	).toContain("Changes pending");
	expect(
		host
			.querySelector('[data-testid="sidebar-sync-destination"]')
			?.getAttribute("data-number-of-lines"),
	).toBe("1");
	expect(
		host
			.querySelector('[data-testid="sidebar-sync-state"]')
			?.getAttribute("data-number-of-lines"),
	).toBe("1");
	await click("sidebar-sync-action");
	expect(defaults.sync).toHaveBeenCalledExactlyOnceWith();
	expect(defaults.open).not.toHaveBeenCalled();
});
it("updates pending status and relative sync time without changing the selected vault", async () => {
	await render({ ...defaults, status: "synced" });
	expect(host.textContent).toBe("GitHub2m ago");
	await act(async () => vi.advanceTimersByTime(60_000));
	expect(host.textContent).toBe("GitHub3m ago");
});
it("keeps the local-change marker next to the source and removes it after a checkpoint", async () => {
	await render(defaults);
	const marker = host.querySelector<HTMLElement>(
		'[data-testid="sidebar-sync-pending-local"]',
	);
	expect(marker).not.toBeNull();
	expect(marker?.style.backgroundColor).toBe("rgb(234, 179, 8)");
	expect(
		marker?.parentElement?.querySelector(
			'[data-testid="sidebar-sync-destination"]',
		),
	).not.toBeNull();
	expect(host.textContent).toBe("GitHub2m ago");
	await render({ ...defaults, status: "committed" });
	expect(
		host.querySelector('[data-testid="sidebar-sync-pending-local"]'),
	).toBeNull();
	await render({ ...defaults, historyAvailable: false });
	expect(
		host.querySelector('[data-testid="sidebar-sync-pending-local"]'),
	).toBeNull();
});
it("keeps a failure on the second line and the last successful time in the accessible details", async () => {
	await render({ ...defaults, status: "failed" });
	expect(host.textContent).toBe("GitHubSync failed");
	expect(
		host
			.querySelector('[data-testid="sidebar-sync-action"]')
			?.getAttribute("aria-label"),
	).toContain("2m ago");
	expect(
		host.querySelector('[data-testid="sidebar-sync-last-success"]'),
	).toBeNull();
});
it("disables duplicate sync requests while busy", async () => {
	await render({ ...defaults, busy: true });
	expect(host.textContent).toBe("GitHubSyncing...");
	expect(
		host.querySelector<HTMLButtonElement>('[data-testid="sidebar-sync-action"]')
			?.disabled,
	).toBe(true);
	await click("sidebar-sync-action");
	expect(defaults.sync).not.toHaveBeenCalled();
});
it("opens existing vault management for local-only and manual-commit workflows", async () => {
	await render({ ...defaults, git: false, status: "local" });
	expect(host.textContent).toContain("Local onlyNot linked");
	await click("sidebar-sync-action");
	preferences.settings.autoGit = false;
	await render(defaults);
	await click("sidebar-sync-action");
	expect(defaults.open).toHaveBeenCalledTimes(2);
	expect(defaults.sync).not.toHaveBeenCalled();
});
it("does not expose a live sync control for a different displayed vault", async () => {
	await render(defaults, "file:///other/");
	expect(host.querySelector('[data-testid="sidebar-sync-action"]')).toBeNull();
	await click("open-mobile-settings");
	expect(preferences.open).toHaveBeenCalledOnce();
});

function render(controls: Controls, rootUri = defaults.rootUri) {
	return act(async () =>
		root.render(
			createElement(
				MobileVaultControlsContext.Provider,
				{ value: controls },
				createElement(
					MobileVaultDisplayContext.Provider,
					{ value: { source: "native", rootUri } },
					createElement(MobileSidebarSettings, {
						onOpenCommandPalette: vi.fn(),
					}),
				),
			),
		),
	);
}
function click(id: string) {
	return act(async () =>
		host.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)?.click(),
	);
}
