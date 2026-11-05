import { BottomSheet, BottomSheetView } from "@expo/ui/community/bottom-sheet";
import { CheckCircle } from "phosphor-react-native";
import { type ReactNode, useEffect } from "react";
import {
	Keyboard,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { MobileButton } from "../../ui/MobileButton";
import {
	MobileToolbar,
	MobileToolbarSpacer,
	MobileToolbarTitle,
} from "../../ui/MobilePanel";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { useMobileDeviceLayout } from "../../ui/useMobileDeviceLayout";
import { useMobileModalDismiss } from "../../workspace/useMobileModalDismiss";
import { Text } from "../ui/text";
import { MobileWorkspaceAndroidPrompt } from "./actions/MobileWorkspaceAndroidPrompt";
import { MobileWorkspaceFolderActionsContent } from "./actions/MobileWorkspaceFolderActionsContent";
import { MobileEditorFindSheet } from "./MobileEditorFindSheet";
import { MobileQuickOpenSheet } from "./MobileQuickOpenSheet";
import { MobileTableOfContentsSheet } from "./MobileTableOfContentsSheet";
import { MobileTypeSectionEditor } from "./MobileTypeSectionEditor";
import { MobileTypeVisibilityEditor } from "./MobileTypeVisibilityEditor";
import { MobileViewDisplayPropertiesPicker } from "./MobileViewDisplayPropertiesPicker";
import type {
	ActionContentProps,
	MobileWorkspaceAction,
	MobileWorkspaceActionSheetProps,
} from "./MobileWorkspaceActionSheet.types";
import {
	mobileActionSheetUsesCompactForm,
	mobileWorkspaceNativeSheetOptions,
} from "./MobileWorkspaceActionSheetModel";
import { MoreActionsContent } from "./MobileWorkspaceMoreActionsContent";
import {
	MobileFavoriteActions,
	MobileTypeSectionActions,
} from "./MobileWorkspaceMoveActions";
import { NativeSingleFieldPrompt } from "./MobileWorkspaceNativePrompt";
import {
	AddPropertyContent,
	AddRelationshipContent,
} from "./MobileWorkspacePropertyForms";
import { SheetFooter } from "./MobileWorkspaceSheetChrome";
import {
	RetargetNoteContent,
	ViewFormContent,
	WorkspaceSingleTextFieldContent,
} from "./MobileWorkspaceTextFieldForms";
import { createMobileWorkspaceSheetStyles as createThemeStyles } from "./mobileWorkspaceActionSheetStyles";
import { actionTitle } from "./mobileWorkspaceSheetPresentation";

const nativeSheetStyles = StyleSheet.create({
	content: { flex: 1, minHeight: 0, width: "100%" },
});

function WorkspaceSheetHeader(props: ActionContentProps) {
	if (props.compactForm) return null;
	return (
		<MobileToolbar testID="workspace-action-sheet-toolbar">
			<MobileToolbarTitle
				title={actionTitle(props.action, props.propertyName)}
			/>
			<MobileToolbarSpacer />
			<MobileButton
				label={mobileText("common.cancel")}
				variant="ghost"
				onPress={props.onClose}
			/>
		</MobileToolbar>
	);
}

function ActionContent(props: ActionContentProps) {
	const Content = Object.hasOwn(actionContentByAction, props.action)
		? actionContentByAction[props.action]
		: null;
	return Content ? <Content {...props} /> : null;
}

function isNativePromptAction(action: MobileWorkspaceAction) {
	return (
		action === "createFolder" ||
		action === "createType" ||
		action === "renameNoteFile"
	);
}

function usesLongFormSheet(action: MobileWorkspaceAction) {
	return (
		action === "createView" ||
		action === "editView" ||
		action === "editTypeSection" ||
		action === "editPrimaryListProperties"
	);
}

function findContent(replace: boolean) {
	return (props: ActionContentProps) => (
		<MobileEditorFindSheet
			editorBlocks={props.editorBlocks}
			editorBullets={props.editorBullets}
			note={props.selectedNote}
			replace={replace}
			onClose={props.onClose}
			onUpdateContent={props.onUpdateNoteContent}
		/>
	);
}

const actionContentByAction: Record<
	MobileWorkspaceAction,
	(props: ActionContentProps) => ReactNode
> = {
	addProperty: (props) => <AddPropertyContent {...props} />,
	addRelationship: (props) => <AddRelationshipContent {...props} />,
	changeNoteType: (props) => (
		<RetargetNoteContent {...props} retargetAction="changeType" />
	),
	createFolder: (props) => <WorkspaceSingleTextFieldContent {...props} />,
	createType: (props) => <WorkspaceSingleTextFieldContent {...props} />,
	createView: (props) => <ViewFormContent {...props} />,
	editFolder: (props) => <MobileWorkspaceFolderActionsContent {...props} />,
	editFavorite: (props) => <FavoriteActionsContent {...props} />,
	editProperty: (props) => <AddPropertyContent {...props} />,
	editPrimaryListProperties: (props) => (
		<PrimaryListPropertiesContent {...props} />
	),
	editTypeSection: (props) => <TypeSectionContent {...props} />,
	editTypeVisibility: (props) => (
		<MobileTypeVisibilityEditor
			typeDefinitions={props.typeDefinitions}
			onToggleTypeVisibility={props.onToggleTypeVisibility}
		/>
	),
	editView: (props) => <ViewFormContent {...props} />,
	findInNote: findContent(false),
	moreActions: (props) => <MoreActionsContent {...props} />,
	moveNoteToFolder: (props) => (
		<RetargetNoteContent {...props} retargetAction="moveFolder" />
	),
	renameNoteFile: (props) => <WorkspaceSingleTextFieldContent {...props} />,
	replaceInNote: findContent(true),
	search: (props) => <SearchContent {...props} />,
	setNoteIcon: (props) => <WorkspaceSingleTextFieldContent {...props} />,
	tableOfContents: (props) => (
		<MobileTableOfContentsSheet
			blocks={props.editorBlocks}
			bullets={props.editorBullets}
			note={props.selectedNote}
			onClose={props.onClose}
			onSelectTarget={props.onSelectTableOfContentsTarget}
		/>
	),
};

function SearchContent(props: MobileWorkspaceActionSheetProps) {
	return (
		<MobileQuickOpenSheet
			notes={props.notes}
			typeDefinitions={props.typeDefinitions}
			onClearWorkspaceSearch={() => props.onSearchQueryChange("")}
			onClose={props.onClose}
			onSelectNote={props.onSelectNote}
		/>
	);
}

function FavoriteActionsContent(props: MobileWorkspaceActionSheetProps) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<ScrollView
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
			style={styles.scrollArea}
		>
			<MobileFavoriteActions
				canMoveDown={props.canMoveFavoriteDown}
				canMoveUp={props.canMoveFavoriteUp}
				onMoveDown={props.onMoveFavoriteDown}
				onMoveUp={props.onMoveFavoriteUp}
			/>
			<SheetFooter>
				<MobileButton
					label={mobileText("common.cancel")}
					variant="ghost"
					onPress={props.onClose}
				/>
			</SheetFooter>
		</ScrollView>
	);
}

