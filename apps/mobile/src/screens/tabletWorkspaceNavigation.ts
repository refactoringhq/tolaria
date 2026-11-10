import { useCallback, useMemo, useRef, useState } from 'react'
import type {
  MobileSidebarFolderSelection,
  MobileSidebarItemSelection,
} from '../components/workspace/MobileWorkspaceSidebar'
import { flattenMobileNeighborhoodNotes } from '../workspace/mobileNeighborhood'
import { isMobileMarkdownNote, type MobileNoteListFilter } from '../workspace/mobileNoteFilters'
import { evaluateMobileSavedView } from '../workspace/mobileSavedViews'
import type { MobileNote, MobileSavedView, MobileWorkspaceSnapshot } from '../workspace/mobileWorkspaceModel'
import { shouldDiscardPristineNewNote } from './pristineNewNoteDiscard'
import {
  editorBlocksForSelection,
  editorBulletsForSelection,
  favoriteNeighborhoodSelectionForSidebarItem,
  filterNotesBySearch,
  initialSelectedNoteId,
  initialSidebarSelection,
  neighborhoodForSelection,
  noteListFilterCountsForSelection,
  noteListPropertiesForSelection,
  notesForSidebarSelection,
  selectedMobileNote,
  tabletNavigationScopePresentation,
  workspaceNotes,
} from './tabletWorkspaceNavigationSelectors'

export {
  favoriteNeighborhoodSelectionForSidebarItem,
  filterNotesBySearch,
  noteListFilterCountsForSelection,
  noteListPropertiesForSelection,
  notesForSidebarSelection,
  snapshotWithFavoriteOverrides,
} from './tabletWorkspaceNavigationSelectors'

export type NoteCount = number

export type NoteCountText = string

export type NoteId = MobileNote['id']

export type ReadOnlyFormValue = string

export type SearchQuery = string

export type SidebarLabel = string

export type TabletSidebarSelection =
  | {
      count?: NoteCountText
      id: string
      kind: 'item'
      label: SidebarLabel
      sectionId: string
      typeName?: string
      viewId?: string
    }
  | { id: string; kind: 'folder'; label: SidebarLabel }
  | { id: string; kind: 'entity'; label: SidebarLabel }

type NavigationVisibleNotesInput = {
  noteListFilter: MobileNoteListFilter
  noteListProperties: string[]
  searchQuery: SearchQuery
  sidebarSelection: TabletSidebarSelection
  snapshot: MobileWorkspaceSnapshot
}

type NavigationHistoryStateInput = {
  noteListFilter: MobileNoteListFilter
  selectedNoteId: NoteId | null
  setNoteListFilter: (filter: MobileNoteListFilter) => void
  setSelectedNoteId: (noteId: NoteId | null) => void
  setSidebarSelection: (selection: TabletSidebarSelection) => void
  sidebarSelection: TabletSidebarSelection
}

type NavigationSelectionActionsInput = {
  noteListFilter: MobileNoteListFilter
  noteListProperties: string[]
  searchQuery: SearchQuery
  selectNavigationEntry: SelectNavigationEntry
  sidebarSelection: TabletSidebarSelection
  snapshot: MobileWorkspaceSnapshot
}

type SelectSidebarSelection = (selection: TabletSidebarSelection, sourceSnapshot?: MobileWorkspaceSnapshot) => void

type SelectNavigationEntry = (entry: TabletNavigationHistoryEntry) => void

export type TabletNavigationHistoryEntry = {
  noteListFilter: MobileNoteListFilter
  selectedNoteId: NoteId | null
  sidebarSelection: TabletSidebarSelection
}

export type TabletNavigationHistory = {
  backStack: TabletNavigationHistoryEntry[]
  forwardStack: TabletNavigationHistoryEntry[]
}

export type TabletNavigationHistoryTraversal = {
  entry: TabletNavigationHistoryEntry | null
  history: TabletNavigationHistory
}

export type TabletNavigationHistoryDirection = 'back' | 'forward'

const tabletNavigationHistoryLimit = 100

export function emptyTabletNavigationHistory(): TabletNavigationHistory {
  return { backStack: [], forwardStack: [] }
}

export function pushTabletNavigationHistory(
  history: TabletNavigationHistory,
  current: TabletNavigationHistoryEntry,
  next: TabletNavigationHistoryEntry,
): TabletNavigationHistory {
  if (sameTabletNavigationEntry(current, next)) return history

  return {
    backStack: limitTabletNavigationHistory([...history.backStack, current]),
    forwardStack: [],
  }
}

