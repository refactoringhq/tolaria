import { describe, expect, it, vi } from "vitest";
import { workspaceScenarioForId } from "../fixtures/workspaceFixtures";
import {
	discardPristineNewNote,
	shouldDiscardPristineNewNote,
} from "./pristineNewNoteDiscard";

const blankNote = {
	...workspaceScenarioForId("default").notes[0],
	id: "Untitled-2026-11-10.md",
	rawContent: "---\ntype: Note\n---\n# \n\n",
};

describe("shouldDiscardPristineNewNote", () => {
	it("discards the selected newly-created note when its body is empty", () => {
		expect(
			shouldDiscardPristineNewNote(blankNote.id, blankNote.id, blankNote),
		).toBe(true);
	});

	it("keeps a newly-created note after its body is edited", () => {
		expect(
			shouldDiscardPristineNewNote(blankNote.id, blankNote.id, {
				...blankNote,
				rawContent: `${blankNote.rawContent}Draft text\n`,
			}),
		).toBe(false);
	});

	it("never discards an existing blank note or a different selection", () => {
		expect(shouldDiscardPristineNewNote(null, blankNote.id, blankNote)).toBe(
			false,
		);
		expect(
			shouldDiscardPristineNewNote(blankNote.id, "existing.md", blankNote),
		).toBe(false);
	});

	it("deletes the consumed draft through the workspace edit pipeline", () => {
		const applyWorkspaceEdit = vi.fn(() => Promise.resolve({}));
		discardPristineNewNote(() => blankNote.id, applyWorkspaceEdit);

		expect(applyWorkspaceEdit).toHaveBeenCalledWith({
			noteId: blankNote.id,
			type: "deleteNote",
		});
	});
});