function TypeSectionContent(props: MobileWorkspaceActionSheetProps) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<ScrollView
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
			style={styles.scrollArea}
		>
			<MobileTypeSectionActions
				canDelete={props.canDeleteType}
				canMoveDown={props.canMoveTypeDown}
				canMoveUp={props.canMoveTypeUp}
				onDelete={props.onDeleteType}
				onMoveDown={props.onMoveTypeDown}
				onMoveUp={props.onMoveTypeUp}
			/>
			<TypeSectionEditorContent {...props} />
			<SheetFooter>
				<MobileButton
					label={mobileText("common.cancel")}
					variant="ghost"
					onPress={props.onClose}
				/>
				<MobileButton
					disabled={props.typeRenameName.trim().length === 0}
					label={mobileText("common.save")}
					variant="primary"
					onPress={props.onSaveTypeDefinition}
				/>
			</SheetFooter>
		</ScrollView>
	);
}

function TypeSectionEditorContent(props: MobileWorkspaceActionSheetProps) {
	return (
		<MobileTypeSectionEditor
			displayProperties={props.typeDisplayProperties}
			notes={props.notes}
			propertyOptions={props.typePropertyOptions}
			propertyQuery={props.typePropertyQuery}
			relationshipTargetOptions={props.typeRelationshipTargetOptions}
			schemaProperties={props.typeSchemaProperties}
			schemaPropertyName={props.typeSchemaPropertyName}
			schemaPropertyNameOptions={props.typeSchemaPropertyNameOptions}
			schemaPropertyValue={props.typeSchemaPropertyValue}
			schemaRelationships={props.typeSchemaRelationships}
			schemaRelationshipName={props.typeSchemaRelationshipName}
			schemaRelationshipNameOptions={props.typeSchemaRelationshipNameOptions}
			schemaRelationshipTarget={props.typeSchemaRelationshipTarget}
			sectionLabel={props.typeSectionLabel}
			sort={props.typeSort}
			sortPropertyOptions={props.typeSortPropertyOptions}
			template={props.typeTemplate}
			typeIcon={props.typeIcon}
			tone={props.typeTone}
			typeName={props.typeName}
			typeRenameName={props.typeRenameName}
			visible={props.typeVisible}
			onDisplayPropertiesChange={props.onTypeDisplayPropertiesChange}
			onPropertyQueryChange={props.onTypePropertyQueryChange}
			onSchemaPropertyAdd={props.onTypeSchemaPropertyAdd}
			onSchemaPropertyNameChange={props.onTypeSchemaPropertyNameChange}
			onSchemaPropertyRemove={props.onTypeSchemaPropertyRemove}
			onSchemaPropertyValueChange={props.onTypeSchemaPropertyValueChange}
			onSchemaRelationshipAdd={props.onTypeSchemaRelationshipAdd}
			onSchemaRelationshipNameChange={props.onTypeSchemaRelationshipNameChange}
			onSchemaRelationshipRemove={props.onTypeSchemaRelationshipRemove}
			onSchemaRelationshipTargetSelect={
				props.onTypeSchemaRelationshipTargetSelect
			}
			onSchemaRelationshipTargetChange={
				props.onTypeSchemaRelationshipTargetChange
			}
			onSectionLabelChange={props.onTypeSectionLabelChange}
			onSortChange={props.onTypeSortChange}
			onTemplateChange={props.onTypeTemplateChange}
			onTypeIconChange={props.onTypeIconChange}
			onTypeRenameNameChange={props.onTypeRenameNameChange}
			onToneChange={props.onTypeToneChange}
			onVisibleChange={props.onTypeVisibleChange}
		/>
	);
}

