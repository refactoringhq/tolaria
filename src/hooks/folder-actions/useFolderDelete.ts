import { useCallback, useState } from 'react'
import { t } from '../../lib/i18n'
import type { SidebarSelection, VaultEntry } from '../../types'
import {
  clearDeletedFolderTabs,
  type ConfirmFolderDeleteState,
  type FolderTab,
  folderLabel,
  invokeDeleteFolder,
  resetSelectionIfFolderDeleted,
} from './folderActionUtils'

interface UseFolderDeleteInput {
  activeTabPathRef: React.MutableRefObject<string | null>
  clearFolderRename: () => void
  closeAllTabs: () => void
  reloadFolders: () => Promise<unknown>
  reloadVault: () => Promise<VaultEntry[]>
  selection: SidebarSelection
  setSelection: (selection: SidebarSelection) => void
  setTabs: React.Dispatch<React.SetStateAction<FolderTab[]>>
  setToastMessage: (message: string | null) => void
  vaultPath: string
}

export function useFolderDelete({
  activeTabPathRef,
  clearFolderRename,
  closeAllTabs,
  reloadFolders,
  reloadVault,
  selection,
  setSelection,
  setTabs,
  setToastMessage,
  vaultPath,
}: UseFolderDeleteInput) {
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<ConfirmFolderDeleteState | null>(null)

  const requestDeleteFolder = useCallback((folderPath: string) => {
    clearFolderRename()
    setConfirmDeleteFolder({
      path: folderPath,
      title: t('Delete "{folder}" and everything inside it?', { folder: folderLabel({ folderPath }) }),
      message: t('This permanently removes the folder, all nested folders, and every note or file inside it. This cannot be undone.'),
      confirmLabel: t('Delete folder'),
    })
  }, [clearFolderRename])

  const cancelDeleteFolder = useCallback(() => setConfirmDeleteFolder(null), [])

  const confirmDeleteSelectedFolder = useCallback(async () => {
    if (!confirmDeleteFolder) return

    const folderPath = confirmDeleteFolder.path
    try {
      setConfirmDeleteFolder(null)
      await invokeDeleteFolder({ vaultPath, folderPath })
      clearDeletedFolderTabs({
        activeTabPathRef,
        closeAllTabs,
        folderPath,
        setTabs,
        vaultPath,
      })
      await reloadFolders()
      const refreshedEntries = await reloadVault()
      resetSelectionIfFolderDeleted({
        folderPath,
        refreshedEntries,
        selection,
        setSelection,
        vaultPath,
      })
      setToastMessage(t('Deleted folder "{folder}"', { folder: folderLabel({ folderPath }) }))
    } catch (error) {
      setToastMessage(t('Failed to delete folder: {error}', { error: String(error) }))
    }
  }, [activeTabPathRef, closeAllTabs, confirmDeleteFolder, reloadFolders, reloadVault, selection, setSelection, setTabs, setToastMessage, vaultPath])

  const deleteSelectedFolder = useCallback(() => {
    if (selection.kind !== 'folder') return
    requestDeleteFolder(selection.path)
  }, [requestDeleteFolder, selection])

  return {
    cancelDeleteFolder,
    confirmDeleteFolder,
    confirmDeleteSelectedFolder,
    deleteSelectedFolder,
    requestDeleteFolder,
  }
}
