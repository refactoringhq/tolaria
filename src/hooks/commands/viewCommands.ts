import { APP_COMMAND_IDS, getAppCommandShortcutDisplay } from '../appCommandCatalog'
import type { CommandAction } from './types'
import type { ViewMode } from '../useViewMode'
import type { NoteWidthMode } from '../../types'
import { requestNewAiChat } from '../../utils/aiPromptBridge'

interface ViewCommandsConfig {
  hasActiveNote: boolean
  activeNoteModified: boolean
  onSetViewMode: (mode: ViewMode) => void
  onToggleInspector: () => void
  onToggleDiff?: () => void
  onToggleRawEditor?: () => void
  noteWidth?: NoteWidthMode
  onSetNoteWidth?: (width: NoteWidthMode) => void
  onSetDefaultNoteWidth?: (width: NoteWidthMode) => void
  onToggleAIChat?: () => void
  zoomLevel: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onCustomizeNoteListColumns?: () => void
  canCustomizeNoteListColumns?: boolean
  noteListColumnsLabel: string
}

function buildNoteWidthCommands(
  noteWidth: NoteWidthMode,
  onSetNoteWidth?: (width: NoteWidthMode) => void,
  onSetDefaultNoteWidth?: (width: NoteWidthMode) => void,
): CommandAction[] {
  const noteModeCommands = (['normal', 'wide'] as const).map((width) => ({
    id: `set-note-width-${width}`,
    label: `Set Note Width: ${width === 'wide' ? 'Wide' : 'Normal'}`,
    group: 'View' as const,
    keywords: ['layout', 'note', 'width', 'wide', 'normal', 'reading'],
    enabled: Boolean(onSetNoteWidth) && noteWidth !== width,
    execute: () => onSetNoteWidth?.(width),
  }))
  const defaultModeCommands = (['normal', 'wide'] as const).map((width) => ({
    id: `set-default-note-width-${width}`,
    label: `Set Default Note Width: ${width === 'wide' ? 'Wide' : 'Normal'}`,
    group: 'View' as const,
    keywords: ['layout', 'default', 'preference', 'width', 'wide', 'normal', 'reading'],
    enabled: Boolean(onSetDefaultNoteWidth),
    execute: () => onSetDefaultNoteWidth?.(width),
  }))

  return [...noteModeCommands, ...defaultModeCommands]
}

export function buildViewCommands(config: ViewCommandsConfig): CommandAction[] {
  const {
    hasActiveNote, activeNoteModified,
    onSetViewMode, onToggleInspector, onToggleDiff, onToggleRawEditor, noteWidth = 'normal', onSetNoteWidth, onSetDefaultNoteWidth, onToggleAIChat,
    zoomLevel, onZoomIn, onZoomOut, onZoomReset,
    onCustomizeNoteListColumns, canCustomizeNoteListColumns, noteListColumnsLabel,
  } = config

  return [
    { id: 'view-editor', label: 'Editor Only', group: 'View', shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewEditorOnly), keywords: ['layout', 'focus'], enabled: true, execute: () => onSetViewMode('editor-only') },
    { id: 'view-editor-list', label: 'Editor + Note List', group: 'View', shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewEditorList), keywords: ['layout'], enabled: true, execute: () => onSetViewMode('editor-list') },
    { id: 'view-all', label: 'Full Layout', group: 'View', shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewAll), keywords: ['layout', 'sidebar'], enabled: true, execute: () => onSetViewMode('all') },
    { id: 'toggle-inspector', label: 'Toggle Properties Panel', group: 'View', shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewToggleProperties), keywords: ['properties', 'inspector', 'panel', 'right', 'sidebar'], enabled: true, execute: onToggleInspector },
    { id: 'toggle-diff', label: 'Toggle Diff Mode', group: 'View', keywords: ['diff', 'changes', 'git', 'compare', 'version'], enabled: hasActiveNote && activeNoteModified, execute: () => onToggleDiff?.() },
    { id: 'toggle-raw-editor', label: 'Toggle Raw Editor', group: 'View', keywords: ['raw', 'source', 'markdown', 'frontmatter', 'code', 'textarea'], enabled: hasActiveNote && !!onToggleRawEditor, execute: () => onToggleRawEditor?.() },
    ...buildNoteWidthCommands(noteWidth, onSetNoteWidth, onSetDefaultNoteWidth),
    { id: 'toggle-ai-panel', label: 'Toggle AI Panel', group: 'View', shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewToggleAiChat), keywords: ['ai', 'agent', 'chat', 'assistant', 'contextual'], enabled: true, execute: () => onToggleAIChat?.() },
    { id: 'new-ai-chat', label: 'New AI chat', group: 'View', keywords: ['ai', 'agent', 'chat', 'assistant', 'new', 'fresh', 'conversation', 'reset'], enabled: true, execute: requestNewAiChat },
    { id: 'toggle-backlinks', label: 'Toggle Backlinks', group: 'View', keywords: ['backlinks', 'references', 'links', 'mentions', 'incoming'], enabled: hasActiveNote, execute: onToggleInspector },
    { id: 'customize-note-list-columns', label: noteListColumnsLabel, group: 'View', keywords: ['all notes', 'inbox', 'columns', 'chips', 'properties', 'note list'], enabled: !!(canCustomizeNoteListColumns && onCustomizeNoteListColumns), execute: () => onCustomizeNoteListColumns?.() },
    { id: 'zoom-in', label: `Zoom In (${zoomLevel}%)`, group: 'View', shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewZoomIn), keywords: ['zoom', 'bigger', 'larger', 'scale'], enabled: zoomLevel < 150, execute: onZoomIn },
    { id: 'zoom-out', label: `Zoom Out (${zoomLevel}%)`, group: 'View', shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewZoomOut), keywords: ['zoom', 'smaller', 'scale'], enabled: zoomLevel > 80, execute: onZoomOut },
    { id: 'zoom-reset', label: 'Reset Zoom', group: 'View', shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewZoomReset), keywords: ['zoom', 'actual', 'default', '100'], enabled: zoomLevel !== 100, execute: onZoomReset },
  ]
}
