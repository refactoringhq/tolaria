import { mobileNoteEditableContent } from "../workspace/mobileDocumentContent";
import { mobileNoteActionMode } from "../workspace/mobileNoteActionMode";
import type { MobileWorkspaceEdit } from "../workspace/mobileWorkspaceEditing";
import type {
	MobileNote,
	MobileWorkspaceSnapshot,
} from "../workspace/mobileWorkspaceModel";

type WorkspaceHistoryEntry = {
	redoEdits: MobileWorkspaceEdit[];
	undoEdits: MobileWorkspaceEdit[];
};

export function recordWorkspaceNoteHistory(
	entry: WorkspaceHistoryEntry,
	previousSnapshot: MobileWorkspaceSnapshot,
	nextSnapshot: MobileWorkspaceSnapshot,
) {
	const nextNotesById = new Map(
		workspaceNotes(nextSnapshot).map((note) => [note.id, note]),
	);
	recordContentChanges(entry, previousSnapshot, nextSnapshot, nextNotesById);

	const previousNotesById = new Map(
		workspaceNotes(previousSnapshot).map((note) => [note.id, note]),
	);
	recordAddedOrRemovedNotes(entry, nextSnapshot, previousNotesById, true);
	recordAddedOrRemovedNotes(entry, previousSnapshot, nextNotesById, false);
}

function recordContentChanges(
	entry: WorkspaceHistoryEntry,
	previousSnapshot: MobileWorkspaceSnapshot,
	nextSnapshot: MobileWorkspaceSnapshot,
	nextNotesById: Map<string, MobileNote>,
) {
	for (const previousNote of workspaceNotes(previousSnapshot)) {
		const reversible = reversibleContentChange(
			previousNote,
			nextNotesById.get(previousNote.id),
			previousSnapshot,
			nextSnapshot,
		);
		if (!reversible) continue;
		entry.undoEdits.push(reversible.undoEdit);
		entry.redoEdits.push(reversible.redoEdit);
	}
}

function reversibleContentChange(
	previousNote: MobileNote,
	nextNote: MobileNote | undefined,
	previousSnapshot: MobileWorkspaceSnapshot,
	nextSnapshot: MobileWorkspaceSnapshot,
) {
	if (!nextNote || !stableEditableNote(previousNote, nextNote)) return null;
	const previousContent = editableContent(previousNote, previousSnapshot);
	const nextContent = editableContent(nextNote, nextSnapshot);
	const contentPair = reversibleContentPair(previousContent, nextContent);
	if (!contentPair) return null;
	const [previousText, nextText] = contentPair;
	const contentKind = noteContentHistoryKind(previousNote, nextNote);
	if (!contentKind) return null;
	const edit = (content: string): MobileWorkspaceEdit =>
		contentKind === "text"
			? { content, noteId: previousNote.id, type: "updateTextFileContent" }
			: { content, noteId: previousNote.id, type: "updateNoteContent" };
	return {
		redoEdit: edit(nextText),
		undoEdit: edit(previousText),
	};
}

function reversibleContentPair(
	previousContent: string | null,
	nextContent: string | null,
): [string, string] | null {
	if (previousContent === null || nextContent === null) return null;
	if (previousContent === nextContent) return null;
	return [previousContent, nextContent];
}

function recordAddedOrRemovedNotes(
	entry: WorkspaceHistoryEntry,
	snapshot: MobileWorkspaceSnapshot,
	knownNotes: Map<string, MobileNote>,
	added: boolean,
) {
	for (const note of workspaceNotes(snapshot)) {
		if (knownNotes.has(note.id)) continue;
		const restore = restoreNoteEdit(note, snapshot);
		const remove: MobileWorkspaceEdit = { noteId: note.id, type: "deleteNote" };
		entry.undoEdits.push(added ? remove : restore);
		entry.redoEdits.push(added ? restore : remove);
	}
}

function stableEditableNote(previousNote: MobileNote, nextNote: MobileNote) {
	return (
		previousNote.id === nextNote.id &&
		notePath(previousNote) === notePath(nextNote) &&
		noteContentKind(previousNote) === noteContentKind(nextNote)
	);
}

function noteContentHistoryKind(
	previousNote: MobileNote,
	nextNote: MobileNote,
): "markdown" | "text" | null {
	const kind = noteContentKind(previousNote);
	if (kind === "binary" || noteContentKind(nextNote) === "binary") return null;
	return kind;
}

function noteContentKind(note: MobileNote): "binary" | "markdown" | "text" {
	const actionMode = mobileNoteActionMode(note);
	if (actionMode === "binary-file") return "binary";
	return actionMode === "text-file" ? "text" : "markdown";
}

function editableContent(
	note: MobileNote,
	snapshot: MobileWorkspaceSnapshot,
): string | null {
	if (note.rawContent !== undefined) return note.rawContent;
	if (noteContentKind(note) !== "markdown") return null;
	return mobileNoteEditableContent(
		snapshot.selectedNoteId === note.id
			? {
					...note,
					editorBlocks: note.editorBlocks ?? snapshot.editorBlocks,
					editorBullets: note.editorBullets ?? snapshot.editorBullets,
				}
			: note,
	);
}

function workspaceNotes(snapshot: MobileWorkspaceSnapshot): MobileNote[] {
	return snapshot.allNotes ?? snapshot.notes;
}

function notePath(note: MobileNote): string {
	return note.path ?? note.id;
}

function restoreNoteEdit(
	note: MobileNote,
	snapshot: MobileWorkspaceSnapshot,
): MobileWorkspaceEdit {
	return {
		allNoteIndex: snapshot.allNotes?.findIndex(
			(candidate) => candidate.id === note.id,
		),
		note,
		noteIndex: snapshot.notes.findIndex(
			(candidate) => candidate.id === note.id,
		),
		type: "restoreNote",
	};
}
