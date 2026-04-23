import { useCallback, useEffect, useRef } from 'react'

export const FOLDER_ROW_SINGLE_CLICK_DELAY_MS = 180

interface UseFolderRowInteractionsInput {
  hasChildren: boolean
  onRenameFolder?: () => void
  onSelect: () => void
  onToggle: () => void
}

export function useFolderRowInteractions({
  hasChildren,
  onRenameFolder,
  onSelect,
  onToggle,
}: UseFolderRowInteractionsInput) {
  const pendingToggleRef = useRef<number | null>(null)

  const clearPendingToggle = useCallback(() => {
    if (pendingToggleRef.current === null) return
    window.clearTimeout(pendingToggleRef.current)
    pendingToggleRef.current = null
  }, [])

  useEffect(() => clearPendingToggle, [clearPendingToggle])

  const handleSelectClick = useCallback((clickDetail: number) => {
    onSelect()
    if (!hasChildren) return

    if (clickDetail === 0) {
      clearPendingToggle()
      onToggle()
      return
    }

    if (clickDetail !== 1) return

    clearPendingToggle()
    pendingToggleRef.current = window.setTimeout(() => {
      pendingToggleRef.current = null
      onToggle()
    }, FOLDER_ROW_SINGLE_CLICK_DELAY_MS)
  }, [clearPendingToggle, hasChildren, onSelect, onToggle])

  const handleRenameDoubleClick = useCallback(() => {
    clearPendingToggle()
    onRenameFolder?.()
  }, [clearPendingToggle, onRenameFolder])

  return {
    handleRenameDoubleClick,
    handleSelectClick,
  }
}
