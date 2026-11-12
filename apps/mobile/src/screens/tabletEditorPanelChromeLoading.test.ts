import { isValidElement, type ReactNode } from "react";
import { expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ ScrollView: "ScrollView", View: "View" }));
vi.mock("phosphor-react-native", () => ({
	ArrowClockwise: "ArrowClockwise",
	FileText: "FileText",
	WarningCircle: "WarningCircle",
}));
vi.mock("../components/ui/text", () => ({ Text: "Text" }));
vi.mock("../components/workspace/MobileEditorBlocks", () => ({
	MobileEditorBlocks: "MobileEditorBlocks",
}));
vi.mock("../components/workspace/MobileMarkdownSourceEditor", () => ({
	MobileMarkdownSourceEditor: "MobileMarkdownSourceEditor",
}));
vi.mock("../components/workspace/MobileWorkspaceIcons", () => ({
	MobileTypeIcon: "MobileTypeIcon",
}));
vi.mock("../components/workspace/MobileWysiwygMarkdownEditor", () => ({
	MobileWysiwygMarkdownEditor: "MobileWysiwygMarkdownEditor",
}));
vi.mock("../i18n/mobileText", () => ({ mobileText: (key: string) => key }));
vi.mock("../qa/useMobileMotionBodyRender", () => ({
	useMobileMotionBodyRender: vi.fn(),
}));
vi.mock("../ui/MobileButton", () => ({ MobileButton: "MobileButton" }));
vi.mock("../ui/MobilePanel", () => ({
	MobilePanel: "MobilePanel",
	MobileToolbar: "MobileToolbar",
	MobileToolbarTitle: "MobileToolbarTitle",
}));
vi.mock("../ui/theme/useMobileTheme", () => ({
	useMobileColors: () => ({
		textMuted: "#666",
		danger: "#f00",
		text: "#111",
		sidebar: "#fff",
	}),
	useMobileMetrics: () => ({
		editor: {
			bodyFontSize: 15,
			bodyLineHeight: 23,
			h1LineHeight: 38,
			h1MarginBottom: 12,
			paragraphSpacing: 8,
		},
		type: { body: 16 },
		space: { md: 8 },
	}),
	useMobileStyles: () => ({
		panelStyles: {
			emptyState: {},
			filePreviewFallback: {},
			filePreviewDescription: {},
			filePreviewTitle: {},
			content: {},
			editorHost: {},
		},
	}),
}));
vi.mock("./TabletEditorPanelStyles", () => ({
	createEditorPanelStyles: vi.fn(),
}));

type TestElementProps = { children?: ReactNode; [key: string]: unknown };

import { MobileNoteReadFallback } from "./TabletEditorPanelChrome";

it("shows a content-free skeleton while a selected note is loading", () => {
	const tree = MobileNoteReadFallback({
		compact: true,
		state: { status: "loading", retry: vi.fn() },
	});
	const text = textContent(tree);
	const testIds = propValues(tree, "testID");

	expect(text).toEqual([]);
	expect(testIds).toContain("note-read-skeleton");
	expect(testIds).toContain("note-read-skeleton-title");
	expect(testIds).toContain("note-read-skeleton-line-1");
});

it("keeps a generic body skeleton when a note has no cached preview", () => {
	const tree = MobileNoteReadFallback({
		state: { status: "loading", retry: vi.fn() },
	});
	const testIds = propValues(tree, "testID");

	expect(testIds).toContain("note-read-skeleton-title");
	expect(testIds).toContain("note-read-skeleton-line-1");
});

function textContent(node: ReactNode): string[] {
	if (typeof node === "string") return [node];
	if (Array.isArray(node)) return node.flatMap(textContent);
	if (!isValidElement<TestElementProps>(node)) return [];
	if (typeof node.type === "function") {
		const render = node.type as (props: Record<string, unknown>) => ReactNode;
		return textContent(render(node.props));
	}
	return textContent(node.props.children);
}

function propValues(node: ReactNode, name: string): unknown[] {
	if (Array.isArray(node))
		return node.flatMap((child) => propValues(child, name));
	if (!isValidElement<TestElementProps>(node)) return [];
	if (typeof node.type === "function") {
		const render = node.type as (props: Record<string, unknown>) => ReactNode;
		return propValues(render(node.props), name);
	}
	return [node.props[name], ...propValues(node.props.children, name)].filter(
		(value) => value !== undefined,
	);
}
