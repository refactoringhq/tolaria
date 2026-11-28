import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
	installRadixJsdomShims,
	makePanelEntry as makeEntry,
	renderPanel,
} from "../test-utils/dynamicPropertiesPanelHarness";

beforeAll(installRadixJsdomShims);

describe("DynamicPropertiesPanel slots", () => {
	const onUpdateProperty = vi.fn();
	const onAddProperty = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	function renderEditablePanel(frontmatter: Record<string, unknown>) {
		renderPanel({ frontmatter, onUpdateProperty });
	}

	describe("TypeSelector", () => {
		const typeEntries = [
			makeEntry({ path: "/vault/project.md", title: "Project", isA: "Type" }),
			makeEntry({ path: "/vault/person.md", title: "Person", isA: "Type" }),
			makeEntry({ path: "/vault/topic.md", title: "Topic", isA: "Type" }),
		];

		it("renders workspace selector before type selector when multiple workspaces are available", () => {
			const personalWorkspace = {
				id: "personal",
				label: "Personal",
				alias: "personal",
				path: "/personal",
				shortLabel: "PE",
				color: "green",
				icon: null,
				mounted: true,
				available: true,
				defaultForNewNotes: true,
			};
			const teamWorkspace = {
				id: "team",
				label: "Team",
				alias: "team",
				path: "/team",
				shortLabel: "TE",
				color: "purple",
				icon: null,
				mounted: true,
				available: true,
				defaultForNewNotes: false,
			};

			renderPanel({
				entry: makeEntry({ workspace: personalWorkspace }),
				workspaces: [personalWorkspace, teamWorkspace],
				onUpdateProperty,
				onChangeWorkspace: vi.fn(),
			});

			const workspaceSelector = screen.getByTestId("workspace-selector");
			const typeSelector = screen.getByTestId("type-selector");
			expect(
				workspaceSelector.compareDocumentPosition(typeSelector) &
					Node.DOCUMENT_POSITION_FOLLOWING,
			).toBeTruthy();
		});

		it("renders as dropdown when editable", () => {
			renderPanel({ entries: typeEntries, onUpdateProperty });
			expect(screen.getByTestId("type-selector")).toBeInTheDocument();
			expect(screen.getByRole("combobox")).toBeInTheDocument();
		});

		it("shows available types in dropdown", () => {
			renderPanel({ entries: typeEntries, onUpdateProperty });
			fireEvent.click(screen.getByRole("combobox"));
			expect(screen.getByRole("option", { name: "None" })).toBeInTheDocument();
			expect(
				screen.getByRole("option", { name: "Person" }),
			).toBeInTheDocument();
			expect(
				screen.getByRole("option", { name: "Project" }),
			).toBeInTheDocument();
			expect(screen.getByRole("option", { name: "Topic" })).toBeInTheDocument();
		});

		function openAndSelect(optionName: string) {
			fireEvent.click(screen.getByRole("combobox"));
			fireEvent.click(screen.getByRole("option", { name: optionName }));
		}

		it("calls onUpdateProperty when type selected", () => {
			renderPanel({ entries: typeEntries, onUpdateProperty });
			openAndSelect("Project");
			expect(onUpdateProperty).toHaveBeenCalledWith("type", "Project");
		});

		it("clears type when None selected", () => {
			renderPanel({
				entry: makeEntry({ isA: "Project" }),
				entries: typeEntries,
				onUpdateProperty,
			});
			openAndSelect("None");
			expect(onUpdateProperty).toHaveBeenCalledWith("type", null);
		});

		it("shows current type even when not in available types", () => {
			renderPanel({
				entry: makeEntry({ isA: "CustomType" }),
				entries: typeEntries,
				onUpdateProperty,
			});
			fireEvent.click(screen.getByRole("combobox"));
			expect(
				screen.getByRole("option", { name: "CustomType" }),
			).toBeInTheDocument();
		});

		it("shows a missing-type warning with keyboard-accessible help and creation flow", async () => {
			const onCreateMissingType = vi.fn().mockResolvedValue(undefined);

			renderPanel({
				entry: makeEntry({ isA: "Hotel" }),
				entries: typeEntries,
				onUpdateProperty,
				onCreateMissingType,
			});

			const warningButton = screen.getByTestId("missing-type-warning");
			expect(warningButton).toBeInTheDocument();

			fireEvent.focus(warningButton);
			await waitFor(() => {
				expect(screen.getByRole("tooltip")).toHaveTextContent("Missing type");
			});

			fireEvent.click(warningButton);
			expect(screen.getByDisplayValue("Hotel")).toBeInTheDocument();

			fireEvent.click(screen.getByRole("button", { name: "Create" }));
			await waitFor(() =>
				expect(onCreateMissingType).toHaveBeenCalledWith("Hotel"),
			);
		});

		it("does not show a missing-type warning when the type already exists", () => {
			renderPanel({
				entry: makeEntry({ isA: "Project" }),
				entries: typeEntries,
				onUpdateProperty,
			});

			expect(
				screen.queryByTestId("missing-type-warning"),
			).not.toBeInTheDocument();
		});

		it("shows None placeholder when entry has no type", () => {
			renderPanel({
				entry: makeEntry({ isA: null }),
				entries: typeEntries,
				onUpdateProperty,
			});
			expect(screen.getByTestId("type-selector")).toBeInTheDocument();
			expect(screen.getByText("None")).toBeInTheDocument();
		});
	});

	describe("suggested property slots", () => {
		function findSuggestedSlotHtml(label: string): HTMLElement {
			const slot = screen
				.getAllByTestId("suggested-property")
				.find((node) => node.textContent?.includes(label));
			expect(slot).toBeDefined();
			return slot as HTMLElement;
		}

		it("shows Status/Date/URL/Icon slots when no properties exist and onAddProperty provided", () => {
			renderPanel({ onAddProperty });
			const slots = screen.getAllByTestId("suggested-property");
			expect(slots.length).toBe(4);
			expect(screen.getByText("status")).toBeInTheDocument();
			expect(screen.getByText("date")).toBeInTheDocument();
			expect(screen.getByText("url")).toBeInTheDocument();
			expect(screen.getByText("icon")).toBeInTheDocument();
			expect(screen.queryByText("Status")).not.toBeInTheDocument();
			expect(screen.queryByText("URL")).not.toBeInTheDocument();
		});

		it("shows a property-kind icon for each suggested slot", () => {
			renderPanel({ onAddProperty });

			expect(
				within(findSuggestedSlotHtml("status")).getByTestId(
					"suggested-property-icon-status",
				),
			).toBeInTheDocument();
			expect(
				within(findSuggestedSlotHtml("date")).getByTestId(
					"suggested-property-icon-date",
				),
			).toBeInTheDocument();
			expect(
				within(findSuggestedSlotHtml("url")).getByTestId(
					"suggested-property-icon-url",
				),
			).toBeInTheDocument();
			expect(
				within(findSuggestedSlotHtml("icon")).getByTestId(
					"suggested-property-icon-text",
				),
			).toBeInTheDocument();
		});

		it("hides Status slot when Status property already exists", () => {
			renderPanel({
				frontmatter: { Status: "Active" },
				onAddProperty,
				onUpdateProperty,
			});
			const slots = screen.getAllByTestId("suggested-property");
			expect(slots.length).toBe(3);
			expect(
				screen
					.queryAllByText("status")
					.some((el) => el.closest('[data-testid="suggested-property"]')),
			).toBe(false);
		});

		it("hides all slots when all suggested properties exist", () => {
			renderPanel({
				frontmatter: {
					Status: "Active",
					Date: "2024-01-01",
					URL: "https://example.com",
					icon: "star",
				},
				onAddProperty,
				onUpdateProperty,
			});
			expect(
				screen.queryByTestId("suggested-property"),
			).not.toBeInTheDocument();
		});

		it("does not show slots when onAddProperty is not provided", () => {
			renderPanel();
			expect(
				screen.queryByTestId("suggested-property"),
			).not.toBeInTheDocument();
		});

		it("opens the status editor without writing an empty property when clicking a suggested slot", async () => {
			renderPanel({ onAddProperty });
			fireEvent.click(findSuggestedSlotHtml("status"));
			expect(onAddProperty).not.toHaveBeenCalled();
			await waitFor(() => {
				expect(
					document.querySelector('[data-testid="status-dropdown-popover"]'),
				).toBeInTheDocument();
			});
		});

		it("writes the suggested status only after the user picks a value", async () => {
			renderPanel({ onAddProperty, onUpdateProperty });
			fireEvent.click(findSuggestedSlotHtml("status"));

			await waitFor(() => {
				expect(
					document.querySelector('[data-testid="status-option-active"]'),
				).toBeInTheDocument();
			});
			fireEvent.click(
				document.querySelector(
					'[data-testid="status-option-active"]',
				) as Element,
			);

			// A note with no status key gets the lowercase key and the lowercase value (TOL-466)
			expect(onAddProperty).toHaveBeenCalledWith("status", "active");
			expect(onAddProperty).not.toHaveBeenCalledWith(
				"Status",
				expect.anything(),
			);
		});

		it("hides the lowercase status slot when an old-cased Status key exists", () => {
			renderPanel({
				frontmatter: { Status: "active" },
				onAddProperty,
				onUpdateProperty,
			});
			expect(
				screen
					.getAllByTestId("suggested-property")
					.some((node) => node.textContent?.includes("status")),
			).toBe(false);
		});

		it("cancels a suggested status edit without writing frontmatter", async () => {
			renderPanel({ onAddProperty });
			fireEvent.click(findSuggestedSlotHtml("status"));

			await waitFor(() => {
				expect(
					document.querySelector('[data-testid="status-search-input"]'),
				).toBeInTheDocument();
			});
			fireEvent.keyDown(
				document.querySelector(
					'[data-testid="status-search-input"]',
				) as Element,
				{ key: "Escape" },
			);

			expect(onAddProperty).not.toHaveBeenCalled();
			expect(findSuggestedSlotHtml("status")).toBeInTheDocument();
		});

		it("opens the date picker without writing an empty property when clicking the Date slot", async () => {
			renderPanel({ onAddProperty });
			fireEvent.click(findSuggestedSlotHtml("date"));

			expect(onAddProperty).not.toHaveBeenCalled();
			await waitFor(() => {
				expect(screen.getByTestId("date-picker-popover")).toBeInTheDocument();
			});
		});

		it("writes the suggested date with the documented lowercase key", async () => {
			renderPanel({ onAddProperty });
			fireEvent.click(findSuggestedSlotHtml("date"));

			const input = await screen.findByTestId("date-picker-input");
			fireEvent.change(input, { target: { value: "2026-06-25" } });
			fireEvent.keyDown(input, { key: "Enter" });

			expect(onAddProperty).toHaveBeenCalledWith("date", "2026-06-25");
			expect(onAddProperty).not.toHaveBeenCalledWith("Date", "2026-06-25");
		});

		it("writes the suggested url with the lowercase key (TOL-466)", async () => {
			renderPanel({ onAddProperty });
			fireEvent.click(findSuggestedSlotHtml("url"));

			const input = await screen.findByRole("textbox");
			fireEvent.change(input, { target: { value: "https://example.com" } });
			fireEvent.keyDown(input, { key: "Enter" });

			expect(onAddProperty).toHaveBeenCalledWith("url", "https://example.com");
			expect(onAddProperty).not.toHaveBeenCalledWith("URL", expect.anything());
		});
	});

	describe("status dropdown interaction", () => {
		it("closes dropdown on Escape without saving", () => {
			renderEditablePanel({ Status: "Active" });
			fireEvent.click(screen.getByTestId("status-badge"));
			expect(screen.getByTestId("status-dropdown")).toBeInTheDocument();
			fireEvent.keyDown(screen.getByTestId("status-search-input"), {
				key: "Escape",
			});
			expect(screen.queryByTestId("status-dropdown")).not.toBeInTheDocument();
			expect(onUpdateProperty).not.toHaveBeenCalled();
		});

		it("closes dropdown on backdrop click without saving", () => {
			renderEditablePanel({ Status: "Active" });
			fireEvent.click(screen.getByTestId("status-badge"));
			fireEvent.click(screen.getByTestId("status-dropdown-backdrop"));
			expect(screen.queryByTestId("status-dropdown")).not.toBeInTheDocument();
			expect(onUpdateProperty).not.toHaveBeenCalled();
		});

		it("creates custom status by typing and pressing Enter", () => {
			renderEditablePanel({ Status: "Active" });
			fireEvent.click(screen.getByTestId("status-badge"));
			const input = screen.getByTestId("status-search-input");
			fireEvent.change(input, { target: { value: "Needs Review" } });
			fireEvent.keyDown(input, { key: "Enter" });
			expect(onUpdateProperty).toHaveBeenCalledWith("Status", "Needs Review");
		});

		it("shows vault statuses from entries", () => {
			const entriesWithStatuses = [
				makeEntry({ path: "/vault/a.md", status: "Reviewing" }),
				makeEntry({ path: "/vault/b.md", status: "Shipped" }),
			];
			renderPanel({
				frontmatter: { Status: "Active" },
				entries: entriesWithStatuses,
				onUpdateProperty,
			});
			fireEvent.click(screen.getByTestId("status-badge"));
			expect(screen.getByTestId("status-option-Reviewing")).toBeInTheDocument();
			expect(screen.getByTestId("status-option-Shipped")).toBeInTheDocument();
		});
	});
});

describe("Type-derived date placeholders", () => {
	it("opens the date picker for an empty type-defined date property", () => {
		const onUpdateProperty = vi.fn();
		const typeEntry = makeEntry({
			title: "Event",
			isA: "Type",
			properties: { date: null },
		});

		renderPanel({
			entry: makeEntry({ title: "Concert", isA: "Event" }),
			entries: [typeEntry],
			frontmatter: {},
			onUpdateProperty,
		});

		const placeholder = screen.getByTestId("type-derived-property");
		expect(within(placeholder).getByText("Date")).toHaveClass(
			"text-text-muted",
		);
		fireEvent.click(placeholder);
		const input = screen.getByTestId("date-picker-input");
		fireEvent.change(input, { target: { value: "2026-05-04" } });
		fireEvent.keyDown(input, { key: "Enter" });

		expect(onUpdateProperty).toHaveBeenCalledWith("date", "2026-05-04");
	});
});