function PrimaryListPropertiesContent(props: MobileWorkspaceActionSheetProps) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<ScrollView
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
			style={styles.scrollArea}
		>
			<MobileViewDisplayPropertiesPicker
				options={props.primaryPropertyOptions}
				query={props.primaryPropertyQuery}
				selectedProperties={props.primaryDisplayProperties}
				testIDPrefix="workspace-primary-property"
				onQueryChange={props.onPrimaryPropertyQueryChange}
				onSelectedPropertiesChange={props.onPrimaryDisplayPropertiesChange}
			/>
			{props.primaryItemId === "all-notes" ? (
				<AllNotesFileVisibilityContent {...props} />
			) : null}
			<SheetFooter>
				<MobileButton
					label={mobileText("common.cancel")}
					variant="ghost"
					onPress={props.onClose}
				/>
				<MobileButton
					label={mobileText("common.save")}
					variant="primary"
					onPress={props.onSavePrimaryNoteListProperties}
				/>
			</SheetFooter>
		</ScrollView>
	);
}

function AllNotesFileVisibilityContent({
	allNotesShowImages,
	allNotesShowPdfs,
	allNotesShowUnsupported,
	onPrimaryAllNotesShowImagesChange,
	onPrimaryAllNotesShowPdfsChange,
	onPrimaryAllNotesShowUnsupportedChange,
}: MobileWorkspaceActionSheetProps) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<View
			style={styles.visibilitySection}
			testID="workspace-all-notes-file-visibility"
		>
			<View style={styles.visibilityHeader}>
				<Text style={styles.visibilityTitle}>
					{mobileText("settings.allNotesVisibility.title")}
				</Text>
				<Text style={styles.visibilityDescription}>
					{mobileText("settings.allNotesVisibility.description")}
				</Text>
			</View>
			<VisibilitySwitchRow
				active={allNotesShowPdfs}
				description={mobileText("settings.allNotesVisibility.pdfsDescription")}
				label={mobileText("settings.allNotesVisibility.pdfs")}
				testID="workspace-all-notes-show-pdfs"
				onChange={onPrimaryAllNotesShowPdfsChange}
			/>
			<VisibilitySwitchRow
				active={allNotesShowImages}
				description={mobileText(
					"settings.allNotesVisibility.imagesDescription",
				)}
				label={mobileText("settings.allNotesVisibility.images")}
				testID="workspace-all-notes-show-images"
				onChange={onPrimaryAllNotesShowImagesChange}
			/>
			<VisibilitySwitchRow
				active={allNotesShowUnsupported}
				description={mobileText(
					"settings.allNotesVisibility.unsupportedDescription",
				)}
				label={mobileText("settings.allNotesVisibility.unsupported")}
				testID="workspace-all-notes-show-unsupported"
				onChange={onPrimaryAllNotesShowUnsupportedChange}
			/>
		</View>
	);
}

