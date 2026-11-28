import { useCallback, useEffect, useRef, useState } from 'react'
import type { InboxPeriod, SidebarSelection } from '../types'
import type { NoteListFilter } from '../utils/noteListHelpers'
import { INBOX_SELECTION } from '../utils/organizationWorkflow'
import { useNeighborhoodEntry } from './useNeighborhoodSelection'

export function useAppCollectionNavigation() {
  const [selection, setSelection] = useState<SidebarSelection>(INBOX_SELECTION)
  const [noteListFilter, setNoteListFilter] = useState<NoteListFilter>('open')
  const [collectionLayout, setCollectionLayout] = useState<'list' | 'kanban'>('list')
  const selectionRef = useRef<SidebarSelection>(INBOX_SELECTION)
  const neighborhoodHistoryRef = useRef<SidebarSelection[]>([])
  useEffect(() => {
    const handleLayoutState = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      if (event.detail === 'list' || event.detail === 'kanban') setCollectionLayout(event.detail)
    }
    window.addEventListener('laputa:collection-layout-state', handleLayoutState)
    return () => window.removeEventListener('laputa:collection-layout-state', handleLayoutState)
  }, [])
  const inboxPeriod: InboxPeriod = 'all'
  const handleSetSelection = useCallback((sel: SidebarSelection, options?: { preserveNeighborhoodHistory?: boolean }) => {
    if (!options?.preserveNeighborhoodHistory && sel.kind !== 'entity') {
      neighborhoodHistoryRef.current = []
    }
    selectionRef.current = sel
    setSelection(sel)
    setNoteListFilter('open')
  }, [])
  const handleEnterNeighborhood = useNeighborhoodEntry({
    neighborhoodHistoryRef,
    selectionRef,
    setSelection: handleSetSelection,
  })
  return {
    selections: { selection, selectionRef, setSelection, neighborhoodHistoryRef, handleSetSelection, handleEnterNeighborhood },
    noteList: { inboxPeriod, noteListFilter, setNoteListFilter },
    collectionLayout,
  }
}
