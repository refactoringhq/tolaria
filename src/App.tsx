import { useCallback, useEffect, useRef, useState } from 'react'
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
import { StatusBar } from './components/StatusBar'
import { SettingsPanel } from './components/SettingsPanel'
import { GitHubVaultModal } from './components/GitHubVaultModal'
import { WelcomeScreen } from './components/WelcomeScreen'
import { useVaultLoader } from './hooks/useVaultLoader'
import { useSettings } from './hooks/useSettings'
import { useNoteActions } from './hooks/useNoteActions'
import { useEditorSave } from './hooks/useEditorSave'
import { useCommitFlow } from './hooks/useCommitFlow'
import { useViewMode } from './hooks/useViewMode'
import { useEntryActions } from './hooks/useEntryActions'
import { useAppCommands } from './hooks/useAppCommands'
import { useDialogs } from './hooks/useDialogs'
import { useVaultSwitcher } from './hooks/useVaultSwitcher'
import { useGitHistory } from './hooks/useGitHistory'
import { useUpdater } from './hooks/useUpdater'
import { useNavigationHistory } from './hooks/useNavigationHistory'
import { useAutoSync } from './hooks/useAutoSync'
import { useZoom } from './hooks/useZoom'
import { useOnboarding } from './hooks/useOnboarding'
import { UpdateBanner } from './components/UpdateBanner'
import { setApiKey } from './utils/ai-chat'
import { extractOutgoingLinks } from './utils/wikilinks'
import type { SidebarSelection } from './types'
import './App.css'

// Type declaration for mock content storage
declare global {
  interface Window {
    __mockContent?: Record<string, string>
  }
}

const DEFAULT_SELECTION: SidebarSelection = { kind: 'filter', filter: 'all' }

