import type React from 'react'
import { useCallback } from 'react'
import type { VaultEntry, NoteStatus } from '../types'
import type { useCreateBlockNote } from '@blocknote/react'
import { DiffView } from './DiffView'
import { BreadcrumbBar } from './BreadcrumbBar'
import { TitleField } from './TitleField'
import { NoteIcon } from './NoteIcon'
import { TrashedNoteBanner } from './TrashedNoteBanner'
import { ArchivedNoteBanner } from './ArchivedNoteBanner'
import { ConflictNoteBanner } from './ConflictNoteBanner'
import { RawEditorView } from './RawEditorView'
import { countWords } from '../utils/wikilinks'
import { SingleEditorView } from './SingleEditorView'
import { isEmoji } from '../utils/emoji'

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
  rawMode: boolean
  onToggleRaw: () => void
  onRawContentChange?: (path: string, content: string) => void
  onSave?: () => void
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
  onDeleteNote?: (path: string) => void
  onArchiveNote?: (path: string) => void
  onUnarchiveNote?: (path: string) => void
  vaultPath?: string
  /** Ref updated by RawEditorView on every keystroke with the latest doc. */
  rawLatestContentRef?: React.MutableRefObject<string | null>
  /** Called when the user edits the dedicated title field. */
  onTitleChange?: (path: string, newTitle: string) => void
  /** Called when user sets or changes an emoji icon via the picker. */
  onSetNoteIcon?: (path: string, emoji: string) => void
  /** Called when user removes an emoji icon. */
  onRemoveNoteIcon?: (path: string) => void
  /** Whether the active note has a merge conflict. */
  isConflicted?: boolean
  /** Resolve conflict by keeping the local version. */
  onKeepMine?: (path: string) => void
  /** Resolve conflict by keeping the remote version. */
  onKeepTheirs?: (path: string) => void
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

function RawModeEditorSection({
  rawMode, activeTab, entries, onContentChange, onSave, latestContentRef,
}: {
  rawMode: boolean
  activeTab: Tab | null
  entries: VaultEntry[]
  onContentChange?: (path: string, content: string) => void
  onSave?: () => void
  latestContentRef?: React.MutableRefObject<string | null>
}) {
  if (!rawMode || !activeTab) return null
  return (
    <RawEditorView
      key={activeTab.entry.path}
      content={activeTab.content}
      path={activeTab.entry.path}
      entries={entries}
      onContentChange={onContentChange ?? (() => {})}
      onSave={onSave ?? (() => {})}
      latestContentRef={latestContentRef}
    />
  )
}

/** Bind an optional callback to a path, returning undefined if callback is absent */
function bindPath(cb: ((path: string) => void) | undefined, path: string) {
  return cb ? () => cb(path) : undefined
}

function ActiveTabBreadcrumb({ activeTab, props }: {
  activeTab: Tab
  props: Omit<EditorContentProps, 'activeTab' | 'isLoadingNewTab' | 'entries' | 'editor' | 'onNavigateWikilink' | 'onEditorChange' | 'onRawContentChange' | 'onSave' | 'onDeleteNote'>
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
      rawMode={props.rawMode}
      onToggleRaw={props.onToggleRaw}
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
  rawMode, onToggleRaw, onRawContentChange, onSave,
  onNavigateWikilink, onEditorChange, vaultPath,
  onDeleteNote, rawLatestContentRef, onTitleChange,
  onSetNoteIcon, onRemoveNoteIcon,
  isConflicted, onKeepMine, onKeepTheirs,
  ...breadcrumbProps
}: EditorContentProps) {
  // Look up trashed/archived from the latest vault entries, not the tab snapshot,
  // so the banner appears regardless of navigation context.
  const freshEntry = activeTab ? entries.find(e => e.path === activeTab.entry.path) : undefined
  const isTrashed = freshEntry?.trashed ?? activeTab?.entry.trashed ?? false
  const isArchived = freshEntry?.archived ?? activeTab?.entry.archived ?? false
  const showEditor = !diffMode && !rawMode
  const entryIcon = activeTab?.entry.icon ?? null
  const emojiIcon = entryIcon && isEmoji(entryIcon) ? entryIcon : null

  const handleSetIcon = useCallback((emoji: string) => {
    if (activeTab) onSetNoteIcon?.(activeTab.entry.path, emoji)
  }, [activeTab, onSetNoteIcon])

  const handleRemoveIcon = useCallback(() => {
    if (activeTab) onRemoveNoteIcon?.(activeTab.entry.path)
  }, [activeTab, onRemoveNoteIcon])

  return (
    <div className="flex flex-1 flex-col min-w-0 min-h-0">
      {activeTab && (
        <ActiveTabBreadcrumb
          activeTab={activeTab}
          props={{ diffMode, diffContent, onToggleDiff, rawMode, onToggleRaw, ...breadcrumbProps }}
        />
      )}
      {activeTab && isTrashed && (
        <TrashedNoteBanner
          onRestore={() => breadcrumbProps.onRestoreNote?.(activeTab.entry.path)}
          onDeletePermanently={() => onDeleteNote?.(activeTab.entry.path)}
        />
      )}
      {activeTab && isArchived && breadcrumbProps.onUnarchiveNote && (
        <ArchivedNoteBanner onUnarchive={() => breadcrumbProps.onUnarchiveNote!(activeTab.entry.path)} />
      )}
      {activeTab && isConflicted && (
        <ConflictNoteBanner
          onKeepMine={() => onKeepMine?.(activeTab.entry.path)}
          onKeepTheirs={() => onKeepTheirs?.(activeTab.entry.path)}
        />
      )}
      {diffMode && <DiffModeView diffContent={diffContent} onToggleDiff={onToggleDiff} />}
      <RawModeEditorSection rawMode={rawMode} activeTab={activeTab} entries={entries} onContentChange={onRawContentChange} onSave={onSave} latestContentRef={rawLatestContentRef} />
      {showEditor && activeTab && (
        <div className="editor-scroll-area">
          <div className="title-section">
            <NoteIcon
              icon={emojiIcon}
              editable={!isTrashed}
              onSetIcon={handleSetIcon}
              onRemoveIcon={handleRemoveIcon}
            />
            <TitleField
              title={activeTab.entry.title}
              filename={activeTab.entry.filename}
              editable={!isTrashed}
              onTitleChange={(newTitle) => onTitleChange?.(activeTab.entry.path, newTitle)}
            />
            <div className="title-section__separator" />
          </div>
          <SingleEditorView editor={editor} entries={entries} onNavigateWikilink={onNavigateWikilink} onChange={onEditorChange} vaultPath={vaultPath} editable={!isTrashed} />
        </div>
      )}
      {isLoadingNewTab && showEditor && <EditorLoadingSkeleton />}
    </div>
  )
}
