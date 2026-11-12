import {
	mobileAllNotesFileVisibilityFromVaultConfig,
	mobileDefaultNoteWidthFromVaultConfig,
} from "../workspace/mobileVaultConfig";
import {
	type MobileWorkspaceActionFeedback,
	mobileWorkspaceActionFeedback,
} from "../workspace/mobileWorkspaceActionFeedback";
import {
	type MobileWorkspaceEdit,
	normalizedDisplayProperties,
} from "../workspace/mobileWorkspaceEditing";
import type {
	MobileAllNotesFileVisibility,
	MobileNoteWidth,
	MobileSavedView,
	MobileTypeDefinition,
	MobileWorkspaceSnapshot,
} from "../workspace/mobileWorkspaceModel";
import { recordWorkspaceNoteHistory } from "./tabletWorkspaceHistoryNotes";
import { mobileWorkspacePathHistoryEntry } from "./tabletWorkspacePathHistory";

type WorkspaceHistoryEdit = MobileWorkspaceEdit;
type ViewHistoryComparison = {
	previousViews: MobileSavedView[];
	nextViews: MobileSavedView[];
};

export type MobileWorkspaceHistoryEntry = {
	feedbackAction?: MobileWorkspaceActionFeedback;
	redoEdits: WorkspaceHistoryEdit[];
	undoEdits: WorkspaceHistoryEdit[];
};

export type MobileWorkspaceHistoryState = {
	future: MobileWorkspaceHistoryEntry[];
	past: MobileWorkspaceHistoryEntry[];
};

const maxWorkspaceHistoryEntries = 100;

export const emptyMobileWorkspaceHistory: MobileWorkspaceHistoryState = {
	future: [],
	past: [],
};

export function mobileWorkspaceHistoryEntry(
	previousSnapshot: MobileWorkspaceSnapshot,
	nextSnapshot: MobileWorkspaceSnapshot,
	sourceEdit?: MobileWorkspaceEdit,
): MobileWorkspaceHistoryEntry | null {
	if (sourceEdit && !historyRecordsEdit(sourceEdit)) return null;
	if (sourceEdit?.type === "createNote")
		return createdNoteHistoryEntry(previousSnapshot, nextSnapshot, sourceEdit);
	const pathHistoryEntry = mobileWorkspacePathHistoryEntry(
		previousSnapshot,
		nextSnapshot,
		sourceEdit,
	);
	if (pathHistoryEntry) return withFeedbackAction(pathHistoryEntry, sourceEdit);
	const defaultNoteWidthHistory = defaultNoteWidthHistoryEntry(
		previousSnapshot,
		nextSnapshot,
		sourceEdit,
	);
	if (defaultNoteWidthHistory) return defaultNoteWidthHistory;
	const primaryListHistoryEntry = primaryNoteListPropertiesHistoryEntry(
		previousSnapshot,
		nextSnapshot,
		sourceEdit,
	);
	if (primaryListHistoryEntry) return primaryListHistoryEntry;

	return snapshotHistoryEntry(previousSnapshot, nextSnapshot, sourceEdit);
}

function snapshotHistoryEntry(
	previousSnapshot: MobileWorkspaceSnapshot,
	nextSnapshot: MobileWorkspaceSnapshot,
	sourceEdit: MobileWorkspaceEdit | undefined,
): MobileWorkspaceHistoryEntry | null {
	const entry = emptyHistoryEntry();
	recordFolderHistory(entry, previousSnapshot, nextSnapshot);
	recordViewHistory(entry, previousSnapshot, nextSnapshot);
	recordTypeDefinitionHistory(entry, previousSnapshot, nextSnapshot);
	recordWorkspaceNoteHistory(entry, previousSnapshot, nextSnapshot);
	if (entry.undoEdits.length === 0) return null;
	return withFeedbackAction(entry, sourceEdit);
}

function createdNoteHistoryEntry(
	previousSnapshot: MobileWorkspaceSnapshot,
	nextSnapshot: MobileWorkspaceSnapshot,
	sourceEdit: Extract<MobileWorkspaceEdit, { type: "createNote" }>,
): MobileWorkspaceHistoryEntry | null {
	const created = newlySelectedNote(previousSnapshot, nextSnapshot);
	if (!created) return null;
	const { note, noteId } = created;
	const entry = emptyHistoryEntry();
	entry.undoEdits.push({ noteId, type: "deleteNote" });
	entry.redoEdits.push({
		allNoteIndex: nextSnapshot.allNotes?.findIndex(
			(candidate) => candidate.id === noteId,
		),
		note,
		noteIndex: nextSnapshot.notes.findIndex(
			(candidate) => candidate.id === noteId,
		),
		type: "restoreNote",
	});
	recordTypeDefinitionHistory(entry, previousSnapshot, nextSnapshot);
	return withFeedbackAction(entry, sourceEdit);
}

