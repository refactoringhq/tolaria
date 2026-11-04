import type { MobileWorkspaceEdit } from "./mobileWorkspaceEditing";

export type MobileWorkspaceActionFeedback =
	| "deleted"
	| "archived"
	| "unarchived"
	| "organized"
	| "unorganized"
	| "relationshipRemoved"
	| "multiple";

export function mobileWorkspaceActionFeedback(
	edit: MobileWorkspaceEdit | null | undefined,
): MobileWorkspaceActionFeedback | null {
	if (!edit) return null;
	if (edit.type === "bulkEdit") return feedbackForBulkEdit(edit.edits);
	return feedbackForSingleEdit(edit);
}

function feedbackForBulkEdit(edits: MobileWorkspaceEdit[]) {
	const actions = new Set(
		edits.map(mobileWorkspaceActionFeedback).filter(Boolean),
	);
	if (actions.size === 1) return [...actions][0] ?? null;
	return actions.size > 1 ? "multiple" : null;
}

function feedbackForSingleEdit(
	edit: Exclude<MobileWorkspaceEdit, { type: "bulkEdit" }>,
): MobileWorkspaceActionFeedback | null {
	switch (edit.type) {
		case "deleteNote":
			return "deleted";
		case "setArchived":
			return edit.archived ? "archived" : "unarchived";
		case "setOrganized":
			return edit.organized ? "organized" : "unorganized";
		case "removeRelationship":
			return "relationshipRemoved";
		default:
			return null;
	}
}
