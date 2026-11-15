// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileListRow } from "../../ui/MobileListRow";
import { MobileNoteIcon } from "./MobileWorkspaceIcons";

vi.mock("react-native", async () => {
	const { createElement: element } = await import("react");
	const Container = ({
		children,
		testID,
	}: {
		children?: React.ReactNode;
		testID?: string;
	}) => element("div", { "data-testid": testID }, children);
	return {
		Image: "native-image",
		Pressable: ({
			children,
			onPress,
		}: {
			children?: React.ReactNode;
			onPress?: () => void;
		}) => element("button", { onClick: onPress }, children),
		StyleSheet: { create: (styles: object) => styles, hairlineWidth: 1 },
		View: Container,
	};
});
vi.mock("../ui/text", async () => {
	const { createElement: element } = await import("react");
	return {
		Text: ({
			children,
			testID,
		}: {
			children?: React.ReactNode;
			testID?: string;
		}) => element("span", { "data-testid": testID }, children),
	};
});
vi.mock("../../ui/theme/useMobileTheme", () => {
	type MockColors = {
		border: string;
		primarySoft: string;
		text: string;
		textMuted: string;
	};
	type MockMetrics = {
		noteItem: {
			contentGap: number;
			padding: { bottom: number; left: number; right: number; top: number };
			snippetLineHeight: number;
			snippetTextSize: number;
			titleLineHeight: number;
			titleTextSize: number;
		};
		space: { sm: number };
		type: { caption: number };
	};
	const colors: MockColors = {
		border: "#ddd",
		primarySoft: "#eee",
		text: "#111",
		textMuted: "#777",
	};
	const metrics: MockMetrics = {
		noteItem: {
			contentGap: 4,
			padding: { bottom: 8, left: 12, right: 12, top: 8 },
			snippetLineHeight: 16,
			snippetTextSize: 12,
			titleLineHeight: 18,
			titleTextSize: 15,
		},
		space: { sm: 4 },
		type: { caption: 11 },
	};
	return {
		useMobileColors: () => colors,
		useMobileStyles: (
			createStyles: (colors: MockColors, metrics: MockMetrics) => unknown,
		) => createStyles(colors, metrics),
	};
});
vi.mock("./MobileWorkspaceIconResolver", () => ({
	mobilePhosphorIconElement: (icon: string, props: object) =>
		icon === "rocket" ? { type: "phosphor-rocket", props } : null,
	requiredMobilePhosphorIcon: () => "phosphor-file",
}));
vi.mock("./MobileWorkspaceIconNames", () => ({
	mobileTypeConfiguredIcon: () => null,
	mobileTypeIconCandidates: () => [],
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const roots: ReturnType<typeof createRoot>[] = [];
afterEach(async () => {
	for (const root of roots.splice(0)) await act(async () => root.unmount());
});

describe("MobileNoteIcon", () => {
	it("renders an emoji value without altering it", () => {
		const icon = MobileNoteIcon({
			color: "#111",
			icon: "🚀",
			size: 15,
			testID: "note-title-icon",
		});

		expect(icon?.props.children).toBe("🚀");
		expect(icon?.props.testID).toBe("note-title-icon");
	});

	it("renders a registered Phosphor icon instead of its raw name", () => {
		const icon = MobileNoteIcon({
			color: "#111",
			icon: "rocket",
			size: 15,
			testID: "note-title-icon",
		});

		expect(icon).not.toBeNull();
		expect(icon?.type).toBe("phosphor-rocket");
		expect(icon?.props.testID).toBe("note-title-icon");
	});

	it("renders an HTTP image URL as an image", () => {
		const icon = MobileNoteIcon({
			color: "#111",
			icon: "https://example.test/icon.png",
			size: 15,
			testID: "note-title-icon",
		});

		expect(icon).not.toBeNull();
		expect(icon?.props.src).toBe("https://example.test/icon.png");
	});

	it.each([null, undefined, "", "not-a-phosphor-icon", ":rocket:"])(
		"renders no title icon for %s",
		(value) => {
			expect(
				MobileNoteIcon({ color: "#111", icon: value, size: 15 }),
			).toBeNull();
		},
	);
});

it("places the optional note icon directly before the title", async () => {
	const container = document.createElement("div");
	const root = createRoot(container);
	roots.push(root);
	await act(async () =>
		root.render(
			createElement(MobileListRow, {
				subtitle: "A fixture note",
				title: "Icon fixture",
				titleLeading: createElement(
					"span",
					{ "data-testid": "note-title-icon" },
					"🚀",
				),
			}),
		),
	);

	const icon = container.querySelector('[data-testid="note-title-icon"]');
	expect(icon?.nextElementSibling?.textContent).toBe("Icon fixture");
});
