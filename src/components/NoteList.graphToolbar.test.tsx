import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SET_COLLECTION_LAYOUT_EVENT } from "../collections/collectionTypes";
import { renderBookNoteList } from "../test-utils/noteListRenderingFixtures";
import { renderNoteList } from "../test-utils/noteListTestUtils";

vi.mock(
	"./note-list/graph/GraphCanvas",
	async () =>
		(await import("./note-list/graph/graphCollectionDoubles")).canvasModule,
);

function showLayout(layout: string) {
	act(() => {
		window.dispatchEvent(
			new CustomEvent(SET_COLLECTION_LAYOUT_EVENT, { detail: layout }),
		);
	});
}

describe("NoteList Graph toolbar", () => {
	beforeEach(() => localStorage.setItem("ff_graph_layout", "true"));
	afterEach(() => localStorage.removeItem("ff_graph_layout"));

	it("drops the label visibility eye on Graph and keeps the other actions", async () => {
		renderNoteList();
		showLayout("graph");
		expect(
			await screen.findByTestId("graph-settings-button"),
		).toBeInTheDocument();
		expect(screen.getByTestId("graph-filter-menu-button")).toBeInTheDocument();
		expect(screen.getByTestId("layout-menu-button")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Search notes" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Create new note" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Show properties" }),
		).not.toBeInTheDocument();
	});

	it("keeps the List property controls", () => {
		renderBookNoteList({
			entryOverrides: { properties: { Priority: "High" } },
			selection: { kind: "filter", filter: "inbox" },
			inboxNoteListProperties: null,
		});
		expect(
			screen.getByRole("button", { name: "Show properties" }),
		).toBeInTheDocument();
	});
});
