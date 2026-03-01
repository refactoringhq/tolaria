import { useRef, useEffect, useCallback, memo } from 'react'
import { useEditorTabSwap, getH1TextFromBlocks } from '../hooks/useEditorTabSwap'
import { useHeadingTitleSync } from '../hooks/useHeadingTitleSync'
import { useCreateBlockNote } from '@blocknote/react'
import '@blocknote/mantine/style.css'
import { uploadImageFile } from '../hooks/useImageDrop'
import type { VaultEntry, GitCommit, NoteStatus } from '../types'
import type { FrontmatterValue } from './Inspector'
import { ResizeHandle } from './ResizeHandle'
import { TabBar } from './TabBar'
import { useDiffMode } from '../hooks/useDiffMode'
import { useEditorFocus } from '../hooks/useEditorFocus'
import { EditorRightPanel } from './EditorRightPanel'
import { EditorContent } from './EditorContent'
import { schema } from './editorSchema'
import './Editor.css'
import './EditorTheme.css'

interface Tab {
  entry: VaultEntry
  content: string
}

interface EditorProps {
  tabs: Tab[]
  activeTabPath: string | null
  entries: VaultEntry[]
  onSwitchTab: (path: string) => void
  onCloseTab: (path: string) => void
  onReorderTabs?: (fromIndex: number, toIndex: number) => void
  onNavigateWikilink: (target: string) => void
  onLoadDiff?: (path: string) => Promise<string>
  onLoadDiffAtCommit?: (path: string, commitHash: string) => Promise<string>
  getNoteStatus?: (path: string) => NoteStatus
  onCreateNote?: () => void
  inspectorCollapsed: boolean
  onToggleInspector: () => void
  inspectorWidth: number
  onInspectorResize: (delta: number) => void
  inspectorEntry: VaultEntry | null
  inspectorContent: string | null
  allContent: Record<string, string>
  gitHistory: GitCommit[]
  onUpdateFrontmatter?: (path: string, key: string, value: FrontmatterValue) => Promise<void>
  onDeleteProperty?: (path: string, key: string) => Promise<void>
  onAddProperty?: (path: string, key: string, value: FrontmatterValue) => Promise<void>
  showAIChat?: boolean
  onToggleAIChat?: () => void
  vaultPath?: string
  onTrashNote?: (path: string) => void
  onRestoreNote?: (path: string) => void
  onArchiveNote?: (path: string) => void
  onUnarchiveNote?: (path: string) => void
  onRenameTab?: (path: string, newTitle: string) => void
  onContentChange?: (path: string, content: string) => void
  /** Called when H1→title sync updates the title (debounced). */
  onTitleSync?: (path: string, newTitle: string) => void
  canGoBack?: boolean
  canGoForward?: boolean
  onGoBack?: () => void
  onGoForward?: () => void
  leftPanelsCollapsed?: boolean
}

function EditorEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <p className="m-0 text-[15px]">Select a note to start editing</p>
      <span className="text-xs text-muted-foreground">Cmd+P to search &middot; Cmd+N to create</span>
    </div>
  )
}

