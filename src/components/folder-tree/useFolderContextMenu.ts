import { useCallback, type MouseEvent as ReactMouseEvent } from 'react'
import type { FolderNode } from '../../types'
import type { FolderFileActions } from '../../hooks/useFileActions'
import { requestCreateNoteInFolder } from '../../hooks/noteCreationRequests'
import { useSidebarContextMenu } from '../sidebar/sidebarHooks'

interface UseFolderContextMenuInput {
  onDeleteFolder?: (folderPath: string, rootPath?: string) => void
  folderFileActions?: FolderFileActions
  onCreateFolder?: (folderPath: string, rootPath?: string) => void
  onStartRenameFolder?: (folderPath: string, rootPath?: string) => void
  canRenameDeleteFolder?: (folderPath: string, rootPath?: string) => boolean
}

export function useFolderContextMenu({
  onDeleteFolder,
  folderFileActions,
  onCreateFolder,
  onStartRenameFolder,
  canRenameDeleteFolder,
}: UseFolderContextMenuInput) {
  const {
    closeContextMenu,
    contextMenu,
    contextMenuRef,
    openContextMenuFromPointer,
  } = useSidebarContextMenu<{ path: string; rootPath?: string }>()

  const handleOpenMenu = useCallback((node: FolderNode, event: ReactMouseEvent<HTMLElement>) => {
    openContextMenuFromPointer({ path: node.path, rootPath: node.rootPath }, event)
  }, [openContextMenuFromPointer])

  const handleCreateNoteFromMenu = useCallback((folderPath: string, rootPath?: string) => {
    closeContextMenu()
    requestCreateNoteInFolder(folderPath, rootPath)
  }, [closeContextMenu])

  const handleCreateFolderFromMenu = useCallback((folderPath: string, rootPath?: string) => {
    closeContextMenu()
    onCreateFolder?.(folderPath, rootPath)
  }, [closeContextMenu, onCreateFolder])

  const handleRenameFromMenu = useCallback((folderPath: string, rootPath?: string) => {
    closeContextMenu()
    onStartRenameFolder?.(folderPath, rootPath)
  }, [closeContextMenu, onStartRenameFolder])

  const handleDeleteFromMenu = useCallback((folderPath: string, rootPath?: string) => {
    closeContextMenu()
    onDeleteFolder?.(folderPath, rootPath)
  }, [closeContextMenu, onDeleteFolder])

  const handleRevealFromMenu = useCallback((folderPath: string, rootPath?: string) => {
    closeContextMenu()
    folderFileActions?.revealFolder(folderPath, rootPath)
  }, [closeContextMenu, folderFileActions])

  const handleCopyPathFromMenu = useCallback((folderPath: string, rootPath?: string) => {
    closeContextMenu()
    folderFileActions?.copyFolderPath(folderPath, rootPath)
  }, [closeContextMenu, folderFileActions])
  const menu = contextMenu ? {
    path: contextMenu.target.path,
    rootPath: contextMenu.target.rootPath,
    x: contextMenu.pos.x,
    y: contextMenu.pos.y,
    canRenameDelete: canRenameDeleteFolder?.(contextMenu.target.path, contextMenu.target.rootPath) ?? true,
  } : null

  return {
    closeContextMenu,
    contextMenu: menu,
    handleCopyPathFromMenu,
    handleCreateFolderFromMenu,
    handleCreateNoteFromMenu,
    handleDeleteFromMenu,
    handleOpenMenu,
    handleRevealFromMenu,
    handleRenameFromMenu,
    menuRef: contextMenuRef,
  }
}
