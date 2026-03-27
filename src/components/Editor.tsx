import { useRef, useEffect, useCallback, memo } from 'react'
import { useEditorTabSwap } from '../hooks/useEditorTabSwap'
import { useCreateBlockNote } from '@blocknote/react'
import '@blocknote/mantine/style.css'
import { uploadImageFile } from '../hooks/useImageDrop'
import type { VaultEntry, GitCommit, NoteStatus } from '../types'
import type { NoteListItem } from '../utils/ai-context'
import type { FrontmatterValue } from './Inspector'
import { ResizeHandle } from './ResizeHandle'
import { useDiffMode } from '../hooks/useDiffMode'
import { useRawMode } from '../hooks/useRawMode'
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
  gitHistory: GitCommit[]
  onUpdateFrontmatter?: (path: string, key: string, value: FrontmatterValue) => Promise<void>
  onDeleteProperty?: (path: string, key: string) => Promise<void>
  onAddProperty?: (path: string, key: string, value: FrontmatterValue) => Promise<void>
  onCreateAndOpenNote?: (title: string) => Promise<boolean>
  showAIChat?: boolean
  onToggleAIChat?: () => void
  vaultPath?: string
  noteList?: NoteListItem[]
  noteListFilter?: { type: string | null; query: string }
  onTrashNote?: (path: string) => void
  onRestoreNote?: (path: string) => void
  onDeleteNote?: (path: string) => void
  onArchiveNote?: (path: string) => void
  onUnarchiveNote?: (path: string) => void
  onContentChange?: (path: string, content: string) => void
  onSave?: () => void
  /** Called when the user edits the title in TitleField. */
  onTitleSync?: (path: string, newTitle: string) => void
  canGoBack?: boolean
  canGoForward?: boolean
  onGoBack?: () => void
  onGoForward?: () => void
  leftPanelsCollapsed?: boolean
  /** Mutable ref that Editor registers its raw-mode toggle into, for command palette access. */
  rawToggleRef?: React.MutableRefObject<() => void>
  /** Mutable ref that Editor registers its diff-mode toggle into, for command palette access. */
  diffToggleRef?: React.MutableRefObject<() => void>
  onFileCreated?: (relativePath: string) => void
  onFileModified?: (relativePath: string) => void
  onVaultChanged?: () => void
  /** Called when user sets an emoji icon on a note. */
  onSetNoteIcon?: (path: string, emoji: string) => void
  /** Called when user removes an emoji icon from a note. */
  onRemoveNoteIcon?: (path: string) => void
  /** Whether the active note has a merge conflict. */
  isConflicted?: boolean
  /** Resolve conflict by keeping the local version. */
  onKeepMine?: (path: string) => void
  /** Resolve conflict by keeping the remote version. */
  onKeepTheirs?: (path: string) => void
}

function useEditorModeExclusion({
  diffMode, rawMode, handleToggleDiff, handleToggleRaw, rawToggleRef, diffToggleRef,
}: {
  diffMode: boolean
  rawMode: boolean
  handleToggleDiff: () => void | Promise<void>
  handleToggleRaw: () => void
  rawToggleRef?: React.MutableRefObject<() => void>
  diffToggleRef?: React.MutableRefObject<() => void>
}) {
  const handleToggleDiffExclusive = useCallback(async () => {
    if (!diffMode && rawMode) handleToggleRaw()
    await handleToggleDiff()
  }, [diffMode, rawMode, handleToggleDiff, handleToggleRaw])

  const handleToggleRawExclusive = useCallback(() => {
    if (!rawMode && diffMode) handleToggleDiff()
    handleToggleRaw()
  }, [rawMode, diffMode, handleToggleDiff, handleToggleRaw])

  useEffect(() => {
    if (rawToggleRef) rawToggleRef.current = handleToggleRawExclusive
  }, [rawToggleRef, handleToggleRawExclusive])

  useEffect(() => {
    if (diffToggleRef) diffToggleRef.current = handleToggleDiffExclusive
  }, [diffToggleRef, handleToggleDiffExclusive])

  return { handleToggleDiffExclusive, handleToggleRawExclusive }
}

function EditorEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <p className="m-0 text-[15px]">Select a note to start editing</p>
      <span className="text-xs text-muted-foreground">Cmd+P to search &middot; Cmd+N to create</span>
    </div>
  )
}

interface EditorSetupParams {
  tabs: Tab[]
  activeTabPath: string | null
  vaultPath?: string
  onContentChange?: (path: string, content: string) => void
  onLoadDiff?: (path: string) => Promise<string>
  onLoadDiffAtCommit?: (path: string, commitHash: string) => Promise<string>
  getNoteStatus?: (path: string) => NoteStatus
  rawToggleRef?: React.MutableRefObject<() => void>
  diffToggleRef?: React.MutableRefObject<() => void>
}

function useRawModeWithFlush(
  activeTabPath: string | null,
  onContentChange?: (path: string, content: string) => void,
) {
  const rawLatestContentRef = useRef<string | null>(null)

  const handleBeforeRawEnd = useCallback(() => {
    if (rawLatestContentRef.current != null && activeTabPath) {
      onContentChange?.(activeTabPath, rawLatestContentRef.current)
    }
    rawLatestContentRef.current = null
  }, [activeTabPath, onContentChange])

  const { rawMode, handleToggleRaw } = useRawMode({
    activeTabPath, onBeforeRawEnd: handleBeforeRawEnd,
  })

  return { rawMode, handleToggleRaw, rawLatestContentRef }
}

