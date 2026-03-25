import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { NoteList } from './components/NoteList'
import { Editor } from './components/Editor'
import { ResizeHandle } from './components/ResizeHandle'
import { CreateTypeDialog } from './components/CreateTypeDialog'
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
import { useMcpStatus } from './hooks/useMcpStatus'
import { useVaultLoader } from './hooks/useVaultLoader'
import { useSettings } from './hooks/useSettings'
import { useNoteActions } from './hooks/useNoteActions'
import { needsRenameOnSave } from './hooks/useNoteRename'
import { useCommitFlow } from './hooks/useCommitFlow'
import { useViewMode } from './hooks/useViewMode'
import { useEntryActions } from './hooks/useEntryActions'
import { useAppCommands } from './hooks/useAppCommands'
import { isEmoji } from './utils/emoji'
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
import { useEditorSaveWithLinks } from './hooks/useEditorSaveWithLinks'
import { useAppNavigation } from './hooks/useAppNavigation'
import { useAiActivity } from './hooks/useAiActivity'
import { useBulkActions } from './hooks/useBulkActions'
import { useDeleteActions } from './hooks/useDeleteActions'
import { useLayoutPanels } from './hooks/useLayoutPanels'
import { ConflictResolverModal } from './components/ConflictResolverModal'
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog'
import { UpdateBanner } from './components/UpdateBanner'
import { FlatVaultMigrationBanner } from './components/FlatVaultMigrationBanner'
import { useFlatVaultMigration } from './hooks/useFlatVaultMigration'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from './mock-tauri'
import type { SidebarSelection, VaultEntry, InboxPeriod } from './types'
import type { NoteListItem } from './utils/ai-context'
import { filterEntries, filterInboxEntries, type NoteListFilter } from './utils/noteListHelpers'
import { openLocalFile } from './utils/url'
import { openNoteInNewWindow } from './utils/openNoteWindow'
import { flushEditorContent } from './utils/autoSave'
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
  const [selection, setSelection] = useState<SidebarSelection>(DEFAULT_SELECTION)
  const [noteListFilter, setNoteListFilter] = useState<NoteListFilter>('open')
  const [inboxPeriod, setInboxPeriod] = useState<InboxPeriod>('month')
  const handleSetSelection = useCallback((sel: SidebarSelection) => {
    setSelection(sel)
    setNoteListFilter('open')
  }, [])
  const layout = useLayoutPanels()
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
  const resolvedPath = onboarding.state.status === 'ready' ? onboarding.state.vaultPath : vaultSwitcher.vaultPath
  const vault = useVaultLoader(resolvedPath)
  useVaultConfig(resolvedPath)
  const { settings, loaded: settingsLoaded, saveSettings } = useSettings()
  const flatVaultMigration = useFlatVaultMigration(resolvedPath, vault.entries.length > 0, vault.reloadVault)
  const { mcpStatus, installMcp } = useMcpStatus(resolvedPath, setToastMessage)

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

  // Ref bridges for conflict resolution callbacks (notes declared below)
  const openConflictFileRef = useRef<(relativePath: string) => void>(() => {})

  const conflictResolver = useConflictResolver({
    vaultPath: resolvedPath,
    onResolved: () => {
      dialogs.closeConflictResolver()
      autoSync.resumePull()
      vault.reloadVault()
      autoSync.triggerSync()
    },
    onToast: (msg) => setToastMessage(msg),
    onOpenFile: (relativePath) => openConflictFileRef.current(relativePath),
  })

  const handleOpenConflictResolver = useCallback(async () => {
    let files = autoSync.conflictFiles
    // If no cached conflicts, check directly — there may be pre-existing
    // conflicts from a prior session that the pull flow didn't detect.
    if (files.length === 0) {
      try {
        files = isTauri()
          ? await invoke<string[]>('get_conflict_files', { vaultPath: resolvedPath })
          : await mockInvoke<string[]>('get_conflict_files', { vaultPath: resolvedPath })
      } catch {
        return
      }
      if (files.length === 0) {
        setToastMessage('No merge conflicts to resolve')
        return
      }
    }
    autoSync.pausePull()
    conflictResolver.initFiles(files)
    dialogs.openConflictResolver()
  }, [autoSync, conflictResolver, dialogs, resolvedPath])

  const handleCloseConflictResolver = useCallback(() => {
    autoSync.resumePull()
    dialogs.closeConflictResolver()
  }, [autoSync, dialogs])

  /** Resolve a single file conflict from the in-editor banner. */
  const handleResolveConflictInline = useCallback(async (filePath: string, strategy: 'ours' | 'theirs') => {
    try {
      const relativePath = filePath.replace(resolvedPath + '/', '')
      const call = isTauri() ? invoke : mockInvoke
      await call('git_resolve_conflict', { vaultPath: resolvedPath, file: relativePath, strategy })
      // Reload the note content to show the resolved version
      const content = await (isTauri() ? invoke<string> : mockInvoke<string>)('get_note_content', { path: filePath })
      // Check remaining conflicts
      const remaining = await (isTauri() ? invoke<string[]> : mockInvoke<string[]>)('get_conflict_files', { vaultPath: resolvedPath })
      if (remaining.length === 0) {
        // All resolved — auto-commit the merge and push
        await (isTauri() ? invoke : mockInvoke)('git_commit_conflict_resolution', { vaultPath: resolvedPath })
        vault.reloadVault()
        autoSync.triggerSync()
        setToastMessage('All conflicts resolved — merge committed')
      } else {
        void content // content reload happens via vault reload
        vault.reloadVault()
        setToastMessage(`Resolved — ${remaining.length} conflict${remaining.length > 1 ? 's' : ''} remaining`)
      }
    } catch (err) {
      setToastMessage(`Failed to resolve conflict: ${err}`)
    }
  }, [resolvedPath, vault, autoSync, setToastMessage])

  const handleKeepMine = useCallback((path: string) => handleResolveConflictInline(path, 'ours'), [handleResolveConflictInline])
  const handleKeepTheirs = useCallback((path: string) => handleResolveConflictInline(path, 'theirs'), [handleResolveConflictInline])

  // Ref bridges handleContentChange (created after notes) into useNoteActions.
  // Read at callback time, so it's always current when user presses Cmd+N.
  const contentChangeRef = useRef<(path: string, content: string) => void>(() => {})

  const notes = useNoteActions({ addEntry: vault.addEntry, removeEntry: vault.removeEntry, entries: vault.entries, setToastMessage, updateEntry: vault.updateEntry, vaultPath: resolvedPath, addPendingSave: vault.addPendingSave, removePendingSave: vault.removePendingSave, trackUnsaved: vault.trackUnsaved, clearUnsaved: vault.clearUnsaved, unsavedPaths: vault.unsavedPaths, markContentPending: (path, content) => contentChangeRef.current(path, content), onNewNotePersisted: vault.loadModifiedFiles, replaceEntry: vault.replaceEntry })

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

  // MCP UI bridge: react to AI-driven open/highlight/vault-change events
  const openNoteByPath = useCallback((path: string) => {
    const entry = entriesByPath.get(path) ?? entriesByPath.get(`${resolvedPath}/${path}`)
    if (entry) {
      notes.handleSelectNote(entry)
    } else {
      // Entry not yet in vault (just created) — reload then open
      vault.reloadVault().then(freshEntries => {
        const fresh = (freshEntries as VaultEntry[]).find(e => e.path === path || e.path === `${resolvedPath}/${path}`)
        if (fresh) notes.handleSelectNote(fresh)
      })
    }
  }, [entriesByPath, vault, notes, resolvedPath])

  const aiActivity = useAiActivity({
    onOpenNote: openNoteByPath,
    onOpenTab: openNoteByPath,
    onSetFilter: (filterType) => {
      handleSetSelection({ kind: 'sectionGroup', type: filterType })
    },
    onVaultChanged: () => { vault.reloadVault() },
  })

  // Stable callback for Pulse "open note" — never triggers reloadVault.
  // Pulse files always exist in the vault; if somehow not found, silently skip.
  const handlePulseOpenNote = useCallback((relativePath: string) => {
    const fullPath = `${resolvedPath}/${relativePath}`
    const entry = entriesByPath.get(fullPath) ?? entriesByPath.get(relativePath)
    if (entry) notes.handleSelectNote(entry)
  }, [entriesByPath, resolvedPath, notes])

  // Agent file operation handlers: auto-open created notes, live-refresh modified notes
  const handleAgentFileCreated = useCallback((relativePath: string) => {
    vault.reloadVault().then(freshEntries => {
      const entry = (freshEntries as VaultEntry[]).find(e => e.path === relativePath || e.path === `${resolvedPath}/${relativePath}`)
      if (entry) notes.handleSelectNote(entry)
    })
  }, [vault, notes, resolvedPath])

  const handleAgentFileModified = useCallback((relativePath: string) => {
    const fullPath = `${resolvedPath}/${relativePath}`
    const currentPath = notes.activeTabPath
    if (currentPath === relativePath || currentPath === fullPath) {
      vault.reloadVault()
    }
  }, [vault, notes.activeTabPath, resolvedPath])

  const handleAgentVaultChanged = useCallback(() => {
    vault.reloadVault()
  }, [vault])

  const handleSetNoteIcon = useCallback(async (path: string, emoji: string) => {
    await notes.handleUpdateFrontmatter(path, 'icon', emoji)
  }, [notes])

  const handleRemoveNoteIcon = useCallback(async (path: string) => {
    await notes.handleDeleteProperty(path, 'icon')
  }, [notes])

  /** Command palette: open the emoji picker on the active note's NoteIcon. */
  const handleSetNoteIconCommand = useCallback(() => {
    window.dispatchEvent(new CustomEvent('laputa:open-icon-picker'))
  }, [])

  /** Command palette: remove the active note's emoji icon. */
  const handleRemoveNoteIconCommand = useCallback(() => {
    if (notes.activeTabPath) handleRemoveNoteIcon(notes.activeTabPath)
  }, [notes.activeTabPath, handleRemoveNoteIcon])

  /** Open the active note in a new window (command palette / keyboard shortcut). */
  const handleOpenInNewWindow = useCallback(() => {
    const activeTab = notes.tabs.find(t => t.entry.path === notes.activeTabPath)
    if (activeTab) openNoteInNewWindow(activeTab.entry.path, resolvedPath, activeTab.entry.title)
  }, [notes.tabs, notes.activeTabPath, resolvedPath]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Open a specific note entry in a new window (Cmd+Shift+Click). */
  const handleOpenEntryInNewWindow = useCallback((entry: VaultEntry) => {
    openNoteInNewWindow(entry.path, resolvedPath, entry.title)
  }, [resolvedPath])

  const onAfterSave = useCallback(() => {
    vault.loadModifiedFiles()
  }, [vault])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by useEditorSave
  const onNotePersisted = useCallback((path: string, _content: string) => {
    vault.clearUnsaved(path)
  }, [vault])

  const { handleSave: handleSaveRaw, handleContentChange, savePendingForPath, savePending } = useEditorSaveWithLinks({
    updateEntry: vault.updateEntry,
    setTabs: notes.setTabs, setToastMessage, onAfterSave,
    onNotePersisted,
  })
  useEffect(() => { contentChangeRef.current = handleContentChange }, [handleContentChange])

  // Refs for stable closure in flushBeforeAction (avoids re-creating on every tab/content change)
  const tabsRef = useRef(notes.tabs)
  tabsRef.current = notes.tabs // eslint-disable-line react-hooks/refs -- ref sync pattern
  const unsavedPathsRef = useRef(vault.unsavedPaths)
  unsavedPathsRef.current = vault.unsavedPaths // eslint-disable-line react-hooks/refs -- ref sync pattern

  /** Auto-save unsaved editor content before a destructive action (trash/archive). */
  const { clearUnsaved: vaultClearUnsaved } = vault
  const flushBeforeAction = useCallback(async (path: string) => {
    try {
      await flushEditorContent(path, {
        savePendingForPath,
        getTabContent: (p) => tabsRef.current.find(t => t.entry.path === p)?.content,
        isUnsaved: (p) => unsavedPathsRef.current.has(p),
        onSaved: (p) => { vaultClearUnsaved(p) },
      })
    } catch (err) {
      setToastMessage(`Auto-save failed: ${err}`)
      throw err
    }
  }, [savePendingForPath, vaultClearUnsaved, setToastMessage])

  // Wire conflict file opener now that notes is available
  useEffect(() => {
    openConflictFileRef.current = (relativePath: string) => {
      const fullPath = `${resolvedPath}/${relativePath}`
      const entry = vault.entries.find(e => e.path === fullPath)
      if (entry) {
        // Markdown note — open inside Laputa editor
        notes.handleSelectNote(entry)
        dialogs.closeConflictResolver()
      } else {
        // Non-note file (e.g. settings.json) —
        // open with system default app so the user can inspect/edit it
        openLocalFile(fullPath)
      }
    }
  }, [resolvedPath, vault.entries, notes, dialogs])

  const handleRenameTab = useCallback(async (path: string, newTitle: string) => {
    await savePendingForPath(path)
    await notes.handleRenameNote(path, newTitle, resolvedPath, vault.replaceEntry).then(vault.loadModifiedFiles)
  }, [notes, resolvedPath, vault, savePendingForPath])

  // Wrap handleSave to also persist unsaved notes that have no pending edits (user pressed Cmd+S without typing)
  // and trigger file rename when the title slug doesn't match the filename.
  const handleSave = useCallback(async () => {
    const activeTab = notes.tabs.find(t => t.entry.path === notes.activeTabPath)
    const fallback = activeTab && vault.unsavedPaths.has(activeTab.entry.path)
      ? { path: activeTab.entry.path, content: activeTab.content }
      : undefined
    await handleSaveRaw(fallback)

    // After saving, check if filename needs to match the current title
    if (activeTab && needsRenameOnSave(activeTab.entry.title, activeTab.entry.filename)) {
      await handleRenameTab(activeTab.entry.path, activeTab.entry.title)
    }
  }, [handleSaveRaw, handleRenameTab, notes.tabs, notes.activeTabPath, vault.unsavedPaths])

  const commitFlow = useCommitFlow({ savePending, loadModifiedFiles: vault.loadModifiedFiles, commitAndPush: vault.commitAndPush, setToastMessage, onPushRejected: autoSync.handlePushRejected })

  const entryActions = useEntryActions({
    entries: vault.entries, updateEntry: vault.updateEntry,
    handleUpdateFrontmatter: notes.handleUpdateFrontmatter,
    handleDeleteProperty: notes.handleDeleteProperty, setToastMessage,
    createTypeEntry: notes.createTypeEntrySilent,
    onFrontmatterPersisted: vault.loadModifiedFiles,
    onBeforeAction: flushBeforeAction,
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

  /** Title field change: save pending content then rename file + update wikilinks (non-blocking). */
  const handleTitleSync = useCallback((path: string, newTitle: string) => {
    savePendingForPath(path)
      .then(() => notes.handleRenameNote(path, newTitle, resolvedPath, vault.replaceEntry))
      .then(vault.loadModifiedFiles)
      .catch((err) => console.error('Title rename failed:', err))
  }, [notes, resolvedPath, vault, savePendingForPath])

  const bulkActions = useBulkActions(entryActions, setToastMessage)

  // Raw-toggle ref: Editor registers its handleToggleRaw here so the command palette can call it
  const rawToggleRef = useRef<() => void>(() => {})
  // Diff-toggle ref: Editor registers its handleToggleDiff here so the command palette can call it
  const diffToggleRef = useRef<() => void>(() => {})

  const { setViewMode, sidebarVisible, noteListVisible } = useViewMode()
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
    // 'available' → UpdateBanner handles it automatically
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
    onSave: handleSave,
    onOpenSettings: dialogs.openSettings,
    onTrashNote: entryActions.handleTrashNote, onRestoreNote: entryActions.handleRestoreNote,
    onArchiveNote: entryActions.handleArchiveNote, onUnarchiveNote: entryActions.handleUnarchiveNote,
    onCommitPush: commitFlow.openCommitDialog,
    onPull: autoSync.triggerSync,
    onResolveConflicts: handleOpenConflictResolver,
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
  })

  const activeTab = notes.tabs.find((t) => t.entry.path === notes.activeTabPath) ?? null

  const inboxCount = useMemo(() => filterInboxEntries(vault.entries, inboxPeriod).length, [vault.entries, inboxPeriod])

  const aiNoteList = useMemo<NoteListItem[]>(() => {
    const isInbox = selection.kind === 'filter' && selection.filter === 'inbox'
    const filtered = isInbox ? filterInboxEntries(vault.entries, inboxPeriod) : filterEntries(vault.entries, selection)
    return filtered.map(e => ({
      path: e.path, title: e.title, type: e.isA ?? 'Note',
    }))
  }, [vault.entries, selection, inboxPeriod])

  const aiNoteListFilter = useMemo(() => {
    if (selection.kind === 'sectionGroup') return { type: selection.type, query: '' }
    if (selection.kind === 'entity') return { type: null, query: selection.entry.title }
    return { type: null, query: '' }
  }, [selection])

  // Show welcome/onboarding screen when vault doesn't exist
  if (onboarding.state.status === 'welcome' || onboarding.state.status === 'vault-missing') {
    return <WelcomeView onboarding={onboarding} />
  }

  // Show loading spinner while checking vault
  if (onboarding.state.status === 'loading') {
    return <LoadingView />
  }

  // Show telemetry consent dialog on first launch (or first upgrade with telemetry)
  if (settingsLoaded && settings.telemetry_consent === null) {
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
              <Sidebar entries={vault.entries} selection={selection} onSelect={handleSetSelection} onSelectNote={notes.handleSelectNote} onCreateType={notes.handleCreateNoteImmediate} onCreateNewType={dialogs.openCreateType} onCustomizeType={entryActions.handleCustomizeType} onUpdateTypeTemplate={entryActions.handleUpdateTypeTemplate} onReorderSections={entryActions.handleReorderSections} onRenameSection={entryActions.handleRenameSection} onToggleTypeVisibility={entryActions.handleToggleTypeVisibility} modifiedCount={vault.modifiedFiles.length} inboxCount={inboxCount} onCommitPush={commitFlow.openCommitDialog} isGitVault={!vault.modifiedFilesError} />
            </div>
            <ResizeHandle onResize={layout.handleSidebarResize} />
          </>
        )}
        {noteListVisible && (
          <>
            <div className={`app__note-list${aiActivity.highlightElement === 'notelist' ? ' ai-highlight' : ''}`} style={{ width: layout.noteListWidth }}>
              {selection.kind === 'filter' && selection.filter === 'pulse' ? (
                <PulseView vaultPath={resolvedPath} onOpenNote={handlePulseOpenNote} sidebarCollapsed={!sidebarVisible} onExpandSidebar={() => setViewMode('all')} />
              ) : (
                <NoteList entries={vault.entries} selection={selection} selectedNote={activeTab?.entry ?? null} noteListFilter={noteListFilter} onNoteListFilterChange={setNoteListFilter} inboxPeriod={inboxPeriod} onInboxPeriodChange={setInboxPeriod} modifiedFiles={vault.modifiedFiles} modifiedFilesError={vault.modifiedFilesError} getNoteStatus={vault.getNoteStatus} sidebarCollapsed={!sidebarVisible} onSelectNote={notes.handleSelectNote} onReplaceActiveTab={notes.handleReplaceActiveTab} onCreateNote={notes.handleCreateNoteImmediate} onBulkArchive={bulkActions.handleBulkArchive} onBulkTrash={bulkActions.handleBulkTrash} onBulkRestore={bulkActions.handleBulkRestore} onBulkDeletePermanently={deleteActions.handleBulkDeletePermanently} onEmptyTrash={deleteActions.handleEmptyTrash} onUpdateTypeSort={notes.handleUpdateFrontmatter} updateEntry={vault.updateEntry} onOpenInNewWindow={handleOpenEntryInNewWindow} />
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
            showAIChat={dialogs.showAIChat}
            onToggleAIChat={dialogs.toggleAIChat}
            vaultPath={resolvedPath}
            noteList={aiNoteList}
            noteListFilter={aiNoteListFilter}
            onTrashNote={entryActions.handleTrashNote}
            onRestoreNote={entryActions.handleRestoreNote}
            onDeleteNote={deleteActions.handleDeleteNote}
            onArchiveNote={entryActions.handleArchiveNote}
            onUnarchiveNote={entryActions.handleUnarchiveNote}
            onContentChange={handleContentChange}
            onSave={handleSave}
            onTitleSync={handleTitleSync}
            rawToggleRef={rawToggleRef}
            diffToggleRef={diffToggleRef}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onGoBack={handleGoBack}
            onGoForward={handleGoForward}
            leftPanelsCollapsed={!sidebarVisible && !noteListVisible}
            onFileCreated={handleAgentFileCreated}
            onFileModified={handleAgentFileModified}
            onVaultChanged={handleAgentVaultChanged}
            onSetNoteIcon={handleSetNoteIcon}
            onRemoveNoteIcon={handleRemoveNoteIcon}
            isConflicted={!!notes.activeTabPath && autoSync.conflictFiles.some(f => notes.activeTabPath?.endsWith(f))}
            onKeepMine={handleKeepMine}
            onKeepTheirs={handleKeepTheirs}
          />
        </div>
      </div>
      {flatVaultMigration.needsMigration && (
        <FlatVaultMigrationBanner
          strayFileCount={flatVaultMigration.strayFiles.length}
          isMigrating={flatVaultMigration.isMigrating}
          onMigrate={async () => {
            const count = await flatVaultMigration.migrate()
            setToastMessage(`Migrated ${count} file${count !== 1 ? 's' : ''} to vault root`)
          }}
          onDismiss={flatVaultMigration.dismiss}
        />
      )}
      <UpdateBanner status={updateStatus} actions={updateActions} />
      <StatusBar noteCount={vault.entries.length} modifiedCount={vault.modifiedFiles.length} vaultPath={vaultSwitcher.vaultPath} vaults={vaultSwitcher.allVaults} onSwitchVault={vaultSwitcher.switchVault} onOpenSettings={dialogs.openSettings} onOpenLocalFolder={vaultSwitcher.handleOpenLocalFolder} onConnectGitHub={dialogs.openGitHubVault} onClickPending={() => handleSetSelection({ kind: 'filter', filter: 'changes' })} hasGitHub={!!settings.github_token} syncStatus={autoSync.syncStatus} lastSyncTime={autoSync.lastSyncTime} conflictCount={autoSync.conflictFiles.length} lastCommitInfo={autoSync.lastCommitInfo} remoteStatus={autoSync.remoteStatus} onTriggerSync={autoSync.triggerSync} onPullAndPush={autoSync.pullAndPush} onOpenConflictResolver={handleOpenConflictResolver} zoomLevel={zoom.zoomLevel} onZoomReset={zoom.zoomReset} buildNumber={buildNumber} onCheckForUpdates={handleCheckForUpdates} onRemoveVault={vaultSwitcher.removeVault} mcpStatus={mcpStatus} onInstallMcp={installMcp} />
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      <QuickOpenPalette open={dialogs.showQuickOpen} entries={vault.entries} onSelect={notes.handleSelectNote} onClose={dialogs.closeQuickOpen} />
      <CommandPalette open={dialogs.showCommandPalette} commands={commands} onClose={dialogs.closeCommandPalette} />
      <SearchPanel open={dialogs.showSearch} vaultPath={resolvedPath} entries={vault.entries} onSelectNote={notes.handleSelectNote} onClose={dialogs.closeSearch} />
      <CreateTypeDialog open={dialogs.showCreateTypeDialog} onClose={dialogs.closeCreateType} onCreate={handleCreateType} />
      <CommitDialog open={commitFlow.showCommitDialog} modifiedCount={vault.modifiedFiles.length} onCommit={commitFlow.handleCommitPush} onClose={commitFlow.closeCommitDialog} />
      <ConflictResolverModal
        open={dialogs.showConflictResolver}
        fileStates={conflictResolver.fileStates}
        allResolved={conflictResolver.allResolved}
        committing={conflictResolver.committing}
        error={conflictResolver.error}
        onResolveFile={conflictResolver.resolveFile}
        onOpenInEditor={conflictResolver.openInEditor}
        onCommit={conflictResolver.commitResolution}
        onClose={handleCloseConflictResolver}
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
