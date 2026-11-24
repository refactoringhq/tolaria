import { useCallback, useMemo } from 'react'
import { usePhoneNoteStackControls } from '../../hooks/phoneNoteStackStore'
import type { SidebarSelection, VaultEntry } from '../../types'

interface SidebarSelectionHandlers {
  onSelect: (selection: SidebarSelection) => void
  onSelectFavorite?: (entry: VaultEntry) => void
}

/**
 * On the phone layout a sidebar pick also moves the stack (TOL-417): a type, view or folder
 * shows its note list, a favorite opens its note. Off the phone the handlers pass through.
 */
export function usePhoneSidebarSelection({ onSelect: selectItem, onSelectFavorite: selectFavorite }: SidebarSelectionHandlers): SidebarSelectionHandlers {
  const { active, showList, showNote } = usePhoneNoteStackControls()
  const onSelect = useCallback((selection: SidebarSelection) => {
    // A phone folder pick lists the whole folder, not a scope left from a wider layout.
    selectItem(active && selection.kind === 'folder' ? { ...selection, rootPath: undefined } : selection)
    if (active) showList()
  }, [active, selectItem, showList])
  const onSelectFavorite = useMemo(() => selectFavorite
    ? (entry: VaultEntry) => {
        selectFavorite(entry)
        if (active) showNote()
      }
    : undefined, [active, selectFavorite, showNote])
  return { onSelect, onSelectFavorite }
}
