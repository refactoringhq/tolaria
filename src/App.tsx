import { useCallback, useEffect, useMemo, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { NoteList } from './components/NoteList'
import { Editor } from './components/Editor'
import { ResizeHandle } from './components/ResizeHandle'
import { CreateTypeDialog } from './components/CreateTypeDialog'
import { QuickOpenPalette } from './components/QuickOpenPalette'
import { Toast } from './components/Toast'
import { CommitDialog } from './components/CommitDialog'
import { StatusBar } from './components/StatusBar'
import { SettingsPanel } from './components/SettingsPanel'
import { GitHubVaultModal } from './components/GitHubVaultModal'
import { useVaultLoader } from './hooks/useVaultLoader'
import { useSettings } from './hooks/useSettings'
import { useNoteActions, generateUntitledName } from './hooks/useNoteActions'
import { useEditorSave } from './hooks/useEditorSave'
import { useAppKeyboard } from './hooks/useAppKeyboard'
import { useViewMode } from './hooks/useViewMode'
import { useEntryActions } from './hooks/useEntryActions'
import { isTauri } from './mock-tauri'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation'
import { useUpdater } from './hooks/useUpdater'
import { UpdateBanner } from './components/UpdateBanner'
import { setApiKey } from './utils/ai-chat'
import type { SidebarSelection, GitCommit } from './types'
import type { VaultOption } from './components/StatusBar'
import './App.css'

// Type declaration for mock content storage
declare global {
  interface Window {
    __mockContent?: Record<string, string>
  }
}

const DEFAULT_SELECTION: SidebarSelection = { kind: 'filter', filter: 'all' }

const DEFAULT_VAULTS: VaultOption[] = isTauri()
  ? [
      { label: 'Demo v2', path: '/Users/luca/Workspace/laputa-app/demo-vault-v2' },
      { label: 'Laputa', path: '/Users/luca/Laputa' },
    ]
  : [
      { label: 'Demo v2', path: '/Users/luca/Workspace/laputa-app/demo-vault-v2' },
    ]

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

function App() {
  const [selection, setSelection] = useState<SidebarSelection>(DEFAULT_SELECTION)
  const layout = useLayoutPanels()
  const [gitHistory, setGitHistory] = useState<GitCommit[]>([])
  const [showCreateTypeDialog, setShowCreateTypeDialog] = useState(false)
  const [showQuickOpen, setShowQuickOpen] = useState(false)
  const [showCommitDialog, setShowCommitDialog] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [vaultPath, setVaultPath] = useState(DEFAULT_VAULTS[0].path)
  const [showAIChat, setShowAIChat] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showGitHubVault, setShowGitHubVault] = useState(false)
  const [extraVaults, setExtraVaults] = useState<VaultOption[]>([])

  const allVaults = useMemo(() => [...DEFAULT_VAULTS, ...extraVaults], [extraVaults])

  const vault = useVaultLoader(vaultPath)
  const { settings, saveSettings } = useSettings()

  // Sync Anthropic key from settings to localStorage for AIChatPanel
  useEffect(() => {
    setApiKey(settings.anthropic_key ?? '')
  }, [settings.anthropic_key])

  const notes = useNoteActions({ addEntry: vault.addEntry, updateContent: vault.updateContent, entries: vault.entries, setToastMessage, updateEntry: vault.updateEntry })

  const { handleSave, handleContentChange, savePendingForPath } = useEditorSave({
    updateVaultContent: vault.updateContent,
    setTabs: notes.setTabs,
    setToastMessage,
  })

  const entryActions = useEntryActions({
    entries: vault.entries,
    updateEntry: vault.updateEntry,
    handleUpdateFrontmatter: notes.handleUpdateFrontmatter,
    handleDeleteProperty: notes.handleDeleteProperty,
    setToastMessage,
  })

  // Immediate note creation — no dialog, just create and open
  const handleCreateNoteImmediate = useCallback((type?: string) => {
    const noteType = type || 'Note'
    notes.handleCreateNote(generateUntitledName(vault.entries, noteType), noteType)
    window.dispatchEvent(new CustomEvent('laputa:focus-editor'))
  }, [vault.entries, notes])

  const handleSwitchVault = useCallback((path: string) => {
    setVaultPath(path)
    setSelection(DEFAULT_SELECTION)
    setGitHistory([])
    notes.closeAllTabs()
  }, [notes])

  const handleVaultCloned = useCallback((path: string, label: string) => {
    setExtraVaults(prev => {
      if (prev.some(v => v.path === path)) return prev
      return [...prev, { label, path }]
    })
    handleSwitchVault(path)
    setToastMessage(`Vault "${label}" cloned and opened`)
  }, [handleSwitchVault])

  useEffect(() => {
    if (!notes.activeTabPath) { setGitHistory([]); return }
    vault.loadGitHistory(notes.activeTabPath).then(setGitHistory)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- vault object is unstable; loadGitHistory is the actual dep
  }, [notes.activeTabPath, vault.loadGitHistory])

  const openCreateTypeDialog = useCallback(() => {
    setShowCreateTypeDialog(true)
  }, [])

  const handleCreateType = useCallback((name: string) => {
    notes.handleCreateType(name)
    setToastMessage(`Type "${name}" created`)
  }, [notes])

  const handleRenameTab = useCallback(async (path: string, newTitle: string) => {
    // Save any pending content before renaming so the file on disk is up to date
    await savePendingForPath(path)
    notes.handleRenameNote(path, newTitle, vaultPath, vault.replaceEntry)
  }, [notes, vaultPath, vault, savePendingForPath])

  const { setViewMode } = useViewMode()

  useAppKeyboard({
    onQuickOpen: () => setShowQuickOpen(true),
    onCreateNote: handleCreateNoteImmediate,
    onSave: handleSave,
    onOpenSettings: () => setShowSettings(true),
    onTrashNote: entryActions.handleTrashNote,
    onArchiveNote: entryActions.handleArchiveNote,
    onSetViewMode: setViewMode,
    activeTabPathRef: notes.activeTabPathRef,
    handleCloseTabRef: notes.handleCloseTabRef,
  })

  const { status: updateStatus, actions: updateActions } = useUpdater()

  useKeyboardNavigation({
    tabs: notes.tabs,
    activeTabPath: notes.activeTabPath,
    entries: vault.entries,
    selection,
    allContent: vault.allContent,
    onSwitchTab: notes.handleSwitchTab,
    onReplaceActiveTab: notes.handleReplaceActiveTab,
    onSelectNote: notes.handleSelectNote,
  })

  const handleCommitPush = useCallback(async (message: string) => {
    setShowCommitDialog(false)
    try {
      const result = await vault.commitAndPush(message)
      setToastMessage(result)
      vault.loadModifiedFiles()
    } catch (err) {
      console.error('Commit failed:', err)
      setToastMessage(`Commit failed: ${err}`)
    }
  }, [vault])

  const activeTab = notes.tabs.find((t) => t.entry.path === notes.activeTabPath) ?? null

  return (
    <div className="app-shell">
      <UpdateBanner status={updateStatus} actions={updateActions} />
      <div className="app">
        <div className="app__sidebar" style={{ width: layout.sidebarWidth }}>
          <Sidebar entries={vault.entries} selection={selection} onSelect={setSelection} onSelectNote={notes.handleSelectNote} onCreateType={handleCreateNoteImmediate} onCreateNewType={openCreateTypeDialog} onCustomizeType={entryActions.handleCustomizeType} onReorderSections={entryActions.handleReorderSections} modifiedCount={vault.modifiedFiles.length} onCommitPush={() => setShowCommitDialog(true)} />
        </div>
        <ResizeHandle onResize={layout.handleSidebarResize} />
        <div className="app__note-list" style={{ width: layout.noteListWidth }}>
          <NoteList entries={vault.entries} selection={selection} selectedNote={activeTab?.entry ?? null} allContent={vault.allContent} modifiedFiles={vault.modifiedFiles} onSelectNote={notes.handleSelectNote} onCreateNote={handleCreateNoteImmediate} />
        </div>
        <ResizeHandle onResize={layout.handleNoteListResize} />
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
            isModified={vault.isFileModified}
            onCreateNote={handleCreateNoteImmediate}
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
            showAIChat={showAIChat}
            onToggleAIChat={() => setShowAIChat(c => !c)}
            vaultPath={vaultPath}
            onTrashNote={entryActions.handleTrashNote}
            onRestoreNote={entryActions.handleRestoreNote}
            onArchiveNote={entryActions.handleArchiveNote}
            onUnarchiveNote={entryActions.handleUnarchiveNote}
            onRenameTab={handleRenameTab}
            onContentChange={handleContentChange}
          />
        </div>
      </div>
      <StatusBar noteCount={vault.entries.length} vaultPath={vaultPath} vaults={allVaults} onSwitchVault={handleSwitchVault} onOpenSettings={() => setShowSettings(true)} onConnectGitHub={() => setShowGitHubVault(true)} hasGitHub={!!settings.github_token} />
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      <QuickOpenPalette open={showQuickOpen} entries={vault.entries} onSelect={notes.handleSelectNote} onClose={() => setShowQuickOpen(false)} />
      <CreateTypeDialog open={showCreateTypeDialog} onClose={() => setShowCreateTypeDialog(false)} onCreate={handleCreateType} />
      <CommitDialog open={showCommitDialog} modifiedCount={vault.modifiedFiles.length} onCommit={handleCommitPush} onClose={() => setShowCommitDialog(false)} />
      <SettingsPanel open={showSettings} settings={settings} onSave={saveSettings} onClose={() => setShowSettings(false)} />
      <GitHubVaultModal
        open={showGitHubVault}
        githubToken={settings.github_token}
        onClose={() => setShowGitHubVault(false)}
        onVaultCloned={handleVaultCloned}
        onOpenSettings={() => { setShowGitHubVault(false); setShowSettings(true) }}
      />
    </div>
  )
}

export default App
