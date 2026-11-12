import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logMobileMotionEvent } from "../qa/mobileMotionFrameLog";
import type { PhoneWorkspaceController } from "./phoneWorkspaceScreenSupport";
import type { PhoneWorkspaceState } from "./phoneWorkspaceTransitions";

type ChromeControllerProps = {
	baseController: PhoneWorkspaceController;
	initialState: PhoneWorkspaceState;
};

export function createdPhoneNoteSelection(
	pending: { previousId: string | null } | null,
	selectedNoteId: string | null,
) {
	return pending && selectedNoteId !== pending.previousId
		? selectedNoteId
		: null;
}

function usePendingPhoneNoteSelection(
	pendingCreateSelectionRef: { current: { previousId: string | null } | null },
	phoneState: PhoneWorkspaceState,
	selectedNoteId: string | null,
	selectNote: PhoneWorkspaceController["onSelectNote"],
) {
	useEffect(() => {
		const pending = pendingCreateSelectionRef.current;
		if (phoneState !== "editor") {
			pendingCreateSelectionRef.current = null;
			return;
		}
		const createdNoteId = createdPhoneNoteSelection(pending, selectedNoteId);
		if (!createdNoteId) return;
		pendingCreateSelectionRef.current = null;
		selectNote(createdNoteId);
	}, [pendingCreateSelectionRef, phoneState, selectNote, selectedNoteId]);
}

export function usePhoneWorkspaceChromeController({
	baseController,
	initialState,
}: ChromeControllerProps) {
	const [phoneState, updatePhoneState] = useState(initialState);
	const [prepareNewNoteEditor, setPrepareNewNoteEditor] = useState(false);
	const pendingCreateSelection = useRef<{ previousId: string | null } | null>(
		null,
	);
	const setPhoneState = useCallback(
		(state: PhoneWorkspaceState) => updatePhoneState(state),
		[],
	);
	const selectNote = baseController.onSelectNote;
	const snapshotSelectedNoteId = baseController.snapshot.selectedNoteId ?? null;
	usePendingPhoneNoteSelection(
		pendingCreateSelection,
		phoneState,
		snapshotSelectedNoteId,
		selectNote,
	);
	const openPreparedNewNote = useCallback(() => {
		if (!prepareNewNoteEditor) return;
		logMobileMotionEvent("new-note-editor-body-ready", {});
		setPrepareNewNoteEditor(false);
		setPhoneState("editor");
	}, [prepareNewNoteEditor, setPhoneState]);
	const createAndOpenNote = useCallback(() => {
		const syncKind = baseController.snapshot.sync.kind;
		const canCreateNote = syncKind !== "noVault" && syncKind !== "readOnly";
		logMobileMotionEvent("new-note-editor-prepare", {
			canCreateNote,
			syncKind,
		});
		if (canCreateNote) {
			pendingCreateSelection.current = {
				previousId: baseController.snapshot.selectedNoteId ?? null,
			};
			setPrepareNewNoteEditor(true);
			setPhoneState("editor");
			requestAnimationFrame(() => {
				const startedAt = performance.now();
				baseController.onOpenCreateNote();
				logMobileMotionEvent("new-note-create-action-complete", {
					durationMs: performance.now() - startedAt,
				});
			});
			return;
		}
		baseController.onOpenCreateNote();
	}, [baseController, setPhoneState]);
	const controller = useMemo(
		() => ({ ...baseController, onOpenCreateNote: createAndOpenNote }),
		[baseController, createAndOpenNote],
	);
	return {
		controller,
		onEditorBodyReady: openPreparedNewNote,
		phoneState,
		prepareNewNoteEditor,
		setPhoneState,
	};
}
