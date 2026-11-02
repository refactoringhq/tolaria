import { desktopPanelParity } from "../../ui/desktopParity";
import { mobileSpace } from "../../ui/tokens";

export const mobileActionSheetLayoutContract = {
	contentGap: mobileSpace.md,
	contentPadding: mobileSpace.lg,
	footerPaddingBottom: mobileSpace.lg,
	footerPaddingHorizontal: mobileSpace.lg,
	overlayPaddingHorizontal: mobileSpace.xl,
	overlayPaddingVertical: desktopPanelParity.toolbarHeight + mobileSpace.xl,
	longFormSheetMinHeight: 320,
	sheetMaxHeight: "84%",
	sheetMaxWidth: 640,
} as const;

export const mobileWorkspaceFormSectionLayoutContract = {
	gap: mobileSpace.sm,
	padding: mobileSpace.sm,
	radius: 8,
} as const;

export const mobileWorkspaceActionGroupLayoutContract = {
	gap: mobileSpace.xs,
	minHeight: 32,
	paddingHorizontal: mobileSpace.sm,
	paddingVertical: mobileSpace.xs,
	radius: 6,
} as const;

export const mobileWorkspaceSortPickerLayoutContract = {
	gap: mobileSpace.xs,
	optionMinHeight: 32,
	optionRadius: 6,
	optionTextSize: 12,
} as const;

export const mobileWorkspaceSuggestionRowLayoutContract = {
	gap: mobileSpace.xs,
	minHeight: 34,
	paddingHorizontal: mobileSpace.sm,
	paddingVertical: mobileSpace.xs,
	radius: 6,
} as const;

export const mobilePropertyValueChoiceLayoutContract = {
	gap: mobileSpace.xs,
	minHeight: 30,
	minWidth: 58,
	paddingHorizontal: mobileSpace.sm,
	radius: 6,
} as const;

export const mobileWorkspaceFilterControlLayoutContract = {
	gap: mobileSpace.xs,
	minHeight: 32,
	paddingHorizontal: mobileSpace.sm,
	paddingVertical: mobileSpace.xs,
	radius: 6,
} as const;

export const mobileWorkspaceFormSheetAutoFocus = false;
export const mobileWorkspaceFormSheetMaxSuggestions = 3;
export const mobileWorkspaceRelationshipTargetMaxSuggestions = 2;

export const mobileWorkspacePropertyActionTestIds = {
	cancel: "workspace-property-cancel-action",
	delete: "workspace-property-delete-action",
	save: "workspace-property-save-action",
} as const;

export const mobileWorkspaceRelationshipActionTestIds = {
	cancel: "workspace-relationship-cancel-action",
	createTarget: "workspace-relationship-create-target",
	save: "workspace-relationship-save-action",
} as const;

export function mobilePropertyDeleteActionVisible({
	editingProperty,
	hasSelectedNote,
}: {
	editingProperty: boolean;
	hasSelectedNote: boolean;
}) {
	return editingProperty && hasSelectedNote;
}

export function mobileActionSheetLongFormHeight(windowHeight: number) {
	const availableHeight =
		windowHeight - mobileActionSheetLayoutContract.overlayPaddingVertical * 2;
	return Math.max(
		0,
		Math.min(
			windowHeight,
			Math.max(
				mobileActionSheetLayoutContract.longFormSheetMinHeight,
				availableHeight,
			),
		),
	);
}

export function mobileWorkspaceNativeSheetOptions({
	height,
	fixedDetent,
}: {
	height: number;
	fixedDetent: boolean;
}) {
	return {
		enablePanDownToClose: true,
		index: 0,
		snapPoints: fixedDetent
			? [mobileActionSheetLongFormHeight(height)]
			: undefined,
	} as const;
}

export function mobileActionSheetUsesCompactForm({
	action,
	phone,
	width,
	height,
}: {
	action: string;
	phone: boolean;
	width: number;
	height: number;
}) {
	return (
		phone &&
		width > height &&
		[
			"createView",
			"editView",
			"addProperty",
			"editProperty",
			"addRelationship",
		].includes(action)
	);
}

export function mobileFormScrollOffset({
	offset,
	fieldTop,
	fieldHeight,
	viewportHeight,
}: {
	offset: number;
	fieldTop: number;
	fieldHeight: number;
	viewportHeight: number;
}) {
	if (viewportHeight <= 0) return offset;
	if (fieldTop < offset) return Math.max(0, fieldTop);
	if (fieldTop + fieldHeight > offset + viewportHeight) {
		return Math.max(0, fieldTop + fieldHeight - viewportHeight);
	}
	return offset;
}

export function mobileSingleTextFieldSubmitDisabled({
	allowEmptyInput = false,
	inputValue,
	submitDisabled = false,
}: {
	allowEmptyInput?: boolean;
	inputValue: string;
	submitDisabled?: boolean;
}) {
	return submitDisabled || (!allowEmptyInput && inputValue.trim().length === 0);
}