function VisibilitySwitchRow({
	active,
	description,
	label,
	onChange,
	testID,
}: {
	active: boolean;
	description: string;
	label: string;
	onChange: (value: boolean) => void;
	testID: string;
}) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<Pressable
			accessibilityLabel={label}
			accessibilityRole="switch"
			accessibilityState={{ checked: active }}
			aria-checked={active}
			style={({ pressed }) => [
				styles.visibilityRow,
				pressed ? styles.visibilityRowPressed : null,
			]}
			testID={testID}
			onPress={() => onChange(!active)}
		>
			<CheckCircle
				color={active ? mobileColors.primary : mobileColors.textFaint}
				size={16}
				weight={active ? "fill" : "regular"}
			/>
			<View style={styles.visibilityText}>
				<Text style={styles.visibilityLabel}>{label}</Text>
				<Text style={styles.visibilityDescription}>{description}</Text>
			</View>
		</Pressable>
	);
}

export function MobileWorkspaceActionSheet(
	props: MobileWorkspaceActionSheetProps,
) {
	useMobileModalDismiss(props.onClose);
	const phone = useMobileDeviceLayout() === "phone";
	useEffect(() => {
		if (props.action !== "search") Keyboard.dismiss();
	}, [props.action]);
	const { height: windowHeight, width: windowWidth } = useWindowDimensions();
	const compactForm = mobileActionSheetUsesCompactForm({
		action: props.action,
		phone,
		width: windowWidth,
		height: windowHeight,
	});
	const nativeSheetOptions = mobileWorkspaceNativeSheetOptions({
		fixedDetent: usesLongFormSheet(props.action) || compactForm,
		height: windowHeight,
	});

	if (isNativePromptAction(props.action)) {
		return Platform.OS === "ios" ? (
			<NativeSingleFieldPrompt {...props} compactForm={compactForm} />
		) : (
			<MobileWorkspaceAndroidPrompt {...props} compactForm={compactForm} />
		);
	}

	return (
		<BottomSheet
			enablePanDownToClose={nativeSheetOptions.enablePanDownToClose}
			index={nativeSheetOptions.index}
			onClose={props.onClose}
			snapPoints={nativeSheetOptions.snapPoints}
		>
			<BottomSheetView style={nativeSheetStyles.content}>
				<View
					accessibilityViewIsModal
					testID={`workspace-action-sheet-${props.action}`}
					style={nativeSheetStyles.content}
				>
					<WorkspaceSheetHeader {...props} compactForm={compactForm} />
					<ActionContent {...props} compactForm={compactForm} />
				</View>
			</BottomSheetView>
		</BottomSheet>
	);
}

export type {
	MobileWorkspaceAction,
	MobileWorkspaceActionSheetProps,
} from "./MobileWorkspaceActionSheet.types";
