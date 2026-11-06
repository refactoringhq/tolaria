import type { ReactNode } from "react";
import { mobileText } from "../../i18n/mobileText";
import { desktopToolbarActionParity } from "../../ui/desktopParity";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import type { MobileNote } from "../../workspace/mobileWorkspaceModel";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { ActionRow, DeleteActionRow } from "./MobileNoteMoreActionRow";
import { createThemeStyles } from "./MobileNoteMoreActionRow.styles";
import {
	isMobileMarkdownActionNote,
	isMobileTextLikeActionNote,
} from "./MobileNoteMoreActionsModel";

export type NoteActionGroup = "note" | "edit" | "file";

type NoteMoreActionRowsProps = {
	group: NoteActionGroup;
	canRedoWorkspaceEdit: boolean;
	canUndoWorkspaceEdit: boolean;
	note: MobileNote;
	onClose: () => void;
	onDeleteNote: () => void;
	onEnterNeighborhood: (noteId: string) => void;
	onCopyFilePath: () => void;
	onOpenFileInDefaultApp: () => void;
	onOpenFindInNote: () => void;
	onOpenMoveNoteToFolder: () => void;
	onOpenReplaceInNote: () => void;
	onOpenRenameNoteFile: () => void;
	onRenameNoteFileToTitle: () => void;
	onRedoWorkspaceEdit: () => void;
	onRemoveNoteIcon: () => void;
	onSetArchived: (archived: boolean) => void;
	onSetOrganized: (organized: boolean) => void;
	onToggleFavorite: () => void;
	onToggleNoteWidth: () => void;
	onUndoWorkspaceEdit: () => void;
};

export function NoteMoreActionRows(props: NoteMoreActionRowsProps) {
	const { note } = props;
	if (!isMobileMarkdownActionNote(note))
		return <NonMarkdownFileActionRows {...props} />;

	if (props.group === "edit")
		return (
			<>
				<NoteEditorActionRows {...props} />
				<NoteHistoryActionRows {...props} />
			</>
		);
	if (props.group === "file") return <NoteFileActionRows {...props} />;

	return (
		<>
			<NoteStateActionRows {...props} />
			<NoteNavigationActionRows {...props} />
			<NoteIconActionRows {...props} />
			<NoteWidthActionRow
				noteWide={note.noteWidth === "wide"}
				onClose={props.onClose}
				onToggleNoteWidth={props.onToggleNoteWidth}
			/>
			<DeleteActionRow
				message={note.title}
				onClose={props.onClose}
				onDeleteNote={props.onDeleteNote}
			/>
		</>
	);
}

function NonMarkdownFileActionRows(props: NoteMoreActionRowsProps) {
	const {
		group,
		note,
		onClose,
		onCopyFilePath,
		onDeleteNote,
		onEnterNeighborhood,
		onOpenFileInDefaultApp,
		onOpenFindInNote,
		onOpenReplaceInNote,
	} = props;
	const { mobileColors } = useMobileStyles(createThemeStyles);
	if (group === "edit")
		return (
			<NoteEditorActionRows
				onOpenFindInNote={onOpenFindInNote}
				onOpenReplaceInNote={onOpenReplaceInNote}
			/>
		);
	return (
		<>
			{isMobileTextLikeActionNote(note) ? (
				<NoteNavigationActionRows
					note={note}
					onClose={onClose}
					onEnterNeighborhood={onEnterNeighborhood}
				/>
			) : null}
			<NotePathActionRows onClose={onClose} onCopyFilePath={onCopyFilePath} />
			<ActionRow
				icon={
					<ChromeSymbol
						name="share"
						color={mobileColors.textMuted}
						size={desktopToolbarActionParity.iconSize}
					/>
				}
				label={mobileText("editor.toolbar.openFileInDefaultApp")}
				testID="workspace-action-open-default-app"
				onPress={() => {
					onOpenFileInDefaultApp();
					onClose();
				}}
			/>
			<DeleteActionRow
				message={note.title}
				onClose={onClose}
				onDeleteNote={onDeleteNote}
			/>
		</>
	);
}

