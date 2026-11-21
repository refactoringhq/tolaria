import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	APP_COMMAND_EVENT_NAME,
	APP_COMMAND_IDS,
} from "../../hooks/appCommandDispatcher";
import { trackEvent } from "../../lib/telemetry";
import { TooltipProvider } from "../ui/tooltip";
import { NoteListHeader } from "./NoteListHeader";

vi.mock("../../lib/telemetry", () => ({
	trackEvent: vi.fn(),
}));

const baseProps = {
	title: "Inbox",
	typeDocument: null,
	isEntityView: false,
	listSort: "modified" as const,
	listDirection: "desc" as const,
	customProperties: [],
	searchVisible: false,
	search: "",
	isSearching: false,
	searchInputRef: { current: null },
	onSortChange: vi.fn(),
	onCreateNote: vi.fn(),
	onOpenType: vi.fn(),
	onToggleSearch: vi.fn(),
	onSearchChange: vi.fn(),
	onSearchKeyDown: vi.fn(),
};

function renderHeader(
	overrides: Partial<Parameters<typeof NoteListHeader>[0]> = {},
) {
	return render(<NoteListHeader {...baseProps} {...overrides} />, {
		wrapper: TooltipProvider,
	});
}

describe("NoteListHeader title space", () => {
	beforeEach(() => vi.clearAllMocks());

	it("keeps the title visible and restores the expand-sidebar action when collapsed", () => {
		renderHeader({ sidebarCollapsed: true });

		expect(screen.getByRole("heading", { name: "Inbox" })).toBeVisible();
		expect(
			screen.getByRole("button", { name: "Expand sidebar" }),
		).toBeVisible();
	});

	it("shows the properties action tooltip on keyboard focus", async () => {
		renderHeader({
			propertyPicker: {
				scope: "all",
				availableProperties: ["status"],
				currentDisplay: ["status"],
				onSave: vi.fn(),
				triggerTitle: "Show properties",
			},
		});

		const propertiesButton = screen.getByRole("button", {
			name: "Show properties",
		});
		fireEvent.focus(propertiesButton);

		expect(await screen.findByRole("tooltip")).toHaveTextContent(
			"Show properties",
		);
		fireEvent.click(propertiesButton);
		expect(propertiesButton).toHaveAttribute("aria-expanded", "true");
		const picker = screen.getByRole("dialog");
		expect(picker).toBeVisible();
		expect(propertiesButton).toHaveAttribute("aria-controls", picker.id);
	});

	it("uses the layout's field-picker label when card visibility has no toggle", () => {
		renderHeader({
			propertyPicker: {
				scope: "view",
				availableProperties: ["owner"],
				currentDisplay: ["owner"],
				onSave: vi.fn(),
				triggerTitle: "Card fields",
				usePickerTitle: true,
			},
		});

		expect(screen.getByRole("button", { name: "Card fields" })).toBeVisible();
	});

	it("shows the sort action tooltip on keyboard focus", async () => {
		renderHeader();

		const sortButton = screen.getByRole("button", { name: "Sort notes" });
		fireEvent.focus(sortButton);

		expect(await screen.findByRole("tooltip")).toHaveTextContent("Sort notes");
	});

	it("keeps the stable create-note name for its tooltip and accessible name", async () => {
		renderHeader();

		const createButton = screen.getByRole("button", {
			name: "Create new note",
		});
		fireEvent.focus(createButton);

		expect(await screen.findByRole("tooltip")).toHaveTextContent(
			"Create new note",
		);
	});

	it("expands the sidebar from the note-list header", () => {
		const commandListener = vi.fn();
		window.addEventListener(APP_COMMAND_EVENT_NAME, commandListener);

		try {
			renderHeader({ sidebarCollapsed: true });
			fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));

			expect(commandListener).toHaveBeenCalledTimes(1);
			const commandEvent = commandListener.mock.calls[0]?.[0];
			expect(commandEvent).toBeInstanceOf(CustomEvent);
			if (!(commandEvent instanceof CustomEvent))
				throw new Error("Expected sidebar expansion command event");
			expect(commandEvent.detail).toBe(APP_COMMAND_IDS.viewAll);
			expect(trackEvent).toHaveBeenCalledWith(
				"sidebar_expanded_from_note_list_header",
			);
		} finally {
			window.removeEventListener(APP_COMMAND_EVENT_NAME, commandListener);
		}
	});

	it("uses the latest create callback after focus-driven state updates settle", async () => {
		vi.useFakeTimers();
		const staleCreate = vi.fn();
		const latestCreate = vi.fn();
		const { rerender } = renderHeader({ onCreateNote: staleCreate });
		const rawEditor = document.createElement("div");
		rawEditor.className = "raw-editor-codemirror";
		const rawInput = document.createElement("textarea");
		rawEditor.append(rawInput);
		document.body.append(rawEditor);
		rawInput.focus();

		const createButton = screen.getByRole("button", {
			name: "Create new note",
		});
		fireEvent.mouseDown(createButton);
		fireEvent.click(createButton);
		rerender(<NoteListHeader {...baseProps} onCreateNote={latestCreate} />);
		await act(async () => vi.runAllTimersAsync());

		expect(staleCreate).not.toHaveBeenCalled();
		expect(latestCreate).toHaveBeenCalledOnce();
		rawEditor.remove();
		vi.useRealTimers();
	});
});
