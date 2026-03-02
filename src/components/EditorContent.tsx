import type { VaultEntry, NoteStatus } from '../types'
import type { useCreateBlockNote } from '@blocknote/react'
import { DiffView } from './DiffView'
import { BreadcrumbBar } from './BreadcrumbBar'
import { countWords } from '../utils/wikilinks'
import { SingleEditorView } from './SingleEditorView'

interface Tab {
  entry: VaultEntry
  content: string
}

interface EditorContentProps {
  activeTab: Tab | null
  isLoadingNewTab: boolean
  entries: VaultEntry[]
  editor: ReturnType<typeof useCreateBlockNote>
  diffMode: boolean
  diffContent: string | null
  diffLoading: boolean
  onToggleDiff: () => void
  activeStatus: NoteStatus
  showDiffToggle: boolean
  showAIChat?: boolean
  onToggleAIChat?: () => void
  inspectorCollapsed: boolean
  onToggleInspector: () => void
  onNavigateWikilink: (target: string) => void
  onEditorChange?: () => void
  onTrashNote?: (path: string) => void
  onRestoreNote?: (path: string) => void
  onArchiveNote?: (path: string) => void
  onUnarchiveNote?: (path: string) => void
  vaultPath?: string
  isDarkTheme?: boolean
}

function EditorLoadingSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 p-8 animate-pulse" style={{ minHeight: 0 }}>
      <div className="h-6 w-2/5 rounded bg-muted" />
      <div className="h-4 w-4/5 rounded bg-muted" />
      <div className="h-4 w-3/5 rounded bg-muted" />
      <div className="h-4 w-4/5 rounded bg-muted" />
      <div className="h-4 w-2/5 rounded bg-muted" />
    </div>
  )
}

function DiffModeView({ diffContent, onToggleDiff }: { diffContent: string | null; onToggleDiff: () => void }) {
  return (
    <div className="flex-1 overflow-auto">
      <button
        className="flex items-center gap-1.5 px-4 py-2 text-xs text-primary bg-muted border-b border-border cursor-pointer hover:bg-accent transition-colors w-full border-t-0 border-l-0 border-r-0"
        onClick={onToggleDiff}
        title="Back to editor"
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>&larr;</span>
        Back to editor
      </button>
      <DiffView diff={diffContent ?? ''} />
    </div>
  )
}

/** Bind an optional callback to a path, returning undefined if callback is absent */
function bindPath(cb: ((path: string) => void) | undefined, path: string) {
  return cb ? () => cb(path) : undefined
}

function ActiveTabBreadcrumb({ activeTab, props }: {
  activeTab: Tab
  props: Omit<EditorContentProps, 'activeTab' | 'isLoadingNewTab' | 'entries' | 'editor' | 'onNavigateWikilink' | 'onEditorChange'>
}) {
  const wordCount = countWords(activeTab.content)
  const path = activeTab.entry.path
  return (
    <BreadcrumbBar
      entry={activeTab.entry}
      wordCount={wordCount}
      noteStatus={props.activeStatus}
      showDiffToggle={props.showDiffToggle}
      diffMode={props.diffMode}
      diffLoading={props.diffLoading}
      onToggleDiff={props.onToggleDiff}
      showAIChat={props.showAIChat}
      onToggleAIChat={props.onToggleAIChat}
      inspectorCollapsed={props.inspectorCollapsed}
      onToggleInspector={props.onToggleInspector}
      onTrash={bindPath(props.onTrashNote, path)}
      onRestore={bindPath(props.onRestoreNote, path)}
      onArchive={bindPath(props.onArchiveNote, path)}
      onUnarchive={bindPath(props.onUnarchiveNote, path)}
    />
  )
}

export function EditorContent({
  activeTab, isLoadingNewTab, entries, editor,
  diffMode, diffContent, onToggleDiff,
  onNavigateWikilink, onEditorChange, vaultPath, isDarkTheme,
  ...breadcrumbProps
}: EditorContentProps) {
  return (
    <div className="flex flex-1 flex-col min-w-0 min-h-0">
      {activeTab && <ActiveTabBreadcrumb activeTab={activeTab} props={{ diffMode, diffContent, onToggleDiff, ...breadcrumbProps }} />}
      {diffMode && <DiffModeView diffContent={diffContent} onToggleDiff={onToggleDiff} />}
      {!diffMode && activeTab && (
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}>
          <SingleEditorView editor={editor} entries={entries} onNavigateWikilink={onNavigateWikilink} onChange={onEditorChange} vaultPath={vaultPath} isDarkTheme={isDarkTheme} />
        </div>
      )}
      {isLoadingNewTab && !diffMode && <EditorLoadingSkeleton />}
    </div>
  )
}