function NoteHistoryActionRows({
	canRedoWorkspaceEdit,
	canUndoWorkspaceEdit,
	onClose,
	onRedoWorkspaceEdit,
	onUndoWorkspaceEdit,
}: {
	canRedoWorkspaceEdit: boolean;
	canUndoWorkspaceEdit: boolean;
	onClose: () => void;
	onRedoWorkspaceEdit: () => void;
	onUndoWorkspaceEdit: () => void;
}) {
	const { mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<>
			{canUndoWorkspaceEdit ? (
				<ActionRow
					icon={
						<ChromeSymbol
							name="undo"
							color={mobileColors.textMuted}
							size={desktopToolbarActionParity.iconSize}
						/>
					}
					label={mobileText("command.note.undo")}
					testID="workspace-action-undo-edit"
					onPress={() => {
						onUndoWorkspaceEdit();
						onClose();
					}}
				/>
			) : null}
			{canRedoWorkspaceEdit ? (
				<ActionRow
					icon={
						<ChromeSymbol
							name="redo"
							color={mobileColors.textMuted}
							size={desktopToolbarActionParity.iconSize}
						/>
					}
					label={mobileText("command.note.redo")}
					testID="workspace-action-redo-edit"
					onPress={() => {
						onRedoWorkspaceEdit();
						onClose();
					}}
				/>
			) : null}
		</>
	);
}

function NoteStateActionRows({
	note,
	onClose,
	onSetArchived,
	onSetOrganized,
	onToggleFavorite,
}: {
	note: MobileNote;
	onClose: () => void;
	onSetArchived: (archived: boolean) => void;
	onSetOrganized: (organized: boolean) => void;
	onToggleFavorite: () => void;
}) {
	const { mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<>
			<NoteFlagActionRow
				active={note.favorite === true}
				activeLabelKey="command.note.removeFavorite"
				icon={
					<ChromeSymbol
						name={note.favorite ? "starFilled" : "star"}
						color={mobileColors.textMuted}
						size={desktopToolbarActionParity.iconSize}
					/>
				}
				inactiveLabelKey="command.note.addFavorite"
				testID="workspace-action-toggle-favorite"
				onPress={() => {
					onToggleFavorite();
					onClose();
				}}
			/>
			<NoteFlagActionRow
				active={note.organized === true}
				activeLabelKey="command.note.markUnorganized"
				icon={
					<ChromeSymbol
						name="organize"
						color={mobileColors.textMuted}
						size={desktopToolbarActionParity.iconSize}
					/>
				}
				inactiveLabelKey="command.note.markOrganized"
				testID="workspace-action-organize-note"
				onPress={() => {
					onSetOrganized(!note.organized);
					onClose();
				}}
			/>
			<NoteFlagActionRow
				active={note.archived === true}
				activeLabelKey="command.note.unarchiveNote"
				icon={
					<ChromeSymbol
						name="archive"
						color={mobileColors.textMuted}
						size={desktopToolbarActionParity.iconSize}
					/>
				}
				inactiveLabelKey="command.note.archiveNote"
				testID="workspace-action-archive-note"
				onPress={() => {
					onSetArchived(!note.archived);
					onClose();
				}}
			/>
		</>
	);
}

function NoteEditorActionRows({
	onOpenFindInNote,
	onOpenReplaceInNote,
}: {
	onOpenFindInNote: () => void;
	onOpenReplaceInNote: () => void;
}) {
	const { mobileColors } = useMobileStyles(createThemeStyles);
	const actions = [
		{
			symbol: "search",
			label: "command.note.findInNote",
			id: "find",
			onPress: onOpenFindInNote,
		},
		{
			symbol: "text",
			label: "command.note.replaceInNote",
			id: "replace",
			onPress: onOpenReplaceInNote,
		},
	] as const;
	return actions.map(({ symbol, label, id, onPress }) => (
		<ActionRow
			key={id}
			icon={
				<ChromeSymbol
					name={symbol}
					color={mobileColors.textMuted}
					size={desktopToolbarActionParity.iconSize}
				/>
			}
			label={mobileText(label)}
			testID={`workspace-action-${id}-in-note`}
			onPress={onPress}
		/>
	));
}

function NoteNavigationActionRows({
	note,
	onClose,
	onEnterNeighborhood,
}: {
	note: MobileNote;
	onClose: () => void;
	onEnterNeighborhood: (noteId: string) => void;
}) {
	const { mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<ActionRow
			icon={
				<ChromeSymbol
					name="map"
					color={mobileColors.textMuted}
					size={desktopToolbarActionParity.iconSize}
				/>
			}
			label={mobileText("editor.toolbar.openNeighborhood")}
			testID="workspace-action-open-neighborhood"
			onPress={() => {
				onEnterNeighborhood(note.id);
				onClose();
			}}
		/>
	);
}