export function traverseTabletNavigationHistory(
  history: TabletNavigationHistory,
  direction: TabletNavigationHistoryDirection,
  current: TabletNavigationHistoryEntry,
): TabletNavigationHistoryTraversal {
  const sourceStack = direction === 'back' ? history.backStack : history.forwardStack
  const entry = sourceStack.at(-1) ?? null
  if (!entry) return { entry, history }

  return {
    entry,
    history: nextTabletNavigationHistory(history, direction, current),
  }
}

function nextTabletNavigationHistory(
  history: TabletNavigationHistory,
  direction: TabletNavigationHistoryDirection,
  current: TabletNavigationHistoryEntry,
): TabletNavigationHistory {
  if (direction === 'back') {
    return {
      backStack: history.backStack.slice(0, -1),
      forwardStack: limitTabletNavigationHistory([...history.forwardStack, current]),
    }
  }

  return {
    backStack: limitTabletNavigationHistory([...history.backStack, current]),
    forwardStack: history.forwardStack.slice(0, -1),
  }
}

function limitTabletNavigationHistory(entries: TabletNavigationHistoryEntry[]) {
  return entries.slice(Math.max(0, entries.length - tabletNavigationHistoryLimit))
}

function sameTabletNavigationEntry(
  left: TabletNavigationHistoryEntry,
  right: TabletNavigationHistoryEntry,
) {
  return left.noteListFilter === right.noteListFilter
    && left.selectedNoteId === right.selectedNoteId
    && tabletSidebarSelectionKey(left.sidebarSelection) === tabletSidebarSelectionKey(right.sidebarSelection)
}

function tabletSidebarSelectionKey(selection: TabletSidebarSelection) {
  if (selection.kind !== 'item') return `${selection.kind}:${selection.id}`

  return [
    selection.kind,
    selection.sectionId,
    selection.id,
    selection.typeName ?? '',
    selection.viewId ?? '',
  ].join(':')
}

export function useTabletWorkspaceNavigation(snapshot: MobileWorkspaceSnapshot, searchQuery: SearchQuery) {
  const [sidebarSelection, setSidebarSelection] = useState<TabletSidebarSelection>(() =>
    initialSidebarSelection(snapshot),
  )
  const [noteListFilter, setNoteListFilter] = useState<MobileNoteListFilter>('open')
  const [selectedNoteId, setSelectedNoteId] = useState<NoteId | null>(initialSelectedNoteId(snapshot))
  const pristineNewNoteId = useRef<NoteId | null>(null)
  const { noteListProperties, noteListFilterCounts } = useNavigationScopeProperties(snapshot, sidebarSelection)
  const { noteListNeighborhood, notes } = useNavigationVisibleNotes({
    noteListFilter, noteListProperties,
    searchQuery, sidebarSelection,
    snapshot,
  })
  const selectedNote = selectedMobileNote(snapshot, notes, selectedNoteId)
  const markPristineNewNote = useCallback((noteId: NoteId) => {
    pristineNewNoteId.current = noteId
  }, [])
  const takePristineNewNoteToDiscard = useCallback(() => {
    const candidateId = pristineNewNoteId.current
    pristineNewNoteId.current = null
    const currentNote = (snapshot.allNotes ?? snapshot.notes).find((note) => note.id === selectedNoteId) ?? null
    return shouldDiscardPristineNewNote(candidateId, selectedNoteId, currentNote) ? candidateId : null
  }, [selectedNoteId, snapshot])
  const navigationHistory = useTabletNavigationHistoryState({
    noteListFilter,
    selectedNoteId,
    setNoteListFilter,
    setSelectedNoteId,
    setSidebarSelection,
    sidebarSelection,
  })
  const { selectNavigationEntry } = navigationHistory
  const selectionActions = useTabletNavigationSelectionActions({
    noteListFilter,
    noteListProperties,
    searchQuery,
    selectNavigationEntry,
    sidebarSelection,
    snapshot,
  })

  return {
    ...tabletNavigationScopePresentation(snapshot, sidebarSelection, notes, searchQuery),
    canGoBack: navigationHistory.canGoBack,
    canGoForward: navigationHistory.canGoForward,
    editorBlocks: editorBlocksForSelection(snapshot, selectedNote),
    editorBullets: editorBulletsForSelection(snapshot, selectedNote),
    goBack: navigationHistory.goBack,
    markPristineNewNote,
    goForward: navigationHistory.goForward,
    noteListProperties,
    noteListNeighborhood,
    noteListFilter,
    noteListFilterCounts,
    notes,
    sidebarSelection,
    selectedNote,
    selectedNoteId: selectedNote?.id ?? selectedNoteId,
    setSelectedNoteId,
    takePristineNewNoteToDiscard,
    ...selectionActions,
  }
}

