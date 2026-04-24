import { useCallback, useMemo } from 'react'
import type { VaultEntry } from '../types'

interface BulkEntryActions {
  handleArchiveNote: (path: string) => Promise<void>
  handleToggleOrganized: (path: string) => Promise<boolean>
}

function formatBulkToast(count: number, label: string) {
  return `${count} note${count > 1 ? 's' : ''} ${label}`
}

async function runBulkAction(paths: string[], action: (path: string) => Promise<boolean>) {
  let ok = 0
  for (const path of paths) {
    try {
      if (await action(path)) ok++
    } catch {
      // Error toast already shown by the underlying action.
    }
  }
  return ok
}

export function useBulkActions(
  entryActions: BulkEntryActions,
  entries: VaultEntry[],
  setToastMessage: (msg: string | null) => void,
) {
  const organizedPathSet = useMemo(
    () => new Set(entries.filter((entry) => entry.organized).map((entry) => entry.path)),
    [entries],
  )

  const handleBulkArchive = useCallback(async (paths: string[]) => {
    const ok = await runBulkAction(paths, async (path) => {
      await entryActions.handleArchiveNote(path)
      return true
    })
    if (ok > 0) setToastMessage(formatBulkToast(ok, 'archived'))
  }, [entryActions, setToastMessage])

  const handleBulkOrganize = useCallback(async (paths: string[]) => {
    const ok = await runBulkAction(paths, async (path) => {
      if (organizedPathSet.has(path)) return false
      return entryActions.handleToggleOrganized(path)
    })
    if (ok > 0) setToastMessage(formatBulkToast(ok, 'organized'))
  }, [entryActions, organizedPathSet, setToastMessage])

  return { handleBulkArchive, handleBulkOrganize }
}
