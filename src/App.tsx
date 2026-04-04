import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { NoteList } from './components/NoteList'
import { Editor } from './components/Editor'
import { ResizeHandle } from './components/ResizeHandle'
import { CreateTypeDialog } from './components/CreateTypeDialog'
import { CreateViewDialog } from './components/CreateViewDialog'
import { QuickOpenPalette } from './components/QuickOpenPalette'
import { CommandPalette } from './components/CommandPalette'
import { SearchPanel } from './components/SearchPanel'
import { Toast } from './components/Toast'
import { CommitDialog } from './components/CommitDialog'
import { PulseView } from './components/PulseView'
import { StatusBar } from './components/StatusBar'
import { SettingsPanel } from './components/SettingsPanel'
import { GitHubVaultModal } from './components/GitHubVaultModal'
import { WelcomeScreen } from './components/WelcomeScreen'
import { TelemetryConsentDialog } from './components/TelemetryConsentDialog'
import { useTelemetry } from './hooks/useTelemetry'
import { useMcpStatus } from './hooks/useMcpStatus'
import { useClaudeCodeStatus } from './hooks/useClaudeCodeStatus'
import { useVaultLoader } from './hooks/useVaultLoader'
import { useSettings } from './hooks/useSettings'
import { useNoteActions } from './hooks/useNoteActions'
import { useCommitFlow } from './hooks/useCommitFlow'
import { useViewMode } from './hooks/useViewMode'
import { useEntryActions } from './hooks/useEntryActions'
import { useAppCommands } from './hooks/useAppCommands'
import { isEmoji } from './utils/emoji'
import { generateCommitMessage } from './utils/commitMessage'
import { useDialogs } from './hooks/useDialogs'
import { useVaultSwitcher } from './hooks/useVaultSwitcher'
import { useGitHistory } from './hooks/useGitHistory'
import { useUpdater, restartApp } from './hooks/useUpdater'
import { useAutoSync } from './hooks/useAutoSync'
import { useConflictResolver } from './hooks/useConflictResolver'
import { useZoom } from './hooks/useZoom'
import { useVaultConfig } from './hooks/useVaultConfig'
import { useBuildNumber } from './hooks/useBuildNumber'
import { useOnboarding } from './hooks/useOnboarding'
import { useAppNavigation } from './hooks/useAppNavigation'
import { useAiActivity } from './hooks/useAiActivity'
import { useBulkActions } from './hooks/useBulkActions'
import { useDeleteActions } from './hooks/useDeleteActions'
import { useLayoutPanels } from './hooks/useLayoutPanels'
import { useConflictFlow } from './hooks/useConflictFlow'
import { useAppSave } from './hooks/useAppSave'
import { useVaultBridge } from './hooks/useVaultBridge'
import { ConflictResolverModal } from './components/ConflictResolverModal'
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog'
import { UpdateBanner } from './components/UpdateBanner'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from './mock-tauri'
import type { SidebarSelection, InboxPeriod } from './types'
import type { NoteListItem } from './utils/ai-context'
import { filterEntries, filterInboxEntries, type NoteListFilter } from './utils/noteListHelpers'
import { openNoteInNewWindow } from './utils/openNoteWindow'
import { isNoteWindow, getNoteWindowParams } from './utils/windowMode'
import { GitRequiredModal } from './components/GitRequiredModal'
import { RenameDetectedBanner, type DetectedRename } from './components/RenameDetectedBanner'
import { trackEvent } from './lib/telemetry'
import './App.css'

// Type declarations for mock content storage and test overrides
declare global {
  interface Window {
    __mockContent?: Record<string, string>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock handler map for Playwright test overrides
    __mockHandlers?: Record<string, (args: any) => any>
  }
}

const DEFAULT_SELECTION: SidebarSelection = { kind: 'filter', filter: 'all' }