function useNavigationScopeProperties(snapshot: MobileWorkspaceSnapshot, sidebarSelection: TabletSidebarSelection) {
  const noteListProperties = useMemo(
    () => noteListPropertiesForSelection(snapshot, sidebarSelection),
    [sidebarSelection, snapshot],
  )
  const noteListFilterCounts = useMemo(
    () => noteListFilterCountsForSelection(snapshot, sidebarSelection),
    [sidebarSelection, snapshot],
  )
  return { noteListProperties, noteListFilterCounts }
}

function useTabletNavigationSelectionActions({
  noteListFilter,
  noteListProperties,
  searchQuery,
  selectNavigationEntry,
  sidebarSelection,
  snapshot,
}: NavigationSelectionActionsInput) {
  const selectSidebarSelection = useCallback((selection: TabletSidebarSelection, sourceSnapshot = snapshot) => {
    const nextNoteListProperties = noteListPropertiesForSelection(sourceSnapshot, selection)
    const nextNotes = filterNotesBySearch(
      notesForSidebarSelection(sourceSnapshot, selection, { noteListFilter: 'open' }),
      searchQuery,
      {
        displayModes: sourceSnapshot.vaultConfig?.propertyDisplayModes,
        displayPropertyKeys: nextNoteListProperties,
        typeDefinitions: sourceSnapshot.typeDefinitions,
      },
    )
    selectNavigationEntry({
      noteListFilter: 'open',
      selectedNoteId: nextNotes[0]?.id ?? null,
      sidebarSelection: selection,
    })
  }, [searchQuery, selectNavigationEntry, snapshot])
  const onNoteListFilterChange = useCallback((filter: MobileNoteListFilter) => {
    const nextNotes = filterNotesBySearch(
      notesForSidebarSelection(snapshot, sidebarSelection, { noteListFilter: filter }),
      searchQuery,
      {
        displayModes: snapshot.vaultConfig?.propertyDisplayModes,
        displayPropertyKeys: noteListProperties,
        typeDefinitions: snapshot.typeDefinitions,
      },
    )
    selectNavigationEntry({
      noteListFilter: filter,
      selectedNoteId: nextNotes[0]?.id ?? null,
      sidebarSelection,
    })
  }, [noteListProperties, searchQuery, selectNavigationEntry, sidebarSelection, snapshot])
  const selectNote = useCallback((noteId: NoteId | null) => {
    selectNavigationEntry({
      noteListFilter,
      selectedNoteId: noteId,
      sidebarSelection,
    })
  }, [noteListFilter, selectNavigationEntry, sidebarSelection])
  const sidebarActions = useTabletSelectionActions({
    selectNavigationEntry,
    selectSidebarSelection,
    snapshot,
  })

  return {
    onNoteListFilterChange,
    selectNote,
    ...sidebarActions,
  }
}

function useTabletNavigationHistoryState({
  noteListFilter,
  selectedNoteId,
  setNoteListFilter,
  setSelectedNoteId,
  setSidebarSelection,
  sidebarSelection,
}: NavigationHistoryStateInput) {
  const [history, setHistory] = useState<TabletNavigationHistory>(() => emptyTabletNavigationHistory())
  const currentEntry = useCallback((): TabletNavigationHistoryEntry => ({
    noteListFilter,
    selectedNoteId,
    sidebarSelection,
  }), [noteListFilter, selectedNoteId, sidebarSelection])
  const applyEntry = useCallback((entry: TabletNavigationHistoryEntry) => {
    setSidebarSelection(entry.sidebarSelection)
    setNoteListFilter(entry.noteListFilter)
    setSelectedNoteId(entry.selectedNoteId)
  }, [setNoteListFilter, setSelectedNoteId, setSidebarSelection])
  const selectNavigationEntry = useCallback((entry: TabletNavigationHistoryEntry) => {
    setHistory((currentHistory) => pushTabletNavigationHistory(currentHistory, currentEntry(), entry))
    applyEntry(entry)
  }, [applyEntry, currentEntry])
  const goBack = useCallback(() => {
    const traversal = traverseTabletNavigationHistory(history, 'back', currentEntry())
    if (!traversal.entry) return
    setHistory(traversal.history)
    applyEntry(traversal.entry)
  }, [applyEntry, currentEntry, history])
  const goForward = useCallback(() => {
    const traversal = traverseTabletNavigationHistory(history, 'forward', currentEntry())
    if (!traversal.entry) return
    setHistory(traversal.history)
    applyEntry(traversal.entry)
  }, [applyEntry, currentEntry, history])

  return {
    canGoBack: history.backStack.length > 0,
    canGoForward: history.forwardStack.length > 0,
    goBack,
    goForward,
    selectNavigationEntry,
  }
}

