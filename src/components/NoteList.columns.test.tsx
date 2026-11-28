import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	makeBookTypeEntries,
	makeViewDefinition,
	renderBookNoteList,
	renderManagedViewNoteList,
} from "../test-utils/noteListRenderingFixtures";
import {
	allSelection,
	makeEntry,
	renderNoteList,
} from "../test-utils/noteListTestUtils";
import { openNoteListPropertiesPicker } from "./note-list/noteListPropertiesEvents";

vi.mock("../hooks/useTabManagement", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../hooks/useTabManagement")>();
	return { ...actual, prefetchNoteContent: vi.fn() };
});

function openTypeColumnPicker(
	entryOverrides: Parameters<typeof makeBookTypeEntries>[1],
) {
	renderNoteList({
		entries: makeBookTypeEntries([], entryOverrides),
		selection: { kind: "sectionGroup", type: "Book" },
		onUpdateTypeSort: () => undefined,
	});

	act(() => {
		openNoteListPropertiesPicker("type");
	});

	expect(screen.getByTestId("list-properties-popover")).toBeInTheDocument();
}

function renderAllNotesColumnPicker(
	onUpdateAllNotesNoteListProperties: ReturnType<typeof vi.fn>,
) {
	const archivedOwnerEntry = makeEntry({
		path: "/vault/book-archive.md",
		filename: "book-archive.md",
		title: "Archived Book",
		isA: "Book",
		archived: true,
		properties: { Owner: "Luca" },
	});

	renderNoteList({
		entries: [
			...makeBookTypeEntries(["Priority"], {
				properties: { Priority: "High" },
			}),
			archivedOwnerEntry,
		],
		selection: allSelection,
		allNotesNoteListProperties: null,
		onUpdateAllNotesNoteListProperties,
	});
	act(() => openNoteListPropertiesPicker("all"));
}

describe("NoteList columns and chips", () => {
	it.each([
		{
			label: "Inbox",
			overrides: {
				selection: { kind: "filter", filter: "inbox" },
				inboxNoteListProperties: null,
			},
		},
		{ label: "All Notes", overrides: { allNotesNoteListProperties: null } },
	] as const)(
		"shows the $label customize-columns action and falls back to type-defined chips",
		({ overrides }) => {
			renderBookNoteList({
				entryOverrides: { properties: { Priority: "High", Owner: "Luca" } },
				...overrides,
			});

			expect(
				screen.getByRole("button", { name: "Show properties" }),
			).toBeInTheDocument();
			expect(screen.getByText("High")).toBeInTheDocument();
			expect(screen.queryByText("Luca")).not.toBeInTheDocument();
		},
	);

	it("opens the all-notes column picker as a searchable combobox and saves new columns", async () => {
		const onUpdateAllNotesNoteListProperties = vi.fn();
		renderAllNotesColumnPicker(onUpdateAllNotesNoteListProperties);

		expect(screen.getByTestId("list-properties-popover")).toBeInTheDocument();
		expect(screen.getByTestId("list-properties-popover")).toHaveClass(
			"overflow-hidden",
		);
		expect(
			screen.getByTestId("list-properties-scroll-area"),
		).toBeInTheDocument();
		expect(screen.getByTestId("list-properties-scroll-area")).toHaveClass(
			"overflow-y-auto",
		);
		expect(screen.getByRole("checkbox", { name: "Priority" })).toBeChecked();
		expect(screen.getByRole("checkbox", { name: "Owner" })).toBeInTheDocument();

		const combobox = screen.getByRole("combobox", {
			name: "Search note-list properties",
		});
		await waitFor(() => expect(combobox).toHaveFocus());

		fireEvent.change(combobox, { target: { value: "Owner" } });
		expect(screen.getByRole("checkbox", { name: "Owner" })).toBeInTheDocument();
		expect(
			screen.queryByRole("checkbox", { name: "Priority" }),
		).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("checkbox", { name: "Owner" }));
		expect(onUpdateAllNotesNoteListProperties).toHaveBeenCalledWith([
			"Priority",
			"Owner",
		]);

		fireEvent.keyDown(combobox, { key: "Escape" });
		await waitFor(() =>
			expect(
				screen.queryByTestId("list-properties-popover"),
			).not.toBeInTheDocument(),
		);
	});

	it("opens the inbox column picker from the global event and saves new columns", () => {
		const onUpdateInboxNoteListProperties = vi.fn();

		renderNoteList({
			entries: makeBookTypeEntries(["Priority"], {
				properties: { Priority: "High", Owner: "Luca" },
			}),
			selection: { kind: "filter", filter: "inbox" },
			inboxNoteListProperties: null,
			onUpdateInboxNoteListProperties,
		});

		act(() => {
			openNoteListPropertiesPicker("inbox");
		});

		expect(screen.getByTestId("list-properties-popover")).toBeInTheDocument();
		expect(
			screen.getByRole("combobox", { name: "Search note-list properties" }),
		).toBeInTheDocument();
		expect(screen.getByRole("checkbox", { name: "Priority" })).toBeChecked();

		fireEvent.click(screen.getByRole("checkbox", { name: "Owner" }));
		expect(onUpdateInboxNoteListProperties).toHaveBeenCalledWith([
			"Priority",
			"Owner",
		]);
	});

	it("opens the view column picker from the global event and applies the saved columns", () => {
		renderManagedViewNoteList({
			entries: makeBookTypeEntries(["Priority"], {
				properties: { Priority: "High", Owner: "Luca" },
			}),
		});

		expect(screen.getByText("High")).toBeInTheDocument();
		expect(screen.queryByText("Luca")).not.toBeInTheDocument();

		act(() => {
			openNoteListPropertiesPicker("view");
		});

		expect(screen.getByTestId("list-properties-popover")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("checkbox", { name: "Owner" }));

		expect(screen.getByText("Luca")).toBeInTheDocument();
	});

	it("keeps computed timestamps available for views with no matching notes", () => {
		renderManagedViewNoteList({
			entries: makeBookTypeEntries(),
			view: makeViewDefinition({
				filename: "empty-view.yml",
				definition: {
					name: "Empty View",
					filters: { all: [{ field: "type", op: "equals", value: "Project" }] },
				},
			}),
		});

		act(() => {
			openNoteListPropertiesPicker("view");
		});

		expect(screen.getByTestId("list-properties-popover")).toBeInTheDocument();
		expect(
			screen.getByRole("group", { name: "Computed fields" }),
		).toBeInTheDocument();
	});

	it("shows status in the type column picker when at least one note has it set", () => {
		openTypeColumnPicker({ status: "Active" });

		expect(
			screen.getByRole("combobox", { name: "Search note-list properties" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("checkbox", { name: "status" }),
		).toBeInTheDocument();
	});

	it("keeps blank statuses out of the type column picker", () => {
		openTypeColumnPicker({ status: "", properties: { Owner: "Luca" } });

		expect(screen.getByRole("checkbox", { name: "Owner" })).toBeInTheDocument();
		expect(
			screen.queryByRole("checkbox", { name: "status" }),
		).not.toBeInTheDocument();
	});
});
