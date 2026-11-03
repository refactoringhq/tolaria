import { FolderOpen, MagnifyingGlass } from 'phosphor-react-native'
import { View } from 'react-native'
import { mobileText } from '../../i18n/mobileText'
import type { MobileLayoutProbe } from '../../qa/mobileLayoutProbe'
import { MobileButton } from '../../ui/MobileButton'
import { MobileChip } from '../../ui/MobileChip'
import { MobileListRow } from '../../ui/MobileListRow'
import { useMobileColors, useMobileStyles } from '../../ui/theme/useMobileTheme'
import type { MobileNeighborhoodGroup } from '../../workspace/mobileNeighborhood'
import { mobileNoteRowChips } from '../../workspace/mobileNoteDisplay'
import type {
  MobileNote,
  MobilePropertyDisplayMode,
  MobileTypeDefinitions,
} from '../../workspace/mobileWorkspaceModel'
import { Text } from '../ui/text'
import { createThemeStyles } from './MobileNoteListPanel.styles'
import { mobileNoteListEmptyStateChrome } from './MobileNoteListPanelChrome'
import { MobilePendingNoteIndicator } from './MobilePendingNoteIndicator'
import { MobileListMotion, type MobileNoteRowActions, MobileSwipeableNoteRow } from './MobileSwipeableNoteRow'
import { MobileTypeIcon } from './MobileWorkspaceIcons'
import { noteTypeSoftColor } from './mobileWorkspaceTone'

export type MobileNoteListRowProps = {
  rowActions?: MobileNoteRowActions
  activeNoteId: string | null
  displayPropertyKeys: string[]
  forceSelected?: boolean
  layoutProbe: MobileLayoutProbe
  multiSelected?: boolean
  note: MobileNote
  onBeginSelection?: (noteId: string) => void
  onSelectNote: (noteId: string) => void
  propertyDisplayModes?: Record<string, MobilePropertyDisplayMode> | null
  typeDefinitions?: MobileTypeDefinitions
}

export function MobileNoteListRow(props: MobileNoteListRowProps) {
  const colors = useMobileColors()
  const {
    activeNoteId,
    displayPropertyKeys,
    forceSelected = false,
    layoutProbe,
    multiSelected = false,
    note,
    onBeginSelection,
    onSelectNote,
    propertyDisplayModes,
    typeDefinitions,
  } = props
  return (
    <MobileSwipeableNoteRow actions={props.rowActions} note={note}>
      <MobileListRow
        chips={
          <NoteRowChips
            displayPropertyKeys={displayPropertyKeys}
            note={note}
            propertyDisplayModes={propertyDisplayModes}
            typeDefinitions={typeDefinitions}
          />
        }
        leading={<MobilePendingNoteIndicator note={note} />}
        layoutProbe={layoutProbe}
        metricId={`noteList.item.${note.id}`}
        multiSelected={multiSelected}
        selected={forceSelected || note.id === activeNoteId}
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
            typeDefinitions={typeDefinitions}
          />
        }
        onLongPress={onBeginSelection ? () => onBeginSelection(note.id) : undefined}
        onPress={() => onSelectNote(note.id)}
      />
    </MobileSwipeableNoteRow>
  )
}

function NoteRowChips({
  displayPropertyKeys,
  note,
  propertyDisplayModes,
  typeDefinitions,
}: {
  displayPropertyKeys: string[]
  note: MobileNote
  propertyDisplayModes?: Record<string, MobilePropertyDisplayMode> | null
  typeDefinitions?: MobileTypeDefinitions
}) {
  const { styles } = useMobileStyles(createThemeStyles)
  const chips = mobileNoteRowChips(note, displayPropertyKeys, typeDefinitions, propertyDisplayModes)
  if (chips.length === 0) return null

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
  )
}

export function NoteListEmptyState({
  emptyVault,
  onOpenVault,
  searchQuery,
}: {
  emptyVault: boolean
  onOpenVault?: () => void
  searchQuery?: string
}) {
  const { styles, mobileColors } = useMobileStyles(createThemeStyles)
  const chrome = mobileNoteListEmptyStateChrome({ emptyVault, searchQuery })

  return (
    <MobileListMotion testID="note-list-empty-motion">
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>{mobileText(chrome.titleKey)}</Text>
        {chrome.detailKey ? (
          <Text style={styles.emptyText}>{mobileText(chrome.detailKey)}</Text>
        ) : null}
        {chrome.action === 'openVault' && onOpenVault ? (
          <MobileButton
            icon={<FolderOpen color={mobileColors.text} size={16} />}
            label={mobileText('status.vault.openLocal')}
            style={styles.emptyAction}
            testID="note-list-empty-open-vault"
            onPress={onOpenVault}
          />
        ) : null}
      </View>
    </MobileListMotion>
  )
}

export function SearchPill({ searchQuery }: { searchQuery: string }) {
  const { styles, mobileColors } = useMobileStyles(createThemeStyles)
  return (
    <View style={styles.searchPill}>
      <MagnifyingGlass color={mobileColors.textMuted} size={16} />
      <Text numberOfLines={1} style={styles.searchText}>
        {searchQuery}
      </Text>
    </View>
  )
}

export function MobileRelationshipGroupHeader({ group }: { group: MobileNeighborhoodGroup }) {
  const { styles } = useMobileStyles(createThemeStyles)
  return (
    <View style={styles.groupHeader} testID={`relationship-group-${group.id}`}>
      <Text style={styles.groupLabel}>{group.label}</Text>
      <Text style={styles.groupCount}>{group.notes.length}</Text>
    </View>
  )
}
