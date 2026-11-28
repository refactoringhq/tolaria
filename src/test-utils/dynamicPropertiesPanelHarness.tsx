import { render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DynamicPropertiesPanel } from "../components/DynamicPropertiesPanel";
import type { VaultEntry } from "../types";

/** Radix Select and Popover need ResizeObserver, pointer and scroll APIs in JSDOM. */
export function installRadixJsdomShims(): void {
	globalThis.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
	Element.prototype.scrollIntoView = vi.fn();
	Element.prototype.hasPointerCapture = () => false;
	Element.prototype.setPointerCapture = vi.fn();
	Element.prototype.releasePointerCapture = vi.fn();
}

export function makePanelEntry(
	overrides: Partial<VaultEntry> = {},
): VaultEntry {
	return {
		path: "/vault/note/test.md",
		filename: "test.md",
		title: "Test Note",
		isA: "Note",
		aliases: [],
		belongsTo: [],
		relatedTo: [],
		status: "Active",
		archived: false,
		modifiedAt: 1700000000,
		createdAt: 1700000000,
		fileSize: 100,
		snippet: "",
		wordCount: 0,
		relationships: {},
		icon: null,
		color: null,
		order: null,
		template: null,
		sort: null,
		outgoingLinks: [],
		...overrides,
	} as VaultEntry;
}

type DynamicPropertiesPanelProps = ComponentProps<
	typeof DynamicPropertiesPanel
>;

export type RenderPanelOptions = Omit<
	DynamicPropertiesPanelProps,
	"entry" | "content" | "frontmatter"
> & {
	entry?: VaultEntry;
	content?: string;
	frontmatter?: Record<string, unknown>;
};

export function renderPanel({
	entry = makePanelEntry(),
	content = "",
	frontmatter = {},
	...props
}: RenderPanelOptions = {}) {
	return render(
		<TooltipProvider>
			<DynamicPropertiesPanel
				entry={entry}
				content={content}
				frontmatter={frontmatter as DynamicPropertiesPanelProps["frontmatter"]}
				{...props}
			/>
		</TooltipProvider>,
	);
}
