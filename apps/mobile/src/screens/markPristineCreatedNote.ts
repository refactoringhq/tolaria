import type {
	MobileWorkspaceEdit,
	MobileWorkspaceEditResult,
} from "../workspace/mobileWorkspaceEditing";

export function markPristineCreatedNote(
	edit: MobileWorkspaceEdit,
	result: MobileWorkspaceEditResult,
	mark: ((noteId: string) => void) | undefined,
) {
	if (edit.type !== "createNote") return;
	if (edit.title.trim() !== "") return;
	const noteId = result.snapshot.selectedNoteId;
	if (!noteId) return;
	if (!result.writes.some((write) => write.kind === "createNote")) return;
	mark?.(noteId);
}
