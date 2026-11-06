import { type ReactNode, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { desktopToolbarActionParity } from "../../ui/desktopParity";
import { MobileButton } from "../../ui/MobileButton";
import { MobileChip } from "../../ui/MobileChip";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { useMobileDeviceLayout } from "../../ui/useMobileDeviceLayout";
import type { MobileNote } from "../../workspace/mobileWorkspaceModel";
import { Button } from "../ui/button";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { Text } from "../ui/text";
import {
	type NoteActionGroup,
	NoteMoreActionRows,
} from "./MobileNoteMoreActions";
import {
	isMobileMarkdownActionNote,
	isMobileTextLikeActionNote,
} from "./MobileNoteMoreActionsModel";
import { MobileSourceBlockMoreActions } from "./MobileSourceBlockMoreActions";
import { MobileTableMoreActions } from "./MobileTableMoreActions";
import { MobileWhiteboardMoreActions } from "./MobileWhiteboardMoreActions";
import type { MobileWorkspaceActionSheetProps } from "./MobileWorkspaceActionSheet";
import { MobileTypeIcon } from "./MobileWorkspaceIcons";
import { chipTone } from "./mobileWorkspaceTone";

export function MoreActionsContent(props: MobileWorkspaceActionSheetProps) {
	const { styles } = useMobileStyles(createThemeStyles);
	const [selectedGroup, setSelectedGroup] = useState<NoteActionGroup>("note");
	const { selectedNote } = props;
	if (!selectedNote) return <MoreActionsScroll />;
	const groups = noteActionGroups(selectedNote);
	const group = groups.includes(selectedGroup) ? selectedGroup : "file";

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<SelectedNoteSummary
					note={selectedNote}
					typeDefinitions={props.typeDefinitions}
				/>
				<View accessibilityRole="tablist" style={styles.groups}>
					{groups.map((value) => (
						<MobileButton
							accessibilityRole="tab"
							accessibilityState={{ selected: group === value }}
							key={value}
							label={mobileText(groupLabelKeys[value])}
							onPress={() => setSelectedGroup(value)}
							style={styles.group}
							testID={`workspace-action-group-${value}`}
							variant={group === value ? "secondary" : "ghost"}
						/>
					))}
				</View>
			</View>
			<MoreActionsScroll key={group}>
				<SelectedNoteActionRows
					group={group}
					note={selectedNote}
					props={props}
				/>
				{isMobileMarkdownActionNote(selectedNote) ? (
					<MarkdownNoteMoreActionRows
						group={group}
						note={selectedNote}
						props={props}
					/>
				) : null}
				{group === "file" ? (
					<DeepLinkActionRow
						onClose={props.onClose}
						onCopyDeepLink={props.onCopyDeepLink}
					/>
				) : null}
			</MoreActionsScroll>
		</View>
	);
}

const groupLabelKeys = {
	note: "menu.note",
	edit: "menu.edit",
	file: "menu.file",
} as const;

function noteActionGroups(note: MobileNote): NoteActionGroup[] {
	if (isMobileMarkdownActionNote(note)) return ["note", "edit", "file"];
	return isMobileTextLikeActionNote(note) ? ["edit", "file"] : ["file"];
}

function MoreActionsScroll({ children }: { children?: ReactNode }) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<ScrollView
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
			style={styles.scrollArea}
		>
			{children}
		</ScrollView>
	);
}

