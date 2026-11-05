import { MagnifyingGlass } from 'phosphor-react-native'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { mobileCopy } from '../../i18n/mobileText'
import { useMobileLayoutProbe } from '../../qa/mobileLayoutProbe'
import { desktopPanelParity, desktopToolbarActionParity } from '../../ui/desktopParity'
import { MobileIconButton } from '../../ui/MobileIconButton'
import {
  MobilePanel,
  MobileToolbar,
  MobileToolbarSpacer,
  MobileToolbarTitle,
} from '../../ui/MobilePanel'
import { useMobileStyles } from '../../ui/theme/useMobileTheme'
import type { MobileNeighborhood } from '../../workspace/mobileNeighborhood'
import type { MobileNoteListFilter } from '../../workspace/mobileNoteFilters'
import type {
  MobileNote,
  MobilePropertyDisplayMode,
  MobileTypeDefinitions,
} from '../../workspace/mobileWorkspaceModel'
import { useMobilePullToSync } from '../../workspace/useMobilePullToSync'
import { MobileCreateNoteButton } from './MobileCreateNoteButton'
import { MobileNoteListBulkActionBar } from './MobileNoteListBulkActionBar'
import { SearchPill } from './MobileNoteListItems'
import { createThemeStyles } from './MobileNoteListPanel.styles'
import {
  mobileNoteListToolbarChrome,
} from './MobileNoteListPanelChrome'
import { MobileNoteListPanelFooter } from './MobileNoteListPanelFooter.internal'
import { MobileNoteListScrollContent } from './MobileNoteListScrollContent.internal'
import { mobileNoteListSelectionIsArchived } from './mobileNoteListBulkSelection'
import { mobileNoteListRowActions } from './mobileNoteListRows'
import {
  type MobileNoteListBulkActions,
  useMobileNoteListBulkSelection,
} from './useMobileNoteListSelection'

type MobileNoteListPanelProps = {
  bulkActions?: MobileNoteListBulkActions
  compact: boolean
  displayPropertyKeys?: string[]
  emptyVault?: boolean
  fullWidth?: boolean
  leading?: ReactNode
  toolbarTrailing?: ReactNode
  showCreateAction?: boolean
  layoutProbe?: boolean
  neighborhood?: MobileNeighborhood | null
  noteListFilter?: MobileNoteListFilter
  noteListFilterCounts?: Record<MobileNoteListFilter, number>
  noteListFilterVisible?: boolean
  notes: MobileNote[]
  onOpenCreateNote: () => void
  onOpenSearch: () => void
  onOpenVault?: () => void
  onNoteListFilterChange?: (filter: MobileNoteListFilter) => void
  onSelectNote: (noteId: string) => void
  onToggleNoteFavorite?: (noteId: string) => void
  propertyDisplayModes?: Record<string, MobilePropertyDisplayMode> | null
  searchQuery?: string
  scrollsToTop?: boolean
  selectedNoteId: string | null
  subtitle: string
  title?: string
  typeDefinitions?: MobileTypeDefinitions
}

export function MobileNoteListPanel(props: MobileNoteListPanelProps) {
  const themeStyles = useMobileStyles(createThemeStyles)
  const { bottom } = useSafeAreaInsets()
  const refreshControl = useMobilePullToSync()
  const {
    bulkActions,
    layoutProbe: layoutProbeEnabled = false,
    neighborhood = null,
    notes,
    onSelectNote,
    selectedNoteId,
  } = props
  const onFilterChange = noteListFilterAction(props)
  const activeNoteId = selectedNoteId ?? notes[0]?.id ?? null
  const layoutProbe = useMobileLayoutProbe(layoutProbeEnabled)
  const bulkSelection = useMobileNoteListBulkSelection({
    bulkActions,
    neighborhood,
    notes,
    onSelectNote,
  })

  return <MobileNoteListPanelFrame props={props} view={{
    activeNoteId,
    bottom,
    bulkSelection,
    layoutProbe,
    onFilterChange,
    refreshControl,
    themeStyles,
  }} />
}

type MobileNoteListPanelView = {
  activeNoteId: string | null
  bottom: number
  bulkSelection: ReturnType<typeof useMobileNoteListBulkSelection>
  layoutProbe: ReturnType<typeof useMobileLayoutProbe>
  onFilterChange: ((filter: MobileNoteListFilter) => void) | undefined
  refreshControl: ReturnType<typeof useMobilePullToSync>
  themeStyles: ReturnType<typeof createThemeStyles>
}