function newlySelectedNote(
	previousSnapshot: MobileWorkspaceSnapshot,
	nextSnapshot: MobileWorkspaceSnapshot,
) {
	const noteId = nextSnapshot.selectedNoteId;
	if (!noteId) return null;
	if (sameSelectedNote(previousSnapshot, noteId)) return null;
	if (noteExistsInSnapshot(previousSnapshot, noteId)) return null;
	const note = findSnapshotNote(nextSnapshot, noteId);
	return note ? { note, noteId } : null;
}

function sameSelectedNote(snapshot: MobileWorkspaceSnapshot, noteId: string) {
	return snapshot.selectedNoteId === noteId;
}

function noteExistsInSnapshot(
	snapshot: MobileWorkspaceSnapshot,
	noteId: string,
) {
	const notes = snapshot.allNotes ?? snapshot.notes;
	return notes.some((note) => note.id === noteId);
}

function findSnapshotNote(snapshot: MobileWorkspaceSnapshot, noteId: string) {
	const notes = snapshot.allNotes ?? snapshot.notes;
	return notes.find((note) => note.id === noteId);
}

function withFeedbackAction(
	entry: MobileWorkspaceHistoryEntry,
	sourceEdit: MobileWorkspaceEdit | undefined,
) {
	const feedbackAction = mobileWorkspaceActionFeedback(sourceEdit);
	return feedbackAction ? { ...entry, feedbackAction } : entry;
}

export function recordMobileWorkspaceHistory(
	history: MobileWorkspaceHistoryState,
	entry: MobileWorkspaceHistoryEntry | null,
): MobileWorkspaceHistoryState {
	if (!entry) return history;

	return {
		future: [],
		past: [...history.past, entry].slice(-maxWorkspaceHistoryEntries),
	};
}

function recordFolderHistory(
	entry: MobileWorkspaceHistoryEntry,
	previousSnapshot: MobileWorkspaceSnapshot,
	nextSnapshot: MobileWorkspaceSnapshot,
) {
	const previousPaths = normalizedFolderPathSet(previousSnapshot);
	const nextPaths = normalizedFolderPathSet(nextSnapshot);
	recordChangedFolderPaths(entry, nextSnapshot, previousPaths, true);
	recordChangedFolderPaths(entry, previousSnapshot, nextPaths, false);
}

function recordChangedFolderPaths(
	entry: MobileWorkspaceHistoryEntry,
	snapshot: MobileWorkspaceSnapshot,
	knownPaths: Set<string>,
	added: boolean,
) {
	for (const path of normalizedFolderPaths(snapshot)) {
		if (knownPaths.has(path)) continue;
		recordFolderChange(entry, path, added);
	}
}

function recordFolderChange(
	entry: MobileWorkspaceHistoryEntry,
	path: string,
	added: boolean,
) {
	const restore = { path, type: "restoreFolder" as const };
	const remove = { folderPath: path, type: "deleteFolder" as const };
	if (added) {
		entry.undoEdits.push(remove);
		entry.redoEdits.unshift(restore);
		return;
	}
	entry.undoEdits.unshift(restore);
	entry.redoEdits.push(remove);
}

function recordViewHistory(
	entry: MobileWorkspaceHistoryEntry,
	previousSnapshot: MobileWorkspaceSnapshot,
	nextSnapshot: MobileWorkspaceSnapshot,
) {
	const previousViews = previousSnapshot.views ?? [];
	const nextViews = nextSnapshot.views ?? [];
	const previousViewsById = new Map(
		previousViews.map((view) => [view.id, view]),
	);
	const nextViewsById = new Map(nextViews.map((view) => [view.id, view]));

	for (const view of nextViews) {
		const previousView = previousViewsById.get(view.id);
		recordNextViewHistory(entry, view, previousView, {
			previousViews,
			nextViews,
		});
	}

	for (const view of previousViews) {
		if (nextViewsById.has(view.id)) continue;
		entry.undoEdits.push(restoreViewEdit(view, previousViews));
		entry.redoEdits.push({ viewId: view.id, type: "deleteView" });
	}
}