function SelectedNoteActionRows({
	group,
	note,
	props,
}: {
	group: NoteActionGroup;
	note: MobileNote;
	props: MobileWorkspaceActionSheetProps;
}) {
	return (
		<NoteMoreActionRows
			group={group}
			note={note}
			canRedoWorkspaceEdit={props.canRedoWorkspaceEdit}
			canUndoWorkspaceEdit={props.canUndoWorkspaceEdit}
			onClose={props.onClose}
			onCopyFilePath={props.onCopyFilePath}
			onDeleteNote={props.onDeleteNote}
			onEnterNeighborhood={props.onEnterNeighborhood}
			onOpenFileInDefaultApp={props.onOpenFileInDefaultApp}
			onOpenFindInNote={props.onOpenFindInNote}
			onOpenMoveNoteToFolder={props.onOpenMoveNoteToFolder}
			onOpenReplaceInNote={props.onOpenReplaceInNote}
			onOpenRenameNoteFile={props.onOpenRenameNoteFile}
			onRenameNoteFileToTitle={props.onRenameNoteFileToTitle}
			onRedoWorkspaceEdit={props.onRedoWorkspaceEdit}
			onRemoveNoteIcon={props.onRemoveNoteIcon}
			onSetArchived={props.onSetArchived}
			onSetOrganized={props.onSetOrganized}
			onToggleFavorite={props.onToggleFavorite}
			onToggleNoteWidth={props.onToggleNoteWidth}
			onUndoWorkspaceEdit={props.onUndoWorkspaceEdit}
		/>
	);
}

function MarkdownNoteMoreActionRows({
	group,
	note,
	props,
}: {
	group: NoteActionGroup;
	note: MobileNote;
	props: MobileWorkspaceActionSheetProps;
}) {
	const { mobileColors } = useMobileStyles(createThemeStyles);
	const phone = useMobileDeviceLayout() === "phone";
	if (group === "note") return null;
	if (group === "file")
		return (
			<MoreActionRow
				icon={
					<ChromeSymbol
						name="compose"
						color={mobileColors.textMuted}
						size={desktopToolbarActionParity.iconSize}
					/>
				}
				label={mobileText("command.note.exportPdf")}
				testID="workspace-action-export-pdf"
				onPress={() => {
					props.onExportNoteAsPdf();
					props.onClose();
				}}
			/>
		);
	return (
		<MarkdownNoteEditorActions
			note={note}
			phone={phone}
			props={props}
			mobileColors={mobileColors}
		/>
	);
}

function MarkdownNoteEditorActions({
	note,
	phone,
	props,
	mobileColors,
}: {
	note: MobileNote;
	phone: boolean;
	props: MobileWorkspaceActionSheetProps;
	mobileColors: MobileColors;
}) {
	return (
		<>
			{!phone ? (
				<MoreActionRow
					icon={
						<ChromeSymbol
							name="list"
							color={mobileColors.textMuted}
							size={desktopToolbarActionParity.iconSize}
						/>
					}
					label={mobileText("tableOfContents.title")}
					testID="workspace-action-table-of-contents"
					onPress={props.onOpenTableOfContents}
				/>
			) : null}
			<MobileTableMoreActions
				editorBlocks={props.editorBlocks}
				editorBullets={props.editorBullets}
				note={note}
				onClose={props.onClose}
				onUpdateNoteContent={props.onUpdateNoteContent}
			/>
			<MobileSourceBlockMoreActions
				editorBlocks={props.editorBlocks}
				editorBullets={props.editorBullets}
				note={note}
				onClose={props.onClose}
				onUpdateNoteContent={props.onUpdateNoteContent}
			/>
			<MobileWhiteboardMoreActions
				editorBlocks={props.editorBlocks}
				editorBullets={props.editorBullets}
				note={note}
				onClose={props.onClose}
				onUpdateNoteContent={props.onUpdateNoteContent}
			/>
		</>
	);
}

function DeepLinkActionRow({
	onClose,
	onCopyDeepLink,
}: {
	onClose: () => void;
	onCopyDeepLink: () => void;
}) {
	const { mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<MoreActionRow
			icon={
				<ChromeSymbol
					name="link"
					color={mobileColors.textMuted}
					size={desktopToolbarActionParity.iconSize}
				/>
			}
			label={mobileText("command.note.copyDeepLink")}
			testID="workspace-action-copy-deep-link"
			onPress={() => {
				onCopyDeepLink();
				onClose();
			}}
		/>
	);
}

