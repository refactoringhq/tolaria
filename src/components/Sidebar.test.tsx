import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { VaultEntry } from "../types";
import { Sidebar } from "./Sidebar";
import {
	buildSidebarEntry,
	defaultSelection,
	mockEntries,
	renderSidebar,
	requireElement,
} from "./Sidebar.testUtils";

describe("Sidebar", () => {
	it("renders top nav items (All Notes)", () => {
		renderSidebar({ entries: [] });
		expect(screen.getByText("All Notes")).toBeInTheDocument();
		expect(screen.queryByText("Favorites")).not.toBeInTheDocument();
	});

	it("renders section group headers only for types present in entries", () => {
		renderSidebar({});
		expect(screen.getByText("Projects")).toBeInTheDocument();
		expect(screen.getByText("Experiments")).toBeInTheDocument();
		expect(screen.getByText("Responsibilities")).toBeInTheDocument();
		expect(screen.getByText("Procedures")).toBeInTheDocument();
		expect(screen.getByText("People")).toBeInTheDocument();
		expect(screen.getByText("Events")).toBeInTheDocument();
		expect(screen.getByText("Topics")).toBeInTheDocument();
		// No entries with isA: 'Type' in mockEntries → Types section absent
		expect(screen.queryByText("Types")).not.toBeInTheDocument();
	});

	it("does not show inline entity names — sections are flat rows", () => {
		renderSidebar({});
		// Individual entries should NOT appear inline in the sidebar
		expect(screen.queryByText("Build Laputa App")).not.toBeInTheDocument();
		expect(screen.queryByText("Grow Newsletter")).not.toBeInTheDocument();
	});

	it("shows note count chip on type sections", () => {
		renderSidebar({});
		// Projects section has 1 entry — count chip should be a sibling of the label
		const projectsHeader = requireElement(
			screen.getByText("Projects").closest('[class*="group/section"]'),
		);
		expect(projectsHeader.textContent).toContain("1");
	});

	it.each([
		{ label: "Projects", type: "Project" },
		{ label: "People", type: "Person" },
	])("selects the $type section when clicking its header", ({
		label,
		type,
	}) => {
		const onSelect = vi.fn();
		renderSidebar({ onSelect });
		fireEvent.click(screen.getByText(label));
		expect(onSelect).toHaveBeenCalledWith({ kind: "sectionGroup", type });
	});

	it("selects on every click — no expand/collapse toggle", () => {
		const onSelect = vi.fn();
		renderSidebar({ onSelect: onSelect });
		fireEvent.click(screen.getByText("Projects"));
		fireEvent.click(screen.getByText("Projects"));
		expect(onSelect).toHaveBeenCalledTimes(2);
	});

	it("renders Topics section header", () => {
		renderSidebar({});
		expect(screen.getByText("Topics")).toBeInTheDocument();
		// Topic entries are NOT shown inline
		expect(screen.queryByText("Software Development")).not.toBeInTheDocument();
	});

	it("does not render + buttons on type sections", () => {
		renderSidebar({ onCreateType: () => {} });
		expect(screen.queryByTitle("New Project")).not.toBeInTheDocument();
	});

	it.each([
		"Changes",
		"Pulse",
		"Commit & Push",
		"Projects",
		"People",
		"Events",
	])("omits %s from an empty sidebar", (label) => {
		renderSidebar({ entries: [] });
		expect(screen.queryByText(label)).not.toBeInTheDocument();
	});

	describe("dynamic custom type sections", () => {
		const entriesWithCustomTypes: VaultEntry[] = [
			...mockEntries,
			buildSidebarEntry({
				path: "/vault/recipe.md",
				filename: "recipe.md",
				title: "Recipe",
				isA: "Type",
				status: null,
				owner: null,
				fileSize: 200,
			}),
			buildSidebarEntry({
				path: "/vault/book.md",
				filename: "book.md",
				title: "Book",
				isA: "Type",
				status: null,
				owner: null,
				fileSize: 200,
			}),
			buildSidebarEntry({
				path: "/vault/recipe/pasta.md",
				filename: "pasta.md",
				title: "Pasta Carbonara",
				isA: "Recipe",
				status: null,
				owner: null,
				fileSize: 300,
			}),
			buildSidebarEntry({
				path: "/vault/book/ddia.md",
				filename: "ddia.md",
				title: "Designing Data-Intensive Applications",
				isA: "Book",
				status: null,
				owner: null,
				fileSize: 400,
			}),
		];

		it("renders custom type sections derived from actual entries", () => {
			renderSidebar({
				entries: entriesWithCustomTypes,
				onCreateType: () => {},
			});
			expect(screen.getByText("Books")).toBeInTheDocument();
			expect(screen.getByText("Recipes")).toBeInTheDocument();
		});

		it("does not show inline instances — sections are flat rows", () => {
			renderSidebar({
				entries: entriesWithCustomTypes,
				onCreateType: () => {},
			});
			expect(screen.queryByText("Pasta Carbonara")).not.toBeInTheDocument();
		});

		it("shows section for type with zero active entries when type definition exists", () => {
			// Only Type definitions exist for Book, no actual Book instances
			// New behavior: types are shown in sidebar as long as the Type definition exists (not archived)
			const entriesNoBookInstance = entriesWithCustomTypes.filter(
				(e) => !(e.isA === "Book" && e.title !== "Book"),
			);
			renderSidebar({ entries: entriesNoBookInstance });
			// Books should still appear because the Book type definition exists
			expect(screen.getByText("Books")).toBeInTheDocument();
			// Recipes still has an instance (Pasta Carbonara)
			expect(screen.getByText("Recipes")).toBeInTheDocument();
		});

		it("does not show built-in types as custom sections", () => {
			const projectTypeEntry: VaultEntry = buildSidebarEntry({
				path: "/vault/project.md",
				filename: "project.md",
				title: "Project",
				isA: "Type",
				status: null,
				owner: null,
				fileSize: 200,
			});
			renderSidebar({ entries: [...mockEntries, projectTypeEntry] });
			// "Projects" should appear once (the built-in section), not twice
			const projectLabels = screen.getAllByText("Projects");
			expect(projectLabels.length).toBe(1);
		});

		it("uses sidebarLabel from Type entry instead of auto-pluralization", () => {
			const entriesWithLabel: VaultEntry[] = [
				...mockEntries,
				buildSidebarEntry({
					path: "/vault/news.md",
					filename: "news.md",
					title: "News",
					isA: "Type",
					status: null,
					owner: null,
					fileSize: 200,
					sidebarLabel: "News",
				}),
				buildSidebarEntry({
					path: "/vault/news/breaking.md",
					filename: "breaking.md",
					title: "Breaking Story",
					isA: "News",
					status: null,
					owner: null,
					fileSize: 300,
				}),
			];
			renderSidebar({ entries: entriesWithLabel });
			// Should show "News" (custom label), not "Newses" (auto-pluralized)
			expect(screen.getByText("News")).toBeInTheDocument();
			expect(screen.queryByText("Newses")).not.toBeInTheDocument();
		});

		it("uses sidebarLabel to override built-in type label", () => {
			const entriesWithBuiltInOverride: VaultEntry[] = [
				...mockEntries,
				buildSidebarEntry({
					path: "/vault/person.md",
					filename: "person.md",
					title: "Person",
					isA: "Type",
					status: null,
					owner: null,
					fileSize: 200,
					sidebarLabel: "Contacts",
				}),
			];
			renderSidebar({ entries: entriesWithBuiltInOverride });
			expect(screen.getByText("Contacts")).toBeInTheDocument();
			expect(screen.queryByText("People")).not.toBeInTheDocument();
		});

		it("falls back to auto-pluralization when sidebarLabel is null", () => {
			renderSidebar({ entries: entriesWithCustomTypes });
			// Recipe has no sidebarLabel → should auto-pluralize to "Recipes"
			expect(screen.getByText("Recipes")).toBeInTheDocument();
		});

		it("uses exact type names when automatic sidebar pluralization is disabled", () => {
			renderSidebar({
				entries: entriesWithCustomTypes,
				pluralizeTypeLabels: false,
			});

			expect(screen.getByText("Recipe")).toBeInTheDocument();
			expect(screen.getByText("Project")).toBeInTheDocument();
			expect(screen.queryByText("Recipes")).not.toBeInTheDocument();
			expect(screen.queryByText("Projects")).not.toBeInTheDocument();
		});
	});

	describe("type visibility via visible property", () => {
		const makeSidebarEntry = (overrides: {
			path: string;
			filename: string;
			title: string;
			isA: string;
			visible?: boolean | null;
		}): VaultEntry =>
			buildSidebarEntry({
				path: overrides.path,
				filename: overrides.filename,
				title: overrides.title,
				isA: overrides.isA,
				status: null,
				owner: null,
				fileSize: 200,
				view: null,
				visible: overrides.visible ?? null,
			});

		const makeTypeEntry = (
			title: string,
			visible: boolean | null,
		): VaultEntry =>
			makeSidebarEntry({
				path: `/vault/${title.toLowerCase()}.md`,
				filename: `${title.toLowerCase()}.md`,
				title,
				isA: "Type",
				visible,
			});

		it("hides a section when its Type entry has visible: false", () => {
			const entries: VaultEntry[] = [
				...mockEntries,
				makeTypeEntry("Person", false),
			];
			renderSidebar({ entries: entries });
			expect(screen.queryByText("People")).not.toBeInTheDocument();
			// Other sections should still be visible
			expect(screen.getByText("Projects")).toBeInTheDocument();
		});

		it.each([true, null])("shows sections with visible=%s", (visible) => {
			renderSidebar({
				entries: [...mockEntries, makeTypeEntry("Person", visible)],
			});
			expect(screen.getByText("People")).toBeInTheDocument();
		});

		it("shows a section when there is no Type entry at all (default visible)", () => {
			// mockEntries has Person instances but no Type entry for Person
			renderSidebar({});
			expect(screen.getByText("People")).toBeInTheDocument();
		});

		it("hides multiple sections when their Type entries have visible: false", () => {
			const entries: VaultEntry[] = [
				...mockEntries,
				makeTypeEntry("Person", false),
				makeTypeEntry("Event", false),
			];
			renderSidebar({ entries: entries });
			expect(screen.queryByText("People")).not.toBeInTheDocument();
			expect(screen.queryByText("Events")).not.toBeInTheDocument();
			expect(screen.getByText("Projects")).toBeInTheDocument();
			expect(screen.getByText("Topics")).toBeInTheDocument();
		});

		it("does not affect All Notes or other sidebar filters when sections are hidden", () => {
			const entries: VaultEntry[] = [
				...mockEntries,
				makeTypeEntry("Project", false),
				makeTypeEntry("Person", false),
			];
			renderSidebar({ entries: entries });
			expect(screen.getByText("All Notes")).toBeInTheDocument();
			expect(screen.queryByText("Favorites")).not.toBeInTheDocument();
		});

		it('renders a "Customize sections" button', () => {
			renderSidebar({});
			expect(screen.getByTitle("Customize sections")).toBeInTheDocument();
		});

		it("opens popover with toggle for each section when clicking customize button", () => {
			renderSidebar({});
			fireEvent.click(screen.getByTitle("Customize sections"));
			expect(screen.getByText("Show in sidebar")).toBeInTheDocument();
			expect(screen.getByLabelText("Toggle Projects")).toBeInTheDocument();
			expect(screen.getByLabelText("Toggle People")).toBeInTheDocument();
			expect(screen.getByLabelText("Toggle Topics")).toBeInTheDocument();
		});

		it("updates the sidebar type picker when Journal becomes a real type while the app stays open", () => {
			const journalEntries: VaultEntry[] = [
				...mockEntries,
				makeSidebarEntry({
					path: "/vault/april-21.md",
					filename: "april-21.md",
					title: "April 21",
					isA: "journal",
				}),
			];
			const { rerender } = renderSidebar({ entries: journalEntries });

			fireEvent.click(screen.getByTitle("Customize sections"));
			expect(
				screen.queryByLabelText("Toggle Journals"),
			).not.toBeInTheDocument();

			rerender(
				<Sidebar
					entries={[...journalEntries, makeTypeEntry("Journal", null)]}
					selection={defaultSelection}
					onSelect={() => {}}
				/>,
			);
			expect(screen.getByLabelText("Toggle Journals")).toBeInTheDocument();

			rerender(
				<Sidebar
					entries={journalEntries}
					selection={defaultSelection}
					onSelect={() => {}}
				/>,
			);
			expect(
				screen.queryByLabelText("Toggle Journals"),
			).not.toBeInTheDocument();
		});

		it("preserves custom section colors in the customize popover", () => {
			const entries: VaultEntry[] = [
				...mockEntries,
				buildSidebarEntry({
					path: "/vault/project-type.md",
					filename: "project-type.md",
					title: "Project",
					isA: "Type",
					status: null,
					owner: null,
					fileSize: 200,
					color: "green",
				}),
				buildSidebarEntry({
					path: "/vault/recipe.md",
					filename: "recipe.md",
					title: "Recipe",
					isA: "Type",
					status: null,
					owner: null,
					fileSize: 200,
					color: "#00ffff",
				}),
				buildSidebarEntry({
					path: "/vault/recipe/pasta.md",
					filename: "pasta.md",
					title: "Pasta Carbonara",
					isA: "Recipe",
					status: null,
					owner: null,
					fileSize: 200,
				}),
			];

			renderSidebar({ entries: entries });
			fireEvent.click(screen.getByTitle("Customize sections"));

			expect(
				screen.getByLabelText("Toggle Projects").querySelector("svg"),
			).toHaveStyle({ color: "var(--accent-green)" });
			expect(
				screen.getByLabelText("Toggle Recipes").querySelector("svg"),
			).toHaveStyle({ color: "var(--accent-teal)" });
		});

		it("calls onToggleTypeVisibility when toggling a section in the popover", () => {
			const onToggleTypeVisibility = vi.fn();
			renderSidebar({ onToggleTypeVisibility: onToggleTypeVisibility });
			fireEvent.click(screen.getByTitle("Customize sections"));
			fireEvent.click(screen.getByLabelText("Toggle People"));
			expect(onToggleTypeVisibility).toHaveBeenCalledWith("Person");
		});

		it("closes popover when clicking outside", () => {
			render(
				<div>
					<div data-testid="outside">outside</div>
					<Sidebar
						entries={mockEntries}
						selection={defaultSelection}
						onSelect={() => {}}
					/>
				</div>,
			);
			fireEvent.click(screen.getByTitle("Customize sections"));
			expect(screen.getByText("Show in sidebar")).toBeInTheDocument();

			fireEvent.mouseDown(screen.getByTestId("outside"));
			expect(screen.queryByText("Show in sidebar")).not.toBeInTheDocument();
		});
	});

	describe("section ordering by type order property", () => {
		const entriesWithOrder: VaultEntry[] = [
			...mockEntries,
			// Type entries with order values — reversed from default
			buildSidebarEntry({
				path: "/vault/project.md",
				filename: "project.md",
				title: "Project",
				isA: "Type",
				status: null,
				owner: null,
				fileSize: 200,
				order: 5,
			}),
			buildSidebarEntry({
				path: "/vault/topic.md",
				filename: "topic.md",
				title: "Topic",
				isA: "Type",
				status: null,
				owner: null,
				fileSize: 200,
				order: 0,
			}),
			buildSidebarEntry({
				path: "/vault/person.md",
				filename: "person.md",
				title: "Person",
				isA: "Type",
				status: null,
				owner: null,
				fileSize: 200,
				order: 1,
			}),
		];

		it("sorts sections by order from Type entries", () => {
			renderSidebar({ entries: entriesWithOrder });
			// Get all section header labels
			const headers = screen.getAllByText(
				/^(Topics|People|Projects|Experiments|Responsibilities|Procedures|Events|Types)$/,
			);
			const labels = headers.map((el) => el.textContent);

			// Topics (order: 0) and People (order: 1) should come before Projects (order: 5)
			const topicsIdx = labels.indexOf("Topics");
			const peopleIdx = labels.indexOf("People");
			const projectsIdx = labels.indexOf("Projects");

			expect(topicsIdx).toBeLessThan(projectsIdx);
			expect(peopleIdx).toBeLessThan(projectsIdx);
			expect(topicsIdx).toBeLessThan(peopleIdx);
		});

		it("does not render drag handle icons on section headers", () => {
			renderSidebar({});
			const dragHandles = screen.queryAllByLabelText(/^Drag to reorder/);
			expect(dragHandles.length).toBe(0);
		});
	});
});
