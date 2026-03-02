import { useEffect } from 'react'
import type { ViewMode } from './useViewMode'

interface KeyboardActions {
  onQuickOpen: () => void
  onCommandPalette: () => void
  onSearch: () => void
  onCreateNote: () => void
  onOpenDailyNote: () => void
  onSave: () => void
  onOpenSettings: () => void
  onTrashNote: (path: string) => void
  onArchiveNote: (path: string) => void
  onSetViewMode: (mode: ViewMode) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onGoBack?: () => void
  onGoForward?: () => void
  onToggleAIChat?: () => void
  activeTabPathRef: React.MutableRefObject<string | null>
  handleCloseTabRef: React.MutableRefObject<(path: string) => void>
}

type ShortcutHandler = () => void

const TEXT_EDITING_KEYS = new Set(['Backspace', 'Delete'])

function isTextInputFocused(): boolean {
  const tag = document.activeElement?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA'
}

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
  if (TEXT_EDITING_KEYS.has(e.key) && isTextInputFocused()) return false
  e.preventDefault()
  handler()
  return true
}

export function useAppKeyboard({
  onQuickOpen, onCommandPalette, onSearch, onCreateNote, onOpenDailyNote, onSave, onOpenSettings, onTrashNote, onArchiveNote,
  onSetViewMode, onZoomIn, onZoomOut, onZoomReset, onGoBack, onGoForward, onToggleAIChat, activeTabPathRef, handleCloseTabRef,
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
      j: onOpenDailyNote,
      s: onSave,
      ',': onOpenSettings,
      e: withActiveTab(onArchiveNote),
      w: withActiveTab((path) => handleCloseTabRef.current(path)),
      Backspace: withActiveTab(onTrashNote),
      Delete: withActiveTab(onTrashNote),
      '[': () => onGoBack?.(),
      ']': () => onGoForward?.(),
      '=': onZoomIn,
      '+': onZoomIn,
      '-': onZoomOut,
      '0': onZoomReset,
      i: () => onToggleAIChat?.(),
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Shift+F: full-text search (distinct from Cmd+F browser find)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault()
        onSearch()
        return
      }
      if (!handleViewModeKey(e, onSetViewMode)) {
        handleCmdKey(e, cmdKeyMap)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onQuickOpen, onCommandPalette, onSearch, onCreateNote, onOpenDailyNote, onSave, onOpenSettings, onTrashNote, onArchiveNote, activeTabPathRef, handleCloseTabRef, onSetViewMode, onZoomIn, onZoomOut, onZoomReset, onGoBack, onGoForward, onToggleAIChat])
}
