import { startTransition, useCallback, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { t } from '../lib/i18n'
import { isTauri, mockInvoke } from '../mock-tauri'
import { trackEvent } from '../lib/telemetry'

interface ConfirmDeleteState {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
}

interface UseDeleteActionsInput {
  /** Called to deselect the note if it is currently open. */
  onDeselectNote: (path: string) => void
  removeEntry: (path: string) => void
  removeEntries?: (paths: string[]) => void
  refreshModifiedFiles: () => Promise<unknown> | void
  reloadVault: () => Promise<unknown> | void
  setToastMessage: (msg: string | null) => void
}

function describeNotes(count: number): string {
  return count === 1 ? t('note') : t('{count} notes', { count })
}

function buildDeleteProgressMessage(count: number): string {
  return t('Deleting {notes}...', { notes: describeNotes(count) })
}

function buildDeleteSuccessMessage(count: number): string {
  return count === 1 ? t('Note permanently deleted') : t('{count} notes permanently deleted', { count })
}

function buildDeleteFailureMessage(error: unknown, count: number): string {
  return t('Failed to delete {notes}: {error}', { notes: describeNotes(count), error: String(error) })
}

function buildPartialDeleteMessage(deletedCount: number, requestedCount: number): string {
  if (deletedCount === 0) {
    return t('Failed to delete {notes}. The note list was reloaded.', { notes: describeNotes(requestedCount) })
  }
  return t('Deleted {deletedCount} of {requestedCount} notes. The note list was reloaded to recover failed items.', { deletedCount, requestedCount })
}

async function runDeleteCommand(paths: string[]): Promise<string[]> {
  if (isTauri()) return invoke<string[]>('batch_delete_notes_async', { paths })
  return mockInvoke<string[]>('batch_delete_notes', { paths })
}

function useDeleteRunner({
  onDeselectNote,
  removeEntry,
  removeEntries,
  refreshModifiedFiles,
  reloadVault,
  setToastMessage,
}: UseDeleteActionsInput) {
  const [pendingDeleteCount, setPendingDeleteCount] = useState(0)

  const reconcileDeleteFailure = useCallback(async () => {
    await Promise.allSettled([
      Promise.resolve(reloadVault()),
      Promise.resolve(refreshModifiedFiles()),
    ])
  }, [refreshModifiedFiles, reloadVault])

  const optimisticallyRemoveEntries = useCallback((paths: string[]) => {
    startTransition(() => {
      for (const path of paths) onDeselectNote(path)
      if (removeEntries) {
        removeEntries(paths)
        return
      }
      for (const path of paths) removeEntry(path)
    })
  }, [onDeselectNote, removeEntries, removeEntry])

  const deleteNotesFromDisk = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return 0

    setPendingDeleteCount((count) => count + paths.length)
    setToastMessage(buildDeleteProgressMessage(paths.length))
    optimisticallyRemoveEntries(paths)

    try {
      const deletedPaths = await runDeleteCommand(paths)
      const deletedCount = deletedPaths.length

      if (deletedCount > 0) {
        trackEvent('note_deleted')
      }

      if (deletedCount !== paths.length) {
        await reconcileDeleteFailure()
        setToastMessage(buildPartialDeleteMessage(deletedCount, paths.length))
        return deletedCount
      }

      await Promise.resolve(refreshModifiedFiles())
      setToastMessage(buildDeleteSuccessMessage(deletedCount))
      return deletedCount
    } catch (e) {
      await reconcileDeleteFailure()
      setToastMessage(buildDeleteFailureMessage(e, paths.length))
      return 0
    } finally {
      setPendingDeleteCount((count) => Math.max(0, count - paths.length))
    }
  }, [optimisticallyRemoveEntries, reconcileDeleteFailure, refreshModifiedFiles, setToastMessage])

  const deleteNoteFromDisk = useCallback(async (path: string) => {
    const deletedCount = await deleteNotesFromDisk([path])
    return deletedCount === 1
  }, [deleteNotesFromDisk])

  return {
    deleteNoteFromDisk,
    deleteNotesFromDisk,
    pendingDeleteCount,
  }
}

export function useDeleteActions({
  onDeselectNote,
  removeEntry,
  removeEntries,
  refreshModifiedFiles,
  reloadVault,
  setToastMessage,
}: UseDeleteActionsInput) {
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState | null>(null)
  const {
    deleteNoteFromDisk,
    deleteNotesFromDisk,
    pendingDeleteCount,
  } = useDeleteRunner({
    onDeselectNote,
    removeEntry,
    removeEntries,
    refreshModifiedFiles,
    reloadVault,
    setToastMessage,
  })

  const handleDeleteNote = useCallback(async (path: string) => {
    setConfirmDelete({
      title: t('Delete permanently?'),
      message: t('Delete permanently? This cannot be undone. You can recover it from Git history.'),
      onConfirm: async () => {
        setConfirmDelete(null)
        await deleteNoteFromDisk(path)
      },
    })
  }, [deleteNoteFromDisk])

  const handleBulkDeletePermanently = useCallback((paths: string[]) => {
    const count = paths.length
    setConfirmDelete({
      title: count === 1
        ? t('Delete 1 note permanently?')
        : t('Delete {count} notes permanently?', { count }),
      message: count === 1
        ? t('This note will be permanently deleted. This cannot be undone.')
        : t('These {count} notes will be permanently deleted. This cannot be undone.', { count }),
      onConfirm: async () => {
        setConfirmDelete(null)
        await deleteNotesFromDisk(paths)
      },
    })
  }, [deleteNotesFromDisk])

  return {
    confirmDelete,
    pendingDeleteCount,
    setConfirmDelete,
    deleteNoteFromDisk,
    handleDeleteNote,
    handleBulkDeletePermanently,
  }
}
