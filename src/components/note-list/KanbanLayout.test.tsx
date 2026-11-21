import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeEntry } from "../../test-utils/noteListTestUtils";
import { KanbanLayout } from "./KanbanLayout";

const entries = [
	makeEntry({
		path: "/vault/a.md",
		title: "Alpha",
		status: "Doing",
		properties: { owner: "Ada" },
	}),
	makeEntry({ path: "/vault/b.md", title: "Beta", status: null }),
];

function createBoardProps(
	overrides: Partial<Parameters<typeof KanbanLayout>[0]> = {},
) {
	return {
		entries,
		allEntries: entries,
		groupBy: "status",
		properties: ["owner"],
		columnOrder: [],
		onColumnOrderChange: vi.fn(),
		collapsedColumns: [] as string[],
		hiddenColumns: [] as string[],
		onToggleColumnCollapsed: vi.fn(),
		onToggleColumnHidden: vi.fn(),
		onOpen: vi.fn(),
		onMove: vi.fn(),
		locale: "en" as const,
		typeEntryMap: {},
		selectedNotePath: "/vault/a.md",
		...overrides,
	};
}

function renderBoard(
	overrides: Partial<Parameters<typeof KanbanLayout>[0]> = {},
) {
	const props = createBoardProps(overrides);
	render(<KanbanLayout {...props} />);
	return props;
}

