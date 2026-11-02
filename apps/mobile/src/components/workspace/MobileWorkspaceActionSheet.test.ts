import { expect, it } from "vitest";
import { desktopPanelParity } from "../../ui/desktopParity";
import { mobileSpace } from "../../ui/tokens";
import {
	mobileActionSheetLayoutContract,
	mobileActionSheetLongFormHeight,
	mobileActionSheetUsesCompactForm,
	mobileFormScrollOffset,
	mobilePropertyDeleteActionVisible,
	mobileSingleTextFieldSubmitDisabled,
	mobileWorkspaceActionGroupLayoutContract,
	mobileWorkspaceFilterControlLayoutContract,
	mobileWorkspaceFormSectionLayoutContract,
	mobileWorkspaceFormSheetAutoFocus,
	mobileWorkspaceFormSheetMaxSuggestions,
	mobileWorkspaceNativeSheetOptions,
	mobileWorkspacePropertyActionTestIds,
	mobileWorkspaceRelationshipActionTestIds,
	mobileWorkspaceRelationshipTargetMaxSuggestions,
	mobileWorkspaceSortPickerLayoutContract,
	mobileWorkspaceSuggestionRowLayoutContract,
} from "./MobileWorkspaceActionSheetModel";

it("keeps sheet spacing explicit for native modals", () => {
	expect(mobileActionSheetLayoutContract).toEqual({
		contentGap: mobileSpace.md,
		contentPadding: mobileSpace.lg,
		footerPaddingBottom: mobileSpace.lg,
		footerPaddingHorizontal: mobileSpace.lg,
		longFormSheetMinHeight: 320,
		overlayPaddingHorizontal: mobileSpace.xl,
		overlayPaddingVertical: desktopPanelParity.toolbarHeight + mobileSpace.xl,
		sheetMaxHeight: "84%",
		sheetMaxWidth: 640,
	});
});

it("derives long form sheet height from native window bounds", () => {
	expect(mobileActionSheetLongFormHeight(800)).toBe(
		800 - mobileActionSheetLayoutContract.overlayPaddingVertical * 2,
	);
	expect(mobileActionSheetLongFormHeight(360)).toBe(320);
});

it("uses native dismissible sheets and reserves detents for long forms", () => {
	expect(
		mobileWorkspaceNativeSheetOptions({ height: 800, fixedDetent: true }),
	).toEqual({
		enablePanDownToClose: true,
		index: 0,
		snapPoints: [
			800 - mobileActionSheetLayoutContract.overlayPaddingVertical * 2,
		],
	});
	expect(
		mobileWorkspaceNativeSheetOptions({ height: 800, fixedDetent: false }),
	).toEqual({
		enablePanDownToClose: true,
		index: 0,
		snapPoints: undefined,
	});
});

it.each([
	{
		action: "createView",
		phone: true,
		width: 844,
		height: 390,
		expected: true,
	},
	{
		action: "editView",
		phone: true,
		width: 844,
		height: 390,
		expected: true,
	},
	{
		action: "createView",
		phone: true,
		width: 390,
		height: 844,
		expected: false,
	},
	{
		action: "editView",
		phone: true,
		width: 600,
		height: 600,
		expected: false,
	},
	{
		action: "createView",
		phone: false,
		width: 1366,
		height: 1024,
		expected: false,
	},
	{
		action: "addProperty",
		phone: true,
		width: 844,
		height: 390,
		expected: true,
	},
	{
		action: "editProperty",
		phone: true,
		width: 844,
		height: 390,
		expected: true,
	},
	{
		action: "addProperty",
		phone: true,
		width: 390,
		height: 844,
		expected: false,
	},
	{
		action: "editProperty",
		phone: false,
		width: 1366,
		height: 1024,
		expected: false,
	},
	{
		action: "addRelationship",
		phone: true,
		width: 844,
		height: 390,
		expected: true,
	},
	{
		action: "addRelationship",
		phone: true,
		width: 390,
		height: 844,
		expected: false,
	},
	{
		action: "addRelationship",
		phone: false,
		width: 1366,
		height: 1024,
		expected: false,
	},
	{
		action: "moreActions",
		phone: true,
		width: 844,
		height: 390,
		expected: false,
	},
])(
	"uses compact actions for $action on phone=$phone at $width x $height",
	(testCase) => {
		const { expected, ...input } = testCase;
		expect(mobileActionSheetUsesCompactForm(input)).toBe(expected);
	},
);

