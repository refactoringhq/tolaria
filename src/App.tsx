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
import { useMcpStatus } from './hooks/useMcpStatus'
import { useVaultLoader } from './hooks/useVaultLoader'
import { useSettings } from './hooks/useSettings'
import { useNoteActions, needsRenameOnSave } from './hooks/useNoteActions'
import { useCommitFlow } from './hooks/useCommitFlow'
import { useViewMode } from './hooks/useViewMode'
import { useEntryActions } from './hooks/useEntryActions'
import { useAppCommands } from './hooks/useAppCommands'
import { useDialogs } from './hooks/useDialogs'
import { useVaultSwitcher } from './hooks/useVaultSwitcher'
import { useGitHistory } from './hooks/useGitHistory'
import { useUpdater, restartApp } from './hooks/useUpdater'
import { useNavigationHistory } from './hooks/useNavigationHistory'
import { useAutoSync } from './hooks/useAutoSync'
import { useConflictResolver } from './hooks/useConflictResolver'
import { useIndexing } from './hooks/useIndexing'
import { useZoom } from './hooks/useZoom'
import { useVaultConfig } from './hooks/useVaultConfig'
import { useBuildNumber } from './hooks/useBuildNumber'
import { useOnboarding } from './hooks/useOnboarding'
import { useThemeManager } from './hooks/useThemeManager'
import { useEditorSaveWithLinks } from './hooks/useEditorSaveWithLinks'
import { useNavigationGestures } from './hooks/useNavigationGestures'
import { useAiActivity } from './hooks/useAiActivity'
import { useBulkActions } from './hooks/useBulkActions'
import { ConflictResolverModal } from './components/ConflictResolverModal'
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog'
import { UpdateBanner } from './components/UpdateBanner'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from './mock-tauri'
import type { SidebarSelection, VaultEntry } from './types'
import type { NoteListItem } from './utils/ai-context'
import { filterEntries } from './utils/noteListHelpers'
import { openLocalFile } from './utils/url'
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

function useLayoutPanels() {
  const [sidebarWidth, setSidebarWidth] = useState(250)
  const [noteListWidth, setNoteListWidth] = useState(300)
  const [inspectorWidth, setInspectorWidth] = useState(280)
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false)
  const handleSidebarResize = useCallback((delta: number) => setSidebarWidth((w) => Math.max(150, Math.min(400, w + delta))), [])
  const handleNoteListResize = useCallback((delta: number) => setNoteListWidth((w) => Math.max(200, Math.min(500, w + delta))), [])
  const handleInspectorResize = useCallback((delta: number) => setInspectorWidth((w) => Math.max(200, Math.min(500, w - delta))), [])
  return { sidebarWidth, noteListWidth, inspectorWidth, inspectorCollapsed, setInspectorCollapsed, handleSidebarResize, handleNoteListResize, handleInspectorResize }
}