describe("KanbanLayout", () => {
	it("shows every value as a column, including notes without a value", () => {
		renderBoard();
		const columns = screen.getAllByTestId("kanban-column");
		expect(columns.map((column) => column.dataset.kanbanColumn)).toEqual([
			"Doing",
			"",
		]);
		expect(within(columns[1]).getByText("No value")).toBeInTheDocument();
		expect(within(columns[1]).getByText("Beta")).toBeInTheDocument();
	});

	it("renders card fields with the note-list property chips", () => {
		renderBoard();
		const alphaCard = screen.getByRole("button", { name: "Alpha" });
		expect(within(alphaCard).getByTestId("property-chips")).toHaveTextContent(
			"Ada",
		);
		expect(alphaCard).toHaveAttribute("data-selected", "true");
	});

	it("hides card fields when item properties are disabled", () => {
		renderBoard({ showProperties: false });
		expect(
			within(screen.getByRole("button", { name: "Alpha" })).queryByTestId(
				"property-chips",
			),
		).not.toBeInTheDocument();
	});

	it("shows the note icon before the title and keeps iconless titles unchanged", () => {
		const withIcon = makeEntry({
			path: "/vault/icon.md",
			title: "Icon note",
			status: "Doing",
			icon: "✨",
		});
		const withoutIcon = makeEntry({
			path: "/vault/plain.md",
			title: "Plain note",
			status: "Doing",
		});
		renderBoard({
			entries: [withIcon, withoutIcon],
			allEntries: [withIcon, withoutIcon],
		});

		const iconCard = screen.getByRole("button", { name: "Icon note" });
		const icon = within(iconCard).getByTestId("kanban-card-title-icon");
		expect(icon).toHaveTextContent("✨");
		expect(
			iconCard.querySelector('[data-testid="kanban-card-title"]')
				?.firstElementChild,
		).toContainElement(icon);
		expect(
			within(screen.getByRole("button", { name: "Plain note" })).queryByTestId(
				"kanban-card-title-icon",
			),
		).not.toBeInTheDocument();
	});

	it("resolves linked card fields against the whole vault, like list rows", () => {
		const person = makeEntry({
			path: "/vault/person-ada.md",
			filename: "person-ada.md",
			title: "Ada Lovelace",
			isA: "Person",
		});
		const linked = makeEntry({
			path: "/vault/c.md",
			title: "Gamma",
			status: "Doing",
			relationships: { owner: ["[[person-ada]]"] },
		});
		renderBoard({ entries: [linked], allEntries: [linked, person] });
		const chips = within(
			screen.getByRole("button", { name: "Gamma" }),
		).getByTestId("property-chips");
		expect(chips).toHaveTextContent("Ada Lovelace");
		expect(chips).not.toHaveTextContent("person-ada");
	});

	it("opens a card on click from a native, keyboard-focusable button", () => {
		const props = renderBoard();
		const alphaCard = screen.getByRole("button", { name: "Alpha" });
		expect(alphaCard.tagName).toBe("BUTTON");
		fireEvent.click(alphaCard);
		expect(props.onOpen).toHaveBeenCalledWith(entries[0], expect.anything());
		expect(screen.getByRole("button", { name: "No value" }).tagName).toBe(
			"BUTTON",
		);
	});

	it("hides board and column scrollbars without disabling scrolling", () => {
		renderBoard({ columnOrder: ["", "Doing"] });
		const board = screen.getByTestId("kanban-board");
		expect(board).toHaveClass("kanban-scroll", "overflow-x-auto");
		expect(
			screen
				.getAllByTestId("kanban-column")
				.map((column) => column.dataset.kanbanColumn),
		).toEqual(["", "Doing"]);
	});

	it.each([
		{
			locale: "en" as const,
			board: "Kanban grouped by status",
			doing: "Doing, 2 notes",
			noValue: "No value, 1 note",
			column: "column",
			card: "Gamma",
			cardRole: "card",
		},
		{
			locale: "it-IT" as const,
			board: "Kanban raggruppato per status",
			doing: "Doing, 1 nota",
			noValue: "Nessun valore, 1 nota",
			column: "colonna",
			card: "Alpha",
			cardRole: "scheda",
		},
	])("announces the board, columns and cards in $locale", (expected) => {
		const boardEntries =
			expected.locale === "en"
				? [
						...entries,
						makeEntry({ path: "/vault/c.md", title: "Gamma", status: "Doing" }),
					]
				: entries;
		renderBoard({
			locale: expected.locale,
			entries: boardEntries,
			allEntries: boardEntries,
		});
		expect(screen.getByTestId("kanban-board")).toHaveAccessibleName(
			expected.board,
		);
		expect(
			screen.getByRole("region", { name: expected.doing }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("region", { name: expected.noValue }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Doing" })).toHaveAttribute(
			"aria-roledescription",
			expected.column,
		);
		expect(screen.getByRole("button", { name: expected.card })).toHaveAttribute(
			"aria-roledescription",
			expected.cardRole,
		);
	});

	it("collapses and hides a column from its header without touching any note", () => {
		const props = renderBoard();
		const doing = screen.getByRole("region", { name: "Doing, 1 note" });
		fireEvent.click(
			within(doing).getByRole("button", { name: "Collapse Doing" }),
		);
		expect(props.onToggleColumnCollapsed).toHaveBeenCalledWith("Doing");
		fireEvent.click(
			within(
				screen.getByRole("region", { name: "No value, 1 note" }),
			).getByRole("button", { name: "Hide No value" }),
		);
		expect(props.onToggleColumnHidden).toHaveBeenCalledWith("");
		expect(props.onMove).not.toHaveBeenCalled();
	});

	it("shows a collapsed column as a strip with its name and count that expands on click", () => {
		const props = renderBoard({ collapsedColumns: ["Doing"] });
		const doing = screen.getByRole("region", { name: "Doing, 1 note" });
		expect(doing).toHaveAttribute("data-collapsed", "true");
		expect(
			within(doing).queryByRole("button", { name: "Alpha" }),
		).not.toBeInTheDocument();
		const strip = within(doing).getByRole("button", { name: "Expand Doing" });
		expect(strip).toHaveTextContent("1Doing");
		expect(strip).toHaveAttribute("aria-roledescription", "column");
		fireEvent.click(strip);
		expect(props.onToggleColumnCollapsed).toHaveBeenCalledWith("Doing");
	});

	it("leaves hidden columns off the board and lists them with counts so they can be shown again", () => {
		const props = renderBoard({ hiddenColumns: ["", "Archived"] });
		expect(
			screen
				.getAllByTestId("kanban-column")
				.map((column) => column.dataset.kanbanColumn),
		).toEqual(["Doing"]);
		const hidden = screen.getByRole("region", { name: "Hidden columns" });
		const show = within(hidden).getByRole("button", { name: "Show No value" });
		expect(show).toHaveTextContent("No value1");
		expect(within(hidden).getAllByRole("button")).toHaveLength(1);
		fireEvent.click(show);
		expect(props.onToggleColumnHidden).toHaveBeenCalledWith("");
	});

	it("has no hidden columns list while every column is shown", () => {
		renderBoard();
		expect(
			screen.queryByTestId("kanban-hidden-columns"),
		).not.toBeInTheDocument();
	});
});
