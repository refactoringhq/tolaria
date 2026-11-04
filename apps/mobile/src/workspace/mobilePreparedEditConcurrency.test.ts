import { expect, it, vi } from "vitest";
import { workspaceScenarioForId } from "../fixtures/workspaceFixtures";
import { createMobilePreparedEdits } from "./mobilePreparedEdits";
import {
	applyMobileWorkspaceEditWithWrites,
	type MobileWorkspaceEdit,
} from "./mobileWorkspaceEditing";
import type {
	MobileNote,
	MobileWorkspaceSnapshot,
} from "./mobileWorkspaceModel";

const content = "---\ntitle: Note\n---\nBody\n";

function createHarness() {
	const fixture = workspaceScenarioForId("default");
	const notes = fixture.notes.slice(0, 2).map((note, index) => ({
		...note,
		id: `note-${index}`,
		path: `note-${index}.md`,
		rawContent: undefined,
	}));
	let snapshot: MobileWorkspaceSnapshot = {
		...fixture,
		notes,
		allNotes: notes,
	};
	const reads = new Map<string, (value: string | null) => void>();
	const apply = vi.fn((edit: MobileWorkspaceEdit) => {
		const result = applyMobileWorkspaceEditWithWrites(snapshot, edit);
		snapshot = result.snapshot;
		return result;
	});
	const prepared = createMobilePreparedEdits({
		apply,
		isCurrent: () => true,
		read: (note: MobileNote) =>
			new Promise<string | null>((resolve) => reads.set(note.id, resolve)),
		snapshot: () => snapshot,
		source: "native",
	});
	return { apply, prepared, reads };
}

it("starts reads for all bulk notes without serializing unrelated note edits", async () => {
	const state = createHarness();
	const bulk = state.prepared.apply({
		type: "bulkEdit",
		edits: [
			{ type: "setArchived", noteId: "note-0", archived: true },
			{ type: "setOrganized", noteId: "note-1", organized: true },
		],
	});
	await Promise.resolve();
	expect([...state.reads.keys()]).toEqual(["note-0", "note-1"]);

	state.reads.get("note-0")?.(content);
	state.reads.get("note-1")?.(content);
	await bulk;
	expect(state.apply).toHaveBeenCalledTimes(3);
});

it("queues edits that share a note while allowing distinct notes to prepare independently", async () => {
	const state = createHarness();
	const first = state.prepared.apply({
		type: "setArchived",
		noteId: "note-0",
		archived: true,
	});
	await Promise.resolve();
	const sameNote = state.prepared.apply({
		type: "setOrganized",
		noteId: "note-0",
		organized: true,
	});
	const otherNote = state.prepared.apply({
		type: "setOrganized",
		noteId: "note-1",
		organized: true,
	});
	await Promise.resolve();
	expect([...state.reads.keys()]).toEqual(["note-0", "note-1"]);

	state.reads.get("note-0")?.(content);
	state.reads.get("note-1")?.(content);
	await Promise.all([first, sameNote, otherNote]);
	expect(state.apply).toHaveBeenCalledTimes(5);
});
