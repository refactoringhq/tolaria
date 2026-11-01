import { useCallback, useMemo, useState } from "react";
import type { MobileNeighborhood } from "../../workspace/mobileNeighborhood";
import type { MobileNote } from "../../workspace/mobileWorkspaceModel";
import {
	addMobileNoteListSelection,
	mobileNoteListSelectionIsArchived,
	selectedMobileNoteListIds,
	selectedMobileNoteListNotes,
	toggleMobileNoteListSelection,
} from "./mobileNoteListBulkSelection";
import type { MobileSwipePrimaryAction } from "./mobileNoteSwipe";

export type MobileNoteListBulkActions = {
	onArchive: (noteIds: string[], archived: boolean) => void;
	onDelete: (noteIds: string[]) => void;
	onOrganize: (noteIds: string[]) => void;
	primarySwipeAction?: MobileSwipePrimaryAction;
};
type MobileNoteListSelectionState = {
	noteIds: ReadonlySet<string>;
	scope: string;
};

export function useMobileNoteListBulkSelection({
	bulkActions,
	neighborhood,
	notes,
	onSelectNote,
}: {
	bulkActions?: MobileNoteListBulkActions;
	neighborhood: MobileNeighborhood | null;
	notes: MobileNote[];
	onSelectNote: (noteId: string) => void;
}) {
	const selectionEnabled = Boolean(bulkActions && !neighborhood);
	const emptySelection = useMemo(() => new Set<string>(), []);
	const [selectionState, setSelectionState] =
		useState<MobileNoteListSelectionState>({
			noteIds: emptySelection,
			scope: "",
		});
	const selectionSnapshot = useNoteListSelectionSnapshot({
		emptySelection,
		notes,
		selectionEnabled,
		selectionState,
	});
	const selectionActions = useNoteListSelectionControls({
		bulkActions,
		notes,
		onSelectNote,
		selectionEnabled,
		selectionSnapshot,
		setSelectionState,
	});
	return useNoteListSelectionResult({
		...selectionActions,
		bulkActions,
		selectionSnapshot,
	});
}

function useNoteListSelectionControls({
	bulkActions,
	notes,
	onSelectNote,
	selectionEnabled,
	selectionSnapshot,
	setSelectionState,
}: {
	bulkActions?: MobileNoteListBulkActions;
	notes: MobileNote[];
	onSelectNote: (noteId: string) => void;
	selectionEnabled: boolean;
	selectionSnapshot: ReturnType<typeof useNoteListSelectionSnapshot>;
	setSelectionState: React.Dispatch<
		React.SetStateAction<MobileNoteListSelectionState>
	>;
}) {
	const { beginSelection, clearSelection, pressNote } =
		useNoteListSelectionActions({
			onSelectNote,
			selectedNoteIds: selectionSnapshot.selectedNoteIds,
			selectionEnabled,
			selectionScope: selectionSnapshot.selectionScope,
			setSelectionState,
		});
	const runBulkAction = useNoteListBulkActionRunner({
		clearSelection,
		notes,
		selectedNoteIds: selectionSnapshot.selectedNoteIds,
	});
	return {
		archiveSelected: useArchiveSelectionAction({
			bulkActions,
			runBulkAction,
			selectedNotes: selectionSnapshot.selectedNotes,
		}),
		beginSelection,
		clearSelection,
		pressNote,
		runBulkAction,
	};
}

function useNoteListSelectionResult({
	archiveSelected,
	beginSelection,
	bulkActions,
	clearSelection,
	pressNote,
	runBulkAction,
	selectionSnapshot,
}: {
	archiveSelected: () => void;
	beginSelection: (noteId: string) => void;
	bulkActions?: MobileNoteListBulkActions;
	clearSelection: () => void;
	pressNote: (noteId: string) => void;
	runBulkAction: (action: (noteIds: string[]) => void) => void;
	selectionSnapshot: ReturnType<typeof useNoteListSelectionSnapshot>;
}) {
	return {
		archiveSelected,
		beginSelection,
		clearSelection,
		deleteSelected: useOptionalBulkAction(bulkActions?.onDelete, runBulkAction),
		organizeSelected: useOptionalBulkAction(
			bulkActions?.onOrganize,
			runBulkAction,
		),
		pressNote,
		rowExtraData: useCallback(
			(selectedNoteId: string | null) =>
				`${selectedNoteId ?? ""}:${selectionSnapshot.selectedNoteIdsSignature}`,
			[selectionSnapshot.selectedNoteIdsSignature],
		),
		selectedNoteIds: selectionSnapshot.selectedNoteIds,
		selectedNotes: selectionSnapshot.selectedNotes,
	};
}

