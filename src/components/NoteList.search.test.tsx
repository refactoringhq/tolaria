import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	expectOnlySearchMatch,
	installFullTextSearchMocks,
	type NoteListSearchMockResult,
	renderBookNoteList,
	searchNoteList,
} from "../test-utils/noteListRenderingFixtures";
import { makeEntry, renderNoteList } from "../test-utils/noteListTestUtils";

vi.mock("../hooks/useTabManagement", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../hooks/useTabManagement")>();
	return { ...actual, prefetchNoteContent: vi.fn() };
});

describe("NoteList search", () => {
	it("toggles the search input from the header action", () => {
		renderNoteList();
		expect(
			screen.queryByPlaceholderText("Search notes..."),
		).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Search notes" }));
		expect(screen.getByPlaceholderText("Search notes...")).toBeInTheDocument();
	});

	it("filters by a case-insensitive search query", async () => {
		renderNoteList();
		await searchNoteList("facebook");
		expect(screen.getByText("Facebook Ads Strategy")).toBeInTheDocument();
		expect(screen.queryByText("Build Laputa App")).not.toBeInTheDocument();
	});

	it("filters by snippet text when the title does not match", async () => {
		renderNoteList({
			entries: [
				makeEntry({
					path: "/vault/a.md",
					filename: "a.md",
					title: "Alpha Note",
					snippet: "Routine body copy.",
				}),
				makeEntry({
					path: "/vault/b.md",
					filename: "b.md",
					title: "Beta Note",
					snippet: "Nebula-only snippet token.",
				}),
			],
		});

		await searchNoteList("nebula-only");

		expect(screen.getByText("Beta Note")).toBeInTheDocument();
		expect(screen.queryByText("Alpha Note")).not.toBeInTheDocument();
	});

	it("filters by full note content when the title and snippet do not match", async () => {
		const { getNoteContent, restore, searchVault } = installFullTextSearchMocks(
			{
				resultsByVault: {
					"/vault": [
						{
							note_type: "Note",
							path: "/vault/b.md",
							score: 1,
							snippet: "Private body match is intentionally not rendered here.",
							title: "Beta Note",
						},
					],
				},
			},
		);

		try {
			renderNoteList({
				entries: [
					makeEntry({
						path: "/vault/a.md",
						filename: "a.md",
						title: "Alpha Note",
						snippet: "Routine body copy.",
					}),
					makeEntry({
						path: "/vault/b.md",
						filename: "b.md",
						title: "Beta Note",
						snippet: "Another public preview.",
					}),
				],
			});

			await searchNoteList("subterranean-keyword");

			await waitFor(() => {
				expect(searchVault).toHaveBeenCalledWith(
					expect.objectContaining({
						vaultPath: "/vault",
						query: "subterranean-keyword",
						mode: "keyword",
						excludeFrontmatter: true,
					}),
				);
			});
			expect(getNoteContent).not.toHaveBeenCalled();
			expect(screen.getByText("Beta Note")).toBeInTheDocument();
			expect(screen.queryByText("Alpha Note")).not.toBeInTheDocument();
			expect(
				screen.queryByText(
					"Private body match is intentionally not rendered here.",
				),
			).not.toBeInTheDocument();
		} finally {
			restore();
		}
	});

	it("ignores stale full-content results when the query changes before a slow search returns", async () => {
		const originalContentHandler = window.__mockHandlers?.get_note_content;
		const originalSearchHandler = window.__mockHandlers?.search_vault;
		let resolveSlowSearch:
			| ((response: {
					elapsed_ms: number;
					results: NoteListSearchMockResult[];
			  }) => void)
			| null = null;
		const searchVault = vi.fn((args?: Record<string, unknown>) => {
			if (args?.query === "slow-body") {
				return new Promise((resolve) => {
					resolveSlowSearch = resolve;
				});
			}

			return Promise.resolve({
				elapsed_ms: 7,
				results: [],
			});
		});
		const getNoteContent = vi.fn(() => {
			throw new Error(
				"Note-list full-text search should not read note content in React",
			);
		});

		if (!window.__mockHandlers) window.__mockHandlers = {};
		window.__mockHandlers.search_vault = searchVault;
		window.__mockHandlers.get_note_content = getNoteContent;

		try {
			renderNoteList({
				entries: [
					makeEntry({
						path: "/vault/a.md",
						filename: "a.md",
						title: "Alpha Note",
						snippet: "Routine body copy.",
					}),
					makeEntry({
						path: "/vault/b.md",
						filename: "b.md",
						title: "Beta Note",
						snippet: "Another public preview.",
					}),
				],
			});

			fireEvent.click(screen.getByRole("button", { name: "Search notes" }));
			fireEvent.change(screen.getByPlaceholderText("Search notes..."), {
				target: { value: "slow-body" },
			});

			await waitFor(() => {
				expect(searchVault).toHaveBeenCalledWith(
					expect.objectContaining({
						query: "slow-body",
						excludeFrontmatter: true,
					}),
				);
			});

			fireEvent.change(screen.getByPlaceholderText("Search notes..."), {
				target: { value: "new-empty-query" },
			});

			await waitFor(() => {
				expect(searchVault).toHaveBeenCalledWith(
					expect.objectContaining({
						query: "new-empty-query",
						excludeFrontmatter: true,
					}),
				);
			});
			await waitFor(() => {
				expect(
					screen.queryByTestId("note-list-search-loading"),
				).not.toBeInTheDocument();
			});

			await act(async () => {
				resolveSlowSearch?.({
					elapsed_ms: 7,
					results: [
						{
							note_type: "Note",
							path: "/vault/b.md",
							score: 1,
							snippet: "Stale body hit from the previous query.",
							title: "Beta Note",
						},
					],
				});
				await Promise.resolve();
			});

			expect(getNoteContent).not.toHaveBeenCalled();
			expect(screen.queryByText("Beta Note")).not.toBeInTheDocument();
			expect(screen.getByText("No matching notes")).toBeInTheDocument();
		} finally {
			window.__mockHandlers.search_vault = originalSearchHandler;
			window.__mockHandlers.get_note_content = originalContentHandler;
		}
	});

	it("ignores full-content matches that only appear in hidden frontmatter", async () => {
		const { getNoteContent, restore, searchVault } = installFullTextSearchMocks(
			{
				resultsByVault: {
					"/vault": [],
				},
			},
		);

		try {
			renderNoteList({
				entries: [
					makeEntry({
						path: "/vault/a.md",
						filename: "a.md",
						title: "Alpha Note",
						snippet: "Routine body copy.",
					}),
					makeEntry({
						path: "/vault/b.md",
						filename: "b.md",
						title: "Beta Note",
						snippet: "Another public preview.",
					}),
				],
			});

			await searchNoteList("hidden-frontmatter-keyword");

			await waitFor(() => {
				expect(searchVault).toHaveBeenCalledWith(
					expect.objectContaining({
						excludeFrontmatter: true,
					}),
				);
			});
			expect(getNoteContent).not.toHaveBeenCalled();
			expect(screen.queryByText("Alpha Note")).not.toBeInTheDocument();
			expect(screen.getByText("No matching notes")).toBeInTheDocument();
		} finally {
			restore();
		}
	});

	it("runs full-content note-list search across visible workspaces", async () => {
		const { getNoteContent, restore, searchVault } = installFullTextSearchMocks(
			{
				resultsByVault: {
					"/team": [
						{
							note_type: "Note",
							path: "/team/team-body-hit.md",
							score: 1,
							snippet: "Private workspace body hit.",
							title: "Team Body Hit",
						},
					],
				},
			},
		);

		try {
			renderNoteList({
				entries: [
					makeEntry({
						path: "/personal/personal-note.md",
						filename: "personal-note.md",
						title: "Personal Note",
						snippet: "No body token here.",
						workspace: {
							id: "personal",
							label: "Personal",
							alias: "PE",
							path: "/personal",
							shortLabel: "PE",
							color: null,
							icon: null,
							mounted: true,
							available: true,
							defaultForNewNotes: true,
						},
					}),
					makeEntry({
						path: "/team/team-body-hit.md",
						filename: "team-body-hit.md",
						title: "Team Body Hit",
						snippet: "No body token here either.",
						workspace: {
							id: "team",
							label: "Team",
							alias: "TE",
							path: "/team",
							shortLabel: "TE",
							color: null,
							icon: null,
							mounted: true,
							available: true,
							defaultForNewNotes: false,
						},
					}),
				],
			});

			await searchNoteList("workspace-only-keyword");

			await waitFor(() => {
				expect(searchVault).toHaveBeenCalledWith(
					expect.objectContaining({
						vaultPath: "/personal",
						excludeFrontmatter: true,
					}),
				);
				expect(searchVault).toHaveBeenCalledWith(
					expect.objectContaining({
						vaultPath: "/team",
						excludeFrontmatter: true,
					}),
				);
			});
			expect(getNoteContent).not.toHaveBeenCalled();
			expect(screen.getByText("Team Body Hit")).toBeInTheDocument();
			expect(screen.queryByText("Personal Note")).not.toBeInTheDocument();
		} finally {
			restore();
		}
	});

	it.each([
		{
			name: "filters by visible property values and ignores hidden properties",
			properties: { Priority: "Boarding Window", Owner: "Hidden Owner Value" },
			allNotesNoteListProperties: null,
			matchingQuery: "boarding window",
			hiddenQuery: "hidden owner value",
		},
		{
			name: "uses the active all-notes columns when filtering by visible property values",
			properties: { Priority: "Hidden Priority", Owner: "Visible Owner Value" },
			allNotesNoteListProperties: ["Owner"],
			matchingQuery: "visible owner value",
			hiddenQuery: "hidden priority",
		},
	])(
		"$name",
		async ({
			properties,
			allNotesNoteListProperties,
			matchingQuery,
			hiddenQuery,
		}) => {
			const title = "Property Search Note";
			renderBookNoteList({
				entryOverrides: { title, properties },
				allNotesNoteListProperties,
			});

			await expectOnlySearchMatch({ title, matchingQuery, hiddenQuery });
		},
	);
});
