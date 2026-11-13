// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mobileMetrics } from "../../ui/mobileMetrics";
import { mobilePalettes } from "../../ui/theme/mobilePalette";
import type { MobileSidebarFolder } from "../../workspace/mobileWorkspaceModel";
import { FolderTree } from "./MobileWorkspaceSidebarFolderTree";

type SurfaceProps = {
	accessibilityLabel?: string;
	children?: ReactNode;
	onLongPress?: () => void;
	onPress?: () => void;
	style?: unknown;
};

function Surface({
	accessibilityLabel,
	children,
	onPress,
	style,
}: SurfaceProps) {
	const styles = Array.isArray(style) ? style : [style];
	const flattened = Object.assign({}, ...styles.filter(isStyleObject));
	return createElement(
		onPress ? "button" : "div",
		{
			"aria-label": accessibilityLabel,
			"data-min-height": flattened.minHeight,
			"data-padding-left": flattened.paddingLeft,
			"data-style-kind": typeof style,
			"data-width": flattened.width,
			style: flattened,
		},
		children,
	);
}

function isStyleObject(
	value: unknown,
): value is Record<string, string | number> {
	return typeof value === "object" && value !== null;
}

vi.mock("react-native", () => ({
	Platform: { OS: "ios" },
	Pressable: Surface,
	StyleSheet: { create: (styles: object) => styles, hairlineWidth: 1 },
	View: Surface,
}));
vi.mock("phosphor-react-native", () => ({
	CaretDown: ({ size }: { size: number }) =>
		createElement("span", { "data-size": size }),
	CaretRight: ({ size }: { size: number }) =>
		createElement("span", { "data-size": size }),
	Folder: () => createElement("span"),
	FolderOpen: () => createElement("span"),
}));
vi.mock("../../ui/theme/useMobileTheme", () => ({
	useMobileStyles: (
		factory: (
			colors: typeof mobilePalettes.light,
			metrics: (typeof mobileMetrics)[1.2],
		) => unknown,
	) => factory(mobilePalettes.light, mobileMetrics[1.2]),
}));
vi.mock("../ui/text", () => ({ Text: Surface }));

const folderTree: MobileSidebarFolder[] = [
	{
		children: [
			{
				children: [{ children: [], id: "essays-methods", name: "Methods" }],
				expanded: true,
				id: "essays",
				name: "Essays",
			},
		],
		expanded: true,
		id: "writing",
		name: "Writing",
	},
];

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => vi.unstubAllGlobals());

function renderFolderTree() {
	const host = document.createElement("div");
	const root = createRoot(host);
	act(() => root.render(createElement(FolderTree, { folders: folderTree })));
	return { host, root };
}

function rowsByName(host: HTMLElement) {
	return ["Writing", "Essays", "Methods"].map((name) => {
		const row = host.querySelector<HTMLElement>(`button[aria-label="${name}"]`);
		expect(row).not.toBeNull();
		return row;
	});
}

function expectRowGeometry(rows: Array<HTMLElement | null>) {
	const metrics = mobileMetrics[1.2].sidebar;
	rows.forEach((row, depth) => {
		expect(row?.dataset.styleKind).toBe("object");
		expect(Number(row?.dataset.paddingLeft)).toBe(
			metrics.folderRowContentInset + depth * metrics.folderRowIndent,
		);
		expect(Number(row?.dataset.minHeight)).toBe(metrics.folderRowHeight);
	});
}

function expectChevronAlignment(rows: Array<HTMLElement | null>) {
	const expandableCaret = rows[0]?.firstElementChild
		?.firstElementChild as HTMLElement;
	const leafCaret = rows[2]?.firstElementChild?.firstElementChild as HTMLElement;
	const iconSize = mobileMetrics[1.2].size(11);
	expect(Number(expandableCaret.dataset.size)).toBe(iconSize);
	expect(Number(leafCaret.dataset.width)).toBe(iconSize);
}

it("keeps nested rows static, evenly sized, and aligned with leaf-folder icons", () => {
	const { host, root } = renderFolderTree();
	const rows = rowsByName(host);
	expectRowGeometry(rows);
	expectChevronAlignment(rows);
	act(() => root.unmount());
});
