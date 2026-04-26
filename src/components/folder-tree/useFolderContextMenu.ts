import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react'
import type { FolderNode } from '../../types'
import type { FolderFileActions } from '../../hooks/useFileActions'
import type { FolderContextMenuState } from './FolderContextMenu'

interface UseFolderContextMenuInput {
  onDeleteFolder?: (folderPath: string) => void
  folderFileActions?: FolderFileActions
  onStartRenameFolder?: (folderPath: string) => void
}

function useContextMenuDismiss(
  contextMenu: FolderContextMenuState | null,
  menuRef: RefObject<HTMLDivElement | null>,
  closeContextMenu: () => void,
) {
  useEffect(() => {
    if (!contextMenu) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) closeContextMenu()
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu()
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [closeContextMenu, contextMenu, menuRef])
}

export function useFolderContextMenu({
  onDeleteFolder,
  folderFileActions,
  onStartRenameFolder,
}: UseFolderContextMenuInput) {
  const [contextMenu, setContextMenu] = useState<FolderContextMenuState | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const closeContextMenu = useCallback(() => setContextMenu(null), [])
  useContextMenuDismiss(contextMenu, menuRef, closeContextMenu)

  const handleOpenMenu = useCallback((node: FolderNode, event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      path: node.path,
      x: event.clientX,
      y: event.clientY,
    })
  }, [])

  const handleRenameFromMenu = useCallback((folderPath: string) => {
    closeContextMenu()
    onStartRenameFolder?.(folderPath)
  }, [closeContextMenu, onStartRenameFolder])

  const handleDeleteFromMenu = useCallback((folderPath: string) => {
    closeContextMenu()
    onDeleteFolder?.(folderPath)
  }, [closeContextMenu, onDeleteFolder])

  const handleRevealFromMenu = useCallback((folderPath: string) => {
    closeContextMenu()
    folderFileActions?.revealFolder(folderPath)
  }, [closeContextMenu, folderFileActions])

  const handleCopyPathFromMenu = useCallback((folderPath: string) => {
    closeContextMenu()
    folderFileActions?.copyFolderPath(folderPath)
  }, [closeContextMenu, folderFileActions])

  return {
    closeContextMenu,
    contextMenu,
    handleCopyPathFromMenu,
    handleDeleteFromMenu,
    handleOpenMenu,
    handleRevealFromMenu,
    handleRenameFromMenu,
    menuRef,
  }
}
