import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderSidebar, requireElement } from "./Sidebar.testUtils";

describe("Sidebar saved views", () => {
	describe("view note count chips", () => {
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
			{
				filename: "all-topics.yml",
				definition: {
					name: "All Topics",
					icon: null,
					color: null,
					sort: null,
					filters: {
						all: [{ field: "type", op: "equals" as const, value: "Topic" }],
					},
				},
			},
		];

		it("does not add visible reorder controls to saved view rows", () => {
			renderSidebar({ views: mockViews, onReorderViews: vi.fn() });

			expect(screen.queryByTitle("Move view up")).not.toBeInTheDocument();
			expect(screen.queryByTitle("Move view down")).not.toBeInTheDocument();
			expect(screen.queryByTitle("Reorder view")).not.toBeInTheDocument();
		});

		it("shows note count chip for each view matching the filter results", () => {
			renderSidebar({ views: mockViews });
			// 'Active Projects' filters for type=Project -> mockEntries has 1 Project (build-app.md)
			const projectLabel = screen.getByText("Active Projects");
			const projectNavItem = requireElement(
				projectLabel.closest('[class*="cursor-pointer"]'),
			);
			// The count chip is a sibling span inside the NavItem
			const projectCount =
				within(projectNavItem).getByTestId("view-count-chip");
			expect(projectCount?.textContent).toBe("1");

			// 'All Topics' filters for type=Topic -> mockEntries has 2 Topics
			const topicLabel = screen.getByText("All Topics");
			const topicNavItem = requireElement(
				topicLabel.closest('[class*="cursor-pointer"]'),
			);
			const topicCount = within(topicNavItem).getByTestId("view-count-chip");
			expect(topicCount?.textContent).toBe("2");
		});

		it("styles view note count chips like the shared sidebar count pills", () => {
			renderSidebar({ views: mockViews });

			const viewLabel = screen.getByText("Active Projects");
			const navItem = viewLabel.closest('[class*="cursor-pointer"]');
			const countChip = within(navItem).getByTestId("view-count-chip");

			expect(navItem).toHaveStyle({ padding: "6px 8px 6px 12px" });
			expect(countChip).toHaveStyle({
				height: "20px",
				padding: "0 6px",
			});
			expect(countChip).toHaveClass("bg-transparent");
			expect(countChip.className).toContain(
				"group-hover/sidebar-row:bg-transparent",
			);
		});

		it("aligns top-nav count pills to the same trailing column as view rows", () => {
			renderSidebar({ inboxCount: 12, views: mockViews });

			const topNavItem = screen
				.getByText("Inbox")
				.closest('[class*="cursor-pointer"]');
			const topNavCount = within(topNavItem).getByTestId("sidebar-count-chip");
			const viewItem = screen
				.getByText("Active Projects")
				.closest('[class*="cursor-pointer"]');
			const viewCount = within(viewItem).getByTestId("view-count-chip");

			expect(topNavItem).toHaveStyle({ padding: "6px 8px 6px 12px" });
			expect(viewItem).toHaveStyle({ padding: "6px 8px 6px 12px" });
			expect(topNavCount).toHaveStyle({
				height: "20px",
				padding: "0 6px",
			});
			expect(viewCount).toHaveStyle({
				height: "20px",
				padding: "0 6px",
			});
			expect(topNavCount).toHaveClass("bg-transparent");
			expect(viewCount).toHaveClass("bg-transparent");
		});

		it("renders phosphor view icons without leaking the raw icon name", () => {
			const iconViews = [
				{
					filename: "active-projects.yml",
					definition: {
						name: "Active Projects",
						icon: "rocket",
						color: null,
						sort: null,
						filters: {
							all: [{ field: "type", op: "equals" as const, value: "Project" }],
						},
					},
				},
			];

			renderSidebar({ views: iconViews });

			const navItem = screen
				.getByText("Active Projects")
				.closest('[class*="cursor-pointer"]');
			expect(navItem.querySelector("svg")).not.toBeNull();
			expect(screen.queryByText("rocket")).not.toBeInTheDocument();
		});

		it("uses saved view color metadata for sidebar accents", () => {
			const coloredViews = [
				{
					filename: "active-projects.yml",
					definition: {
						name: "Active Projects",
						icon: "rocket",
						color: "blue",
						sort: null,
						filters: {
							all: [{ field: "type", op: "equals" as const, value: "Project" }],
						},
					},
				},
			];

			renderSidebar({
				selection: { kind: "view", filename: "active-projects.yml" },
				views: coloredViews,
			});

			const navItem = screen
				.getByText("Active Projects")
				.closest('[class*="cursor-pointer"]');
			const icon = navItem.querySelector("svg");
			const countChip = within(navItem).getByTestId("view-count-chip");

			expect(navItem).toHaveStyle({
				background: "var(--accent-blue-light)",
				color: "var(--accent-blue)",
			});
			expect(icon).toHaveStyle({ color: "var(--accent-blue)" });
			expect(countChip).toHaveClass("bg-transparent", "font-medium");
			expect(countChip.className).toContain("text-[var(--sidebar-active-fg,var(--accent-blue))]");
		});

		it("keeps the default active styling when a saved view color is invalid", () => {
			const invalidColorViews = [
				{
					filename: "active-projects.yml",
					definition: {
						name: "Active Projects",
						icon: "rocket",
						color: "not-a-token",
						sort: null,
						filters: {
							all: [{ field: "type", op: "equals" as const, value: "Project" }],
						},
					},
				},
			];

			renderSidebar({
				selection: { kind: "view", filename: "active-projects.yml" },
				views: invalidColorViews,
			});

			const navItem = screen
				.getByText("Active Projects")
				.closest('[class*="cursor-pointer"]');

			expect(navItem.className).toContain("text-[var(--accent-blue)]");
			expect(navItem.getAttribute("style")).not.toContain("--accent-");
		});

		it("does not show count chip for views with 0 matching notes", () => {
			const emptyView = [
				{
					filename: "empty.yml",
					definition: {
						name: "Empty View",
						icon: null,
						color: null,
						sort: null,
						filters: {
							all: [
								{ field: "type", op: "equals" as const, value: "Nonexistent" },
							],
						},
					},
				},
			];
			renderSidebar({ views: emptyView });
			expect(screen.getByText("Empty View")).toBeInTheDocument();
			// No count chip rendered for 0 results (NavItem hides count <= 0)
			const viewContainer = screen.getByText("Empty View").closest("div");
			expect(
				viewContainer?.querySelector("span:last-child")?.textContent,
			).not.toBe("0");
		});

		it("keeps the view count chip visible because row actions live in the context menu", () => {
			renderSidebar({
				views: mockViews,
				onEditView: () => {},
				onDeleteView: () => {},
			});

			const label = screen.getByText("Active Projects");
			const navItem = label.closest('[class*="cursor-pointer"]');
			const countChip = within(navItem).getByTestId("view-count-chip");
			expect(countChip).toBeTruthy();
			expect(countChip.className).not.toContain("group-hover:opacity-0");
			expect(screen.queryByTitle("Edit view")).not.toBeInTheDocument();
			expect(screen.queryByTitle("Delete view")).not.toBeInTheDocument();
		});
	});
});
