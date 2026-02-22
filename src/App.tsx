import { useCallback, useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { NoteList } from './components/NoteList'
import { Editor } from './components/Editor'
import { ResizeHandle } from './components/ResizeHandle'
import { CreateTypeDialog } from './components/CreateTypeDialog'
import { QuickOpenPalette } from './components/QuickOpenPalette'
import { Toast } from './components/Toast'
import { CommitDialog } from './components/CommitDialog'
import { StatusBar } from './components/StatusBar'
import { WelcomeScreen } from './components/WelcomeScreen'
import { useVaultLoader } from './hooks/useVaultLoader'
import { useNoteActions, generateUntitledName } from './hooks/useNoteActions'
import { useAppKeyboard } from './hooks/useAppKeyboard'
import { useEntryActions } from './hooks/useEntryActions'
import { useVaultConfig } from './hooks/useVaultConfig'
import { isTauri } from './mock-tauri'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation'
import { useUpdater } from './hooks/useUpdater'
import type { SidebarSelection, GitCommit } from './types'
import './App.css'

// Type declaration for mock content storage
declare global {
  interface Window {
    __mockContent?: Record<string, string>
  }
}

const DEFAULT_SELECTION: SidebarSelection = { kind: 'filter', filter: 'all' }

async function openFolderDialog(): Promise<string | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({ directory: true, multiple: false, title: 'Choose vault folder' })
    return selected ?? null
  }
  // In mock/browser mode, prompt the user
  const path = window.prompt('Enter vault folder path:')
  return path || null
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

function App() {
  const [selection, setSelection] = useState<SidebarSelection>(DEFAULT_SELECTION)
  const layout = useLayoutPanels()
  const [gitHistory, setGitHistory] = useState<GitCommit[]>([])
  const [showCreateTypeDialog, setShowCreateTypeDialog] = useState(false)
  const [showQuickOpen, setShowQuickOpen] = useState(false)
  const [showCommitDialog, setShowCommitDialog] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [showAIChat, setShowAIChat] = useState(false)

  const vaultConfig = useVaultConfig()

  // Set initial vault path once config loads
  useEffect(() => {
    if (vaultConfig.loading) return
    if (vaultPath) return // Already set
    if (vaultConfig.vaults.length > 0) {
      setVaultPath(vaultConfig.vaults[0].path)
    }
  }, [vaultConfig.loading, vaultConfig.vaults, vaultPath])

  // Use a placeholder path for the vault loader when no vault is selected
  const vault = useVaultLoader(vaultPath ?? '')
  const notes = useNoteActions(vault.addEntry, vault.updateContent, vault.entries, setToastMessage)

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

  const handleAddVaultFromDialog = useCallback(async () => {
    try {
      const selected = await openFolderDialog()
      if (!selected) return
      // Init git if needed, then add to config
      await vaultConfig.initVault(selected)
      const vault = await vaultConfig.addVault(selected)
      handleSwitchVault(vault.path)
    } catch (err) {
      setToastMessage(String(err))
    }
  }, [vaultConfig, handleSwitchVault])

  const handleCreateVault = useCallback(async () => {
    try {
      const selected = await openFolderDialog()
      if (!selected) return
      await vaultConfig.initVault(selected)
      const vault = await vaultConfig.addVault(selected)
      handleSwitchVault(vault.path)
    } catch (err) {
      setToastMessage(String(err))
    }
  }, [vaultConfig, handleSwitchVault])

  const handleRemoveVault = useCallback(async (path: string) => {
    await vaultConfig.removeVault(path)
    // If the removed vault was active, switch to another or show welcome
    if (vaultPath === path) {
      const remaining = vaultConfig.vaults.filter((v) => v.path !== path)
      if (remaining.length > 0) {
        handleSwitchVault(remaining[0].path)
      } else {
        setVaultPath(null)
      }
    }
  }, [vaultConfig, vaultPath, handleSwitchVault])

  useEffect(() => {
    if (!notes.activeTabPath) { setGitHistory([]); return }
    vault.loadGitHistory(notes.activeTabPath).then(setGitHistory)
  }, [notes.activeTabPath, vault.loadGitHistory])

  const openCreateTypeDialog = useCallback(() => {
    setShowCreateTypeDialog(true)
  }, [])

  const handleCreateType = useCallback((name: string) => {
    notes.handleCreateType(name)
    setToastMessage(`Type "${name}" created`)
  }, [notes])

  const handleRenameTab = useCallback((path: string, newTitle: string) => {
    notes.handleRenameNote(path, newTitle, vaultPath ?? '', vault.replaceEntry)
  }, [notes, vaultPath, vault])

  useAppKeyboard({
    onQuickOpen: () => setShowQuickOpen(true),
    onCreateNote: handleCreateNoteImmediate,
    onSave: () => setToastMessage('Saved'),
    onTrashNote: entryActions.handleTrashNote,
    onArchiveNote: entryActions.handleArchiveNote,
    activeTabPathRef: notes.activeTabPathRef,
    handleCloseTabRef: notes.handleCloseTabRef,
  })

  useUpdater()

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

  // Show welcome screen when no vaults are configured
  if (!vaultConfig.loading && vaultConfig.vaults.length === 0) {
    return (
      <>
        <WelcomeScreen
          onOpenFolder={handleAddVaultFromDialog}
          onCreateVault={handleCreateVault}
          error={vaultConfig.error}
        />
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      </>
    )
  }

  // Show nothing while loading config
  if (vaultConfig.loading || !vaultPath) {
    return null
  }

  return (
    <div className="app-shell">
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
          />
        </div>
      </div>
      <StatusBar
        noteCount={vault.entries.length}
        vaultPath={vaultPath}
        vaults={vaultConfig.vaults}
        onSwitchVault={handleSwitchVault}
        onAddVault={handleAddVaultFromDialog}
        onRemoveVault={handleRemoveVault}
      />
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      <QuickOpenPalette open={showQuickOpen} entries={vault.entries} onSelect={notes.handleSelectNote} onClose={() => setShowQuickOpen(false)} />
      <CreateTypeDialog open={showCreateTypeDialog} onClose={() => setShowCreateTypeDialog(false)} onCreate={handleCreateType} />
      <CommitDialog open={showCommitDialog} modifiedCount={vault.modifiedFiles.length} onCommit={handleCommitPush} onClose={() => setShowCommitDialog(false)} />
    </div>
  )
}

export default App