function useNavigationVisibleNotes({
  noteListFilter,
  noteListProperties,
  searchQuery,
  sidebarSelection,
  snapshot,
}: NavigationVisibleNotesInput) {
  const sidebarNotes = useMemo(() => (
    notesForSidebarSelection(snapshot, sidebarSelection, { noteListFilter })
  ), [noteListFilter, sidebarSelection, snapshot])
  const noteListNeighborhood = useMemo(
    () => neighborhoodForSelection(snapshot, sidebarSelection, searchQuery, noteListProperties),
    [noteListProperties, searchQuery, sidebarSelection, snapshot],
  )
  const notes = useMemo(() => (
    noteListNeighborhood
      ? flattenMobileNeighborhoodNotes(noteListNeighborhood)
      : filterNotesBySearch(sidebarNotes, searchQuery, {
        displayModes: snapshot.vaultConfig?.propertyDisplayModes,
        displayPropertyKeys: noteListProperties,
        typeDefinitions: snapshot.typeDefinitions,
      })
  ), [noteListNeighborhood, noteListProperties, searchQuery, sidebarNotes, snapshot.typeDefinitions, snapshot.vaultConfig?.propertyDisplayModes])

  return { noteListNeighborhood, notes }
}

function useTabletSelectionActions({
  selectNavigationEntry,
  selectSidebarSelection,
  snapshot,
}: {
  selectNavigationEntry: SelectNavigationEntry
  selectSidebarSelection: SelectSidebarSelection
  snapshot: MobileWorkspaceSnapshot
}) {
  return {
    selectDefaultSidebarItem: useCallback((sourceSnapshot = snapshot) => {
      selectSidebarSelection(initialSidebarSelection(sourceSnapshot), sourceSnapshot)
    }, [selectSidebarSelection, snapshot]),
    selectSavedView: useCallback((view: MobileSavedView, sourceSnapshot = snapshot) => {
      const matchingNotes = evaluateMobileSavedView(view, workspaceNotes(sourceSnapshot).filter(isMobileMarkdownNote))
      selectSidebarSelection({
        count: matchingNotes.length.toLocaleString(),
        id: view.id,
        kind: 'item',
        label: view.definition.name,
        sectionId: 'views',
        viewId: view.id,
      }, sourceSnapshot)
    }, [selectSidebarSelection, snapshot]),
    selectFolder: useCallback((selection: MobileSidebarFolderSelection, sourceSnapshot = snapshot) => {
      selectSidebarSelection({
        id: selection.id,
        kind: 'folder',
        label: selection.name,
      }, sourceSnapshot)
    }, [selectSidebarSelection, snapshot]),
    selectNeighborhoodNote: useCallback((noteId: NoteId, sourceSnapshot = snapshot) => {
      selectNavigationEntry(navigationEntryForNeighborhoodNote(noteId, sourceSnapshot))
    }, [selectNavigationEntry, snapshot]),
    selectSidebarItem: useCallback((selection: MobileSidebarItemSelection, sourceSnapshot = snapshot) => {
      const favoriteSelection = favoriteNeighborhoodSelectionForSidebarItem(sourceSnapshot, selection)
      if (favoriteSelection) {
        selectNavigationEntry({
          noteListFilter: 'open',
          selectedNoteId: favoriteSelection.id,
          sidebarSelection: favoriteSelection,
        })
        return
      }

      selectSidebarSelection({
        count: selection.count,
        id: selection.id,
        kind: 'item',
        label: selection.label,
        sectionId: selection.sectionId,
        typeName: selection.typeName,
        viewId: selection.viewId,
      }, sourceSnapshot)
    }, [selectNavigationEntry, selectSidebarSelection, snapshot]),
  }
}

function navigationEntryForNeighborhoodNote(
  noteId: NoteId,
  snapshot: MobileWorkspaceSnapshot,
): TabletNavigationHistoryEntry {
  const sourceNote = workspaceNotes(snapshot).find((note) => note.id === noteId)
  if (!sourceNote) {
    return {
      noteListFilter: 'open',
      selectedNoteId: noteId,
      sidebarSelection: {
        id: noteId,
        kind: 'entity',
        label: noteId,
      },
    }
  }

  return {
    noteListFilter: 'open',
    selectedNoteId: sourceNote.id,
    sidebarSelection: {
      id: sourceNote.id,
      kind: 'entity',
      label: sourceNote.title,
    },
  }
}
