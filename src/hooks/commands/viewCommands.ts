import type { CommandAction } from './types'
import type { ViewMode } from '../useViewMode'

interface ViewCommandsConfig {
  hasActiveNote: boolean
  activeNoteModified: boolean
  onSetViewMode: (mode: ViewMode) => void
  onToggleInspector: () => void
  onToggleDiff?: () => void
  onToggleRawEditor?: () => void
  onToggleAIChat?: () => void
  zoomLevel: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onCustomizeInboxColumns?: () => void
  canCustomizeInboxColumns?: boolean
}

export function buildViewCommands(config: ViewCommandsConfig): CommandAction[] {
  const {
    hasActiveNote, activeNoteModified,
    onSetViewMode, onToggleInspector, onToggleDiff, onToggleRawEditor, onToggleAIChat,
    zoomLevel, onZoomIn, onZoomOut, onZoomReset, onCustomizeInboxColumns, canCustomizeInboxColumns,
  } = config

  return [
    { id: 'view-editor', label: 'Editor Only', group: 'View', shortcut: '⌘1', keywords: ['layout', 'focus'], enabled: true, execute: () => onSetViewMode('editor-only') },
    { id: 'view-editor-list', label: 'Editor + Note List', group: 'View', shortcut: '⌘2', keywords: ['layout'], enabled: true, execute: () => onSetViewMode('editor-list') },
    { id: 'view-all', label: 'Full Layout', group: 'View', shortcut: '⌘3', keywords: ['layout', 'sidebar'], enabled: true, execute: () => onSetViewMode('all') },
    { id: 'toggle-inspector', label: 'Toggle Properties Panel', group: 'View', shortcut: '⌘⇧I', keywords: ['properties', 'inspector', 'panel', 'right', 'sidebar'], enabled: true, execute: onToggleInspector },
    { id: 'toggle-diff', label: 'Toggle Diff Mode', group: 'View', keywords: ['diff', 'changes', 'git', 'compare', 'version'], enabled: hasActiveNote && activeNoteModified, execute: () => onToggleDiff?.() },
    { id: 'toggle-raw-editor', label: 'Toggle Raw Editor', group: 'View', keywords: ['raw', 'source', 'markdown', 'frontmatter', 'code', 'textarea'], enabled: hasActiveNote, execute: () => onToggleRawEditor?.() },
    { id: 'toggle-ai-panel', label: 'Toggle AI Panel', group: 'View', shortcut: '⇧⌘L', keywords: ['ai', 'agent', 'chat', 'assistant', 'contextual'], enabled: true, execute: () => onToggleAIChat?.() },
    { id: 'toggle-backlinks', label: 'Toggle Backlinks', group: 'View', keywords: ['backlinks', 'references', 'links', 'mentions', 'incoming'], enabled: hasActiveNote, execute: onToggleInspector },
    { id: 'customize-inbox-columns', label: 'Customize Inbox columns', group: 'View', keywords: ['inbox', 'columns', 'chips', 'properties', 'note list'], enabled: !!(canCustomizeInboxColumns && onCustomizeInboxColumns), execute: () => onCustomizeInboxColumns?.() },
    { id: 'zoom-in', label: `Zoom In (${zoomLevel}%)`, group: 'View', shortcut: '⌘=', keywords: ['zoom', 'bigger', 'larger', 'scale'], enabled: zoomLevel < 150, execute: onZoomIn },
    { id: 'zoom-out', label: `Zoom Out (${zoomLevel}%)`, group: 'View', shortcut: '⌘-', keywords: ['zoom', 'smaller', 'scale'], enabled: zoomLevel > 80, execute: onZoomOut },
    { id: 'zoom-reset', label: 'Reset Zoom', group: 'View', shortcut: '⌘0', keywords: ['zoom', 'actual', 'default', '100'], enabled: zoomLevel !== 100, execute: onZoomReset },
  ]
}
