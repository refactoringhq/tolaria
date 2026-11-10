import { render } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { makeEntry } from "../../test-utils/noteListTestUtils";
import type { VaultEntry } from "../../types";
import { ListView } from "./NoteListViews";

type ItemContent = (index: number, entry: VaultEntry) => ReactNode;

const captured = vi.hoisted(() => ({
	itemContent: null as ItemContent | null,
}));

vi.mock("react-virtuoso", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-virtuoso")>();
	return {
		...actual,
		Virtuoso: ({
			data,
			itemContent,
		}: {
			data: VaultEntry[];
			itemContent: ItemContent;
		}) => {
			captured.itemContent = itemContent;
			return createElement(
				"div",
				null,
				data.map((entry, index) =>
					createElement("div", { key: entry.path }, itemContent(index, entry)),
				),
			);
		},
	};
});

describe("note list virtualizer renderer stability", () => {
	it("retains the row renderer while using the latest title-save render", () => {
		const firstEntry = makeEntry({ title: "Original title" });
		const firstRender = (entry: VaultEntry) =>
			createElement("span", null, entry.title);
		const view = render(
			<ListView searched={[firstEntry]} query="" renderItem={firstRender} />,
		);
		const itemContent = captured.itemContent;
		expect(itemContent).not.toBeNull();
		if (!itemContent)
			throw new Error("Virtuoso did not receive an item renderer");

		const savedEntry = { ...firstEntry, title: "Saved title" };
		const savedRender = (entry: VaultEntry) =>
			createElement("span", null, entry.title);
		view.rerender(
			<ListView searched={[savedEntry]} query="" renderItem={savedRender} />,
		);

		expect(captured.itemContent).toBe(itemContent);
		expect(view.getByText("Saved title")).toBeInTheDocument();
	});
});
