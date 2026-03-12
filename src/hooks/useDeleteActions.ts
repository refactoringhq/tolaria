import { useCallback, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { VaultEntry } from '../types'

interface ConfirmDeleteState {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
}

interface UseDeleteActionsInput {
  vaultPath: string
  entries: VaultEntry[]
  handleCloseTab: (path: string) => void
  removeEntry: (path: string) => void
  setToastMessage: (msg: string | null) => void
}

export function useDeleteActions({
  vaultPath,
  entries,
  handleCloseTab,
  removeEntry,
  setToastMessage,
}: UseDeleteActionsInput) {
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState | null>(null)

  const trashedCount = useMemo(() => entries.filter(e => e.trashed).length, [entries])

  const deleteNoteFromDisk = useCallback(async (path: string) => {
    try {
      if (isTauri()) await invoke('delete_note', { path })
      else await mockInvoke('delete_note', { path })
      handleCloseTab(path)
      removeEntry(path)
      return true
    } catch (e) {
      setToastMessage(`Failed to delete note: ${e}`)
      return false
    }
  }, [handleCloseTab, removeEntry, setToastMessage])

  const handleDeleteNote = useCallback(async (path: string) => {
    setConfirmDelete({
      title: 'Delete permanently?',
      message: 'This note will be permanently deleted. This cannot be undone.',
      onConfirm: async () => {
        setConfirmDelete(null)
        const ok = await deleteNoteFromDisk(path)
        if (ok) setToastMessage('Note permanently deleted')
      },
    })
  }, [deleteNoteFromDisk, setToastMessage])

  const handleBulkDeletePermanently = useCallback((paths: string[]) => {
    const count = paths.length
    setConfirmDelete({
      title: `Delete ${count} ${count === 1 ? 'note' : 'notes'} permanently?`,
      message: `${count === 1 ? 'This note' : `These ${count} notes`} will be permanently deleted. This cannot be undone.`,
      onConfirm: async () => {
        setConfirmDelete(null)
        let ok = 0
        for (const path of paths) {
          if (await deleteNoteFromDisk(path)) ok++
        }
        if (ok > 0) setToastMessage(`${ok} note${ok > 1 ? 's' : ''} permanently deleted`)
      },
    })
  }, [deleteNoteFromDisk, setToastMessage])

  const handleEmptyTrash = useCallback(() => {
    if (trashedCount === 0) return
    setConfirmDelete({
      title: 'Empty Trash?',
      message: `Permanently delete all ${trashedCount} trashed ${trashedCount === 1 ? 'note' : 'notes'}? This cannot be undone.`,
      confirmLabel: 'Empty Trash',
      onConfirm: async () => {
        setConfirmDelete(null)
        try {
          const tauriInvoke = isTauri() ? invoke : mockInvoke
          const deleted = await tauriInvoke<string[]>('empty_trash', { vaultPath })
          for (const path of deleted) {
            handleCloseTab(path)
            removeEntry(path)
          }
          setToastMessage(`${deleted.length} note${deleted.length !== 1 ? 's' : ''} permanently deleted`)
        } catch (e) {
          setToastMessage(`Failed to empty trash: ${e}`)
        }
      },
    })
  }, [trashedCount, vaultPath, handleCloseTab, removeEntry, setToastMessage])

  return {
    confirmDelete,
    setConfirmDelete,
    trashedCount,
    deleteNoteFromDisk,
    handleDeleteNote,
    handleBulkDeletePermanently,
    handleEmptyTrash,
  }
}
