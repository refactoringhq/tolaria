import { type ReactElement, useMemo } from 'react'
import { FlatList, type RefreshControlProps } from 'react-native'
import type { MobileLayoutProbe } from '../../qa/mobileLayoutProbe'
import { useMobileStyles } from '../../ui/theme/useMobileTheme'
import type { MobileNeighborhood } from '../../workspace/mobileNeighborhood'
import type {
	MobileNote,
	MobilePropertyDisplayMode,
	MobileTypeDefinitions,
} from '../../workspace/mobileWorkspaceModel'
import { MobileNoteListRow, MobileRelationshipGroupHeader, NoteListEmptyState } from './MobileNoteListItems'
import { createThemeStyles } from './MobileNoteListPanel.styles'
import type { MobileNoteRowActions } from './MobileSwipeableNoteRow'
import { type MobileNeighborhoodRow, mobileNeighborhoodRows } from './mobileNoteListRows'
import type { useMobileNoteListBulkSelection } from './useMobileNoteListSelection'

export type MobileNoteListScrollContentProps = {
	rowActions?: MobileNoteRowActions
	activeNoteId: string | null
	bulkSelection: ReturnType<typeof useMobileNoteListBulkSelection>
	displayPropertyKeys: string[]
	emptyVault: boolean
	layoutProbe: MobileLayoutProbe
	neighborhood: MobileNeighborhood | null
	notes: MobileNote[]
	onOpenVault?: () => void
	onSelectNote: (noteId: string) => void
	propertyDisplayModes?: Record<string, MobilePropertyDisplayMode> | null
	searchQuery?: string
	scrollsToTop: boolean
	refreshControl?: ReactElement<RefreshControlProps>
	selectedNoteId: string | null
	typeDefinitions?: MobileTypeDefinitions
}

export function MobileNoteListScrollContent(props: MobileNoteListScrollContentProps) {
	const { styles } = useMobileStyles(createThemeStyles)
	const {
		activeNoteId, bulkSelection, displayPropertyKeys, emptyVault, layoutProbe,
		neighborhood, notes, onOpenVault, propertyDisplayModes,
		searchQuery, scrollsToTop, refreshControl, selectedNoteId, typeDefinitions,
	} = props
	if (neighborhood) {
		return <NeighborhoodNoteList {...props} neighborhood={neighborhood} />
	}

	return (
		<FlatList
			{...layoutProbe('noteList.list')}
			contentContainerStyle={styles.listContent}
			data={notes}
			extraData={bulkSelection.rowExtraData(selectedNoteId)}
			initialNumToRender={16}
			keyExtractor={(note) => note.id}
			ListEmptyComponent={<NoteListEmptyState emptyVault={emptyVault} searchQuery={searchQuery} onOpenVault={onOpenVault} />}
			refreshControl={refreshControl}
			scrollsToTop={scrollsToTop}
			renderItem={({ item: note }) => (
				<MobileNoteListRow
					{...{
						rowActions: bulkSelection.selectedNotes.length === 0 ? props.rowActions : undefined,
						activeNoteId, displayPropertyKeys, layoutProbe,
						multiSelected: bulkSelection.selectedNoteIds.has(note.id), note,
						onBeginSelection: bulkSelection.beginSelection, propertyDisplayModes,
						typeDefinitions, onSelectNote: bulkSelection.pressNote,
					}}
				/>
			)}
			removeClippedSubviews
			showsVerticalScrollIndicator={false}
			windowSize={5}
		/>
	)
}

function NeighborhoodNoteList(props: MobileNoteListScrollContentProps & { neighborhood: MobileNeighborhood }) {
	const { styles } = useMobileStyles(createThemeStyles)
	const rows = useMemo(() => mobileNeighborhoodRows(props.neighborhood), [props.neighborhood])
	return (
		<FlatList
			contentContainerStyle={styles.listContent}
			data={rows}
			extraData={props.activeNoteId}
			initialNumToRender={18}
			keyExtractor={(row) => row.id}
			refreshControl={props.refreshControl}
			scrollsToTop={props.scrollsToTop}
			renderItem={({ item }) => neighborhoodRow(props, item)}
			removeClippedSubviews
			showsVerticalScrollIndicator={false}
			windowSize={5}
		/>
	)
}

function neighborhoodRow(props: MobileNoteListScrollContentProps, item: MobileNeighborhoodRow) {
	if (item.kind === 'header') return <MobileRelationshipGroupHeader group={item.group} />
	return (
		<MobileNoteListRow
			{...{
				rowActions: props.rowActions, activeNoteId: props.activeNoteId,
				displayPropertyKeys: props.displayPropertyKeys,
				forceSelected: item.kind === 'source', layoutProbe: props.layoutProbe,
				note: item.note, propertyDisplayModes: props.propertyDisplayModes,
				typeDefinitions: props.typeDefinitions, onSelectNote: props.onSelectNote,
			}}
		/>
	)
}
