import { type MutableRefObject, useCallback, useMemo } from 'react'
import { openNoteListPropertiesPicker } from '../components/note-list/noteListPropertiesEvents'
import { focusNoteIconPropertyEditor } from '../components/noteIconPropertyEvents'
import type { SidebarSelection, VaultConfig, VaultEntry } from '../types'
import { entrySupportsPreviewSourceToggle } from '../utils/filePreview'
import { requestPlainTextPaste } from '../utils/plainTextPaste'
import type { RichEditorBlockTypeDefinition } from '../utils/richEditorBlockTypes'
import { initializeNoteProperties } from '../utils/initializeNoteProperties'
import { openNoteInNewWindow } from '../utils/openNoteWindow'
import { vaultPathForEntry } from '../utils/workspaces'
import type { useAppWindowControls } from './useAppWindowControls'
import type { useAppWorkspaceRuntime } from './useAppWorkspaceRuntime'
import type { useNoteActions } from './useNoteActions'

type NoteActions = ReturnType<typeof useNoteActions>

export function useAppNotePropertyCommands(
  notes: Pick<NoteActions, 'activeTabPath' | 'handleUpdateFrontmatter' | 'handleDeleteProperty'>,
  setInspectorCollapsed: (collapsed: boolean) => void,
) {
  const handleInitializeProperties = useCallback((path: string) => {
    void initializeNoteProperties(notes.handleUpdateFrontmatter, path).catch((err) => {
      console.warn('Failed to initialize note properties:', err)
    })
  }, [notes])

  const handleRemoveNoteIcon = useCallback(async (path: string) => {
    await notes.handleDeleteProperty(path, 'icon')
  }, [notes])

  const handleSetNoteIconCommand = useCallback(() => {
    setInspectorCollapsed(false)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        focusNoteIconPropertyEditor()
      })
    })
  }, [setInspectorCollapsed])

  const handleRemoveNoteIconCommand = useCallback(() => {
    if (notes.activeTabPath) handleRemoveNoteIcon(notes.activeTabPath)
  }, [notes.activeTabPath, handleRemoveNoteIcon])

  return { handleInitializeProperties, handleSetNoteIconCommand, handleRemoveNoteIconCommand }
}

interface ListPropertyCommandOptions {
  effectiveSelection: SidebarSelection
  updateConfig: ReturnType<typeof useAppWorkspaceRuntime>['git']['updateConfig']
  vaultConfig: VaultConfig
}

function noteListPropertiesScope(selection: SidebarSelection) {
  if (selection.kind === 'view') return 'view'
  if (selection.kind !== 'filter') return null
  switch (selection.filter) {
    case 'all':
    case 'inbox':
      return selection.filter
    default:
      return null
  }
}

function displayedProperties(value: string[] | null) {
  return value?.length ? value : null
}

export function useAppListPropertyCommands({ effectiveSelection, updateConfig, vaultConfig }: ListPropertyCommandOptions) {
  const handleCustomizeNoteListColumns = useCallback(() => {
    const scope = noteListPropertiesScope(effectiveSelection)
    if (scope) openNoteListPropertiesPicker(scope)
  }, [effectiveSelection])

  const handleUpdateAllNotesNoteListProperties = useCallback((value: string[] | null) => {
    updateConfig('allNotes', { ...vaultConfig.allNotes, noteListProperties: displayedProperties(value) })
  }, [updateConfig, vaultConfig.allNotes])

  const handleUpdateInboxNoteListProperties = useCallback((value: string[] | null) => {
    updateConfig('inbox', { ...vaultConfig.inbox, noteListProperties: displayedProperties(value) })
  }, [updateConfig, vaultConfig.inbox])

  return { handleCustomizeNoteListColumns, handleUpdateAllNotesNoteListProperties, handleUpdateInboxNoteListProperties }
}