function recordNextViewHistory(
	entry: MobileWorkspaceHistoryEntry,
	view: MobileSavedView,
	previousView: MobileSavedView | undefined,
	views: ViewHistoryComparison,
) {
	if (!previousView) {
		entry.undoEdits.push({ viewId: view.id, type: "deleteView" });
		entry.redoEdits.push(restoreViewEdit(view, views.nextViews));
	} else if (!sameJson(previousView, view)) {
		entry.undoEdits.push(restoreViewEdit(previousView, views.previousViews));
		entry.redoEdits.push(restoreViewEdit(view, views.nextViews));
	}
}

function recordTypeDefinitionHistory(
	entry: MobileWorkspaceHistoryEntry,
	previousSnapshot: MobileWorkspaceSnapshot,
	nextSnapshot: MobileWorkspaceSnapshot,
) {
	const { previousDefinitions, nextDefinitions } = historyTypeDefinitions(
		previousSnapshot,
		nextSnapshot,
	);
	const typeNames = new Set([
		...Object.keys(previousDefinitions),
		...Object.keys(nextDefinitions),
	]);

	for (const typeName of typeNames) {
		const previousDefinition = previousDefinitions[typeName];
		const nextDefinition = nextDefinitions[typeName];
		if (sameTypeDefinition(previousDefinition, nextDefinition)) continue;

		entry.undoEdits.push(
			typeDefinitionHistoryEdit(typeName, previousDefinition),
		);
		entry.redoEdits.push(typeDefinitionHistoryEdit(typeName, nextDefinition));
	}
}

function sameTypeDefinition(previous: unknown, next: unknown) {
	return Boolean(previous && next && sameJson(previous, next));
}

function historyTypeDefinitions(
	previousSnapshot: MobileWorkspaceSnapshot,
	nextSnapshot: MobileWorkspaceSnapshot,
) {
	return {
		previousDefinitions: previousSnapshot.typeDefinitions ?? {},
		nextDefinitions: nextSnapshot.typeDefinitions ?? {},
	};
}

function typeDefinitionHistoryEdit(
	typeName: string,
	definition: MobileTypeDefinition | undefined,
): MobileWorkspaceEdit {
	return definition
		? { definition, type: "restoreTypeDefinition", typeName }
		: { type: "deleteTypeDefinition", typeName };
}

function primaryNoteListPropertiesHistoryEntry(
	previousSnapshot: MobileWorkspaceSnapshot,
	nextSnapshot: MobileWorkspaceSnapshot,
	sourceEdit: MobileWorkspaceEdit | undefined,
): MobileWorkspaceHistoryEntry | null {
	if (sourceEdit?.type !== "updatePrimaryNoteListProperties") return null;

	const includeVisibility = shouldRecordAllNotesFileVisibility(
		previousSnapshot,
		nextSnapshot,
		sourceEdit,
	);
	const previousSettings = primaryNoteListSettings(
		previousSnapshot,
		sourceEdit.target,
		includeVisibility,
	);
	const nextSettings = primaryNoteListSettings(
		nextSnapshot,
		sourceEdit.target,
		includeVisibility,
	);
	if (samePrimaryNoteListSettings(previousSettings, nextSettings)) return null;

	return {
		redoEdits: [primaryNoteListHistoryEdit(sourceEdit.target, nextSettings)],
		undoEdits: [
			primaryNoteListHistoryEdit(sourceEdit.target, previousSettings),
		],
	};
}

function defaultNoteWidthHistoryEntry(
	previousSnapshot: MobileWorkspaceSnapshot,
	nextSnapshot: MobileWorkspaceSnapshot,
	sourceEdit: MobileWorkspaceEdit | undefined,
): MobileWorkspaceHistoryEntry | null {
	if (sourceEdit?.type !== "setDefaultNoteWidth") return null;

	const previousMode = defaultNoteWidthHistoryMode(previousSnapshot);
	const nextMode = defaultNoteWidthHistoryMode(nextSnapshot);
	if (previousMode === nextMode) return null;

	return {
		redoEdits: [{ mode: nextMode, type: "setDefaultNoteWidth" }],
		undoEdits: [{ mode: previousMode, type: "setDefaultNoteWidth" }],
	};
}

