import {
	ArrowSquareOut,
	ClipboardText,
	FilePlus,
	FolderOpen,
	Trash,
} from "phosphor-react-native";
import { Platform, ScrollView } from "react-native";
import { mobileText } from "../../../i18n/mobileText";
import { desktopToolbarActionParity } from "../../../ui/desktopParity";
import { MobileButton } from "../../../ui/MobileButton";
import { MobileTextInput } from "../../../ui/MobileTextInput";
import { useMobileStyles } from "../../../ui/theme/useMobileTheme";
import { showNativeConfirmation } from "../../ui/mobileNativeDialogs";
import type { MobileWorkspaceActionSheetProps } from "../MobileWorkspaceActionSheet.types";
import { mobileWorkspaceFormSheetAutoFocus } from "../MobileWorkspaceActionSheetModel";
import { showNativeFolderRenamePrompt } from "../MobileWorkspaceFolderPrompt";
import { ActionRow, SheetFooter } from "../MobileWorkspaceSheetChrome";
import { createMobileWorkspaceSheetStyles as createThemeStyles } from "../mobileWorkspaceActionSheetStyles";

function FolderNameAction(props: MobileWorkspaceActionSheetProps) {
	const { mobileColors } = useMobileStyles(createThemeStyles);
	if (Platform.OS === "ios") {
		return (
			<ActionRow
				icon={
					<FolderOpen
						color={mobileColors.textMuted}
						size={desktopToolbarActionParity.iconSize}
					/>
				}
				label={mobileText("sidebar.action.renameFolder")}
				testID="workspace-rename-folder-prompt"
				onPress={() => showNativeFolderRenamePrompt(props)}
			/>
		);
	}
	return (
		<MobileTextInput
			autoFocus={mobileWorkspaceFormSheetAutoFocus}
			label={mobileText("sidebar.folder.newName")}
			placeholder={mobileText("sidebar.folder.newName")}
			testID="workspace-rename-folder-input"
			value={props.folderName}
			onChangeText={props.onFolderNameChange}
		/>
	);
}

function FolderCreateActions(props: MobileWorkspaceActionSheetProps) {
	const { mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<>
			<ActionRow
				icon={
					<FilePlus
						color={mobileColors.textMuted}
						size={desktopToolbarActionParity.iconSize}
					/>
				}
				label={mobileText("sidebar.action.createNodeInFolderMenu")}
				testID="workspace-action-create-note-in-folder"
				onPress={props.onOpenCreateNoteInFolder}
			/>
			<ActionRow
				icon={
					<FolderOpen
						color={mobileColors.textMuted}
						size={desktopToolbarActionParity.iconSize}
					/>
				}
				label={mobileText("sidebar.action.createFolder")}
				testID="workspace-action-create-child-folder"
				onPress={props.onOpenCreateChildFolder}
			/>
			<ActionRow
				icon={
					<ClipboardText
						color={mobileColors.textMuted}
						size={desktopToolbarActionParity.iconSize}
					/>
				}
				label={mobileText("sidebar.action.copyFolderPathMenu")}
				testID="workspace-action-copy-folder-path"
				onPress={props.onCopyFolderPath}
			/>
		</>
	);
}

function FolderPathActions(props: MobileWorkspaceActionSheetProps) {
	const { mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<>
			<ActionRow
				icon={
					<ArrowSquareOut
						color={mobileColors.textMuted}
						size={desktopToolbarActionParity.iconSize}
					/>
				}
				label={mobileText("sidebar.action.revealFolderMenu")}
				testID="workspace-action-reveal-folder"
				onPress={props.onRevealFolder}
			/>
			<ActionRow
				destructive
				icon={
					<Trash
						color={mobileColors.red}
						size={desktopToolbarActionParity.iconSize}
					/>
				}
				label={mobileText("sidebar.action.deleteFolder")}
				testID="workspace-action-delete-folder"
				onPress={() =>
					showNativeConfirmation({
						cancelLabel: mobileText("common.cancel"),
						confirmLabel: mobileText("sidebar.action.deleteFolder"),
						message: props.folderPath,
						onConfirm: props.onDeleteFolder,
						title: mobileText("sidebar.action.deleteFolder"),
					})
				}
			/>
		</>
	);
}

export function MobileWorkspaceFolderActionsContent(
	props: MobileWorkspaceActionSheetProps,
) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<ScrollView
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
			style={styles.scrollArea}
		>
			<FolderNameAction {...props} />
			<FolderCreateActions {...props} />
			<FolderPathActions {...props} />
			<SheetFooter>
				<MobileButton
					label={mobileText("common.cancel")}
					variant="ghost"
					onPress={props.onClose}
				/>
				<MobileButton
					disabled={props.folderName.trim().length === 0}
					label={mobileText("common.save")}
					variant="primary"
					onPress={props.onRenameFolder}
				/>
			</SheetFooter>
		</ScrollView>
	);
}
