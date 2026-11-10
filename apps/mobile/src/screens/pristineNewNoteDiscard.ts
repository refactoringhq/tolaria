import {
	mobileDocumentBody,
	mobileNoteEditableContent,
} from "../workspace/mobileDocumentContent";
import type { MobileWorkspaceEdit } from "../workspace/mobileWorkspaceEditing";
import type { MobileNote } from "../workspace/mobileWorkspaceModel";

export function shouldDiscardPristineNewNote(
	candidateId: string | null,
	selectedNoteId: string | null,
	selectedNote: MobileNote | null,
) {
	return isSelectedCandidate(candidateId, selectedNoteId, selectedNote) &&
		isEmptyNoteBody(selectedNote);
}

function isSelectedCandidate(
	candidateId: string | null,
	selectedNoteId: string | null,
	selectedNote: MobileNote | null,
) {
	return candidateId === selectedNoteId && selectedNote?.id === candidateId;
}

function isEmptyNoteBody(note: MobileNote | null) {
	if (!note) return false;
	const body = mobileDocumentBody(mobileNoteEditableContent(note)).trim();
	return body === "" || /^#\s*$/u.test(body);
}

export function discardPristineNewNote(
	takeNoteId: () => string | null,
	applyWorkspaceEdit: (edit: MobileWorkspaceEdit) => unknown,
) {
	const noteId = takeNoteId();
	if (noteId) void applyWorkspaceEdit({ noteId, type: "deleteNote" });
}

export function createPristineNewNoteDiscardAction(
	takeNoteId: () => string | null,
	applyWorkspaceEdit: (edit: MobileWorkspaceEdit) => unknown,
) {
	return () => discardPristineNewNote(takeNoteId, applyWorkspaceEdit);
}
