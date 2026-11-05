import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
	const selection = useMobileNoteSelectionState({
		onSelectNote,
		selectionEnabled,
	});
	const selectedNotes = useMemo(
		() => selectedMobileNoteListNotes(notes, selection.selectedNoteIds),
		[notes, selection.selectedNoteIds],
	);
	const runBulkAction = useBulkSelectionRunner(
		notes,
		selection.selectedNoteIds,
		selection.clearSelection,
	);
	const archiveSelected = useArchiveSelectionAction({
		bulkActions,
		runBulkAction,
		selectedNotes,
	});

	return {
		archiveSelected,
		beginSelection: selection.beginSelection,
		clearSelection: selection.clearSelection,
		deleteSelected: useOptionalBulkAction(bulkActions?.onDelete, runBulkAction),
		organizeSelected: useOptionalBulkAction(
			bulkActions?.onOrganize,
			runBulkAction,
		),
		pressNote: selection.pressNote,
		rowExtraData: useCallback(
			(selectedNoteId: string | null) =>
				`${selectedNoteId ?? ""}:${selection.selectedNoteIdsSignature}`,
			[selection.selectedNoteIdsSignature],
		),
		selectedNoteIds: selection.selectedNoteIds,
		selectedNotes,
	};
}

function useMobileNoteSelectionState({
	onSelectNote,
	selectionEnabled,
}: {
	onSelectNote: (noteId: string) => void;
	selectionEnabled: boolean;
}) {
	const emptySelection = useMemo(() => new Set<string>(), []);
	const [selectionState, setSelectionState] =
		useState<MobileNoteListSelectionState>({
			noteIds: emptySelection,
			scope: "",
		});
	const selectionScope = selectionEnabled ? "selection-enabled" : "";
	const selectedNoteIds = scopedSelectedNoteIds({
		emptySelection,
		selectionScope,
		selectionState,
	});
	const selectedNoteIdsSignature = [...selectedNoteIds].join("\u0000");
	const { onSelectNoteRef, selectedNoteIdsRef } = useSelectionEventReferences(
		selectedNoteIds,
		onSelectNote,
	);
	const actions = useSelectionActions({
		onSelectNoteRef,
		selectedNoteIdsRef,
		selectionEnabled,
		selectionScope,
		setSelectionState,
	});
	return {
		...actions,
		selectedNoteIds,
		selectedNoteIdsSignature,
	};
}

function useSelectionActions({
	onSelectNoteRef,
	selectedNoteIdsRef,
	selectionEnabled,
	selectionScope,
	setSelectionState,
}: {
	onSelectNoteRef: React.MutableRefObject<(noteId: string) => void>;
	selectedNoteIdsRef: React.MutableRefObject<ReadonlySet<string>>;
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
			if (
				shouldSelectNoteImmediately(
					selectionEnabled,
					selectedNoteIdsRef.current,
				)
			) {
				onSelectNoteRef.current(noteId);
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
			onSelectNoteRef,
			selectedNoteIdsRef,
			selectionEnabled,
			selectionScope,
			setSelectionState,
		],
	);
	return { beginSelection, clearSelection, pressNote };
}

function useSelectionEventReferences(
	selectedNoteIds: ReadonlySet<string>,
	onSelectNote: (noteId: string) => void,
) {
	const selectedNoteIdsRef = useRef(selectedNoteIds);
	const onSelectNoteRef = useRef(onSelectNote);
	useEffect(() => {
		selectedNoteIdsRef.current = selectedNoteIds;
	}, [selectedNoteIds]);
	useEffect(() => {
		onSelectNoteRef.current = onSelectNote;
	}, [onSelectNote]);
	return { onSelectNoteRef, selectedNoteIdsRef };
}

function useBulkSelectionRunner(
	notes: MobileNote[],
	selectedNoteIds: ReadonlySet<string>,
	clearSelection: () => void,
) {
	const selectedIdsInOrder = useCallback(
		() => selectedMobileNoteListIds(notes, selectedNoteIds),
		[notes, selectedNoteIds],
	);
	return useCallback(
		(action: (noteIds: string[]) => void) => {
			const noteIds = selectedIdsInOrder();
			if (noteIds.length > 0) {
				clearSelection();
				action(noteIds);
			}
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
