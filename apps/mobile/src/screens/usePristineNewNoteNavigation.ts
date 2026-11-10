import type { MobileWorkspaceSnapshot } from "../workspace/mobileWorkspaceModel";
import { createPristineNewNoteDiscardAction } from "./pristineNewNoteDiscard";
import type { ApplyWorkspaceEdit } from "./tabletWorkspaceController.types";
import { useWorkspaceBackRefreshNavigation } from "./workspaceBackRefresh";

export function usePristineNewNoteNavigation(
	snapshot: MobileWorkspaceSnapshot,
	searchQuery: string,
	reloadWorkspaceSnapshot: Parameters<
		typeof useWorkspaceBackRefreshNavigation
	>[2],
	applyWorkspaceEdit: ApplyWorkspaceEdit,
) {
	const navigation = useWorkspaceBackRefreshNavigation(
		snapshot,
		searchQuery,
		reloadWorkspaceSnapshot,
	);
	const onDiscardPristineNewNote = createPristineNewNoteDiscardAction(
		navigation.takePristineNewNoteToDiscard,
		applyWorkspaceEdit,
	);
	return { navigation, onDiscardPristineNewNote };
}
