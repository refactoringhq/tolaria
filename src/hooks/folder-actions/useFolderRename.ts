import { useCallback, useState } from 'react'
import type { SidebarSelection, VaultEntry } from '../../types'
import {
  folderLabel,
  invokeRenameFolder,
  resolveFolderVaultPath,
  type FolderTab,
  updateSelectionAfterFolderRename,
  updateTabsAfterFolderRename,
} from './folderActionUtils'

export interface FolderRenameTarget {
  path: string
  rootPath?: string
}

interface UseFolderRenameInput {
  activeTabPathRef: React.MutableRefObject<string | null>
  handleSwitchTab: (path: string) => void
  reloadFolders: () => Promise<unknown>
  reloadVault: () => Promise<VaultEntry[]>
  selection: SidebarSelection
  setSelection: (selection: SidebarSelection) => void
  setTabs: React.Dispatch<React.SetStateAction<FolderTab[]>>
  setToastMessage: (message: string | null) => void
  vaultPath: string
}

export function useFolderRename(options: UseFolderRenameInput) {
  const { activeTabPathRef, handleSwitchTab, reloadFolders, reloadVault, selection, setSelection, setTabs, setToastMessage, vaultPath } = options
  const [renamingFolderPath, setRenamingFolderPath] = useState<FolderRenameTarget | null>(null)

  const cancelFolderRename = useCallback(() => setRenamingFolderPath(null), [])
  const startFolderRename = useCallback((folderPath: string, rootPath?: string) => {
    setRenamingFolderPath(rootPath ? { path: folderPath, rootPath } : { path: folderPath })
  }, [])

  const renameFolder = useCallback(
    async (folderPath: string, nextName: string, rootPath?: string) => {
    const trimmedName = nextName.trim()
    if (trimmedName === folderLabel({ folderPath })) {
      setRenamingFolderPath(null)
      return true
    }

    const targetVaultPath = resolveFolderVaultPath(rootPath ?? renamingFolderPath?.rootPath, vaultPath)

    try {
        const renameResult = await invokeRenameFolder({
          vaultPath: targetVaultPath,
          folderPath,
          newName: trimmedName,
        })
      setRenamingFolderPath(null)
      await reloadFolders()
      const refreshedEntries = await reloadVault()
      updateTabsAfterFolderRename({
        activeTabPathRef,
        handleSwitchTab,
        refreshedEntries,
        renameResult,
        setTabs,
        vaultPath: targetVaultPath,
      })
      updateSelectionAfterFolderRename({
        refreshedEntries,
        renameResult,
        selection,
        setSelection,
        vaultPath: targetVaultPath,
      })
      setToastMessage(`Renamed folder to "${trimmedName}"`)
      return true
    } catch (error) {
      setToastMessage(`Failed to rename folder: ${error}`)
      return false
    }
    },
    [
      activeTabPathRef,
      handleSwitchTab,
      reloadFolders,
      reloadVault,
      renamingFolderPath,
      selection,
      setSelection,
      setTabs,
      setToastMessage,
      vaultPath,
    ],
  )

  const renameSelectedFolder = useCallback(() => {
    if (selection.kind !== 'folder' || !selection.path) return
    startFolderRename(selection.path, selection.rootPath)
  }, [selection, startFolderRename])

  return {
    cancelFolderRename,
    renameFolder,
    renameSelectedFolder,
    renamingFolderPath,
    startFolderRename,
  }
}