function NoteIconActionRows({
	note,
	onRemoveNoteIcon,
}: {
	note: MobileNote;
	onRemoveNoteIcon: () => void;
}) {
	const { mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<>
			{note.icon ? (
				<ActionRow
					icon={
						<ChromeSymbol
							name="face"
							color={mobileColors.textMuted}
							size={desktopToolbarActionParity.iconSize}
						/>
					}
					label={mobileText("command.note.removeIcon")}
					testID="workspace-action-remove-note-icon"
					onPress={onRemoveNoteIcon}
				/>
			) : null}
		</>
	);
}

function NoteFileActionRows({
	onClose,
	onCopyFilePath,
	onOpenMoveNoteToFolder,
	onOpenRenameNoteFile,
	onRenameNoteFileToTitle,
}: {
	onClose: () => void;
	onCopyFilePath: () => void;
	onOpenMoveNoteToFolder: () => void;
	onOpenRenameNoteFile: () => void;
	onRenameNoteFileToTitle: () => void;
}) {
	const { mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<>
			<ActionRow
				icon={
					<ChromeSymbol
						name="edit"
						color={mobileColors.textMuted}
						size={desktopToolbarActionParity.iconSize}
					/>
				}
				label={mobileText("editor.filename.rename")}
				testID="workspace-action-rename-file"
				onPress={onOpenRenameNoteFile}
			/>
			<ActionRow
				icon={
					<ChromeSymbol
						name="edit"
						color={mobileColors.textMuted}
						size={desktopToolbarActionParity.iconSize}
					/>
				}
				label={mobileText("editor.filename.renameToTitle")}
				testID="workspace-action-rename-file-to-title"
				onPress={() => {
					onRenameNoteFileToTitle();
					onClose();
				}}
			/>
			<ActionRow
				icon={
					<ChromeSymbol
						name="move"
						color={mobileColors.textMuted}
						size={desktopToolbarActionParity.iconSize}
					/>
				}
				label={mobileText("command.note.moveToFolder")}
				testID="workspace-action-move-note-folder"
				onPress={onOpenMoveNoteToFolder}
			/>
			<NotePathActionRows onClose={onClose} onCopyFilePath={onCopyFilePath} />
		</>
	);
}

function NotePathActionRows({
	onClose,
	onCopyFilePath,
}: Pick<NoteMoreActionRowsProps, "onClose" | "onCopyFilePath">) {
	const { mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<ActionRow
			icon={
				<ChromeSymbol
					name="copy"
					color={mobileColors.textMuted}
					size={desktopToolbarActionParity.iconSize}
				/>
			}
			label={mobileText("editor.toolbar.copyFilePath")}
			testID="workspace-action-copy-file-path"
			onPress={() => {
				onCopyFilePath();
				onClose();
			}}
		/>
	);
}

function NoteWidthActionRow({
	noteWide,
	onClose,
	onToggleNoteWidth,
}: {
	noteWide: boolean;
	onClose: () => void;
	onToggleNoteWidth: () => void;
}) {
	const { mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<ActionRow
			icon={
				noteWide ? (
					<ChromeSymbol
						name="widthCompact"
						color={mobileColors.textMuted}
						size={desktopToolbarActionParity.iconSize}
					/>
				) : (
					<ChromeSymbol
						name="width"
						color={mobileColors.textMuted}
						size={desktopToolbarActionParity.iconSize}
					/>
				)
			}
			label={mobileText(
				noteWide
					? "editor.toolbar.noteWidthNormal"
					: "editor.toolbar.noteWidthWide",
			)}
			testID="workspace-action-toggle-note-width"
			onPress={() => {
				onToggleNoteWidth();
				onClose();
			}}
		/>
	);
}

function NoteFlagActionRow({
	active,
	activeLabelKey,
	icon,
	inactiveLabelKey,
	onPress,
	testID,
}: {
	active: boolean;
	activeLabelKey: Parameters<typeof mobileText>[0];
	icon: ReactNode;
	inactiveLabelKey: Parameters<typeof mobileText>[0];
	onPress: () => void;
	testID: string;
}) {
	return (
		<ActionRow
			icon={icon}
			label={mobileText(active ? activeLabelKey : inactiveLabelKey)}
			testID={testID}
			onPress={onPress}
		/>
	);
}