export function useAppNoteWindowCommands(
  notes: Pick<NoteActions, 'activeTabPath' | 'tabs'>,
  resolvedPath: string,
) {
  const handleOpenInNewWindow = useCallback(() => {
    const activeTab = notes.tabs.find(t => t.entry.path === notes.activeTabPath)
    if (activeTab) {
      openNoteInNewWindow(
        activeTab.entry.path,
        vaultPathForEntry(activeTab.entry, resolvedPath),
        activeTab.entry.title,
      )
    }
  }, [notes.tabs, notes.activeTabPath, resolvedPath])

  const handleOpenEntryInNewWindow = useCallback((entry: Pick<VaultEntry, 'path' | 'title' | 'workspace'>) => {
    openNoteInNewWindow(entry.path, vaultPathForEntry(entry, resolvedPath), entry.title)
  }, [resolvedPath])

  return { handleOpenInNewWindow, handleOpenEntryInNewWindow }
}

interface AppEditorCommandsOptions extends Pick<
  ReturnType<typeof useAppWindowControls>,
  | 'diffToggleRef'
  | 'findInNoteRef'
  | 'pdfExportRef'
  | 'rawToggleRef'
  | 'tableOfContentsToggleRef'
> {
  activeEntry: VaultEntry | null
  activeNoteDeleted: boolean
  activeTabPath: NoteActions['activeTabPath']
  turnCurrentBlockIntoRef: MutableRefObject<((target: RichEditorBlockTypeDefinition) => void) | null>
}

type ActiveNoteEditorCommandOptions = Pick<
  AppEditorCommandsOptions,
  'activeNoteDeleted' | 'findInNoteRef' | 'pdfExportRef' | 'turnCurrentBlockIntoRef'
>

function useActiveNoteEditorCommands({
  activeNoteDeleted,
  findInNoteRef,
  pdfExportRef,
  turnCurrentBlockIntoRef,
}: ActiveNoteEditorCommandOptions) {
  const exportNotePdfCommand = useCallback(() => {
    pdfExportRef.current?.('app_command')
  }, [pdfExportRef])
  const replaceInNoteCommand = useCallback(() => {
    findInNoteRef.current?.({ replace: true })
  }, [findInNoteRef])
  const turnCurrentBlockIntoCommand = useCallback((target: RichEditorBlockTypeDefinition) => {
    turnCurrentBlockIntoRef.current?.(target)
  }, [turnCurrentBlockIntoRef])

  if (activeNoteDeleted) {
    return { onExportNoteAsPdf: undefined, onReplaceInNote: undefined, onTurnCurrentBlockInto: undefined }
  }
  return {
    onExportNoteAsPdf: exportNotePdfCommand,
    onReplaceInNote: replaceInNoteCommand,
    onTurnCurrentBlockInto: turnCurrentBlockIntoCommand,
  }
}

export function useAppEditorCommands({
  activeEntry,
  activeNoteDeleted,
  activeTabPath,
  diffToggleRef,
  findInNoteRef,
  pdfExportRef,
  rawToggleRef,
  tableOfContentsToggleRef,
  turnCurrentBlockIntoRef,
}: AppEditorCommandsOptions) {
  const canToggleRichEditor = !!activeEntry
    && entrySupportsPreviewSourceToggle(activeEntry)
    && !activeNoteDeleted

  const toggleDiffCommand = useCallback(() => diffToggleRef.current(), [diffToggleRef])
  const toggleRawEditorCommand = useMemo(
    () => canToggleRichEditor ? () => rawToggleRef.current() : undefined,
    [canToggleRichEditor, rawToggleRef],
  )
  const toggleTableOfContentsCommand = useCallback(() => {
    if (activeTabPath) tableOfContentsToggleRef.current()
  }, [activeTabPath, tableOfContentsToggleRef])
  const findInNoteCommand = useCallback(() => {
    findInNoteRef.current?.({ replace: false })
  }, [findInNoteRef])
  const pastePlainTextCommand = useCallback(() => {
    void requestPlainTextPaste().catch((error) => {
      console.warn('[paste] Failed to paste plain text:', error)
    })
  }, [])

  const activeNoteCommands = useActiveNoteEditorCommands({
    activeNoteDeleted,
    findInNoteRef,
    pdfExportRef,
    turnCurrentBlockIntoRef,
  })
  return {
    ...activeNoteCommands,
    onToggleDiff: toggleDiffCommand,
    onToggleRawEditor: toggleRawEditorCommand,
    onToggleTableOfContents: toggleTableOfContentsCommand,
    onFindInNote: findInNoteCommand,
    onPastePlainText: pastePlainTextCommand,
  }
}