/** Wraps useEditorSave to also keep outgoingLinks in sync on save and on content change. */
function App() {
  const [selection, setSelection] = useState<SidebarSelection>(DEFAULT_SELECTION)
  const layout = useLayoutPanels()
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const dialogs = useDialogs()

  // onSwitch closure captures `notes` declared below — safe because it's only
  // called on user interaction, never during render (refs inside the hook
  // guarantee the latest closure is always used).
  const vaultSwitcher = useVaultSwitcher({
    onSwitch: () => { setSelection(DEFAULT_SELECTION); notes.closeAllTabs() },
    onToast: (msg) => setToastMessage(msg),
  })

  const onboarding = useOnboarding(vaultSwitcher.vaultPath)

  // When onboarding resolves to a different vault path, update the switcher
  const resolvedPath = onboarding.state.status === 'ready' ? onboarding.state.vaultPath : vaultSwitcher.vaultPath
  const vault = useVaultLoader(resolvedPath)
  useVaultConfig(resolvedPath)
  const { settings, saveSettings } = useSettings()
  const themeManager = useThemeManager(resolvedPath, vault.entries)

  const { mcpStatus, installMcp } = useMcpStatus(resolvedPath, setToastMessage)

  const indexing = useIndexing(resolvedPath)

  const autoSync = useAutoSync({
    vaultPath: resolvedPath,
    intervalMinutes: settings.auto_pull_interval_minutes,
    onVaultUpdated: vault.reloadVault,
    onSyncUpdated: indexing.triggerIncrementalIndex,
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

  // Ref bridges handleContentChange (created after notes) into useNoteActions.
  // Read at callback time, so it's always current when user presses Cmd+N.
  const contentChangeRef = useRef<(path: string, content: string) => void>(() => {})

  const notes = useNoteActions({ addEntry: vault.addEntry, removeEntry: vault.removeEntry, entries: vault.entries, setToastMessage, updateEntry: vault.updateEntry, vaultPath: resolvedPath, addPendingSave: vault.addPendingSave, removePendingSave: vault.removePendingSave, trackUnsaved: vault.trackUnsaved, clearUnsaved: vault.clearUnsaved, unsavedPaths: vault.unsavedPaths, markContentPending: (path, content) => contentChangeRef.current(path, content), onNewNotePersisted: vault.loadModifiedFiles, replaceEntry: vault.replaceEntry })

  // Keep tab entries in sync with vault entries so banners (trash/archive)
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

  const navHistory = useNavigationHistory()

  // Push to navigation history whenever the active tab changes (user-initiated)
  const navFromHistoryRef = useRef(false)
  useEffect(() => {
    if (notes.activeTabPath && !navFromHistoryRef.current) {
      navHistory.push(notes.activeTabPath)
    }
    navFromHistoryRef.current = false
  }, [notes.activeTabPath]) // eslint-disable-line react-hooks/exhaustive-deps -- navHistory.push is stable

  const isEntryExists = useCallback((path: string) => vault.entries.some(e => e.path === path), [vault.entries])

  const handleGoBack = useCallback(() => {
    const target = navHistory.goBack(isEntryExists)
    if (target) {
      navFromHistoryRef.current = true
      if (notes.tabs.some(t => t.entry.path === target)) {
        notes.handleSwitchTab(target)
      } else {
        const entry = vault.entries.find(e => e.path === target)
        if (entry) notes.handleSelectNote(entry)
      }
    }
  }, [navHistory, isEntryExists, vault.entries, notes])

  const handleGoForward = useCallback(() => {
    const target = navHistory.goForward(isEntryExists)
    if (target) {
      navFromHistoryRef.current = true
      if (notes.tabs.some(t => t.entry.path === target)) {
        notes.handleSwitchTab(target)
      } else {
        const entry = vault.entries.find(e => e.path === target)
        if (entry) notes.handleSelectNote(entry)
      }
    }
  }, [navHistory, isEntryExists, vault.entries, notes])

  useNavigationGestures({ onGoBack: handleGoBack, onGoForward: handleGoForward })

  // O(1) path lookup map — rebuilt only when vault.entries changes
  const entriesByPath = useMemo(() => {
    const map = new Map<string, VaultEntry>()
    for (const e of vault.entries) map.set(e.path, e)
    return map
  }, [vault.entries])

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
      setSelection({ kind: 'sectionGroup', type: filterType })
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
    const matchPath = notes.tabs.some(t => t.entry.path === relativePath) ? relativePath : fullPath
    if (notes.tabs.some(t => t.entry.path === matchPath)) {
      vault.reloadVault()
    }
  }, [vault, notes, resolvedPath])

  const handleAgentVaultChanged = useCallback(() => {
    vault.reloadVault()
  }, [vault])

  const { triggerIncrementalIndex } = indexing
  const onAfterSave = useCallback(() => {
    vault.loadModifiedFiles()
    triggerIncrementalIndex()
  }, [vault, triggerIncrementalIndex])

  const { notifyThemeSaved } = themeManager
  const onNotePersisted = useCallback((path: string, content: string) => {
    vault.clearUnsaved(path)
    notifyThemeSaved(path, content)
  }, [vault, notifyThemeSaved])

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

  const commitFlow = useCommitFlow({ savePending, loadModifiedFiles: vault.loadModifiedFiles, commitAndPush: vault.commitAndPush, setToastMessage })

  const entryActions = useEntryActions({
    entries: vault.entries, updateEntry: vault.updateEntry,
    handleUpdateFrontmatter: notes.handleUpdateFrontmatter,
    handleDeleteProperty: notes.handleDeleteProperty, setToastMessage,
    createTypeEntry: notes.createTypeEntrySilent,
    onFrontmatterPersisted: vault.loadModifiedFiles,
    onBeforeAction: flushBeforeAction,
  })

  const deleteNoteFromDisk = useCallback(async (path: string) => {
    try {
      if (isTauri()) await invoke('delete_note', { path })
      else await mockInvoke('delete_note', { path })
      notes.handleCloseTab(path)
      vault.removeEntry(path)
      return true
    } catch (e) {
      setToastMessage(`Failed to delete note: ${e}`)
      return false
    }
  }, [notes, vault, setToastMessage])

  // Confirmation dialog state for permanent delete
  const [confirmDelete, setConfirmDelete] = useState<{ title: string; message: string; confirmLabel?: string; onConfirm: () => void } | null>(null)

  const handleDeleteNote = useCallback(async (path: string) => {
    setConfirmDelete({
      title: 'Delete permanently?',
      message: 'This note will be permanently deleted. This cannot be undone.',
      onConfirm: async () => {
        setConfirmDelete(null)
        const ok = await deleteNoteFromDisk(path)
        if (ok) setToastMessage('Note permanently deleted')
      },
    })
  }, [deleteNoteFromDisk, setToastMessage])

  const handleBulkDeletePermanently = useCallback((paths: string[]) => {
    const count = paths.length
    setConfirmDelete({
      title: `Delete ${count} ${count === 1 ? 'note' : 'notes'} permanently?`,
      message: `${count === 1 ? 'This note' : `These ${count} notes`} will be permanently deleted. This cannot be undone.`,
      onConfirm: async () => {
        setConfirmDelete(null)
        let ok = 0
        for (const path of paths) {
          if (await deleteNoteFromDisk(path)) ok++
        }
        if (ok > 0) setToastMessage(`${ok} note${ok > 1 ? 's' : ''} permanently deleted`)
      },
    })
  }, [deleteNoteFromDisk, setToastMessage])

  const trashedCount = useMemo(() => vault.entries.filter(e => e.trashed).length, [vault.entries])

  const handleEmptyTrash = useCallback(() => {
    if (trashedCount === 0) return
    setConfirmDelete({
      title: 'Empty Trash?',
      message: `Permanently delete all ${trashedCount} trashed ${trashedCount === 1 ? 'note' : 'notes'}? This cannot be undone.`,
      confirmLabel: 'Empty Trash',
      onConfirm: async () => {
        setConfirmDelete(null)
        try {
          const tauriInvoke = isTauri() ? invoke : mockInvoke
          const deleted = await tauriInvoke<string[]>('empty_trash', { vaultPath: resolvedPath })
          // Close tabs and remove entries for deleted notes
          for (const path of deleted) {
            notes.handleCloseTab(path)
            vault.removeEntry(path)
          }
          setToastMessage(`${deleted.length} note${deleted.length !== 1 ? 's' : ''} permanently deleted`)
        } catch (e) {
          setToastMessage(`Failed to empty trash: ${e}`)
        }
      },
    })
  }, [trashedCount, resolvedPath, notes, vault, setToastMessage])

  const gitHistory = useGitHistory(notes.activeTabPath, vault.loadGitHistory)

  const handleCreateType = useCallback((name: string) => {
    notes.handleCreateType(name)
    setToastMessage(`Type "${name}" created`)
  }, [notes])

  /** H1→title sync: save pending content then rename file + update wikilinks. */
  const handleTitleSync = useCallback(async (path: string, newTitle: string) => {
    await savePendingForPath(path)
    await notes.handleRenameNote(path, newTitle, resolvedPath, vault.replaceEntry).then(vault.loadModifiedFiles)
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

  const handleRestoreDefaultThemes = useCallback(async () => {
    if (!resolvedPath) return
    try {
      const tauriInvoke = isTauri() ? invoke : mockInvoke
      const msg = await tauriInvoke<string>('restore_default_themes', { vaultPath: resolvedPath })
      await vault.reloadVault()
      await themeManager.reloadThemes()
      setToastMessage(msg)
    } catch (err) {
      setToastMessage(`Failed to restore themes: ${err}`)
    }
  }, [resolvedPath, vault, themeManager, setToastMessage])

  const handleRepairVault = useCallback(async () => {
    if (!resolvedPath) return
    try {
      const tauriInvoke = isTauri() ? invoke : mockInvoke
      const msg = await tauriInvoke<string>('repair_vault', { vaultPath: resolvedPath })
      await vault.reloadVault()
      await themeManager.reloadThemes()
      setToastMessage(msg)
    } catch (err) {
      setToastMessage(`Failed to repair vault: ${err}`)
    }
  }, [resolvedPath, vault, themeManager, setToastMessage])

  const commands = useAppCommands({
    activeTabPath: notes.activeTabPath, activeTabPathRef: notes.activeTabPathRef,
    handleCloseTabRef: notes.handleCloseTabRef, tabs: notes.tabs,
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
    onResolveConflicts: handleOpenConflictResolver,
    onSetViewMode: setViewMode,
    onToggleInspector: () => layout.setInspectorCollapsed(c => !c),
    onToggleDiff: () => diffToggleRef.current(),
    onToggleRawEditor: () => rawToggleRef.current(),
    onZoomIn: zoom.zoomIn, onZoomOut: zoom.zoomOut, onZoomReset: zoom.zoomReset,
    zoomLevel: zoom.zoomLevel,
    onSelect: setSelection, onCloseTab: notes.handleCloseTab,
    onSwitchTab: notes.handleSwitchTab, onReplaceActiveTab: notes.handleReplaceActiveTab,
    onSelectNote: notes.handleSelectNote,
    onGoBack: handleGoBack, onGoForward: handleGoForward,
    canGoBack: navHistory.canGoBack, canGoForward: navHistory.canGoForward,
    themes: themeManager.themes, activeThemeId: themeManager.activeThemeId,
    onSwitchTheme: themeManager.switchTheme,
    onCreateTheme: async () => {
      const path = await themeManager.createTheme()
      const freshEntries = await vault.reloadVault()
      setSelection({ kind: 'sectionGroup', type: 'Theme' })
      if (path) {
        const entry = freshEntries.find(e => e.path === path)
        if (entry) notes.handleSelectNote(entry)
      }
    },
    onOpenTheme: (themeId: string) => {
      const entry = vault.entries.find(e => e.path === themeId)
      if (entry) notes.handleSelectNote(entry)
    },
    onOpenVault: vaultSwitcher.handleOpenLocalFolder,
    onCreateType: dialogs.openCreateType,
    onToggleAIChat: dialogs.toggleAIChat,
    onCheckForUpdates: handleCheckForUpdates,
    onRemoveActiveVault: () => vaultSwitcher.removeVault(vaultSwitcher.vaultPath),
    onRestoreGettingStarted: vaultSwitcher.restoreGettingStarted,
    onRestoreDefaultThemes: handleRestoreDefaultThemes,
    isGettingStartedHidden: vaultSwitcher.isGettingStartedHidden,
    vaultCount: vaultSwitcher.allVaults.length,
    mcpStatus,
    onInstallMcp: installMcp,
    onEmptyTrash: handleEmptyTrash,
    trashedCount,
    onReopenClosedTab: notes.handleReopenClosedTab,
    onReindexVault: indexing.triggerFullReindex,
    onReloadVault: vault.reloadVault,
    onRepairVault: handleRepairVault,
  })

  const activeTab = notes.tabs.find((t) => t.entry.path === notes.activeTabPath) ?? null

  const aiNoteList = useMemo<NoteListItem[]>(() => {
    return filterEntries(vault.entries, selection).map(e => ({
      path: e.path, title: e.title, type: e.isA ?? 'Note',
    }))
  }, [vault.entries, selection])

  const aiNoteListFilter = useMemo(() => {
    if (selection.kind === 'sectionGroup') return { type: selection.type, query: '' }
    if (selection.kind === 'topic') return { type: null, query: selection.entry.title }
    if (selection.kind === 'entity') return { type: null, query: selection.entry.title }
    return { type: null, query: '' }
  }, [selection])

  // Show welcome/onboarding screen when vault doesn't exist
  if (onboarding.state.status === 'welcome' || onboarding.state.status === 'vault-missing') {
    const defaultPath = onboarding.state.defaultPath
    return (
      <div className="app-shell">
        <WelcomeScreen
          mode={onboarding.state.status === 'welcome' ? 'welcome' : 'vault-missing'}
          missingPath={onboarding.state.status === 'vault-missing' ? onboarding.state.vaultPath : undefined}
          defaultVaultPath={defaultPath}
          onCreateVault={onboarding.handleCreateVault}
          onOpenFolder={onboarding.handleOpenFolder}
          creating={onboarding.creating}
          error={onboarding.error}
        />
      </div>
    )
  }

  // Show loading spinner while checking vault
  if (onboarding.state.status === 'loading') {
    return (
      <div className="app-shell">
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sidebar)' }}>
          <span style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>Loading…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="app">
        {sidebarVisible && (
          <>
            <div className="app__sidebar" style={{ width: layout.sidebarWidth }}>
              <Sidebar entries={vault.entries} selection={selection} onSelect={setSelection} onSelectNote={notes.handleSelectNote} onCreateType={notes.handleCreateNoteImmediate} onCreateNewType={dialogs.openCreateType} onCustomizeType={entryActions.handleCustomizeType} onUpdateTypeTemplate={entryActions.handleUpdateTypeTemplate} onReorderSections={entryActions.handleReorderSections} onRenameSection={entryActions.handleRenameSection} onToggleTypeVisibility={entryActions.handleToggleTypeVisibility} modifiedCount={vault.modifiedFiles.length} onCommitPush={commitFlow.openCommitDialog} isGitVault={!vault.modifiedFilesError} />
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
                <NoteList entries={vault.entries} selection={selection} selectedNote={activeTab?.entry ?? null} modifiedFiles={vault.modifiedFiles} modifiedFilesError={vault.modifiedFilesError} getNoteStatus={vault.getNoteStatus} sidebarCollapsed={!sidebarVisible} onSelectNote={notes.handleSelectNote} onReplaceActiveTab={notes.handleReplaceActiveTab} onCreateNote={notes.handleCreateNoteImmediate} onBulkArchive={bulkActions.handleBulkArchive} onBulkTrash={bulkActions.handleBulkTrash} onBulkRestore={bulkActions.handleBulkRestore} onBulkDeletePermanently={handleBulkDeletePermanently} onEmptyTrash={handleEmptyTrash} onUpdateTypeSort={notes.handleUpdateFrontmatter} updateEntry={vault.updateEntry} />
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
            onSwitchTab={notes.handleSwitchTab}
            onCloseTab={notes.handleCloseTab}
            onReorderTabs={notes.handleReorderTabs}
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
            onDeleteNote={handleDeleteNote}
            onArchiveNote={entryActions.handleArchiveNote}
            onUnarchiveNote={entryActions.handleUnarchiveNote}
            onRenameTab={handleRenameTab}
            onContentChange={handleContentChange}
            onSave={handleSave}
            onTitleSync={handleTitleSync}
            rawToggleRef={rawToggleRef}
            diffToggleRef={diffToggleRef}
            canGoBack={navHistory.canGoBack}
            canGoForward={navHistory.canGoForward}
            onGoBack={handleGoBack}
            onGoForward={handleGoForward}
            leftPanelsCollapsed={!sidebarVisible && !noteListVisible}
            isDarkTheme={themeManager.isDark}
            onFileCreated={handleAgentFileCreated}
            onFileModified={handleAgentFileModified}
            onVaultChanged={handleAgentVaultChanged}
          />
        </div>
      </div>
      <UpdateBanner status={updateStatus} actions={updateActions} />
      <StatusBar noteCount={vault.entries.length} modifiedCount={vault.modifiedFiles.length} vaultPath={vaultSwitcher.vaultPath} vaults={vaultSwitcher.allVaults} onSwitchVault={vaultSwitcher.switchVault} onOpenSettings={dialogs.openSettings} onOpenLocalFolder={vaultSwitcher.handleOpenLocalFolder} onConnectGitHub={dialogs.openGitHubVault} onClickPending={() => setSelection({ kind: 'filter', filter: 'changes' })} hasGitHub={!!settings.github_token} syncStatus={autoSync.syncStatus} lastSyncTime={autoSync.lastSyncTime} conflictCount={autoSync.conflictFiles.length} lastCommitInfo={autoSync.lastCommitInfo} onTriggerSync={autoSync.triggerSync} onOpenConflictResolver={handleOpenConflictResolver} zoomLevel={zoom.zoomLevel} onZoomReset={zoom.zoomReset} buildNumber={buildNumber} onCheckForUpdates={handleCheckForUpdates} indexingProgress={indexing.progress} lastIndexedTime={indexing.lastIndexedTime} onRetryIndexing={indexing.retryIndexing} onReindexVault={indexing.triggerFullReindex} onRemoveVault={vaultSwitcher.removeVault} mcpStatus={mcpStatus} onInstallMcp={installMcp} />
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
      <SettingsPanel open={dialogs.showSettings} settings={settings} onSave={saveSettings} onClose={dialogs.closeSettings} themeManager={themeManager} />
      <GitHubVaultModal
        open={dialogs.showGitHubVault}
        githubToken={settings.github_token}
        onClose={dialogs.closeGitHubVault}
        onVaultCloned={vaultSwitcher.handleVaultCloned}
        onOpenSettings={() => { dialogs.closeGitHubVault(); dialogs.openSettings() }}
        onGitHubConnected={(token, username) => saveSettings({ ...settings, github_token: token, github_username: username })}
      />
      {confirmDelete && (
        <ConfirmDeleteDialog
          open={true}
          title={confirmDelete.title}
          message={confirmDelete.message}
          confirmLabel={confirmDelete.confirmLabel}
          onConfirm={confirmDelete.onConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

export default App