function useBulkActions(
  entryActions: { handleArchiveNote: (path: string) => Promise<void>; handleTrashNote: (path: string) => Promise<void> },
  setToastMessage: (msg: string | null) => void,
) {
  const handleBulkArchive = useCallback(async (paths: string[]) => {
    for (const path of paths) await entryActions.handleArchiveNote(path)
    setToastMessage(`${paths.length} note${paths.length > 1 ? 's' : ''} archived`)
  }, [entryActions, setToastMessage])

  const handleBulkTrash = useCallback(async (paths: string[]) => {
    for (const path of paths) await entryActions.handleTrashNote(path)
    setToastMessage(`${paths.length} note${paths.length > 1 ? 's' : ''} moved to trash`)
  }, [entryActions, setToastMessage])

  return { handleBulkArchive, handleBulkTrash }
}

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
function useEditorSaveWithLinks(config: {
  updateContent: (path: string, content: string) => void
  updateEntry: (path: string, patch: Partial<import('./types').VaultEntry>) => void
  setTabs: Parameters<typeof useEditorSave>[0]['setTabs']
  setToastMessage: (msg: string | null) => void
  onAfterSave: () => void
  onNotePersisted?: (path: string) => void
}) {
  const { updateContent, updateEntry } = config
  const saveContent = useCallback((path: string, content: string) => {
    updateContent(path, content)
    updateEntry(path, { outgoingLinks: extractOutgoingLinks(content) })
  }, [updateContent, updateEntry])
  const editor = useEditorSave({ updateVaultContent: saveContent, setTabs: config.setTabs, setToastMessage: config.setToastMessage, onAfterSave: config.onAfterSave, onNotePersisted: config.onNotePersisted })
  const { handleContentChange: rawOnChange } = editor
  const prevLinksKeyRef = useRef('')
  const handleContentChange = useCallback((path: string, content: string) => {
    rawOnChange(path, content)
    const links = extractOutgoingLinks(content)
    const key = links.join('\0')
    if (key !== prevLinksKeyRef.current) {
      prevLinksKeyRef.current = key
      updateEntry(path, { outgoingLinks: links })
    }
  }, [rawOnChange, updateEntry])
  return { ...editor, handleContentChange }
}

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
  const { settings, saveSettings } = useSettings()

  useEffect(() => { setApiKey(settings.anthropic_key ?? '') }, [settings.anthropic_key])

  const autoSync = useAutoSync({
    vaultPath: resolvedPath,
    intervalMinutes: settings.auto_pull_interval_minutes,
    onVaultUpdated: vault.reloadVault,
    onConflict: (files) => {
      const names = files.map((f) => f.split('/').pop()).join(', ')
      setToastMessage(`Conflict in ${names} — review needed`)
    },
    onToast: (msg) => setToastMessage(msg),
  })

  // Ref bridges handleContentChange (created after notes) into useNoteActions.
  // Read at callback time, so it's always current when user presses Cmd+N.
  const contentChangeRef = useRef<(path: string, content: string) => void>(() => {})

  const notes = useNoteActions({ addEntry: vault.addEntry, removeEntry: vault.removeEntry, updateContent: vault.updateContent, entries: vault.entries, setToastMessage, updateEntry: vault.updateEntry, addPendingSave: vault.addPendingSave, removePendingSave: vault.removePendingSave, trackUnsaved: vault.trackUnsaved, clearUnsaved: vault.clearUnsaved, unsavedPaths: vault.unsavedPaths, markContentPending: (path, content) => contentChangeRef.current(path, content) })

  const navHistory = useNavigationHistory()

  // Push to navigation history whenever the active tab changes (user-initiated)
  const navFromHistoryRef = useRef(false)
  useEffect(() => {
    if (notes.activeTabPath && !navFromHistoryRef.current) {
      navHistory.push(notes.activeTabPath)
    }
    navFromHistoryRef.current = false
  }, [notes.activeTabPath]) // eslint-disable-line react-hooks/exhaustive-deps -- navHistory.push is stable

  const isTabOpen = useCallback((path: string) => notes.tabs.some(t => t.entry.path === path), [notes.tabs])

  const handleGoBack = useCallback(() => {
    const target = navHistory.goBack(isTabOpen)
    if (target) {
      navFromHistoryRef.current = true
      notes.handleSwitchTab(target)
    }
  }, [navHistory, isTabOpen, notes])

  const handleGoForward = useCallback(() => {
    const target = navHistory.goForward(isTabOpen)
    if (target) {
      navFromHistoryRef.current = true
      notes.handleSwitchTab(target)
    }
  }, [navHistory, isTabOpen, notes])

  // Mouse button 3/4 (back/forward) and macOS trackpad two-finger swipe
  useEffect(() => {
    const handleMouseBack = (e: MouseEvent) => {
      if (e.button === 3) { e.preventDefault(); handleGoBack() }
      if (e.button === 4) { e.preventDefault(); handleGoForward() }
    }
    window.addEventListener('mouseup', handleMouseBack)

    // Trackpad swipe: accumulate horizontal wheel delta and trigger on threshold
    let accumulatedDeltaX = 0
    let resetTimer: ReturnType<typeof setTimeout> | null = null
    const SWIPE_THRESHOLD = 120

    const handleWheel = (e: WheelEvent) => {
      // Only handle horizontal-dominant gestures (trackpad swipe)
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      if (e.ctrlKey || e.metaKey) return // ignore pinch-zoom

      accumulatedDeltaX += e.deltaX

      if (resetTimer) clearTimeout(resetTimer)
      resetTimer = setTimeout(() => { accumulatedDeltaX = 0 }, 300)

      if (accumulatedDeltaX > SWIPE_THRESHOLD) {
        accumulatedDeltaX = 0
        handleGoForward()
      } else if (accumulatedDeltaX < -SWIPE_THRESHOLD) {
        accumulatedDeltaX = 0
        handleGoBack()
      }
    }
    window.addEventListener('wheel', handleWheel, { passive: true })

    return () => {
      window.removeEventListener('mouseup', handleMouseBack)
      window.removeEventListener('wheel', handleWheel)
      if (resetTimer) clearTimeout(resetTimer)
    }
  }, [handleGoBack, handleGoForward])

  const { handleSave: handleSaveRaw, handleContentChange, savePendingForPath, savePending } = useEditorSaveWithLinks({
    updateContent: vault.updateContent, updateEntry: vault.updateEntry,
    setTabs: notes.setTabs, setToastMessage, onAfterSave: vault.loadModifiedFiles,
    onNotePersisted: vault.clearUnsaved,
  })
  useEffect(() => { contentChangeRef.current = handleContentChange }, [handleContentChange])

  // Wrap handleSave to also persist unsaved notes that have no pending edits (user pressed Cmd+S without typing)
  const handleSave = useCallback(async () => {
    const activeTab = notes.tabs.find(t => t.entry.path === notes.activeTabPath)
    const fallback = activeTab && vault.unsavedPaths.has(activeTab.entry.path)
      ? { path: activeTab.entry.path, content: activeTab.content }
      : undefined
    await handleSaveRaw(fallback)
  }, [handleSaveRaw, notes.tabs, notes.activeTabPath, vault.unsavedPaths])

  const commitFlow = useCommitFlow({ savePending, loadModifiedFiles: vault.loadModifiedFiles, commitAndPush: vault.commitAndPush, setToastMessage })

  const entryActions = useEntryActions({
    entries: vault.entries, updateEntry: vault.updateEntry,
    handleUpdateFrontmatter: notes.handleUpdateFrontmatter,
    handleDeleteProperty: notes.handleDeleteProperty, setToastMessage,
  })

  const gitHistory = useGitHistory(notes.activeTabPath, vault.loadGitHistory)

  const handleCreateType = useCallback((name: string) => {
    notes.handleCreateType(name)
    setToastMessage(`Type "${name}" created`)
  }, [notes])

  const handleRenameTab = useCallback(async (path: string, newTitle: string) => {
    await savePendingForPath(path)
    await notes.handleRenameNote(path, newTitle, resolvedPath, vault.replaceEntry).then(vault.loadModifiedFiles)
  }, [notes, resolvedPath, vault, savePendingForPath])

  /** H1→title sync: update VaultEntry.title and tab entry in memory. */
  const handleTitleSync = useCallback((path: string, newTitle: string) => {
    vault.updateEntry(path, { title: newTitle })
    notes.setTabs(prev => prev.map(t =>
      t.entry.path === path ? { ...t, entry: { ...t.entry, title: newTitle } } : t
    ))
  }, [vault, notes])

  const bulkActions = useBulkActions(entryActions, setToastMessage)

  const { setViewMode, sidebarVisible, noteListVisible } = useViewMode()
  const zoom = useZoom()

  const commands = useAppCommands({
    activeTabPath: notes.activeTabPath, activeTabPathRef: notes.activeTabPathRef,
    handleCloseTabRef: notes.handleCloseTabRef, tabs: notes.tabs,
    entries: vault.entries, allContent: vault.allContent,
    modifiedCount: vault.modifiedFiles.length, selection,
    onQuickOpen: dialogs.openQuickOpen, onCommandPalette: dialogs.openCommandPalette,
    onSearch: dialogs.openSearch,
    onCreateNote: notes.handleCreateNoteImmediate, onSave: handleSave,
    onOpenSettings: dialogs.openSettings,
    onTrashNote: entryActions.handleTrashNote, onArchiveNote: entryActions.handleArchiveNote,
    onUnarchiveNote: entryActions.handleUnarchiveNote,
    onCommitPush: commitFlow.openCommitDialog, onSetViewMode: setViewMode,
    onToggleInspector: () => layout.setInspectorCollapsed(c => !c),
    onZoomIn: zoom.zoomIn, onZoomOut: zoom.zoomOut, onZoomReset: zoom.zoomReset,
    zoomLevel: zoom.zoomLevel,
    onSelect: setSelection, onCloseTab: notes.handleCloseTab,
    onSwitchTab: notes.handleSwitchTab, onReplaceActiveTab: notes.handleReplaceActiveTab,
    onSelectNote: notes.handleSelectNote,
    onGoBack: handleGoBack, onGoForward: handleGoForward,
    canGoBack: navHistory.canGoBack, canGoForward: navHistory.canGoForward,
  })

  const { status: updateStatus, actions: updateActions } = useUpdater()

  const activeTab = notes.tabs.find((t) => t.entry.path === notes.activeTabPath) ?? null

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
      <UpdateBanner status={updateStatus} actions={updateActions} />
      <div className="app">
        {sidebarVisible && (
          <>
            <div className="app__sidebar" style={{ width: layout.sidebarWidth }}>
              <Sidebar entries={vault.entries} selection={selection} onSelect={setSelection} onSelectNote={notes.handleSelectNote} onCreateType={notes.handleCreateNoteImmediate} onCreateNewType={dialogs.openCreateType} onCustomizeType={entryActions.handleCustomizeType} onReorderSections={entryActions.handleReorderSections} modifiedCount={vault.modifiedFiles.length} onCommitPush={commitFlow.openCommitDialog} />
            </div>
            <ResizeHandle onResize={layout.handleSidebarResize} />
          </>
        )}
        {noteListVisible && (
          <>
            <div className="app__note-list" style={{ width: layout.noteListWidth }}>
              <NoteList entries={vault.entries} selection={selection} selectedNote={activeTab?.entry ?? null} allContent={vault.allContent} modifiedFiles={vault.modifiedFiles} getNoteStatus={vault.getNoteStatus} sidebarCollapsed={!sidebarVisible} onSelectNote={notes.handleSelectNote} onReplaceActiveTab={notes.handleReplaceActiveTab} onCreateNote={notes.handleCreateNoteImmediate} onBulkArchive={bulkActions.handleBulkArchive} onBulkTrash={bulkActions.handleBulkTrash} />
            </div>
            <ResizeHandle onResize={layout.handleNoteListResize} />
          </>
        )}
        <div className="app__editor">
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
            allContent={vault.allContent}
            gitHistory={gitHistory}
            onUpdateFrontmatter={notes.handleUpdateFrontmatter}
            onDeleteProperty={notes.handleDeleteProperty}
            onAddProperty={notes.handleAddProperty}
            showAIChat={dialogs.showAIChat}
            onToggleAIChat={dialogs.toggleAIChat}
            vaultPath={resolvedPath}
            onTrashNote={entryActions.handleTrashNote}
            onRestoreNote={entryActions.handleRestoreNote}
            onArchiveNote={entryActions.handleArchiveNote}
            onUnarchiveNote={entryActions.handleUnarchiveNote}
            onRenameTab={handleRenameTab}
            onContentChange={handleContentChange}
            onTitleSync={handleTitleSync}
            canGoBack={navHistory.canGoBack}
            canGoForward={navHistory.canGoForward}
            onGoBack={handleGoBack}
            onGoForward={handleGoForward}
          />
        </div>
      </div>
      <StatusBar noteCount={vault.entries.length} modifiedCount={vault.modifiedFiles.length} vaultPath={vaultSwitcher.vaultPath} vaults={vaultSwitcher.allVaults} onSwitchVault={vaultSwitcher.switchVault} onOpenSettings={dialogs.openSettings} onOpenLocalFolder={vaultSwitcher.handleOpenLocalFolder} onConnectGitHub={dialogs.openGitHubVault} onClickPending={() => setSelection({ kind: 'filter', filter: 'changes' })} hasGitHub={!!settings.github_token} syncStatus={autoSync.syncStatus} lastSyncTime={autoSync.lastSyncTime} conflictCount={autoSync.conflictFiles.length} lastCommitInfo={autoSync.lastCommitInfo} onTriggerSync={autoSync.triggerSync} zoomLevel={zoom.zoomLevel} onZoomReset={zoom.zoomReset} />
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      <QuickOpenPalette open={dialogs.showQuickOpen} entries={vault.entries} onSelect={notes.handleSelectNote} onClose={dialogs.closeQuickOpen} />
      <CommandPalette open={dialogs.showCommandPalette} commands={commands} onClose={dialogs.closeCommandPalette} />
      <SearchPanel open={dialogs.showSearch} vaultPath={resolvedPath} entries={vault.entries} onSelectNote={notes.handleSelectNote} onClose={dialogs.closeSearch} />
      <CreateTypeDialog open={dialogs.showCreateTypeDialog} onClose={dialogs.closeCreateType} onCreate={handleCreateType} />
      <CommitDialog open={commitFlow.showCommitDialog} modifiedCount={vault.modifiedFiles.length} onCommit={commitFlow.handleCommitPush} onClose={commitFlow.closeCommitDialog} />
      <SettingsPanel open={dialogs.showSettings} settings={settings} onSave={saveSettings} onClose={dialogs.closeSettings} />
      <GitHubVaultModal
        open={dialogs.showGitHubVault}
        githubToken={settings.github_token}
        onClose={dialogs.closeGitHubVault}
        onVaultCloned={vaultSwitcher.handleVaultCloned}
        onOpenSettings={() => { dialogs.closeGitHubVault(); dialogs.openSettings() }}
        onGitHubConnected={(token, username) => saveSettings({ ...settings, github_token: token, github_username: username })}
      />
    </div>
  )
}

export default App
