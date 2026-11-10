import { useCallback, useMemo, useState } from "react";
import { logMobileMotionEvent } from "../qa/mobileMotionFrameLog";
import type { PhoneWorkspaceController } from "./phoneWorkspaceScreenSupport";
import type { PhoneWorkspaceState } from "./phoneWorkspaceTransitions";

type ChromeControllerProps = {
	baseController: PhoneWorkspaceController;
	initialState: PhoneWorkspaceState;
};

export function usePhoneWorkspaceChromeController({
	baseController,
	initialState,
}: ChromeControllerProps) {
	const [phoneState, updatePhoneState] = useState(initialState);
	const [prepareNewNoteEditor, setPrepareNewNoteEditor] = useState(false);
	const setPhoneState = useCallback(
		(state: PhoneWorkspaceState) => updatePhoneState(state),
		[],
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
		if (canCreateNote) setPrepareNewNoteEditor(true);
		baseController.onOpenCreateNote();
	}, [baseController]);
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
