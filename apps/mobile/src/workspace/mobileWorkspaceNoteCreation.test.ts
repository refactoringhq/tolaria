import { afterEach, describe, expect, it, vi } from "vitest";
import { workspaceScenarioForId } from "../fixtures/workspaceFixtures";
import { buildMobileDeepLinkForNote } from "./mobileDeepLinks";
import {
	applyMobileWorkspaceEdit,
	applyMobileWorkspaceEditWithWrites,
} from "./mobileWorkspaceEditing";
import * as noteContent from "./mobileWorkspaceNoteContent";

describe("mobile note creation parity", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("creates a selected editable note with desktop-style frontmatter content", () => {
		const snapshot = applyMobileWorkspaceEdit(
			workspaceScenarioForId("default"),
			{
				title: "Mobile Editing Contract",
				type: "createNote",
			},
		);

		expect(snapshot.selectedNoteId).toBe("mobile-editing-contract.md");
		expect(snapshot.notes[0]).toMatchObject({
			id: "mobile-editing-contract.md",
			rawContent: "---\ntitle: Mobile Editing Contract\ntype: Note\n---\n",
			title: "Mobile Editing Contract",
			type: "Note",
		});
	});

	it("creates typed notes with Type template body content", () => {
		const result = applyMobileWorkspaceEditWithWrites(
			workspaceScenarioForId("default"),
			{
				defaults: {
					status: "Active",
					template: "## Objective\n\nLaunch mobile parity.\n",
					type: "Project",
				},
				title: "Mobile Template Contract",
				type: "createNote",
			},
		);

		const note = result.snapshot.notes[0];
		expect(note).toMatchObject({
			rawContent: [
				"---",
				"title: Mobile Template Contract",
				"type: Project",
				"status: Active",
				"---",
				"",
				"## Objective",
				"",
				"Launch mobile parity.",
				"",
			].join("\n"),
			title: "Mobile Template Contract",
			type: "Project",
		});
		expect(note?.editorBlocks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "heading",
					level: 2,
					text: "Objective",
				}),
				expect.objectContaining({ kind: "paragraph" }),
			]),
		);
		expect(result.writes).toEqual([
			{
				content: note?.rawContent,
				kind: "createNote",
				path: "mobile-template-contract.md",
			},
		]);
	});

	it("creates title-less typed notes for immediate type commands", () => {
		vi.spyOn(Date, "now").mockReturnValue(1700000000000);
		const result = applyMobileWorkspaceEditWithWrites(
			workspaceScenarioForId("default"),
			{
				defaults: {
					template: "## Objective\n\nLaunch mobile parity.\n",
					type: "Project",
				},
				title: "",
				type: "createNote",
			},
		);
		const note = result.snapshot.notes[0];

		expect(note).toMatchObject({
			id: "untitled-project-1700000000.md",
			rawContent: [
				"---",
				"type: Project",
				"---",
				"",
				"# ",
				"",
				"## Objective",
				"",
				"Launch mobile parity.",
				"",
			].join("\n"),
			title: "Untitled Project 1700000000",
			type: "Project",
		});
		expect(result.writes).toEqual([
			{
				content: note?.rawContent,
				kind: "createNote",
				path: "untitled-project-1700000000.md",
			},
		]);
	});

	it("does not prepend an empty H1 when a title-less typed note template starts with H1", () => {
		const result = applyMobileWorkspaceEditWithWrites(
			workspaceScenarioForId("default"),
			{
				defaults: {
					template: "\n\n# Week 2026.21\n\nWeekly note\n",
					type: "Weekly",
				},
				title: "",
				type: "createNote",
			},
		);
		const note = result.snapshot.notes[0];

		expect(note.rawContent).toBe(
			[
				"---",
				"type: Weekly",
				"---",
				"",
				"",
				"",
				"# Week 2026.21",
				"",
				"Weekly note",
				"",
			].join("\n"),
		);
		expect(note.rawContent).not.toContain("# \n\n\n\n# Week");
	});

	it("plans create writes for new notes", () => {
		const result = applyMobileWorkspaceEditWithWrites(
			workspaceScenarioForId("default"),
			{
				title: "Mobile Persistence Contract",
				type: "createNote",
			},
		);

		expect(result.writes).toEqual([
			{
				content: "---\ntitle: Mobile Persistence Contract\ntype: Note\n---\n",
				kind: "createNote",
				path: "mobile-persistence-contract.md",
			},
		]);
	});

	it("keeps fixture-created scratch notes on the default Tolaria vault label", () => {
		const result = applyMobileWorkspaceEditWithWrites(
			workspaceScenarioForId("default"),
			{
				title: "Mobile QA Draft",
				type: "createNote",
			},
		);
		const note = result.snapshot.notes[0];

		expect(note).toMatchObject({
			path: "mobile-qa-draft.md",
			workspace: "Tolaria Vault",
			workspaceAlias: null,
		});
		expect(
			buildMobileDeepLinkForNote({ note, source: result.snapshot.source }),
		).toEqual({
			ok: true,
			url: "tolaria://tolaria-vault/mobile-qa-draft.md",
		});
	});

	it("creates notes in the selected folder with frontmatter defaults", () => {
		const result = applyMobileWorkspaceEditWithWrites(
			workspaceScenarioForId("default"),
			{
				defaults: {
					folderPath: "Writing/Launch",
					organized: false,
					properties: { priority: "High" },
					relationships: { belongs_to: ["[[Tolaria MVP]]"] },
					status: "Active",
					tags: ["Design", "Mobile"],
					type: "Procedure",
				},
				title: "Launch Checklist",
				type: "createNote",
			},
		);
		const note = result.snapshot.notes[0];

		expect(note).toMatchObject({
			id: "Writing/Launch/launch-checklist.md",
			path: "Writing/Launch/launch-checklist.md",
			status: "Active",
			tags: ["Design", "Mobile"],
			title: "Launch Checklist",
			type: "Procedure",
			typeTone: "purple",
		});
		expect(
			note.relationships.find(
				(relationship) => relationship.key === "belongs_to",
			)?.values,
		).toContainEqual(
			expect.objectContaining({ title: "Tolaria MVP", type: "Note" }),
		);
		expect(note.rawContent).toContain("type: Procedure");
		expect(note.rawContent).toContain("status: Active");
		expect(note.rawContent).toContain("title: Launch Checklist");
		expect(note.rawContent).toContain("tags:\n  - Design\n  - Mobile");
		expect(note.rawContent).toContain("priority: High");
		expect(note.rawContent).toContain('belongs_to: "[[Tolaria MVP]]"');
		expect(result.writes).toEqual([
			{
				content: note.rawContent,
				kind: "createNote",
				path: "Writing/Launch/launch-checklist.md",
			},
		]);
	});

	it("preserves desktop relationship key spelling from create-note defaults", () => {
		const result = applyMobileWorkspaceEditWithWrites(
			workspaceScenarioForId("default"),
			{
				defaults: {
					relationships: { "Belongs to": ["[[Tolaria MVP]]"] },
					type: "Project",
				},
				title: "Relationship Key Contract",
				type: "createNote",
			},
		);
		const note = result.snapshot.notes[0];

		expect(
			note.relationships.find(
				(relationship) => relationship.key === "Belongs to",
			)?.values,
		).toContainEqual(expect.objectContaining({ title: "Tolaria MVP" }));
		expect(note.rawContent).toContain('Belongs to: "[[Tolaria MVP]]"');
		expect(note.rawContent).not.toContain("belongs_to:");
		expect(result.writes).toEqual([
			{
				content: note.rawContent,
				kind: "createNote",
				path: "relationship-key-contract.md",
			},
		]);
	});

	it("blocks named note creation when the desktop target path already exists", () => {
		const base = workspaceScenarioForId("default");
		const existingNote = {
			...base.notes[0],
			id: "Writing/Launch/launch-checklist.md",
			path: "Writing/Launch/launch-checklist.md",
		};
		const snapshot = {
			...base,
			allNotes: [existingNote, ...base.notes],
			notes: [existingNote, ...base.notes],
		};
		const result = applyMobileWorkspaceEditWithWrites(snapshot, {
			defaults: { folderPath: "Writing/Launch" },
			title: "Launch Checklist",
			type: "createNote",
		});

		expect(result.writes).toEqual([]);
		expect(result.snapshot.notes).toHaveLength(snapshot.notes.length);
		expect(result.snapshot.selectedNoteId).toBe(snapshot.selectedNoteId);
	});

	it("preserves already prepared note objects when creating in a large vault", () => {
		const base = workspaceScenarioForId("default");
		const notes = Array.from({ length: 6000 }, (_, index) => ({
			...base.notes[0],
			id: `note-${index}.md`,
			path: `note-${index}.md`,
			rawContent: `---\ntype: Note\n---\n# Note ${index}\n\nBody`,
		}));
		const snapshot = { ...base, allNotes: notes, notes: notes.slice(0, 24) };
		const derive = vi.spyOn(noteContent, "deriveMobileNote");

		const result = applyMobileWorkspaceEditWithWrites(snapshot, {
			title: "",
			type: "createNote",
		});

		expect(result.writes).toHaveLength(1);
		expect(derive.mock.calls.length).toBe(1);
		expect(result.snapshot.allNotes?.[1]).toBe(notes[0]);
		expect(result.snapshot.notes[1]).toBe(notes[0]);
	});
});
