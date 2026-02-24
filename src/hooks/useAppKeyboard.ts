import { useEffect } from 'react'
import type { ViewMode } from './useViewMode'

interface KeyboardActions {
  onQuickOpen: () => void
  onCommandPalette: () => void
  onCreateNote: () => void
  onSave: () => void
  onOpenSettings: () => void
  onTrashNote: (path: string) => void
  onArchiveNote: (path: string) => void
  onSetViewMode: (mode: ViewMode) => void
  activeTabPathRef: React.MutableRefObject<string | null>
  handleCloseTabRef: React.MutableRefObject<(path: string) => void>
}

type ShortcutHandler = () => void

const VIEW_MODE_KEYS: Record<string, ViewMode> = {
  '1': 'editor-only',
  '2': 'editor-list',
  '3': 'all',
}

function isCmdOnly(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && !e.altKey
}

function handleViewModeKey(e: KeyboardEvent, onSetViewMode: (m: ViewMode) => void): boolean {
  if (!isCmdOnly(e)) return false
  const mode = VIEW_MODE_KEYS[e.key]
  if (!mode) return false
  e.preventDefault()
  onSetViewMode(mode)
  return true
}

function handleCmdKey(e: KeyboardEvent, keyMap: Record<string, ShortcutHandler>): boolean {
  const mod = e.metaKey || e.ctrlKey
  if (!mod) return false
  const handler = keyMap[e.key]
  if (!handler) return false
  e.preventDefault()
  handler()
  return true
}

export function useAppKeyboard({
  onQuickOpen, onCommandPalette, onCreateNote, onSave, onOpenSettings, onTrashNote, onArchiveNote,
  onSetViewMode, activeTabPathRef, handleCloseTabRef,
}: KeyboardActions) {
  useEffect(() => {
    const withActiveTab = (fn: (path: string) => void): ShortcutHandler => () => {
      const path = activeTabPathRef.current
      if (path) fn(path)
    }

    const cmdKeyMap: Record<string, ShortcutHandler> = {
      k: onCommandPalette,
      p: onQuickOpen,
      n: onCreateNote,
      s: onSave,
      ',': onOpenSettings,
      e: withActiveTab(onArchiveNote),
      w: withActiveTab((path) => handleCloseTabRef.current(path)),
      Backspace: withActiveTab(onTrashNote),
      Delete: withActiveTab(onTrashNote),
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!handleViewModeKey(e, onSetViewMode)) {
        handleCmdKey(e, cmdKeyMap)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onQuickOpen, onCommandPalette, onCreateNote, onSave, onOpenSettings, onTrashNote, onArchiveNote, activeTabPathRef, handleCloseTabRef, onSetViewMode])
}
