import { type ReactElement, useMemo } from "react";
import { FlatList, type RefreshControlProps, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileText } from "../../i18n/mobileText";
import type { MobileLayoutProbe } from "../../qa/mobileLayoutProbe";
import { PhoneNoteListLargeTitle } from "../../screens/PhoneNoteListLargeTitle";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import type { MobileNeighborhood } from "../../workspace/mobileNeighborhood";
import type { MobileNoteListFilter } from "../../workspace/mobileNoteFilters";
import type {
	MobileNote,
	MobilePropertyDisplayMode,
	MobileTypeDefinitions,
} from "../../workspace/mobileWorkspaceModel";
import { Button } from "../ui/button";
import { Text } from "../ui/text";
import { MobileNoteListBulkActionBar } from "./MobileNoteListBulkActionBar";
import {
	MobileNoteListRow,
	MobileRelationshipGroupHeader,
	NoteListEmptyState,
} from "./MobileNoteListItems";
import { createThemeStyles } from "./MobileNoteListPanel.styles";
import { mobileNoteListFilterOptions } from "./MobileNoteListPanelChrome";
import type { MobileNoteRowActions } from "./MobileSwipeableNoteRow";
import { mobileNoteListSelectionIsArchived } from "./mobileNoteListBulkSelection";
import {
	type MobileNeighborhoodRow,
	mobileNeighborhoodRows,
} from "./mobileNoteListRows";
import { mobilePaneFooterFrame } from "./mobilePaneFooterLayout";
import type {
	MobileNoteListBulkActions,
	useMobileNoteListBulkSelection,
} from "./useMobileNoteListSelection";

type ListProps = {
	rowActions?: MobileNoteRowActions;
	activeNoteId: string | null;
	bulkSelection: ReturnType<typeof useMobileNoteListBulkSelection>;
	displayPropertyKeys: string[];
	emptyVault: boolean;
	layoutProbe: MobileLayoutProbe;
	neighborhood: MobileNeighborhood | null;
	notes: MobileNote[];
	onOpenVault?: () => void;
	onSelectNote: (noteId: string) => void;
	propertyDisplayModes?: Record<string, MobilePropertyDisplayMode> | null;
	searchQuery?: string;
	refreshControl?: ReactElement<RefreshControlProps>;
	selectedNoteId: string | null;
	phoneTitle?: string;
	onScrollOffset?: (offset: number) => void;
	typeDefinitions?: MobileTypeDefinitions;
};

export function MobileNoteListPanelContent(props: ListProps) {
	return props.neighborhood ? (
		<NeighborhoodList {...props} neighborhood={props.neighborhood} />
	) : (
		<StandardList {...props} />
	);
}

function StandardList(props: ListProps) {
	const { styles } = useMobileStyles(createThemeStyles);
	const selection = props.bulkSelection;
	return (
		<FlatList
			{...props.layoutProbe("noteList.list")}
			contentContainerStyle={styles.listContent}
			data={props.notes}
			extraData={selection.rowExtraData(props.selectedNoteId)}
			initialNumToRender={16}
			keyExtractor={(note) => note.id}
			ListEmptyComponent={
				<NoteListEmptyState
					emptyVault={props.emptyVault}
					searchQuery={props.searchQuery}
					onOpenVault={props.onOpenVault}
				/>
			}
			ListHeaderComponent={
				props.phoneTitle ? (
					<PhoneNoteListLargeTitle title={props.phoneTitle} />
				) : undefined
			}
			refreshControl={props.refreshControl}
			onScroll={
				props.onScrollOffset
					? (event) => props.onScrollOffset?.(event.nativeEvent.contentOffset.y)
					: undefined
			}
			scrollEventThrottle={16}
			renderItem={({ item: note }) => <StandardRow props={props} note={note} />}
			removeClippedSubviews
			showsVerticalScrollIndicator={false}
			windowSize={5}
		/>
	);
}

function StandardRow(props: { props: ListProps; note: MobileNote }) {
	const selection = props.props.bulkSelection;
	return (
		<MobileNoteListRow
			rowActions={
				selection.selectedNotes.length === 0
					? props.props.rowActions
					: undefined
			}
			activeNoteId={props.props.activeNoteId}
			displayPropertyKeys={props.props.displayPropertyKeys}
			layoutProbe={props.props.layoutProbe}
			multiSelected={selection.selectedNoteIds.has(props.note.id)}
			note={props.note}
			onBeginSelection={selection.beginSelection}
			propertyDisplayModes={props.props.propertyDisplayModes}
			typeDefinitions={props.props.typeDefinitions}
			onSelectNote={selection.pressNote}
		/>
	);
}