/** Wraps useEditorSave to also keep outgoingLinks in sync on save and on content change. */
function App() {
  const noteWindowParams = useMemo(() => isNoteWindow() ? getNoteWindowParams() : null, [])
  const [selection, setSelection] = useState<SidebarSelection>(DEFAULT_SELECTION)
  const [noteListFilter, setNoteListFilter] = useState<NoteListFilter>('open')
  const inboxPeriod: InboxPeriod = 'all'
  const handleSetSelection = useCallback((sel: SidebarSelection) => {
    setSelection(sel)
    setNoteListFilter('open')
  }, [])
  const layout = useLayoutPanels(noteWindowParams ? { initialInspectorCollapsed: true } : undefined)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const dialogs = useDialogs()

  // onSwitch closure captures `notes` declared below — safe because it's only
  // called on user interaction, never during render (refs inside the hook
  // guarantee the latest closure is always used).
  const vaultSwitcher = useVaultSwitcher({
    onSwitch: () => { handleSetSelection(DEFAULT_SELECTION); notes.closeAllTabs() },
    onToast: (msg) => setToastMessage(msg),
  })

  const onboarding = useOnboarding(vaultSwitcher.vaultPath)

  // When onboarding resolves to a different vault path, update the switcher
  const resolvedPath = noteWindowParams?.vaultPath ?? (onboarding.state.status === 'ready' ? onboarding.state.vaultPath : vaultSwitcher.vaultPath)
  // Git repo check: 'checking' | 'required' | 'ready'
  const [gitRepoState, setGitRepoState] = useState<'checking' | 'required' | 'ready'>('checking')
  useEffect(() => {
    if (!resolvedPath) return
    setGitRepoState('checking')
    const check = isTauri()
      ? invoke<boolean>('is_git_repo', { vaultPath: resolvedPath })
      : Promise.resolve(true) // browser mock: assume git
    check
      .then(isGit => setGitRepoState(isGit ? 'ready' : 'required'))
      .catch(() => setGitRepoState('ready')) // fail open
  }, [resolvedPath])

  const handleInitGitRepo = useCallback(async () => {
    if (isTauri()) await invoke('init_git_repo', { vaultPath: resolvedPath })
    setGitRepoState('ready')
  }, [resolvedPath])

  const vault = useVaultLoader(resolvedPath)
  useVaultConfig(resolvedPath)
  const { settings, loaded: settingsLoaded, saveSettings } = useSettings()
  useTelemetry(settings, settingsLoaded)

  const vaultOpenedRef = useRef('')
  useEffect(() => {
    if (vault.entries.length > 0 && gitRepoState !== 'checking' && resolvedPath !== vaultOpenedRef.current) {
      vaultOpenedRef.current = resolvedPath
      trackEvent('vault_opened', { has_git: gitRepoState === 'ready' ? 1 : 0, note_count: vault.entries.length })
    }
  }, [vault.entries.length, gitRepoState, resolvedPath])
  const { mcpStatus, installMcp } = useMcpStatus(resolvedPath, setToastMessage)
  const { status: claudeCodeStatus, version: claudeCodeVersion } = useClaudeCodeStatus()

  const autoSync = useAutoSync({
    vaultPath: resolvedPath,
    intervalMinutes: settings.auto_pull_interval_minutes,
    onVaultUpdated: vault.reloadVault,
    onConflict: (files) => {
      const names = files.map((f) => f.split('/').pop()).join(', ')
      setToastMessage(`Conflict in ${names} — click to resolve`)
    },
    onToast: (msg) => setToastMessage(msg),
  })

  // Detect external file renames on window focus
  const [detectedRenames, setDetectedRenames] = useState<DetectedRename[]>([])
  useEffect(() => {
    if (!isTauri() || !resolvedPath) return
    const handleFocus = () => {
      invoke<DetectedRename[]>('detect_renames', { vaultPath: resolvedPath })
        .then(renames => { if (renames.length > 0) setDetectedRenames(renames) })
        .catch(() => {}) // ignore errors (e.g., no git)
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [resolvedPath])

  const handleUpdateWikilinks = useCallback(async () => {
    if (!isTauri()) return
    try {
      const count = await invoke<number>('update_wikilinks_for_renames', { vaultPath: resolvedPath, renames: detectedRenames })
      setDetectedRenames([])
      vault.reloadVault()
      setToastMessage(`Updated wikilinks in ${count} file${count !== 1 ? 's' : ''}`)
    } catch (err) {
      setToastMessage(`Failed to update wikilinks: ${err}`)
    }
  }, [resolvedPath, detectedRenames, vault, setToastMessage])

  const handleDismissRenames = useCallback(() => setDetectedRenames([]), [])

  const conflictResolver = useConflictResolver({
    vaultPath: resolvedPath,
    onResolved: () => {
      dialogs.closeConflictResolver()
      autoSync.resumePull()
      vault.reloadVault()
      autoSync.triggerSync()
    },
    onToast: (msg) => setToastMessage(msg),
    onOpenFile: (relativePath) => conflictFlow.openConflictFileRef.current(relativePath),
  })

  const notes = useNoteActions({ addEntry: vault.addEntry, removeEntry: vault.removeEntry, entries: vault.entries, setToastMessage, updateEntry: vault.updateEntry, vaultPath: resolvedPath, addPendingSave: vault.addPendingSave, removePendingSave: vault.removePendingSave, trackUnsaved: vault.trackUnsaved, clearUnsaved: vault.clearUnsaved, unsavedPaths: vault.unsavedPaths, markContentPending: (path, content) => appSave.contentChangeRef.current(path, content), onNewNotePersisted: vault.loadModifiedFiles, replaceEntry: vault.replaceEntry })

  // Note window: auto-open the note from URL params once vault entries load
  const noteWindowOpenedRef = useRef(false)
  useEffect(() => {
    if (!noteWindowParams || noteWindowOpenedRef.current || vault.entries.length === 0) return
    const entry = vault.entries.find(e => e.path === noteWindowParams.notePath)
    if (entry) {
      noteWindowOpenedRef.current = true
      notes.handleSelectNote(entry)
    }
  }, [vault.entries]) // eslint-disable-line react-hooks/exhaustive-deps -- run when entries load, params are stable

  // Note window: update window title when active note changes
  useEffect(() => {
    if (!noteWindowParams) return
    const activeEntry = notes.tabs.find(t => t.entry.path === notes.activeTabPath)?.entry
    const title = activeEntry?.title ?? noteWindowParams.noteTitle
    if (!isTauri()) { document.title = title; return }
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().setTitle(title)
    }).catch(() => {})
  }, [noteWindowParams, notes.tabs, notes.activeTabPath])

  // Keep note entry in sync with vault entries so banners (trash/archive)
  // and read-only state react immediately without reopening the note.
  useEffect(() => {
    notes.setTabs(prev => {
      let changed = false
      const next = prev.map(tab => {
        const fresh = vault.entries.find(e => e.path === tab.entry.path)
        if (fresh && fresh !== tab.entry) {
          changed = true
          return { ...tab, entry: fresh }
        }
        return tab
      })
      return changed ? next : prev
    })
  }, [vault.entries]) // eslint-disable-line react-hooks/exhaustive-deps -- notes.setTabs is stable (useState setter)

  const { handleGoBack, handleGoForward, canGoBack, canGoForward, entriesByPath } = useAppNavigation({
    entries: vault.entries,
    activeTabPath: notes.activeTabPath,
    onSelectNote: notes.handleSelectNote,
  })

  const vaultBridge = useVaultBridge({
    entriesByPath, resolvedPath,
    reloadVault: vault.reloadVault,
    onSelectNote: notes.handleSelectNote,
    activeTabPath: notes.activeTabPath,
  })

  const conflictFlow = useConflictFlow({
    resolvedPath, entries: vault.entries,
    conflictFiles: autoSync.conflictFiles,
    pausePull: autoSync.pausePull, resumePull: autoSync.resumePull,
    triggerSync: autoSync.triggerSync, reloadVault: vault.reloadVault,
    initConflictFiles: conflictResolver.initFiles,
    openConflictResolver: dialogs.openConflictResolver,
    closeConflictResolver: dialogs.closeConflictResolver,
    onSelectNote: notes.handleSelectNote,
    activeTabPath: notes.activeTabPath,
    setToastMessage,
  })

  const appSave = useAppSave({
    updateEntry: vault.updateEntry, setTabs: notes.setTabs, setToastMessage,
    loadModifiedFiles: vault.loadModifiedFiles,
    clearUnsaved: vault.clearUnsaved, unsavedPaths: vault.unsavedPaths,
    tabs: notes.tabs, activeTabPath: notes.activeTabPath,
    handleRenameNote: notes.handleRenameNote,
    replaceEntry: vault.replaceEntry, resolvedPath,
  })

  const aiActivity = useAiActivity({
    onOpenNote: vaultBridge.openNoteByPath,
    onOpenTab: vaultBridge.openNoteByPath,
    onSetFilter: (filterType) => {
      handleSetSelection({ kind: 'sectionGroup', type: filterType })
    },
    onVaultChanged: () => { vault.reloadVault() },
  })

  const handleInitializeProperties = useCallback(async (path: string) => {
    const filename = path.split('/').pop()?.replace(/\.md$/, '') ?? 'Untitled'
    await notes.handleUpdateFrontmatter(path, 'type', 'Note', { silent: true })
    await notes.handleUpdateFrontmatter(path, 'title', filename)
  }, [notes])

  const handleSetNoteIcon = useCallback(async (path: string, emoji: string) => {
    await notes.handleUpdateFrontmatter(path, 'icon', emoji)
  }, [notes])

  const handleRemoveNoteIcon = useCallback(async (path: string) => {
    await notes.handleDeleteProperty(path, 'icon')
  }, [notes])

  const handleSetNoteIconCommand = useCallback(() => {
    window.dispatchEvent(new CustomEvent('laputa:open-icon-picker'))
  }, [])

  const handleCreateFolder = useCallback(async (name: string) => {
    try {
      if (isTauri()) {
        await invoke('create_vault_folder', { vaultPath: resolvedPath, folderName: name })
      } else {
        await mockInvoke('create_vault_folder', { vaultPath: resolvedPath, folderName: name })
      }
      await vault.reloadFolders()
      setToastMessage(`Created folder "${name}"`)
    } catch (e) {
      setToastMessage(`Failed to create folder: ${e}`)
    }
  }, [resolvedPath, vault, setToastMessage])

  const handleRemoveNoteIconCommand = useCallback(() => {
    if (notes.activeTabPath) handleRemoveNoteIcon(notes.activeTabPath)
  }, [notes.activeTabPath, handleRemoveNoteIcon])

  const handleOpenInNewWindow = useCallback(() => {
    const activeTab = notes.tabs.find(t => t.entry.path === notes.activeTabPath)
    if (activeTab) openNoteInNewWindow(activeTab.entry.path, resolvedPath, activeTab.entry.title)
  }, [notes.tabs, notes.activeTabPath, resolvedPath])

  const handleOpenEntryInNewWindow = useCallback((entry: { path: string; title: string }) => {
    openNoteInNewWindow(entry.path, resolvedPath, entry.title)
  }, [resolvedPath])

  const handleDiscardFile = useCallback(async (relativePath: string) => {
    try {
      if (isTauri()) {
        await invoke('git_discard_file', { vaultPath: resolvedPath, relativePath })
      } else {
        await mockInvoke('git_discard_file', { vaultPath: resolvedPath, relativePath })
      }
      await vault.loadModifiedFiles()
      await vault.reloadVault()
    } catch (err) {
      setToastMessage(typeof err === 'string' ? err : 'Failed to discard changes')
    }
  }, [resolvedPath, vault, setToastMessage])

  const commitFlow = useCommitFlow({ savePending: appSave.savePending, loadModifiedFiles: vault.loadModifiedFiles, commitAndPush: vault.commitAndPush, setToastMessage, onPushRejected: autoSync.handlePushRejected })
  const suggestedCommitMessage = useMemo(() => generateCommitMessage(vault.modifiedFiles), [vault.modifiedFiles])

  const entryActions = useEntryActions({
    entries: vault.entries, updateEntry: vault.updateEntry,
    handleUpdateFrontmatter: notes.handleUpdateFrontmatter,
    handleDeleteProperty: notes.handleDeleteProperty, setToastMessage,
    createTypeEntry: notes.createTypeEntrySilent,
    onFrontmatterPersisted: vault.loadModifiedFiles,
    onBeforeAction: appSave.flushBeforeAction,
  })

  const deleteActions = useDeleteActions({
    vaultPath: resolvedPath,
    entries: vault.entries,
    onDeselectNote: (path: string) => { if (notes.activeTabPath === path) notes.closeAllTabs() },
    removeEntry: vault.removeEntry,
    setToastMessage,
  })

  const gitHistory = useGitHistory(notes.activeTabPath, vault.loadGitHistory)

  const handleCreateType = useCallback((name: string) => {
    notes.handleCreateType(name)
    setToastMessage(`Type "${name}" created`)
  }, [notes])

  const handleCreateOrUpdateView = useCallback(async (definition: import('./types').ViewDefinition) => {
    const editing = dialogs.editingView
    const filename = editing
      ? editing.filename
      : definition.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '.yml'
    const target = isTauri() ? invoke : mockInvoke
    await target('save_view_cmd', { vaultPath: resolvedPath, filename, definition })
    trackEvent(editing ? 'view_updated' : 'view_created')
    await vault.reloadViews()
    await vault.reloadVault()
    vault.reloadFolders()
    setToastMessage(editing ? `View "${definition.name}" updated` : `View "${definition.name}" created`)
    handleSetSelection({ kind: 'view', filename })
  }, [resolvedPath, vault, handleSetSelection, dialogs.editingView])

  const handleEditView = useCallback((filename: string) => {
    const view = vault.views.find((v) => v.filename === filename)
    if (view) dialogs.openEditView(filename, view.definition)
  }, [vault.views, dialogs])

  const handleDeleteView = useCallback(async (filename: string) => {
    const target = isTauri() ? invoke : mockInvoke
    await target('delete_view_cmd', { vaultPath: resolvedPath, filename })
    await vault.reloadViews()
    await vault.reloadVault()
    vault.reloadFolders()
    if (selection.kind === 'view' && selection.filename === filename) {
      handleSetSelection({ kind: 'filter', filter: 'all' })
    }
    setToastMessage('View deleted')
  }, [resolvedPath, vault, selection, handleSetSelection])

  const availableFields = useMemo(() => {
    const builtIn = ['type', 'status', 'title', 'favorite', 'body']
    if (!vault.entries?.length) return builtIn
    const customFields = new Set<string>()
    for (const e of vault.entries) {
      if (e.properties) {
        for (const key of Object.keys(e.properties)) customFields.add(key)
      }
      if (e.relationships) {
        for (const key of Object.keys(e.relationships)) customFields.add(key)
      }
    }
    return [...builtIn, ...Array.from(customFields).sort()]
  }, [vault.entries])

  const valueSuggestionsForField = useCallback((field: string): string[] => {
    if (!vault.entries?.length) return []
    const values = new Set<string>()
    for (const e of vault.entries) {
      if (field === 'type' && e.isA) values.add(e.isA)
      else if (field === 'status' && e.status) values.add(e.status)
      else if (e.properties?.[field] != null) values.add(String(e.properties[field]))
    }
    return Array.from(values).sort()
  }, [vault.entries])

  const bulkActions = useBulkActions(entryActions, setToastMessage)

  // Raw-toggle ref: Editor registers its handleToggleRaw here so the command palette can call it
  const rawToggleRef = useRef<() => void>(() => {})
  // Diff-toggle ref: Editor registers its handleToggleDiff here so the command palette can call it
  const diffToggleRef = useRef<() => void>(() => {})

  const { setViewMode, sidebarVisible, noteListVisible } = useViewMode(noteWindowParams ? 'editor-only' : undefined)
  const zoom = useZoom()
  const buildNumber = useBuildNumber()

  const { status: updateStatus, actions: updateActions } = useUpdater()

  const handleCheckForUpdates = useCallback(async () => {
    if (updateStatus.state === 'downloading') {
      setToastMessage('Update is downloading…')
      return
    }
    if (updateStatus.state === 'ready') {
      await restartApp()
      return
    }
    const result = await updateActions.checkForUpdates()
    if (result === 'up-to-date') {
      setToastMessage("You're on the latest version")
    } else if (result === 'error') {
      setToastMessage('Could not check for updates')
    }
  }, [updateActions, updateStatus.state, setToastMessage])

  const handleRepairVault = useCallback(async () => {
    if (!resolvedPath) return
    try {
      const tauriInvoke = isTauri() ? invoke : mockInvoke
      const msg = await tauriInvoke<string>('repair_vault', { vaultPath: resolvedPath })
      await vault.reloadVault()
      setToastMessage(msg)
    } catch (err) {
      setToastMessage(`Failed to repair vault: ${err}`)
    }
  }, [resolvedPath, vault, setToastMessage])

  const commands = useAppCommands({
    activeTabPath: notes.activeTabPath, activeTabPathRef: notes.activeTabPathRef,
    entries: vault.entries,
    modifiedCount: vault.modifiedFiles.length,
    activeNoteModified: vault.modifiedFiles.some(f => f.path === notes.activeTabPath),
    selection,
    onQuickOpen: dialogs.openQuickOpen, onCommandPalette: dialogs.openCommandPalette,
    onSearch: dialogs.openSearch,
    onCreateNote: notes.handleCreateNoteImmediate,
    onOpenDailyNote: notes.handleOpenDailyNote,
    onCreateNoteOfType: notes.handleCreateNoteImmediate,
    onSave: appSave.handleSave,
    onOpenSettings: dialogs.openSettings,
    onTrashNote: entryActions.handleTrashNote, onRestoreNote: entryActions.handleRestoreNote,
    onArchiveNote: entryActions.handleArchiveNote, onUnarchiveNote: entryActions.handleUnarchiveNote,
    onCommitPush: commitFlow.openCommitDialog,
    onPull: autoSync.triggerSync,
    onResolveConflicts: conflictFlow.handleOpenConflictResolver,
    onSetViewMode: setViewMode,
    onToggleInspector: () => layout.setInspectorCollapsed(c => !c),
    onToggleDiff: () => diffToggleRef.current(),
    onToggleRawEditor: () => rawToggleRef.current(),
    onZoomIn: zoom.zoomIn, onZoomOut: zoom.zoomOut, onZoomReset: zoom.zoomReset,
    zoomLevel: zoom.zoomLevel,
    onSelect: handleSetSelection,
    onReplaceActiveTab: notes.handleReplaceActiveTab,
    onSelectNote: notes.handleSelectNote,
    onGoBack: handleGoBack, onGoForward: handleGoForward,
    canGoBack: canGoBack, canGoForward: canGoForward,
    onOpenVault: vaultSwitcher.handleOpenLocalFolder,
    onCreateType: dialogs.openCreateType,
    onToggleAIChat: dialogs.toggleAIChat,
    onCheckForUpdates: handleCheckForUpdates,
    onRemoveActiveVault: () => vaultSwitcher.removeVault(vaultSwitcher.vaultPath),
    onRestoreGettingStarted: vaultSwitcher.restoreGettingStarted,
    isGettingStartedHidden: vaultSwitcher.isGettingStartedHidden,
    vaultCount: vaultSwitcher.allVaults.length,
    mcpStatus,
    onInstallMcp: installMcp,
    claudeCodeStatus: claudeCodeStatus ?? undefined,
    claudeCodeVersion: claudeCodeVersion ?? undefined,
    onEmptyTrash: deleteActions.handleEmptyTrash,
    trashedCount: deleteActions.trashedCount,
    onReloadVault: vault.reloadVault,
    onRepairVault: handleRepairVault,
    onSetNoteIcon: handleSetNoteIconCommand,
    onRemoveNoteIcon: handleRemoveNoteIconCommand,
    activeNoteHasIcon: (() => {
      const ae = vault.entries.find(e => e.path === notes.activeTabPath)
      return !!(ae?.icon && isEmoji(ae.icon))
    })(),
    noteListFilter,
    onSetNoteListFilter: setNoteListFilter,
    onOpenInNewWindow: handleOpenInNewWindow,
    onToggleFavorite: entryActions.handleToggleFavorite,
  })

  const activeTab = notes.tabs.find((t) => t.entry.path === notes.activeTabPath) ?? null

  const inboxCount = useMemo(() => filterInboxEntries(vault.entries, inboxPeriod).length, [vault.entries, inboxPeriod])

  const aiNoteList = useMemo<NoteListItem[]>(() => {
    const isInbox = selection.kind === 'filter' && selection.filter === 'inbox'
    const filtered = isInbox ? filterInboxEntries(vault.entries, inboxPeriod) : filterEntries(vault.entries, selection, undefined, vault.views)
    return filtered.map(e => ({
      path: e.path, title: e.title, type: e.isA ?? 'Note',
    }))
  }, [vault.entries, selection, inboxPeriod])

  const aiNoteListFilter = useMemo(() => {
    if (selection.kind === 'sectionGroup') return { type: selection.type, query: '' }
    if (selection.kind === 'entity') return { type: null, query: selection.entry.title }
    return { type: null, query: '' }
  }, [selection])

  // Show welcome/onboarding screen when vault doesn't exist (skip for note windows — vault path is known)
  if (!noteWindowParams && (onboarding.state.status === 'welcome' || onboarding.state.status === 'vault-missing')) {
    return <WelcomeView onboarding={onboarding} />
  }

  // Show loading spinner while checking vault (skip for note windows)
  if (!noteWindowParams && onboarding.state.status === 'loading') {
    return <LoadingView />
  }

  // Show git-required modal when vault has no git repo (skip for note windows)
  if (!noteWindowParams && gitRepoState === 'required') {
    return (
      <div className="app-shell">
        <GitRequiredModal
          onCreateRepo={handleInitGitRepo}
          onChooseVault={vaultSwitcher.handleOpenLocalFolder}
        />
      </div>
    )
  }

  // Show loading spinner while checking git status
  if (!noteWindowParams && gitRepoState === 'checking' && onboarding.state.status === 'ready') {
    return <LoadingView />
  }

  // Show telemetry consent dialog on first launch (skip for note windows)
  if (!noteWindowParams && settingsLoaded && settings.telemetry_consent === null) {
    return (
      <TelemetryConsentDialog
        onAccept={() => {
          const id = crypto.randomUUID()
          saveSettings({ ...settings, telemetry_consent: true, crash_reporting_enabled: true, analytics_enabled: true, anonymous_id: id })
        }}
        onDecline={() => {
          saveSettings({ ...settings, telemetry_consent: false, crash_reporting_enabled: false, analytics_enabled: false, anonymous_id: null })
        }}
      />
    )
  }

  return (
    <div className="app-shell">
      <div className="app">
        {sidebarVisible && (
          <>
            <div className="app__sidebar" style={{ width: layout.sidebarWidth }}>
              <Sidebar entries={vault.entries} folders={vault.folders} views={vault.views} selection={selection} onSelect={handleSetSelection} onSelectNote={notes.handleSelectNote} onSelectFavorite={notes.handleSelectNote} onReorderFavorites={entryActions.handleReorderFavorites} onCreateType={notes.handleCreateNoteImmediate} onCreateNewType={dialogs.openCreateType} onCustomizeType={entryActions.handleCustomizeType} onUpdateTypeTemplate={entryActions.handleUpdateTypeTemplate} onReorderSections={entryActions.handleReorderSections} onRenameSection={entryActions.handleRenameSection} onToggleTypeVisibility={entryActions.handleToggleTypeVisibility} onCreateFolder={handleCreateFolder} onCreateView={dialogs.openCreateView} onEditView={handleEditView} onDeleteView={handleDeleteView} inboxCount={inboxCount} />
            </div>
            <ResizeHandle onResize={layout.handleSidebarResize} />
          </>
        )}
        {noteListVisible && (
          <>
            <div className={`app__note-list${aiActivity.highlightElement === 'notelist' ? ' ai-highlight' : ''}`} style={{ width: layout.noteListWidth }}>
              {selection.kind === 'filter' && selection.filter === 'pulse' ? (
                <PulseView vaultPath={resolvedPath} onOpenNote={vaultBridge.handlePulseOpenNote} sidebarCollapsed={!sidebarVisible} onExpandSidebar={() => setViewMode('all')} />
              ) : (
                <NoteList entries={vault.entries} selection={selection} selectedNote={activeTab?.entry ?? null} noteListFilter={noteListFilter} onNoteListFilterChange={setNoteListFilter} inboxPeriod={inboxPeriod} modifiedFiles={vault.modifiedFiles} modifiedFilesError={vault.modifiedFilesError} getNoteStatus={vault.getNoteStatus} sidebarCollapsed={!sidebarVisible} onSelectNote={notes.handleSelectNote} onReplaceActiveTab={notes.handleReplaceActiveTab} onCreateNote={notes.handleCreateNoteImmediate} onBulkArchive={bulkActions.handleBulkArchive} onBulkTrash={bulkActions.handleBulkTrash} onBulkRestore={bulkActions.handleBulkRestore} onBulkDeletePermanently={deleteActions.handleBulkDeletePermanently} onEmptyTrash={deleteActions.handleEmptyTrash} onUpdateTypeSort={notes.handleUpdateFrontmatter} updateEntry={vault.updateEntry} onOpenInNewWindow={handleOpenEntryInNewWindow} onDiscardFile={handleDiscardFile} views={vault.views} />
              )}
            </div>
            <ResizeHandle onResize={layout.handleNoteListResize} />
          </>
        )}
        <div className={`app__editor${aiActivity.highlightElement === 'editor' || aiActivity.highlightElement === 'tab' ? ' ai-highlight' : ''}`}>
          <Editor
            tabs={notes.tabs}
            activeTabPath={notes.activeTabPath}
            entries={vault.entries}
            onNavigateWikilink={notes.handleNavigateWikilink}
            onLoadDiff={vault.loadDiff}
            onLoadDiffAtCommit={vault.loadDiffAtCommit}
            getNoteStatus={vault.getNoteStatus}
            onCreateNote={notes.handleCreateNoteImmediate}
            inspectorCollapsed={layout.inspectorCollapsed}
            onToggleInspector={() => layout.setInspectorCollapsed((c) => !c)}
            inspectorWidth={layout.inspectorWidth}
            onInspectorResize={layout.handleInspectorResize}
            inspectorEntry={activeTab?.entry ?? null}
            inspectorContent={activeTab?.content ?? null}
            gitHistory={gitHistory}
            onUpdateFrontmatter={notes.handleUpdateFrontmatter}
            onDeleteProperty={notes.handleDeleteProperty}
            onAddProperty={notes.handleAddProperty}
            onCreateAndOpenNote={notes.handleCreateNoteForRelationship}
            onInitializeProperties={handleInitializeProperties}
            showAIChat={dialogs.showAIChat}
            onToggleAIChat={dialogs.toggleAIChat}
            vaultPath={resolvedPath}
            noteList={aiNoteList}
            noteListFilter={aiNoteListFilter}
            onToggleFavorite={entryActions.handleToggleFavorite}
            onTrashNote={entryActions.handleTrashNote}
            onRestoreNote={entryActions.handleRestoreNote}
            onDeleteNote={deleteActions.handleDeleteNote}
            onArchiveNote={entryActions.handleArchiveNote}
            onUnarchiveNote={entryActions.handleUnarchiveNote}
            onContentChange={appSave.handleContentChange}
            onSave={appSave.handleSave}
            onTitleSync={appSave.handleTitleSync}
            rawToggleRef={rawToggleRef}
            diffToggleRef={diffToggleRef}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onGoBack={handleGoBack}
            onGoForward={handleGoForward}
            leftPanelsCollapsed={!sidebarVisible && !noteListVisible}
            onFileCreated={vaultBridge.handleAgentFileCreated}
            onFileModified={vaultBridge.handleAgentFileModified}
            onVaultChanged={vaultBridge.handleAgentVaultChanged}
            onSetNoteIcon={handleSetNoteIcon}
            onRemoveNoteIcon={handleRemoveNoteIcon}
            isConflicted={conflictFlow.isConflicted}
            onKeepMine={conflictFlow.handleKeepMine}
            onKeepTheirs={conflictFlow.handleKeepTheirs}
          />
        </div>
      </div>
      <UpdateBanner status={updateStatus} actions={updateActions} />
      <RenameDetectedBanner renames={detectedRenames} onUpdate={handleUpdateWikilinks} onDismiss={handleDismissRenames} />
      <StatusBar noteCount={vault.entries.length} modifiedCount={vault.modifiedFiles.length} vaultPath={vaultSwitcher.vaultPath} vaults={vaultSwitcher.allVaults} onSwitchVault={vaultSwitcher.switchVault} onOpenSettings={dialogs.openSettings} onOpenLocalFolder={vaultSwitcher.handleOpenLocalFolder} onConnectGitHub={dialogs.openGitHubVault} onClickPending={() => handleSetSelection({ kind: 'filter', filter: 'changes' })} onClickPulse={() => handleSetSelection({ kind: 'filter', filter: 'pulse' })} onCommitPush={commitFlow.openCommitDialog} isGitVault={!vault.modifiedFilesError} hasGitHub={!!settings.github_token} syncStatus={autoSync.syncStatus} lastSyncTime={autoSync.lastSyncTime} conflictCount={autoSync.conflictFiles.length} lastCommitInfo={autoSync.lastCommitInfo} remoteStatus={autoSync.remoteStatus} onTriggerSync={autoSync.triggerSync} onPullAndPush={autoSync.pullAndPush} onOpenConflictResolver={conflictFlow.handleOpenConflictResolver} zoomLevel={zoom.zoomLevel} onZoomReset={zoom.zoomReset} buildNumber={buildNumber} onCheckForUpdates={handleCheckForUpdates} onRemoveVault={vaultSwitcher.removeVault} mcpStatus={mcpStatus} onInstallMcp={installMcp} claudeCodeStatus={claudeCodeStatus} claudeCodeVersion={claudeCodeVersion} />
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      <QuickOpenPalette open={dialogs.showQuickOpen} entries={vault.entries} onSelect={notes.handleSelectNote} onClose={dialogs.closeQuickOpen} />
      <CommandPalette open={dialogs.showCommandPalette} commands={commands} onClose={dialogs.closeCommandPalette} />
      <SearchPanel open={dialogs.showSearch} vaultPath={resolvedPath} entries={vault.entries} onSelectNote={notes.handleSelectNote} onClose={dialogs.closeSearch} />
      <CreateTypeDialog open={dialogs.showCreateTypeDialog} onClose={dialogs.closeCreateType} onCreate={handleCreateType} />
      <CreateViewDialog open={dialogs.showCreateViewDialog} onClose={dialogs.closeCreateView} onCreate={handleCreateOrUpdateView} availableFields={availableFields} valueSuggestions={valueSuggestionsForField} entries={vault.entries} editingView={dialogs.editingView?.definition ?? null} />
      <CommitDialog open={commitFlow.showCommitDialog} modifiedCount={vault.modifiedFiles.length} suggestedMessage={suggestedCommitMessage} onCommit={commitFlow.handleCommitPush} onClose={commitFlow.closeCommitDialog} />
      <ConflictResolverModal
        open={dialogs.showConflictResolver}
        fileStates={conflictResolver.fileStates}
        allResolved={conflictResolver.allResolved}
        committing={conflictResolver.committing}
        error={conflictResolver.error}
        onResolveFile={conflictResolver.resolveFile}
        onOpenInEditor={conflictResolver.openInEditor}
        onCommit={conflictResolver.commitResolution}
        onClose={conflictFlow.handleCloseConflictResolver}
      />
      <SettingsPanel open={dialogs.showSettings} settings={settings} onSave={saveSettings} onClose={dialogs.closeSettings} />
      <GitHubVaultModal
        open={dialogs.showGitHubVault}
        githubToken={settings.github_token}
        onClose={dialogs.closeGitHubVault}
        onVaultCloned={vaultSwitcher.handleVaultCloned}
        onOpenSettings={() => { dialogs.closeGitHubVault(); dialogs.openSettings() }}
        onGitHubConnected={(token, username) => saveSettings({ ...settings, github_token: token, github_username: username })}
      />
      {deleteActions.confirmDelete && (
        <ConfirmDeleteDialog
          open={true}
          title={deleteActions.confirmDelete.title}
          message={deleteActions.confirmDelete.message}
          confirmLabel={deleteActions.confirmDelete.confirmLabel}
          onConfirm={deleteActions.confirmDelete.onConfirm}
          onCancel={() => deleteActions.setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

type OnboardingState = ReturnType<typeof useOnboarding>

/** Welcome screen view - extracted from main App component */
function WelcomeView({ onboarding }: { onboarding: OnboardingState }) {
  const state = onboarding.state as { status: 'welcome' | 'vault-missing'; defaultPath: string; vaultPath?: string }
  return (
    <div className="app-shell">
      <WelcomeScreen
        mode={state.status === 'welcome' ? 'welcome' : 'vault-missing'}
        missingPath={state.status === 'vault-missing' ? state.vaultPath : undefined}
        defaultVaultPath={state.defaultPath}
        onCreateVault={onboarding.handleCreateVault}
        onCreateNewVault={onboarding.handleCreateNewVault}
        onOpenFolder={onboarding.handleOpenFolder}
        creating={onboarding.creating}
        error={onboarding.error}
      />
    </div>
  )
}

/** Loading spinner view - extracted from main App component */
function LoadingView() {
  return (
    <div className="app-shell">
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sidebar)' }}>
        <span style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>Loading…</span>
      </div>
    </div>
  )
}

export default App
