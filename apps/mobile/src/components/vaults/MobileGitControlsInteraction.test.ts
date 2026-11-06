// @vitest-environment jsdom
import { act, type ComponentProps, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MobileGitControls } from "./MobileGitControls";

type Props = {
	children?: ReactNode;
	testID?: string;
	label?: string;
	onPress?: () => void;
	disabled?: boolean;
	checked?: boolean;
	onCheckedChange?: (checked: boolean) => void;
};
const preferences = vi.hoisted(() => ({
	settings: { autoGit: true },
	ready: true,
	saving: false,
	update: vi.fn(async () => true),
}));
const capture = vi.hoisted(() => vi.fn());
function Surface(props: Props) {
	return createElement("div", { "data-testid": props.testID }, props.children);
}
function Control(props: Props) {
	return createElement(
		"button",
		{
			type: "button",
			"data-testid": props.testID,
			onClick: props.onPress,
			disabled: props.disabled,
		},
		props.label,
	);
}
vi.mock("react-native", () => ({ View: Surface }));
vi.mock("../ui/ChromeSymbol", () => ({ ChromeSymbol: () => null }));
vi.mock("phosphor-react-native", () => ({
	ArrowClockwise: () => null,
	GitCommit: () => null,
}));
vi.mock("../../settings/useMobileSettings", () => ({
	useMobileSettings: () => preferences,
}));
vi.mock("../../analytics/useMobileAnalytics", () => ({
	useMobileAnalytics: () => ({ capture }),
}));
vi.mock("../ui/switch", () => ({
	Switch: (props: Props) =>
		createElement("button", {
			type: "button",
			"data-testid": props.testID,
			disabled: props.disabled,
			onClick: () => props.onCheckedChange?.(!props.checked),
		}),
}));
vi.mock("../../ui/theme/useMobileTheme", () => ({
	useMobileStyles: () => ({}),
	useMobileColors: () => ({}),
}));
vi.mock("../../ui/MobileButton", () => ({ MobileButton: Control }));
vi.mock("../../ui/MobileTextInput", () => ({
	MobileTextInput: (props: Props) =>
		createElement("input", { "data-testid": props.testID }),
}));
vi.mock("../ui/text", () => ({ Text: Surface }));

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
beforeEach(() => {
	vi.clearAllMocks();
	preferences.ready = true;
	preferences.saving = false;
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	host = document.createElement("div");
	root = createRoot(host);
});

it("places the Auto Git switch inside Git and preserves persistence and analytics", async () => {
	preferences.settings.autoGit = true;
	await act(async () =>
		root.render(
			createElement(MobileGitControls, { manager: managerFixture() }),
		),
	);
	const section = host.querySelector('[data-testid="vault-git-controls"]');
	const toggle = section?.querySelector<HTMLButtonElement>(
		'[data-testid="settings-auto-git"]',
	);
	expect(toggle).not.toBeNull();
	expect(
		host.querySelectorAll('[data-testid="settings-auto-git"]'),
	).toHaveLength(1);
	await act(async () => toggle?.click());
	expect(preferences.update).toHaveBeenCalledExactlyOnceWith({
		autoGit: false,
	});
	expect(capture).toHaveBeenCalledExactlyOnceWith({
		name: "mobile_setting_changed",
		setting: "autoGit",
	});
});

it("keeps the toggle disabled while Git is busy and omits Git controls for local-only vaults", async () => {
	const manager = managerFixture();
	await act(async () =>
		root.render(
			createElement(MobileGitControls, { manager: { ...manager, busy: true } }),
		),
	);
	expect(
		host.querySelector<HTMLButtonElement>('[data-testid="settings-auto-git"]')
			?.disabled,
	).toBe(true);
	await act(async () =>
		root.render(
			createElement(MobileGitControls, {
				manager: { ...manager, active: { ...manager.active, git: null } },
			}),
		),
	);
	expect(host.querySelector('[data-testid="vault-git-controls"]')).toBeNull();
});

function managerFixture(): ComponentProps<typeof MobileGitControls>["manager"] {
	return {
		active: {
			selection: null,
			git: {
				id: "owned",
				label: "Owned",
				repositoryUrl: "https://github.com/fixture/owned.git",
			},
		},
		busy: false,
		status: "pending",
		lastCommitId: null,
		sync: vi.fn(async () => {}),
		commit: vi.fn(async () => {}),
	};
}
afterEach(async () => {
	await act(async () => root.unmount());
	vi.unstubAllGlobals();
});

it.each([true, false])(
	"shows manual commit controls only when AutoGit is disabled (%s)",
	async (autoGit) => {
		preferences.settings.autoGit = autoGit;
		const sync = vi.fn(async () => {});
		const manager: ComponentProps<typeof MobileGitControls>["manager"] = {
			active: {
				selection: null,
				git: {
					id: "owned",
					label: "Owned",
					repositoryUrl: "https://github.com/fixture/owned.git",
				},
			},
			busy: false,
			status: "pending",
			lastCommitId: null,
			sync,
			commit: vi.fn(async () => {}),
		};
		await act(async () =>
			root.render(createElement(MobileGitControls, { manager })),
		);
		expect(
			Boolean(host.querySelector('[data-testid="git-commit-message"]')),
		).toBe(!autoGit);
		expect(
			Boolean(host.querySelector('[data-testid="git-commit-local"]')),
		).toBe(!autoGit);
		expect(Boolean(host.querySelector('[data-testid="git-commit-sync"]'))).toBe(
			!autoGit,
		);
		await act(async () =>
			host
				.querySelector<HTMLButtonElement>('[data-testid="git-sync-now"]')
				?.click(),
		);
		expect(sync).toHaveBeenCalledExactlyOnceWith();
	},
);
