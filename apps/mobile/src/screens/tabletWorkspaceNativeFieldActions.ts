import type { MobilePropertyValue } from "../workspace/mobileWorkspaceModel";
import type { ApplyWorkspaceEdit } from "./tabletWorkspaceController.types";

export function nativeWorkspaceFieldActions(applyEdit: ApplyWorkspaceEdit) {
	return {
		onCommitNativeNoteType: (noteId: string, value: string) =>
			applyEdit({ noteId, type: "changeNoteType", value }),
		onCommitNativeProperty: (
			noteId: string,
			key: string,
			value: MobilePropertyValue,
		) => applyEdit({ noteId, key, type: "updateProperty", value }),
	};
}