function historyRecordsEdit(edit: MobileWorkspaceEdit): boolean {
	return (
		edit.type !== "hydrateNoteContent" &&
		edit.type !== "hydrateTextFileContent" &&
		edit.type !== "restoreFolder" &&
		edit.type !== "restoreNote" &&
		edit.type !== "restoreTypeDefinition" &&
		edit.type !== "restoreView"
	);
}

function emptyHistoryEntry(): MobileWorkspaceHistoryEntry {
	return { redoEdits: [], undoEdits: [] };
}

function restoreViewEdit(
	view: MobileSavedView,
	views: MobileSavedView[],
): WorkspaceHistoryEdit {
	return {
		type: "restoreView",
		view,
		viewIndex: views.findIndex((candidate) => candidate.id === view.id),
	};
}

function normalizedFolderPaths(snapshot: MobileWorkspaceSnapshot): string[] {
	return [
		...new Set(
			(snapshot.folderPaths ?? []).map(normalizedFolderPath).filter(Boolean),
		),
	];
}

function normalizedFolderPathSet(
	snapshot: MobileWorkspaceSnapshot,
): Set<string> {
	return new Set(normalizedFolderPaths(snapshot));
}

function normalizedFolderPath(path: string): string {
	return path
		.trim()
		.replaceAll("\\", "/")
		.replace(/^\/+|\/+$/gu, "")
		.replace(/\/+/gu, "/");
}

function sameJson(
	left: MobileSavedView | MobileTypeDefinition,
	right: MobileSavedView | MobileTypeDefinition,
): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function primaryNoteListProperties(
	snapshot: MobileWorkspaceSnapshot,
	target: "allNotes" | "inbox",
): string[] {
	return normalizedDisplayProperties(
		snapshot.noteListPropertyOverrides?.[target] ?? [],
	);
}

function defaultNoteWidthHistoryMode(
	snapshot: MobileWorkspaceSnapshot,
): MobileNoteWidth {
	return (
		mobileDefaultNoteWidthFromVaultConfig(snapshot.vaultConfig) ?? "normal"
	);
}

function primaryNoteListSettings(
	snapshot: MobileWorkspaceSnapshot,
	target: "allNotes" | "inbox",
	includeVisibility: boolean,
) {
	return {
		allNotesFileVisibility:
			target === "allNotes" && includeVisibility
				? mobileAllNotesFileVisibilityFromVaultConfig(snapshot.vaultConfig)
				: undefined,
		listPropertiesDisplay: primaryNoteListProperties(snapshot, target),
	};
}

function primaryNoteListHistoryEdit(
	target: "allNotes" | "inbox",
	settings: ReturnType<typeof primaryNoteListSettings>,
): WorkspaceHistoryEdit {
	const edit: Extract<
		WorkspaceHistoryEdit,
		{ type: "updatePrimaryNoteListProperties" }
	> = {
		listPropertiesDisplay: settings.listPropertiesDisplay,
		target,
		type: "updatePrimaryNoteListProperties",
	};
	if (settings.allNotesFileVisibility)
		edit.allNotesFileVisibility = settings.allNotesFileVisibility;
	return edit;
}

function shouldRecordAllNotesFileVisibility(
	previousSnapshot: MobileWorkspaceSnapshot,
	nextSnapshot: MobileWorkspaceSnapshot,
	sourceEdit: Extract<
		MobileWorkspaceEdit,
		{ type: "updatePrimaryNoteListProperties" }
	>,
) {
	return (
		sourceEdit.target === "allNotes" &&
		(sourceEdit.allNotesFileVisibility !== undefined ||
			previousSnapshot.vaultConfig?.allNotes?.fileVisibility !== undefined ||
			nextSnapshot.vaultConfig?.allNotes?.fileVisibility !== undefined)
	);
}

function samePrimaryNoteListSettings(
	left: ReturnType<typeof primaryNoteListSettings>,
	right: ReturnType<typeof primaryNoteListSettings>,
) {
	return (
		sameList(left.listPropertiesDisplay, right.listPropertiesDisplay) &&
		sameAllNotesFileVisibility(
			left.allNotesFileVisibility,
			right.allNotesFileVisibility,
		)
	);
}

function sameAllNotesFileVisibility(
	left: MobileAllNotesFileVisibility | undefined,
	right: MobileAllNotesFileVisibility | undefined,
) {
	if (!left || !right) return left === right;
	return (
		left.images === right.images &&
		left.pdfs === right.pdfs &&
		left.unsupported === right.unsupported
	);
}

function sameList(left: string[], right: string[]): boolean {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}
