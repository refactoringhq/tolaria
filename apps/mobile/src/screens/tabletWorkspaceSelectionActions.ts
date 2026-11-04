import { useCallback } from "react";
import type { MobileWorkspaceEdit } from "../workspace/mobileWorkspaceEditing";
import type { MobileNote } from "../workspace/mobileWorkspaceModel";
import type {
	ApplyWorkspaceEdit,
	SetOpenAction,
	TabletWorkspaceNavigation,
} from "./tabletWorkspaceController.types";
import { selectAfterWorkspaceEdit } from "./tabletWorkspaceEditSelection";
import type { useWorkspaceEditPipeline } from "./tabletWorkspacePersistence";

export function useTabletWorkspaceSelectionActions({
	applyWorkspaceEdit,
	navigation,
	resetForm,
	selectedNote,
	setOpenAction,
}: {
	applyWorkspaceEdit: ReturnType<
		typeof useWorkspaceEditPipeline
	>["applyWorkspaceEdit"];
	navigation: TabletWorkspaceNavigation;
	resetForm: () => void;
	selectedNote: MobileNote | null;
	setOpenAction: SetOpenAction;
}) {
	const applyEdit = useApplyControllerEdit(applyWorkspaceEdit, navigation);
	const closeAction = useCloseWorkspaceAction(resetForm, setOpenAction);
	const saveSelectedEdit = useSaveSelectedEdit(
		applyEdit,
		closeAction,
		selectedNote,
	);
	return { applyEdit, closeAction, saveSelectedEdit };
}

function useApplyControllerEdit(
	applyWorkspaceEdit: ReturnType<
		typeof useWorkspaceEditPipeline
	>["applyWorkspaceEdit"],
	navigation: TabletWorkspaceNavigation,
) {
	return useCallback(
		(edit: MobileWorkspaceEdit) => {
			void applyWorkspaceEdit(edit).then((result) => {
				if (result)
					selectAfterWorkspaceEdit({
						edit,
						navigation,
						result,
						setSelectedNoteId: navigation.setSelectedNoteId,
					});
			});
		},
		[applyWorkspaceEdit, navigation],
	);
}

function useCloseWorkspaceAction(
	resetForm: () => void,
	setOpenAction: SetOpenAction,
) {
	return useCallback(() => {
		setOpenAction(null);
		resetForm();
	}, [resetForm, setOpenAction]);
}

function useSaveSelectedEdit(
	applyEdit: ApplyWorkspaceEdit,
	closeAction: () => void,
	selectedNote: MobileNote | null,
) {
	return useCallback(
		(toEdit: (noteId: string) => MobileWorkspaceEdit | null) => {
			if (!selectedNote) return;
			const edit = toEdit(selectedNote.id);
			if (!edit) return;
			applyEdit(edit);
			closeAction();
		},
		[applyEdit, closeAction, selectedNote],
	);
}