function useNoteListSelectionSnapshot({
	emptySelection,
	notes,
	selectionEnabled,
	selectionState,
}: {
	emptySelection: ReadonlySet<string>;
	notes: MobileNote[];
	selectionEnabled: boolean;
	selectionState: MobileNoteListSelectionState;
}) {
	const visibleNoteIds = useMemo(() => notes.map((note) => note.id), [notes]);
	const selectionScope = selectionEnabled ? visibleNoteIds.join("\u0000") : "";
	const selectedNoteIds = scopedSelectedNoteIds({
		emptySelection,
		selectionScope,
		selectionState,
	});
	const selectedNotes = useMemo(
		() => selectedMobileNoteListNotes(notes, selectedNoteIds),
		[notes, selectedNoteIds],
	);
	return {
		selectedNoteIds,
		selectedNoteIdsSignature: [...selectedNoteIds].join("\u0000"),
		selectedNotes,
		selectionScope,
	};
}

function useNoteListSelectionActions({
	onSelectNote,
	selectedNoteIds,
	selectionEnabled,
	selectionScope,
	setSelectionState,
}: {
	onSelectNote: (noteId: string) => void;
	selectedNoteIds: ReadonlySet<string>;
	selectionEnabled: boolean;
	selectionScope: string;
	setSelectionState: React.Dispatch<
		React.SetStateAction<MobileNoteListSelectionState>
	>;
}) {
	const clearSelection = useCallback(() => {
		setSelectionState({ noteIds: new Set(), scope: selectionScope });
	}, [selectionScope, setSelectionState]);
	const beginSelection = useCallback(
		(noteId: string) => {
			if (!selectionEnabled) return;
			setSelectionState((current) =>
				selectionWithNote(
					current,
					selectionScope,
					noteId,
					addMobileNoteListSelection,
				),
			);
		},
		[selectionEnabled, selectionScope, setSelectionState],
	);
	const pressNote = useCallback(
		(noteId: string) => {
			if (shouldSelectNoteImmediately(selectionEnabled, selectedNoteIds)) {
				onSelectNote(noteId);
				return;
			}
			setSelectionState((current) =>
				selectionWithNote(
					current,
					selectionScope,
					noteId,
					toggleMobileNoteListSelection,
				),
			);
		},
		[
			onSelectNote,
			selectedNoteIds,
			selectionEnabled,
			selectionScope,
			setSelectionState,
		],
	);
	return { beginSelection, clearSelection, pressNote };
}

function useNoteListBulkActionRunner({
	clearSelection,
	notes,
	selectedNoteIds,
}: {
	clearSelection: () => void;
	notes: MobileNote[];
	selectedNoteIds: ReadonlySet<string>;
}) {
	const selectedIdsInOrder = useCallback(
		() => selectedMobileNoteListIds(notes, selectedNoteIds),
		[notes, selectedNoteIds],
	);
	return useCallback(
		(action: (noteIds: string[]) => void) => {
			const noteIds = selectedIdsInOrder();
			if (noteIds.length === 0) return;
			clearSelection();
			action(noteIds);
		},
		[clearSelection, selectedIdsInOrder],
	);
}

function scopedSelectedNoteIds({
	emptySelection,
	selectionScope,
	selectionState,
}: {
	emptySelection: ReadonlySet<string>;
	selectionScope: string;
	selectionState: MobileNoteListSelectionState;
}) {
	return selectionState.scope === selectionScope
		? selectionState.noteIds
		: emptySelection;
}

function selectionWithNote(
	current: MobileNoteListSelectionState,
	selectionScope: string,
	noteId: string,
	updateSelection: (
		noteIds: ReadonlySet<string>,
		noteId: string,
	) => ReadonlySet<string>,
): MobileNoteListSelectionState {
	return {
		noteIds: updateSelection(
			scopedNoteSelection(current, selectionScope),
			noteId,
		),
		scope: selectionScope,
	};
}

function shouldSelectNoteImmediately(
	selectionEnabled: boolean,
	selectedNoteIds: ReadonlySet<string>,
) {
	return !selectionEnabled || selectedNoteIds.size === 0;
}

function useArchiveSelectionAction({
	bulkActions,
	runBulkAction,
	selectedNotes,
}: {
	bulkActions?: MobileNoteListBulkActions;
	runBulkAction: (action: (noteIds: string[]) => void) => void;
	selectedNotes: MobileNote[];
}) {
	return useCallback(() => {
		if (!bulkActions) return;
		const archived = !mobileNoteListSelectionIsArchived(selectedNotes);
		runBulkAction((noteIds) => bulkActions.onArchive(noteIds, archived));
	}, [bulkActions, runBulkAction, selectedNotes]);
}

function useOptionalBulkAction(
	action: ((noteIds: string[]) => void) | undefined,
	runBulkAction: (action: (noteIds: string[]) => void) => void,
) {
	return useCallback(() => {
		if (action) runBulkAction(action);
	}, [action, runBulkAction]);
}

function scopedNoteSelection(
	state: MobileNoteListSelectionState,
	scope: string,
) {
	return state.scope === scope ? state.noteIds : new Set<string>();
}
