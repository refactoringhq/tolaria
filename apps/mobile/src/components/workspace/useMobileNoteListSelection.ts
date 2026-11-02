import { useCallback, useMemo, useState } from 'react'
import type { MobileNeighborhood } from '../../workspace/mobileNeighborhood'
import type { MobileNote } from '../../workspace/mobileWorkspaceModel'
import {
  addMobileNoteListSelection,
  mobileNoteListSelectionIsArchived,
  selectedMobileNoteListIds,
  selectedMobileNoteListNotes,
  toggleMobileNoteListSelection,
} from './mobileNoteListBulkSelection'

export type MobileNoteListBulkActions = {
  onArchive: (noteIds: string[], archived: boolean) => void
  onDelete: (noteIds: string[]) => void
  onOrganize: (noteIds: string[]) => void
}
type MobileNoteListSelectionState = {
  noteIds: ReadonlySet<string>
  scope: string
}

export function useMobileNoteListBulkSelection({
  bulkActions,
  neighborhood,
  notes,
  onSelectNote,
}: {
  bulkActions?: MobileNoteListBulkActions
  neighborhood: MobileNeighborhood | null
  notes: MobileNote[]
  onSelectNote: (noteId: string) => void
}) {
  const selectionEnabled = Boolean(bulkActions && !neighborhood)
  const emptySelection = useMemo(() => new Set<string>(), [])
  const [selectionState, setSelectionState] = useState<MobileNoteListSelectionState>({
    noteIds: emptySelection,
    scope: '',
  })
  const visibleNoteIds = useMemo(() => notes.map((note) => note.id), [notes])
  const visibleNoteIdsSignature = visibleNoteIds.join('\u0000')
  const selectionScope = selectionEnabled ? visibleNoteIdsSignature : ''
  const selectedNoteIds = scopedSelectedNoteIds({ emptySelection, selectionScope, selectionState })
  const selectedNotes = useMemo(
    () => selectedMobileNoteListNotes(notes, selectedNoteIds),
    [notes, selectedNoteIds],
  )
  const selectedNoteIdsSignature = [...selectedNoteIds].join('\u0000')
  const clearSelection = useCallback(() => {
    setSelectionState({ noteIds: new Set(), scope: selectionScope })
  }, [selectionScope])

  const beginSelection = useCallback((noteId: string) => {
    if (!selectionEnabled) return
    setSelectionState((current) => selectionWithNote(current, selectionScope, noteId, addMobileNoteListSelection))
  }, [selectionEnabled, selectionScope])

  const pressNote = useCallback((noteId: string) => {
    if (shouldSelectNoteImmediately(selectionEnabled, selectedNoteIds)) {
      onSelectNote(noteId)
      return
    }
    setSelectionState((current) => selectionWithNote(current, selectionScope, noteId, toggleMobileNoteListSelection))
  }, [onSelectNote, selectedNoteIds, selectionEnabled, selectionScope])

  const selectedIdsInOrder = useCallback(() => selectedMobileNoteListIds(notes, selectedNoteIds), [notes, selectedNoteIds])

  const runBulkAction = useCallback((action: (noteIds: string[]) => void) => {
    const noteIds = selectedIdsInOrder()
    if (noteIds.length > 0) {
      clearSelection()
      action(noteIds)
    }
  }, [clearSelection, selectedIdsInOrder])
  const archiveSelected = useArchiveSelectionAction({ bulkActions, runBulkAction, selectedNotes })

  return {
    archiveSelected,
    beginSelection,
    clearSelection,
    deleteSelected: useOptionalBulkAction(bulkActions?.onDelete, runBulkAction),
    organizeSelected: useOptionalBulkAction(bulkActions?.onOrganize, runBulkAction),
    pressNote,
    rowExtraData: useCallback((selectedNoteId: string | null) => (
      `${selectedNoteId ?? ''}:${selectedNoteIdsSignature}`
    ), [selectedNoteIdsSignature]),
    selectedNoteIds,
    selectedNotes,
  }
}

function scopedSelectedNoteIds({
  emptySelection,
  selectionScope,
  selectionState,
}: {
  emptySelection: ReadonlySet<string>
  selectionScope: string
  selectionState: MobileNoteListSelectionState
}) {
  return selectionState.scope === selectionScope ? selectionState.noteIds : emptySelection
}

function selectionWithNote(
  current: MobileNoteListSelectionState,
  selectionScope: string,
  noteId: string,
  updateSelection: (noteIds: ReadonlySet<string>, noteId: string) => ReadonlySet<string>,
): MobileNoteListSelectionState {
  return {
    noteIds: updateSelection(scopedNoteSelection(current, selectionScope), noteId),
    scope: selectionScope,
  }
}

function shouldSelectNoteImmediately(selectionEnabled: boolean, selectedNoteIds: ReadonlySet<string>) {
  return !selectionEnabled || selectedNoteIds.size === 0
}

function useArchiveSelectionAction({
  bulkActions,
  runBulkAction,
  selectedNotes,
}: {
  bulkActions?: MobileNoteListBulkActions
  runBulkAction: (action: (noteIds: string[]) => void) => void
  selectedNotes: MobileNote[]
}) {
  return useCallback(() => {
    if (!bulkActions) return
    const archived = !mobileNoteListSelectionIsArchived(selectedNotes)
    runBulkAction((noteIds) => bulkActions.onArchive(noteIds, archived))
  }, [bulkActions, runBulkAction, selectedNotes])
}

function useOptionalBulkAction(
  action: ((noteIds: string[]) => void) | undefined,
  runBulkAction: (action: (noteIds: string[]) => void) => void,
) {
  return useCallback(() => {
    if (action) runBulkAction(action)
  }, [action, runBulkAction])
}

function scopedNoteSelection(state: MobileNoteListSelectionState, scope: string) {
  return state.scope === scope ? state.noteIds : new Set<string>()
}