it("allows title-less note creation while keeping required field guards", () => {
	expect(
		mobileSingleTextFieldSubmitDisabled({
			allowEmptyInput: true,
			inputValue: "",
		}),
	).toBe(false);

	expect(
		mobileSingleTextFieldSubmitDisabled({
			inputValue: "",
		}),
	).toBe(true);

	expect(
		mobileSingleTextFieldSubmitDisabled({
			allowEmptyInput: true,
			inputValue: "",
			submitDisabled: true,
		}),
	).toBe(true);
});

it.each([
	{
		offset: 0,
		fieldTop: 20,
		fieldHeight: 34,
		viewportHeight: 100,
		expected: 0,
	},
	{
		offset: 0,
		fieldTop: 200,
		fieldHeight: 34,
		viewportHeight: 100,
		expected: 134,
	},
	{
		offset: 180,
		fieldTop: 100,
		fieldHeight: 34,
		viewportHeight: 100,
		expected: 100,
	},
	{
		offset: 30,
		fieldTop: 100,
		fieldHeight: 34,
		viewportHeight: 100,
		expected: 34,
	},
	{
		offset: 30,
		fieldTop: -10,
		fieldHeight: 34,
		viewportHeight: 100,
		expected: 0,
	},
	{
		offset: 40,
		fieldTop: 200,
		fieldHeight: 34,
		viewportHeight: 0,
		expected: 40,
	},
])(
	"reveals the focused field without moving an already visible input: $expected",
	({ expected, ...geometry }) => {
		expect(mobileFormScrollOffset(geometry)).toBe(expected);
	},
);

it("opens workspace form sheets without forcing the native keyboard over the sheet", () => {
	expect(mobileWorkspaceFormSheetAutoFocus).toBe(false);
});

it("keeps destructive property removal inside edit sheets only", () => {
	expect(
		mobilePropertyDeleteActionVisible({
			editingProperty: true,
			hasSelectedNote: true,
		}),
	).toBe(true);
	expect(
		mobilePropertyDeleteActionVisible({
			editingProperty: false,
			hasSelectedNote: true,
		}),
	).toBe(false);
	expect(
		mobilePropertyDeleteActionVisible({
			editingProperty: true,
			hasSelectedNote: false,
		}),
	).toBe(false);
});

it("bounds form sheet suggestions so the footer remains reachable on first open", () => {
	expect(mobileWorkspaceFormSheetMaxSuggestions).toBe(3);
	expect(mobileWorkspaceRelationshipTargetMaxSuggestions).toBe(2);
});

it("keeps property and relationship form actions addressable in native QA", () => {
	expect(mobileWorkspacePropertyActionTestIds).toEqual({
		cancel: "workspace-property-cancel-action",
		delete: "workspace-property-delete-action",
		save: "workspace-property-save-action",
	});
	expect(mobileWorkspaceRelationshipActionTestIds).toEqual({
		cancel: "workspace-relationship-cancel-action",
		createTarget: "workspace-relationship-create-target",
		save: "workspace-relationship-save-action",
	});
});

it("keeps nested form sections grouped with explicit native spacing", () => {
	expect(mobileWorkspaceFormSectionLayoutContract).toEqual({
		gap: mobileSpace.sm,
		padding: mobileSpace.sm,
		radius: 8,
	});
});

it("keeps reorder/delete action groups wrapped with fixed native touch height", () => {
	expect(mobileWorkspaceActionGroupLayoutContract).toEqual({
		gap: mobileSpace.xs,
		minHeight: 32,
		paddingHorizontal: mobileSpace.sm,
		paddingVertical: mobileSpace.xs,
		radius: 6,
	});
});

it("keeps view sort options rendered as compact selectable controls", () => {
	expect(mobileWorkspaceSortPickerLayoutContract).toEqual({
		gap: mobileSpace.xs,
		optionMinHeight: 32,
		optionRadius: 6,
		optionTextSize: 12,
	});
});

it("keeps form suggestion rows rendered as bordered native rows", () => {
	expect(mobileWorkspaceSuggestionRowLayoutContract).toEqual({
		gap: mobileSpace.xs,
		minHeight: 34,
		paddingHorizontal: mobileSpace.sm,
		paddingVertical: mobileSpace.xs,
		radius: 6,
	});
});

it("keeps filter controls on compact native button metrics", () => {
	expect(mobileWorkspaceFilterControlLayoutContract).toEqual({
		gap: mobileSpace.xs,
		minHeight: 32,
		paddingHorizontal: mobileSpace.sm,
		paddingVertical: mobileSpace.xs,
		radius: 6,
	});
});