export function MobileNoteListPanelBulkSelectionBar(props: {
	bulkActions?: MobileNoteListBulkActions;
	bulkSelection: ReturnType<typeof useMobileNoteListBulkSelection>;
}) {
	const selection = props.bulkSelection;
	if (!props.bulkActions || selection.selectedNotes.length === 0) return null;
	return (
		<MobileNoteListBulkActionBar
			archivedMode={mobileNoteListSelectionIsArchived(selection.selectedNotes)}
			count={selection.selectedNotes.length}
			onArchiveToggle={selection.archiveSelected}
			onClear={selection.clearSelection}
			onDelete={selection.deleteSelected}
			onOrganize={selection.organizeSelected}
		/>
	);
}

export function MobileNoteListPanelFilterPills(props: {
	active: MobileNoteListFilter;
	counts: Record<MobileNoteListFilter, number>;
	onChange: (filter: MobileNoteListFilter) => void;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	const { bottom } = useSafeAreaInsets();
	return (
		<View
			accessibilityRole="tablist"
			style={[styles.filterBar, mobilePaneFooterFrame(bottom)]}
			testID="note-list-filter-pills"
		>
			{mobileNoteListFilterOptions.map((option) => (
				<FilterPill key={option.value} option={option} props={props} />
			))}
		</View>
	);
}

function FilterPill(props: {
	option: (typeof mobileNoteListFilterOptions)[number];
	props: {
		active: MobileNoteListFilter;
		counts: Record<MobileNoteListFilter, number>;
		onChange: (filter: MobileNoteListFilter) => void;
	};
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	const selected = props.props.active === props.option.value;
	const label = mobileText(props.option.labelKey);
	return (
		<Button
			accessibilityLabel={label}
			accessibilityRole="tab"
			accessibilityState={{ selected }}
			className="shadow-none"
			size="sm"
			style={[styles.filterPill, selected ? styles.filterPillSelected : null]}
			testID={`filter-pill-${props.option.value}`}
			variant="ghost"
			onPress={() => props.props.onChange(props.option.value)}
		>
			<Text
				style={[
					styles.filterPillText,
					selected ? styles.filterPillTextSelected : null,
				]}
			>
				{label}
			</Text>
			<Text
				style={[
					styles.filterPillCount,
					selected ? styles.filterPillCountSelected : null,
				]}
			>
				{props.props.counts[props.option.value].toLocaleString()}
			</Text>
		</Button>
	);
}

function NeighborhoodList(
	props: ListProps & { neighborhood: MobileNeighborhood },
) {
	const { styles } = useMobileStyles(createThemeStyles);
	const rows = useMemo(
		() => mobileNeighborhoodRows(props.neighborhood),
		[props.neighborhood],
	);
	return <NeighborhoodListRows props={props} rows={rows} styles={styles} />;
}

function NeighborhoodListRows(props: {
	props: ListProps;
	rows: MobileNeighborhoodRow[];
	styles: ReturnType<typeof createThemeStyles>["styles"];
}) {
	return (
		<FlatList
			contentContainerStyle={props.styles.listContent}
			data={props.rows}
			ListHeaderComponent={
				props.props.phoneTitle ? (
					<PhoneNoteListLargeTitle title={props.props.phoneTitle} />
				) : undefined
			}
			extraData={props.props.activeNoteId}
			initialNumToRender={18}
			keyExtractor={(row) => row.id}
			refreshControl={props.props.refreshControl}
			onScroll={
				props.props.onScrollOffset
					? (event) =>
							props.props.onScrollOffset?.(event.nativeEvent.contentOffset.y)
					: undefined
			}
			scrollEventThrottle={16}
			renderItem={({ item }) => (
				<NeighborhoodRow props={props.props} item={item} />
			)}
			removeClippedSubviews
			showsVerticalScrollIndicator={false}
			windowSize={5}
		/>
	);
}

function NeighborhoodRow(props: {
	props: ListProps;
	item: MobileNeighborhoodRow;
}) {
	if (props.item.kind === "header")
		return <MobileRelationshipGroupHeader group={props.item.group} />;
	return (
		<MobileNoteListRow
			rowActions={props.props.rowActions}
			activeNoteId={props.props.activeNoteId}
			displayPropertyKeys={props.props.displayPropertyKeys}
			forceSelected={props.item.kind === "source"}
			layoutProbe={props.props.layoutProbe}
			note={props.item.note}
			propertyDisplayModes={props.props.propertyDisplayModes}
			typeDefinitions={props.props.typeDefinitions}
			onSelectNote={props.props.onSelectNote}
		/>
	);
}
