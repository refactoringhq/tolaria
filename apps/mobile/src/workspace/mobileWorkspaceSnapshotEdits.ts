import type { DerivedNote } from "./mobileEditableNote";
import { isMobileInboxNote } from "./mobileNoteFilters";
import {
	selectedMobileEditorBlocks,
	selectedMobileEditorBullets,
} from "./mobileSelectedEditorFallback";
import { buildMobileSidebarSections } from "./mobileSidebarSections";
import { mobileAllNotesFileVisibilityFromVaultConfig } from "./mobileVaultConfig";
import type {
	MobileNoteEdit,
	MobileWorkspaceEdit,
	MobileWorkspaceWrite,
	NoteId,
} from "./mobileWorkspaceEditing.types";
import type {
	MobileNote,
	MobileWorkspaceSnapshot,
} from "./mobileWorkspaceModel";
import { deriveMobileNote } from "./mobileWorkspaceNoteContent";
import { mobileRelationships } from "./mobileWorkspaceNoteMutations";
import { noteWritePath } from "./mobileWorkspacePathRewrites";
import type { ReadOnlyWorkspaceRequest } from "./readOnlyWorkspaceRepository";

export function requestForStaleNativeCreate(
	edit: MobileWorkspaceEdit,
	snapshot: MobileWorkspaceSnapshot,
	request: ReadOnlyWorkspaceRequest | undefined,
): ReadOnlyWorkspaceRequest | undefined {
	if (edit.type !== "createNote") return undefined;
	if (request?.source !== "native") return undefined;
	const vaultRootUri = writableLocalVaultPath(snapshot);
	if (!vaultRootUri) return undefined;
	return { ...request, vaultRootUri };
}

function writableLocalVaultPath(snapshot: MobileWorkspaceSnapshot) {
	if (snapshot.sync.kind === "noVault") return undefined;
	if (snapshot.sync.kind === "readOnly") return undefined;
	if (snapshot.source?.kind !== "localVault") return undefined;
	return snapshot.source.vaultPath;
}

export function rebuildSnapshot(
	snapshot: MobileWorkspaceSnapshot,
	notes: MobileNote[],
	allNotes = notes,
	hydrationId?: NoteId | null,
): MobileWorkspaceSnapshot {
	const derivableAllNotes = snapshot.allNotes
		? notesWithDetailedNotes(allNotes, notes)
		: allNotes;
	const derivedById = new Map(
		derivableAllNotes
			.filter((note) => hydrationId === undefined || note.id === hydrationId)
			.map(
				(note) =>
					[note.id, deriveMobileNote(note, snapshot.typeDefinitions)] as const,
			)
			.filter(
				(entry): entry is readonly [NoteId, DerivedNote] => entry[1] !== null,
			),
	);
	const relationshipTargets = derivableAllNotes.map(
		(note) => derivedById.get(note.id)?.note ?? note,
	);
	const resolvedAllNotes = derivableAllNotes.map((note) => {
		const derived = derivedById.get(note.id);
		if (!derived) return note;

		return {
			...derived.note,
			relationships: mobileRelationships(
				derived.rawRelationships,
				relationshipTargets,
			),
		};
	});
	const resolvedNoteById = new Map(
		resolvedAllNotes.map((note) => [note.id, note]),
	);
	const resolvedNotes = notes.map(
		(note) => resolvedNoteById.get(note.id) ?? note,
	);
	return snapshotWithResolvedNotes(snapshot, resolvedNotes, resolvedAllNotes);
}

export function snapshotWithResolvedNotes(
	snapshot: MobileWorkspaceSnapshot,
	resolvedNotes: MobileNote[],
	resolvedAllNotes: MobileNote[],
): MobileWorkspaceSnapshot {
	const selectedNote =
		resolvedNotes.find((note) => note.id === snapshot.selectedNoteId) ??
		resolvedNotes[0] ??
		null;

	return {
		...snapshot,
		allNotes: snapshot.allNotes ? resolvedAllNotes : undefined,
		editorBlocks: selectedMobileEditorBlocks(
			selectedNote,
			snapshot.editorBlocks,
		),
		editorBullets: selectedMobileEditorBullets(
			selectedNote,
			snapshot.editorBullets,
		),
		noteListSubtitle: noteListSubtitle(resolvedNotes),
		notes: resolvedNotes,
		selectedNoteId: selectedNote?.id,
		sidebarSections: buildMobileSidebarSections({
			allNotesFileVisibility: mobileAllNotesFileVisibilityFromVaultConfig(
				snapshot.vaultConfig,
			),
			folderPaths: snapshot.folderPaths,
			notes: resolvedAllNotes,
			previousSections: snapshot.sidebarSections,
			typeDefinitions: snapshot.typeDefinitions,
			views: snapshot.views,
		}),
	};
}

export function notesWithDetailedNotes(
	notes: MobileNote[],
	detailedNotes: MobileNote[],
): MobileNote[] {
	const detailedById = new Map(detailedNotes.map((note) => [note.id, note]));
	return notes.map((note) => detailedById.get(note.id) ?? note);
}

export function workspaceNotePool(
	snapshot: MobileWorkspaceSnapshot,
): MobileNote[] {
	return snapshot.allNotes ?? snapshot.notes;
}

export function workspaceNoteById(
	snapshot: MobileWorkspaceSnapshot,
	noteId: NoteId,
): MobileNote | null {
	return (
		[...snapshot.notes, ...(snapshot.allNotes ?? [])].find(
			(note) => note.id === noteId,
		) ?? null
	);
}

export function createNoteWrites(
	snapshot: MobileWorkspaceSnapshot,
): MobileWorkspaceWrite[] {
	const note = workspaceNoteById(snapshot, snapshot.selectedNoteId ?? "");
	if (!note?.rawContent) return [];

	return [
		{
			content: note.rawContent,
			kind: "createNote",
			path: noteWritePath(note),
		},
	];
}

export function saveNoteWrites(
	previousSnapshot: MobileWorkspaceSnapshot,
	nextSnapshot: MobileWorkspaceSnapshot,
	edit: MobileNoteEdit,
): MobileWorkspaceWrite[] {
	if (
		edit.type === "hydrateNoteContent" ||
		edit.type === "hydrateTextFileContent"
	)
		return [];

	const previousNote = workspaceNoteById(previousSnapshot, edit.noteId);
	const nextNote = workspaceNoteById(nextSnapshot, edit.noteId);
	if (
		previousNote?.rawContent === undefined ||
		nextNote?.rawContent === undefined
	)
		return [];
	if (previousNote.rawContent === nextNote.rawContent) return [];

	return [
		{
			content: nextNote.rawContent,
			kind: "saveNote",
			path: noteWritePath(nextNote),
		},
	];
}

export function noteListSubtitle(notes: MobileNote[]): string {
	const count = notes.filter(isMobileInboxNote).length;
	return `${count.toLocaleString()} open notes`;
}
