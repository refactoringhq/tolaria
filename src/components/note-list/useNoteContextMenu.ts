import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react'
import type { VaultEntry } from '../../types'

export interface NoteContextMenuState {
  entry: VaultEntry
  x: number
  y: number
}

function useContextMenuDismiss(
  menu: NoteContextMenuState | null,
  menuRef: RefObject<HTMLDivElement | null>,
  closeMenu: () => void,
) {
  useEffect(() => {
    if (!menu) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) closeMenu()
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [closeMenu, menu, menuRef])
}

export function useNoteContextMenu() {
  const [menu, setMenu] = useState<NoteContextMenuState | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeMenu = useCallback(() => setMenu(null), [])

  useContextMenuDismiss(menu, menuRef, closeMenu)

  const openMenuForEntry = useCallback((entry: VaultEntry, point: { x: number; y: number }) => {
    setMenu({ entry, x: point.x, y: point.y })
  }, [])

  const handleNoteContextMenu = useCallback((entry: VaultEntry, event: ReactMouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    openMenuForEntry(entry, { x: event.clientX, y: event.clientY })
  }, [openMenuForEntry])

  return {
    closeMenu,
    handleNoteContextMenu,
    menu,
    menuRef,
    openMenuForEntry,
  }
}
