import { useCallback } from 'react'

interface BulkEntryActions {
  handleArchiveNote: (path: string) => Promise<void>
  handleTrashNote: (path: string) => Promise<void>
  handleRestoreNote: (path: string) => Promise<void>
}

export function useBulkActions(
  entryActions: BulkEntryActions,
  setToastMessage: (msg: string | null) => void,
) {
  const handleBulkArchive = useCallback(async (paths: string[]) => {
    let ok = 0
    for (const path of paths) {
      try { await entryActions.handleArchiveNote(path); ok++ }
      catch { /* error toast already shown by flushBeforeAction */ }
    }
    if (ok > 0) setToastMessage(`${ok} note${ok > 1 ? 's' : ''} archived`)
  }, [entryActions, setToastMessage])

  const handleBulkTrash = useCallback(async (paths: string[]) => {
    let ok = 0
    for (const path of paths) {
      try { await entryActions.handleTrashNote(path); ok++ }
      catch { /* error toast already shown by flushBeforeAction */ }
    }
    if (ok > 0) setToastMessage(`${ok} note${ok > 1 ? 's' : ''} moved to trash`)
  }, [entryActions, setToastMessage])

  const handleBulkRestore = useCallback(async (paths: string[]) => {
    let ok = 0
    for (const path of paths) {
      try { await entryActions.handleRestoreNote(path); ok++ }
      catch { /* skip — error toast already shown */ }
    }
    if (ok > 0) setToastMessage(`${ok} note${ok > 1 ? 's' : ''} restored`)
  }, [entryActions, setToastMessage])

  return { handleBulkArchive, handleBulkTrash, handleBulkRestore }
}