function SelectedNoteSummary({
	note,
	typeDefinitions,
}: {
	note: MobileNote;
	typeDefinitions: MobileWorkspaceActionSheetProps["typeDefinitions"];
}) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<View style={styles.summary} testID="workspace-action-sheet-note-summary">
			<MobileTypeIcon
				size={desktopToolbarActionParity.iconSize}
				tone={note.typeTone}
				type={note.type}
				typeDefinitions={typeDefinitions}
			/>
			<Text numberOfLines={1} style={styles.summaryTitle}>
				{note.title}
			</Text>
			{note.favorite ? (
				<ChromeSymbol
					name="starFilled"
					color={mobileColors.primary}
					size={desktopToolbarActionParity.iconSize}
				/>
			) : null}
			<MobileChip label={note.type} tone={chipTone(note.typeTone)} />
		</View>
	);
}

function MoreActionRow({
	icon,
	label,
	onPress,
	testID,
}: {
	icon: ReactNode;
	label: string;
	onPress: () => void;
	testID?: string;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<Button
			accessibilityLabel={label}
			variant="ghost"
			style={styles.actionRow}
			testID={testID}
			onPress={onPress}
		>
			<View style={styles.actionRowContent}>
				<View style={styles.actionIcon}>{icon}</View>
				<Text numberOfLines={1} style={styles.actionText}>
					{label}
				</Text>
			</View>
		</Button>
	);
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const styles = {
		...workspaceActionStyles(mobileColors, metrics),
		...workspaceMenuStyles(mobileColors, metrics),
	};
	return { mobileColors, styles };
}

function workspaceActionStyles(
	mobileColors: MobileColors,
	metrics: MobileMetrics,
) {
	const {
		toolbarAction: desktopToolbarActionParity,
		space: mobileSpace,
		type: mobileType,
	} = metrics;
	return StyleSheet.create({
		actionIcon: {
			width: desktopToolbarActionParity.iconSize,
			alignItems: "center",
		},
		actionRow: {
			minHeight: 44,
			justifyContent: "center",
			minWidth: 0,
			alignSelf: "stretch",
			width: "100%",
			borderRadius: 4,
			paddingHorizontal: mobileSpace.sm,
			paddingVertical: mobileSpace.sm,
		},
		actionRowContent: {
			minWidth: 0,
			flex: 1,
			flexDirection: "row",
			alignItems: "center",
			gap: mobileSpace.sm,
		},
		actionText: {
			minWidth: 0,
			flex: 1,
			flexShrink: 1,
			color: mobileColors.text,
			fontSize: mobileType.body,
		},
	});
}

function workspaceMenuStyles(
	mobileColors: MobileColors,
	metrics: MobileMetrics,
) {
	const { space: mobileSpace, type: mobileType } = metrics;
	return StyleSheet.create({
		content: {
			gap: mobileSpace.xs,
			padding: mobileSpace.md,
		},
		container: {
			flexShrink: 1,
			minHeight: 0,
		},
		header: {
			paddingHorizontal: mobileSpace.md,
			paddingTop: mobileSpace.md,
			gap: mobileSpace.sm,
		},
		groups: {
			flexDirection: "row",
			gap: mobileSpace.xs,
		},
		group: {
			flex: 1,
			minWidth: 0,
			minHeight: 44,
		},
		scrollArea: {
			flexShrink: 1,
		},
		summary: {
			minWidth: 0,
			alignItems: "center",
			flexDirection: "row",
			gap: mobileSpace.sm,
			borderBottomColor: mobileColors.border,
			borderBottomWidth: StyleSheet.hairlineWidth,
			paddingBottom: mobileSpace.md,
		},
		summaryTitle: {
			minWidth: 0,
			flex: 1,
			color: mobileColors.text,
			fontSize: mobileType.body,
			fontWeight: "500",
		},
	});
}
