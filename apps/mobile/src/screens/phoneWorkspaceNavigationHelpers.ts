import { useCallback, useEffect } from "react";
import { logNativeMobileKeyboardShortcutBridgeProof } from "../qa/nativeMobileKeyboardShortcutProof";
import type { MobileNote } from "../workspace/mobileWorkspaceModel";
import type { PhoneWorkspaceController } from "./phoneWorkspaceScreenSupport";
import type { PhoneWorkspaceState } from "./phoneWorkspaceTransitions";

export function selectAdjacentVisiblePhoneNote(
	notes: MobileNote[],
	selectedNoteId: string | null,
	onSelectNote: (noteId: string) => void,
	direction: -1 | 1,
) {
	if (notes.length === 0) return;
	const currentIndex = Math.max(
		0,
		notes.findIndex((note) => note.id === selectedNoteId),
	);
	const nextIndex = Math.max(
		0,
		Math.min(notes.length - 1, currentIndex + direction),
	);
	const noteId = notes[nextIndex]?.id;
	if (noteId) onSelectNote(noteId);
}

export function usePhoneWorkspaceNoteSelection(
	controller: PhoneWorkspaceController,
) {
	const selectNextNote = useCallback(
		() =>
			selectAdjacentVisiblePhoneNote(
				controller.notes,
				controller.selectedNoteId,
				controller.onSelectNote,
				1,
			),
		[controller],
	);
	const selectPreviousNote = useCallback(
		() =>
			selectAdjacentVisiblePhoneNote(
				controller.notes,
				controller.selectedNoteId,
				controller.onSelectNote,
				-1,
			),
		[controller],
	);
	return { selectNextNote, selectPreviousNote };
}

export function usePhoneKeyboardShortcutBridgeProof(enabled: boolean) {
	useEffect(() => {
		if (enabled) logNativeMobileKeyboardShortcutBridgeProof();
	}, [enabled]);
}

export function useCreateRelationshipTargetAndOpenEditor(
	controller: PhoneWorkspaceController,
	setPhoneState: (nextState: PhoneWorkspaceState) => void,
) {
	return useCallback(() => {
		controller.onCreateRelationshipTarget();
		setPhoneState("editor");
	}, [controller, setPhoneState]);
}
