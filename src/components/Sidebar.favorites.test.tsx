import { fireEvent, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { VaultEntry } from "../types";
import type { Sidebar } from "./Sidebar";
import {
	buildSidebarEntry,
	mockEntries,
	renderSidebar,
	requireElement,
} from "./Sidebar.testUtils";

describe("Sidebar.favorites", () => {
	describe("FAVORITES section", () => {
		const favEntry: VaultEntry = buildSidebarEntry({
			path: "/vault/project/fav.md",
			filename: "fav.md",
			title: "My Favorite Note",
			status: null,
			owner: null,
			fileSize: 100,
			view: null,
			visible: null,
			favorite: true,
			favoriteIndex: 0,
		});

		function getFavoriteAndTypeRows(favoriteTitle = "My Favorite Note") {
			const favoriteLabel = screen.getByText(favoriteTitle);
			const favoriteRow = favoriteLabel.closest(".cursor-pointer");
			const typeLabel = screen.getByText("Projects");
			const typeRow = typeLabel.closest(".cursor-pointer");
			expect(favoriteRow).not.toBeNull();
			expect(typeRow).not.toBeNull();

			return {
				favoriteLabel,
				favoriteRow: favoriteRow,
				typeLabel,
				typeRow: typeRow,
			};
		}

		function expectFavoriteIconToMatchTypeSizing(favoriteRow: HTMLElement) {
			const favoriteIcon = favoriteRow.querySelector("svg");
			expect(favoriteIcon).not.toBeNull();
			expect(favoriteIcon?.getAttribute("width")).toBe("16");
			expect(favoriteIcon?.getAttribute("height")).toBe("16");
			expect(favoriteIcon?.getAttribute("style")).toContain(
				"var(--accent-red)",
			);
			return favoriteIcon;
		}

		function expectFavoriteRowToMatchTypeRow(
			favoriteTitle = "My Favorite Note",
		) {
			const { favoriteLabel, favoriteRow, typeLabel, typeRow } =
				getFavoriteAndTypeRows(favoriteTitle);

			expect(favoriteRow.className).toContain(typeRow.className);
			expect(favoriteRow.className).toContain("w-full");
			expect(favoriteRow.style.padding).toBe(typeRow.style.padding);
			expect(favoriteRow.style.gap).toBe(typeRow.style.gap);
			expect(favoriteLabel.className).toContain(typeLabel.className);
			expect(favoriteLabel.className).toContain("truncate");
			return {
				favoriteRow,
				typeRow,
				favoriteIcon: expectFavoriteIconToMatchTypeSizing(favoriteRow),
			};
		}

		it("shows FAVORITES section when there are favorites", () => {
			renderSidebar({ entries: [...mockEntries, favEntry] });
			expect(screen.getByText("FAVORITES")).toBeInTheDocument();
			expect(screen.getByText("My Favorite Note")).toBeInTheDocument();
		});

		it("preserves plain square brackets in favorite titles", () => {
			const bracketedFavorite = { ...favEntry, title: "[26Q2] Tolaria MVP" };

			renderSidebar({ entries: [...mockEntries, bracketedFavorite] });

			expect(screen.getByText("[26Q2] Tolaria MVP")).toBeInTheDocument();
		});

		it("hides FAVORITES section when no favorites", () => {
			renderSidebar({});
			expect(screen.queryByText("FAVORITES")).not.toBeInTheDocument();
		});

		it("calls onSelect with favorites filter when clicking a favorite", () => {
			const onSelect = vi.fn();
			renderSidebar({
				entries: [...mockEntries, favEntry],
				onSelect: onSelect,
			});
			fireEvent.click(screen.getByText("My Favorite Note"));
			expect(onSelect).toHaveBeenCalledWith({
				kind: "filter",
				filter: "favorites",
			});
		});

		it("matches the Types row styling and type color for favorites", () => {
			renderSidebar({ entries: [...mockEntries, favEntry] });
			expectFavoriteRowToMatchTypeRow();
		});

		it("aligns the favorites header count pill with the shared sidebar count column", () => {
			renderSidebar({ entries: [...mockEntries, favEntry] });

			const favoritesHeader = screen.getByText("FAVORITES").closest("div");
			const countChip =
				within(favoritesHeader).getByTestId("sidebar-count-chip");

			expect(favoritesHeader).toHaveStyle({ padding: "8px 8px 8px 12px" });
			expect(countChip).toHaveStyle({
				height: "18px",
				padding: "0 6px",
			});
			expect(countChip.className).toContain("bg-count-pill");
		});

		it("prefers a favorite note emoji icon over the type icon fallback", () => {
			const emojiFavorite = {
				...favEntry,
				title: "Emoji Favorite",
				icon: "🚀",
			};

			renderSidebar({ entries: [...mockEntries, emojiFavorite] });

			const emojiRow = screen
				.getByText("Emoji Favorite")
				.closest(".cursor-pointer");
			expect(within(emojiRow).getByText("🚀")).toBeInTheDocument();
			expect(emojiRow?.querySelector("svg")).toBeNull();
		});

		it("uses a favorite note phosphor icon and keeps the type color", () => {
			const iconFavorite = {
				...favEntry,
				title: "Icon Favorite",
				icon: "rocket",
			};

			renderSidebar({ entries: [...mockEntries, iconFavorite] });

			const { favoriteIcon, typeRow } =
				expectFavoriteRowToMatchTypeRow("Icon Favorite");
			const typeIcon = typeRow.querySelector("svg");
			expect(typeIcon).not.toBeNull();
			expect(favoriteIcon?.querySelector("path")?.getAttribute("d")).not.toBe(
				typeIcon?.querySelector("path")?.getAttribute("d"),
			);
		});

		it("falls back to a neutral icon color when the favorite type has no defined color", () => {
			const customType: VaultEntry = buildSidebarEntry({
				path: "/vault/types/recipe.md",
				filename: "recipe.md",
				title: "Recipe",
				isA: "Type",
				status: null,
				owner: null,
				fileSize: 120,
				icon: "flask",
				view: null,
				visible: null,
			});
			const recipeFavorite: VaultEntry = buildSidebarEntry({
				path: "/vault/recipe/sourdough.md",
				filename: "sourdough.md",
				title: "Sourdough",
				isA: "Recipe",
				status: null,
				owner: null,
				fileSize: 120,
				view: null,
				visible: null,
				favorite: true,
				favoriteIndex: 0,
			});

			renderSidebar({ entries: [...mockEntries, customType, recipeFavorite] });

			const recipeRow = screen
				.getByText("Sourdough")
				.closest(".cursor-pointer");
			const recipeIcon = recipeRow?.querySelector("svg");

			expect(recipeIcon?.getAttribute("style")).toContain(
				"var(--accent-gray)",
			);
			expect(within(recipeRow).getByText("Sourdough")).toBeInTheDocument();
		});
	});

	describe("group separators", () => {
		it("TYPES header and its entries share the same border-b container (no separator inside group)", () => {
			renderSidebar({});
			const sectionsHeader = screen.getByText("TYPES");
			const projectsSection = screen.getByText("Projects");
			// Walk up from TYPES header to find the border-b container
			const borderContainer = sectionsHeader.closest(".border-b");
			expect(borderContainer).not.toBeNull();
			// The section entry should be inside the same border-b container
			expect(borderContainer?.contains(projectsSection)).toBe(true);
		});
	});

	describe("view row actions", () => {
		const mockViews = [
			{
				filename: "active-projects.yml",
				definition: {
					name: "Active Projects",
					icon: "🚀",
					color: null,
					sort: null,
					filters: {
						all: [{ field: "type", op: "equals" as const, value: "Project" }],
					},
				},
			},
		];

		function renderViewActions(
			overrides: Partial<ComponentProps<typeof Sidebar>> = {},
		) {
			renderSidebar({
				views: mockViews,
				onEditView: () => {},
				onDeleteView: () => {},
				onUpdateViewDefinition: () => {},
				...overrides,
			});
		}

		function openViewContextMenu() {
			fireEvent.contextMenu(
				requireElement(
					screen
						.getByText("Active Projects")
						.closest('[class*="cursor-pointer"]'),
				),
			);
		}

		it("keeps edit and delete off the hover row controls", () => {
			renderViewActions();
			expect(screen.queryByTitle("Edit view")).not.toBeInTheDocument();
			expect(screen.queryByTitle("Delete view")).not.toBeInTheDocument();
		});

		it("shows View-specific context menu labels on right-click", () => {
			renderViewActions();
			openViewContextMenu();

			expect(screen.getByText("Edit view")).toBeInTheDocument();
			expect(screen.queryByText("Rename view…")).not.toBeInTheDocument();
			expect(screen.getByText("Customize icon & color…")).toBeInTheDocument();
			expect(screen.getByText("Delete view")).toBeInTheDocument();
		});

		it("opens and dismisses the View context menu from the keyboard", () => {
			renderViewActions();
			const row = requireElement(
				screen
					.getByText("Active Projects")
					.closest('[class*="cursor-pointer"]'),
			);
			fireEvent.keyDown(row, { key: "F10", shiftKey: true });
			expect(screen.getByText("Edit view")).toBeInTheDocument();

			fireEvent.keyDown(document, { key: "Escape" });
			expect(screen.queryByText("Edit view")).not.toBeInTheDocument();
		});

		it("calls onEditView from the context menu", () => {
			const onEditView = vi.fn();
			renderViewActions({ onEditView });
			openViewContextMenu();
			fireEvent.click(screen.getByText("Edit view"));
			expect(onEditView).toHaveBeenCalledWith("active-projects.yml");
		});

		it("starts inline rename when the view row is double-clicked", () => {
			renderViewActions();
			fireEvent.doubleClick(
				requireElement(
					screen
						.getByText("Active Projects")
						.closest('[class*="cursor-pointer"]'),
				),
			);
			expect(screen.getByRole("textbox", { name: "View name" })).toHaveValue(
				"Active Projects",
			);
		});

		it("submits the renamed view on Enter", () => {
			const onUpdateViewDefinition = vi.fn();
			renderViewActions({ onUpdateViewDefinition });
			fireEvent.doubleClick(
				requireElement(
					screen
						.getByText("Active Projects")
						.closest('[class*="cursor-pointer"]'),
				),
			);

			const input = screen.getByRole("textbox", { name: "View name" });
			fireEvent.change(input, { target: { value: "Today Focus" } });
			fireEvent.keyDown(input, { key: "Enter" });

			expect(onUpdateViewDefinition).toHaveBeenCalledWith(
				"active-projects.yml",
				{ name: "Today Focus" },
			);
		});

		it("opens the shared appearance panel from the context menu", () => {
			const onUpdateViewDefinition = vi.fn();
			renderViewActions({ onUpdateViewDefinition });
			openViewContextMenu();
			fireEvent.click(screen.getByText("Customize icon & color…"));

			fireEvent.click(screen.getByTitle("Blue"));
			fireEvent.change(screen.getByPlaceholderText("Search icons…"), {
				target: { value: "book" },
			});
			fireEvent.click(screen.getByTitle("book"));

			expect(onUpdateViewDefinition).toHaveBeenCalledWith(
				"active-projects.yml",
				{ color: "blue" },
			);
			expect(onUpdateViewDefinition).toHaveBeenCalledWith(
				"active-projects.yml",
				{ icon: "book" },
			);
		});

		it("calls onDeleteView from the context menu", () => {
			const onDeleteView = vi.fn();
			renderViewActions({ onDeleteView });
			openViewContextMenu();
			fireEvent.click(screen.getByText("Delete view"));
			expect(onDeleteView).toHaveBeenCalledWith("active-projects.yml");
		});
	});

	describe("create type button", () => {
		it("renders + button in TYPES header when onCreateNewType is provided", () => {
			renderSidebar({ onCreateNewType: () => {} });
			expect(screen.getByTestId("create-type-btn")).toBeInTheDocument();
		});

		it("does not render + button when onCreateNewType is not provided", () => {
			renderSidebar({});
			expect(screen.queryByTestId("create-type-btn")).not.toBeInTheDocument();
		});

		it("calls onCreateNewType when + button is clicked", () => {
			const onCreateNewType = vi.fn();
			renderSidebar({ onCreateNewType: onCreateNewType });
			fireEvent.click(screen.getByTestId("create-type-btn"));
			expect(onCreateNewType).toHaveBeenCalledOnce();
		});
	});
});