function useEditorSetup({
  tabs, activeTabPath, vaultPath, onContentChange,
  onLoadDiff, onLoadDiffAtCommit, getNoteStatus,
  rawToggleRef, diffToggleRef,
}: EditorSetupParams) {
  const vaultPathRef = useRef(vaultPath)
  useEffect(() => { vaultPathRef.current = vaultPath }, [vaultPath])

  const editor = useCreateBlockNote({
    schema,
    uploadFile: (file: File) => uploadImageFile(file, vaultPathRef.current),
  })

  const activeTab = tabs.find((t) => t.entry.path === activeTabPath) ?? null

  const { rawMode, handleToggleRaw, rawLatestContentRef } = useRawModeWithFlush(
    activeTabPath, onContentChange,
  )

  const { handleEditorChange, editorMountedRef } = useEditorTabSwap({
    tabs, activeTabPath, editor, onContentChange, rawMode,
  })
  useEditorFocus(editor, editorMountedRef)

  const { diffMode, diffContent, diffLoading, handleToggleDiff, handleViewCommitDiff } = useDiffMode({
    activeTabPath, onLoadDiff, onLoadDiffAtCommit,
  })

  const { handleToggleDiffExclusive, handleToggleRawExclusive } = useEditorModeExclusion({
    diffMode, rawMode, handleToggleDiff, handleToggleRaw, rawToggleRef, diffToggleRef,
  })

  const isLoadingNewTab = activeTabPath !== null && !activeTab
  const activeStatus = activeTab ? getNoteStatus?.(activeTab.entry.path) ?? 'clean' : 'clean'
  const showDiffToggle = !!(activeTab && (diffMode || activeStatus === 'modified'))

  return {
    editor, activeTab, rawLatestContentRef,
    rawMode, diffMode, diffContent, diffLoading,
    handleToggleDiffExclusive, handleToggleRawExclusive,
    handleEditorChange, handleViewCommitDiff,
    isLoadingNewTab, activeStatus, showDiffToggle,
  }
}

export const Editor = memo(function Editor(props: EditorProps) {
  const {
    tabs, activeTabPath, entries, onNavigateWikilink,
    getNoteStatus,
    inspectorCollapsed, onToggleInspector, inspectorWidth, onInspectorResize,
    inspectorEntry, inspectorContent, gitHistory,
    onUpdateFrontmatter, onDeleteProperty, onAddProperty, onCreateAndOpenNote,
    showAIChat, onToggleAIChat,
    vaultPath, noteList, noteListFilter,
    onTrashNote, onRestoreNote, onDeleteNote, onArchiveNote, onUnarchiveNote,
    onContentChange, onSave, onTitleSync,
    onFileCreated, onFileModified, onVaultChanged,
    onSetNoteIcon, onRemoveNoteIcon,
    isConflicted, onKeepMine, onKeepTheirs,
  } = props

  const {
    editor, activeTab, rawLatestContentRef,
    rawMode, diffMode, diffContent, diffLoading,
    handleToggleDiffExclusive, handleToggleRawExclusive,
    handleEditorChange, handleViewCommitDiff,
    isLoadingNewTab, activeStatus, showDiffToggle,
  } = useEditorSetup({
    tabs, activeTabPath, vaultPath, onContentChange,
    onLoadDiff: props.onLoadDiff,
    onLoadDiffAtCommit: props.onLoadDiffAtCommit, getNoteStatus,
    rawToggleRef: props.rawToggleRef, diffToggleRef: props.diffToggleRef,
  })

  return (
    <div className="editor flex flex-col min-h-0 overflow-hidden bg-background text-foreground">
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
              onToggleDiff={handleToggleDiffExclusive}
              rawMode={rawMode}
              onToggleRaw={handleToggleRawExclusive}
              onRawContentChange={onContentChange}
              onSave={onSave}
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
              onDeleteNote={onDeleteNote}
              onArchiveNote={onArchiveNote}
              onUnarchiveNote={onUnarchiveNote}
              vaultPath={vaultPath}
              rawLatestContentRef={rawLatestContentRef}
              onTitleChange={onTitleSync}
              onSetNoteIcon={onSetNoteIcon}
              onRemoveNoteIcon={onRemoveNoteIcon}
              isConflicted={isConflicted}
              onKeepMine={onKeepMine}
              onKeepTheirs={onKeepTheirs}
            />
        }
        {(showAIChat || !inspectorCollapsed) && <ResizeHandle onResize={onInspectorResize} />}
        <EditorRightPanel
          showAIChat={showAIChat}
          inspectorCollapsed={inspectorCollapsed}
          inspectorWidth={inspectorWidth}
          inspectorEntry={inspectorEntry}
          inspectorContent={inspectorContent}
          entries={entries}
          gitHistory={gitHistory}
          vaultPath={vaultPath ?? ''}
          noteList={noteList}
          noteListFilter={noteListFilter}
          onToggleInspector={onToggleInspector}
          onToggleAIChat={onToggleAIChat}
          onNavigateWikilink={onNavigateWikilink}
          onViewCommitDiff={handleViewCommitDiff}
          onUpdateFrontmatter={onUpdateFrontmatter}
          onDeleteProperty={onDeleteProperty}
          onAddProperty={onAddProperty}
          onCreateAndOpenNote={onCreateAndOpenNote}
          onOpenNote={onNavigateWikilink}
          onFileCreated={onFileCreated}
          onFileModified={onFileModified}
          onVaultChanged={onVaultChanged}
        />
      </div>
    </div>
  )
})
