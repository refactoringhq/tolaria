import MenuView from "@expo/ui/community/menu";
import { FolderOpen, MagnifyingGlass } from "phosphor-react-native";
import type { ReactNode } from "react";
import { Platform, View } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import type { MobileLayoutProbe } from "../../qa/mobileLayoutProbe";
import { MobileButton } from "../../ui/MobileButton";
import { MobileChip } from "../../ui/MobileChip";
import { MobileListRow } from "../../ui/MobileListRow";
import {
	useMobileColors,
	useMobileStyles,
} from "../../ui/theme/useMobileTheme";
import type { MobileNeighborhoodGroup } from "../../workspace/mobileNeighborhood";
import { mobileNoteRowChips } from "../../workspace/mobileNoteDisplay";
import type {
	MobileNote,
	MobilePropertyDisplayMode,
	MobileTypeDefinitions,
} from "../../workspace/mobileWorkspaceModel";
import { Text } from "../ui/text";
import { createThemeStyles } from "./MobileNoteListPanel.styles";
import { mobileNoteListEmptyStateChrome } from "./MobileNoteListPanelChrome";
import { MobilePendingNoteIndicator } from "./MobilePendingNoteIndicator";
import type { MobileNoteRowActions } from "./MobileSwipeableNoteRow";
import { MobileSwipeableNoteRow } from "./MobileSwipeableNoteRow";
import { MobileTypeIcon } from "./MobileWorkspaceIcons";
import {
	mobileNoteContextActions,
	runMobileNoteContextAction,
} from "./mobileNoteContextMenuModel";
import { noteTypeSoftColor } from "./mobileWorkspaceTone";

export type MobileNoteListRowProps = {
	rowActions?: MobileNoteRowActions;
	activeNoteId: string | null;
	displayPropertyKeys: string[];
	forceSelected?: boolean;
	layoutProbe: MobileLayoutProbe;
	multiSelected?: boolean;
	note: MobileNote;
	onBeginSelection?: (noteId: string) => void;
	onSelectNote: (noteId: string) => void;
	propertyDisplayModes?: Record<string, MobilePropertyDisplayMode> | null;
	typeDefinitions?: MobileTypeDefinitions;
};

export function MobileNoteListRow(props: MobileNoteListRowProps) {
	return (
		<NoteContextMenu
			actions={props.rowActions}
			archived={Boolean(props.note.archived)}
			favorite={props.note.favorite}
			noteId={props.note.id}
			onBeginSelection={props.onBeginSelection}
			title={props.note.title}
		>
			<NoteRowContents {...props} />
		</NoteContextMenu>
	);
}

function NoteRowContents(props: MobileNoteListRowProps) {
	const colors = useMobileColors();
	const note = props.note;
	return (
		<MobileSwipeableNoteRow actions={props.rowActions} note={note}>
			<MobileListRow
				chips={
					<NoteRowChips
						displayPropertyKeys={props.displayPropertyKeys}
						note={note}
						propertyDisplayModes={props.propertyDisplayModes}
						typeDefinitions={props.typeDefinitions}
					/>
				}
				leading={<MobilePendingNoteIndicator note={note} />}
				layoutProbe={props.layoutProbe}
				metricId={`noteList.item.${note.id}`}
				multiSelected={props.multiSelected ?? false}
				selected={props.forceSelected || note.id === props.activeNoteId}
				selectedBackgroundColor={noteTypeSoftColor(note.typeTone, colors)}
				subtitle={note.snippet}
				testID={`note-row-${note.id}`}
				title={note.title}
				trailing={
					<MobileTypeIcon
						fileKind={note.fileKind}
						size={16}
						tone={note.typeTone}
						type={note.type}
						typeDefinitions={props.typeDefinitions}
					/>
				}
				onLongPress={
					Platform.OS === "ios"
						? undefined
						: props.onBeginSelection
							? () => props.onBeginSelection?.(note.id)
							: undefined
				}
				onPress={() => props.onSelectNote(note.id)}
			/>
		</MobileSwipeableNoteRow>
	);
}

function NoteContextMenu(props: {
	actions?: MobileNoteRowActions;
	archived: boolean;
	children: ReactNode;
	favorite: boolean;
	noteId: string;
	onBeginSelection?: (noteId: string) => void;
	title: string;
}) {
	if (Platform.OS !== "ios" || !props.actions) return props.children;
	return (
		<MenuView
			actions={mobileNoteContextActions({
				archived: props.archived,
				favorite: props.favorite,
				selectionEnabled: Boolean(props.onBeginSelection),
			})}
			onPressAction={({ nativeEvent }) =>
				runMobileNoteContextAction(nativeEvent.event, {
					actions: props.actions,
					archived: props.archived,
					noteId: props.noteId,
					onBeginSelection: props.onBeginSelection,
				})
			}
			shouldOpenOnLongPress
			testID={`note-context-menu-${props.noteId}`}
			title={props.title}
		>
			{props.children}
		</MenuView>
	);
}

function NoteRowChips({
	displayPropertyKeys,
	note,
	propertyDisplayModes,
	typeDefinitions,
}: {
	displayPropertyKeys: string[];
	note: MobileNote;
	propertyDisplayModes?: Record<string, MobilePropertyDisplayMode> | null;
	typeDefinitions?: MobileTypeDefinitions;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	const chips = mobileNoteRowChips(
		note,
		displayPropertyKeys,
		typeDefinitions,
		propertyDisplayModes,
	);
	if (chips.length === 0) return null;

	return (
		<View style={styles.chipRow}>
			{chips.map((chip, index) => (
				<MobileChip
					density="list"
					key={`${chip.label}-${index}`}
					label={chip.label}
					tone={chip.tone}
				/>
			))}
		</View>
	);
}

export function NoteListEmptyState({
	emptyVault,
	onOpenVault,
	searchQuery,
}: {
	emptyVault: boolean;
	onOpenVault?: () => void;
	searchQuery?: string;
}) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	const chrome = mobileNoteListEmptyStateChrome({ emptyVault, searchQuery });

	return (
		<View style={styles.emptyState}>
			<Text style={styles.emptyTitle}>{mobileText(chrome.titleKey)}</Text>
			{chrome.detailKey ? (
				<Text style={styles.emptyText}>{mobileText(chrome.detailKey)}</Text>
			) : null}
			{chrome.action === "openVault" && onOpenVault ? (
				<MobileButton
					icon={<FolderOpen color={mobileColors.text} size={16} />}
					label={mobileText("status.vault.openLocal")}
					style={styles.emptyAction}
					testID="note-list-empty-open-vault"
					onPress={onOpenVault}
				/>
			) : null}
		</View>
	);
}

export function SearchPill({ searchQuery }: { searchQuery: string }) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<View style={styles.searchPill}>
			<MagnifyingGlass color={mobileColors.textMuted} size={16} />
			<Text numberOfLines={1} style={styles.searchText}>
				{searchQuery}
			</Text>
		</View>
	);
}

export function MobileRelationshipGroupHeader({
	group,
}: {
	group: MobileNeighborhoodGroup;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<View style={styles.groupHeader} testID={`relationship-group-${group.id}`}>
			<Text style={styles.groupLabel}>{group.label}</Text>
			<Text style={styles.groupCount}>{group.notes.length}</Text>
		</View>
	);
}