function MobileNoteListPanelFrame({ props, view }: { props: MobileNoteListPanelProps; view: MobileNoteListPanelView }) {
  return (
    <MobilePanel {...view.layoutProbe.probe('noteList.panel')} style={noteListPanelStyle(props, view)} testID="note-list-panel">
      <MobileNoteListToolbar props={props} themeStyles={view.themeStyles} />
      <MobileNoteListPanelBody props={props} view={view} />
      <BulkSelectionBar bulkActions={props.bulkActions} bulkSelection={view.bulkSelection} />
      <MobileNoteListPanelFooter
        active={props.noteListFilter ?? 'open'}
        counts={props.noteListFilterCounts ?? { archived: 0, open: 0 }}
        layoutProbe={props.layoutProbe ? view.layoutProbe : null}
        onChange={view.onFilterChange}
      />
    </MobilePanel>
  )
}

function noteListPanelStyle(props: MobileNoteListPanelProps, view: MobileNoteListPanelView) {
  return [
    panelStyles.panel,
    props.compact ? panelStyles.panelCompact : null,
    props.fullWidth ? panelStyles.panelFullWidth : null,
    { paddingBottom: view.onFilterChange ? 0 : view.bottom },
  ]
}

function MobileNoteListToolbar({ props, themeStyles }: { props: MobileNoteListPanelProps; themeStyles: ReturnType<typeof createThemeStyles> }) {
  return (
    <MobileToolbar testID="note-list-toolbar">
      {props.leading}
      <View style={themeStyles.styles.toolbarTitleBlock}>
        <MobileToolbarTitle testID="note-list-toolbar-title" title={props.title ?? mobileCopy.inbox} />
      </View>
      <MobileToolbarSpacer />
      {props.toolbarTrailing ?? <MobileNoteListSearchButton onOpenSearch={props.onOpenSearch} color={themeStyles.mobileColors.textMuted} />}
    </MobileToolbar>
  )
}

function MobileNoteListSearchButton({ onOpenSearch, color }: { onOpenSearch: () => void; color: string }) {
  return (
    <MobileIconButton accessibilityLabel={mobileCopy.searchNotes} testID={mobileNoteListToolbarChrome.actionTestIds[0]} onPress={onOpenSearch}>
      <MagnifyingGlass color={color} size={desktopToolbarActionParity.iconSize} />
    </MobileIconButton>
  )
}

function MobileNoteListPanelBody({ props, view }: { props: MobileNoteListPanelProps; view: MobileNoteListPanelView }) {
  const { styles } = view.themeStyles
  return (
    <>
      {props.searchQuery ? <SearchPill searchQuery={props.searchQuery} /> : null}
      <View style={styles.listBody}>
        <MobileNoteListScrollContent
          rowActions={mobileNoteListRowActions(props.bulkActions, props.onToggleNoteFavorite)}
          activeNoteId={view.activeNoteId}
          bulkSelection={view.bulkSelection}
          displayPropertyKeys={props.displayPropertyKeys ?? []}
          emptyVault={props.emptyVault ?? false}
          layoutProbe={view.layoutProbe.probe}
          neighborhood={props.neighborhood ?? null}
          notes={props.notes}
          onSelectNote={props.onSelectNote}
          onOpenVault={props.onOpenVault}
          propertyDisplayModes={props.propertyDisplayModes}
          searchQuery={props.searchQuery}
          scrollsToTop={props.scrollsToTop ?? false}
          refreshControl={view.refreshControl}
          selectedNoteId={props.selectedNoteId}
          typeDefinitions={props.typeDefinitions}
        />
        <MobileCreateNoteButton
          visible={(props.showCreateAction ?? true) && view.bulkSelection.selectedNotes.length === 0}
          onPress={props.onOpenCreateNote}
        />
      </View>
    </>
  )
}

function BulkSelectionBar({
  bulkActions,
  bulkSelection,
}: {
  bulkActions?: MobileNoteListBulkActions
  bulkSelection: ReturnType<typeof useMobileNoteListBulkSelection>
}) {
  if (!bulkActions || bulkSelection.selectedNotes.length === 0) return null

  return (
    <MobileNoteListBulkActionBar
      archivedMode={mobileNoteListSelectionIsArchived(bulkSelection.selectedNotes)}
      count={bulkSelection.selectedNotes.length}
      onArchiveToggle={bulkSelection.archiveSelected}
      onClear={bulkSelection.clearSelection}
      onDelete={bulkSelection.deleteSelected}
      onOrganize={bulkSelection.organizeSelected}
    />
  )
}

const panelStyles = StyleSheet.create({
  panel: {
    alignSelf: 'stretch',
    borderRightWidth: StyleSheet.hairlineWidth,
    height: '100%',
    width: desktopPanelParity.noteListWidth,
  },
  panelCompact: {
    width: 336,
  },
  panelFullWidth: {
    width: '100%',
  },
})

function noteListFilterAction({
  noteListFilterVisible,
  onNoteListFilterChange,
}: MobileNoteListPanelProps) {
  return noteListFilterVisible ? onNoteListFilterChange : undefined
}
