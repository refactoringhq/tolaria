import { expect, it, vi } from "vitest";
import { nativeWorkspaceFieldActions } from "./tabletWorkspaceNativeFieldActions";

it("commits native inspector changes through the workspace edit pipeline", () => {
	const applyEdit = vi.fn();
	const actions = nativeWorkspaceFieldActions(applyEdit);

	actions.onCommitNativeNoteType("note-1", "Project");
	actions.onCommitNativeProperty("note-1", "Status", "Open");

	expect(applyEdit.mock.calls).toEqual([
		[{ noteId: "note-1", type: "changeNoteType", value: "Project" }],
		[
			{
				noteId: "note-1",
				key: "Status",
				type: "updateProperty",
				value: "Open",
			},
		],
	]);
});