export const Editor = memo(function Editor({
  tabs, activeTabPath, entries, onSwitchTab, onCloseTab, onReorderTabs, onNavigateWikilink,
  onLoadDiff, onLoadDiffAtCommit, getNoteStatus, onCreateNote,
  inspectorCollapsed, onToggleInspector, inspectorWidth, onInspectorResize,
  inspectorEntry, inspectorContent, allContent, gitHistory,
  onUpdateFrontmatter, onDeleteProperty, onAddProperty,
  showAIChat, onToggleAIChat,
  vaultPath,
  onTrashNote, onRestoreNote, onArchiveNote, onUnarchiveNote,
  onRenameTab, onContentChange, onTitleSync,
  canGoBack, canGoForward, onGoBack, onGoForward, leftPanelsCollapsed,
}: EditorProps) {
  const vaultPathRef = useRef(vaultPath)
  useEffect(() => { vaultPathRef.current = vaultPath }, [vaultPath])

  const editor = useCreateBlockNote({
    schema,
    uploadFile: (file: File) => uploadImageFile(file, vaultPathRef.current),
  })

  const activeTab = tabs.find((t) => t.entry.path === activeTabPath) ?? null

  const { syncActiveRef, onH1Changed, onManualRename } = useHeadingTitleSync({
    activeTabPath,
    currentTitle: activeTab?.entry.title ?? null,
    onTitleSync: onTitleSync ?? (() => {}),
  })

  const { handleEditorChange, editorMountedRef } = useEditorTabSwap({
    tabs, activeTabPath, editor, onContentChange,
    onH1Change: onH1Changed, syncActiveRef,
  })
  useEditorFocus(editor, editorMountedRef)

  const handleRenameTabWithSync = useCallback((path: string, newTitle: string) => {
    const h1Text = getH1TextFromBlocks(editor.document)
    onManualRename(newTitle, h1Text)
    onRenameTab?.(path, newTitle)
  }, [editor, onManualRename, onRenameTab])

  const { diffMode, diffContent, diffLoading, handleToggleDiff, handleViewCommitDiff } = useDiffMode({
    activeTabPath, onLoadDiff, onLoadDiffAtCommit,
  })
  const isLoadingNewTab = activeTabPath !== null && !activeTab
  const activeStatus = activeTab ? getNoteStatus?.(activeTab.entry.path) ?? 'clean' : 'clean'
  const showDiffToggle = !!(activeTab && (diffMode || activeStatus === 'modified'))
  const showRightPanel = !!(showAIChat || !inspectorCollapsed)

  return (
    <div className="editor flex flex-col min-h-0 overflow-hidden bg-background text-foreground">
      <TabBar
        tabs={tabs}
        activeTabPath={activeTabPath}
        getNoteStatus={getNoteStatus}
        onSwitchTab={onSwitchTab}
        onCloseTab={onCloseTab}
        onCreateNote={onCreateNote}
        onReorderTabs={onReorderTabs}
        onRenameTab={handleRenameTabWithSync}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onGoBack={onGoBack}
        onGoForward={onGoForward}
        leftPanelsCollapsed={leftPanelsCollapsed}
      />
      <div className="flex flex-1 min-h-0">
        {tabs.length === 0
          ? <EditorEmptyState />
          : <EditorContent
              activeTab={activeTab}
              isLoadingNewTab={isLoadingNewTab}
              entries={entries}
              editor={editor}
              diffMode={diffMode}
              diffContent={diffContent}
              diffLoading={diffLoading}
              onToggleDiff={handleToggleDiff}
              activeStatus={activeStatus}
              showDiffToggle={showDiffToggle}
              showAIChat={showAIChat}
              onToggleAIChat={onToggleAIChat}
              inspectorCollapsed={inspectorCollapsed}
              onToggleInspector={onToggleInspector}
              onNavigateWikilink={onNavigateWikilink}
              onEditorChange={handleEditorChange}
              onTrashNote={onTrashNote}
              onRestoreNote={onRestoreNote}
              onArchiveNote={onArchiveNote}
              onUnarchiveNote={onUnarchiveNote}
              vaultPath={vaultPath}
            />
        }
        {showRightPanel && <ResizeHandle onResize={onInspectorResize} />}
        <EditorRightPanel
          showAIChat={showAIChat}
          inspectorCollapsed={inspectorCollapsed}
          inspectorWidth={inspectorWidth}
          inspectorEntry={inspectorEntry}
          inspectorContent={inspectorContent}
          entries={entries}
          allContent={allContent}
          gitHistory={gitHistory}
          vaultPath={vaultPath ?? ''}
          onToggleInspector={onToggleInspector}
          onToggleAIChat={onToggleAIChat}
          onNavigateWikilink={onNavigateWikilink}
          onViewCommitDiff={handleViewCommitDiff}
          onUpdateFrontmatter={onUpdateFrontmatter}
          onDeleteProperty={onDeleteProperty}
          onAddProperty={onAddProperty}
          onOpenNote={onNavigateWikilink}
        />
      </div>
    </div>
  )
})
