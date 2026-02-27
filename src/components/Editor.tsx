import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react'
import { useEditorTabSwap } from '../hooks/useEditorTabSwap'
import { BlockNoteSchema, defaultInlineContentSpecs } from '@blocknote/core'
import { filterSuggestionItems } from '@blocknote/core/extensions'
import { createReactInlineContentSpec, useCreateBlockNote, SuggestionMenuController } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import { uploadImageFile, useImageDrop } from '../hooks/useImageDrop'
import type { VaultEntry, GitCommit, NoteStatus } from '../types'
import { Inspector, type FrontmatterValue } from './Inspector'
import { AIChatPanel } from './AIChatPanel'
import { DiffView } from './DiffView'
import { ResizeHandle } from './ResizeHandle'
import { TabBar } from './TabBar'
import { BreadcrumbBar } from './BreadcrumbBar'
import { useEditorTheme } from '../hooks/useTheme'
import { countWords } from '../utils/wikilinks'
import { preFilterWikilinks, deduplicateByPath, disambiguateTitles, MAX_RESULTS, MIN_QUERY_LENGTH } from '../utils/wikilinkSuggestions'
import { filterPersonMentions, PERSON_MENTION_MIN_QUERY } from '../utils/personMentionSuggestions'
import { resolveWikilinkColor as resolveColor } from '../utils/wikilinkColors'
import { getTypeColor, getTypeLightColor, buildTypeEntryMap } from '../utils/typeColors'
import { getTypeIcon } from './NoteItem'
import { WikilinkSuggestionMenu, type WikilinkSuggestionItem } from './WikilinkSuggestionMenu'
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
  // Inspector props
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
  canGoBack?: boolean
  canGoForward?: boolean
  onGoBack?: () => void
  onGoForward?: () => void
}

// --- Custom Inline Content: WikiLink ---

// Module-level cache so the WikiLink renderer (defined outside React) can access entries
const _wikilinkEntriesRef: { current: VaultEntry[] } = { current: [] }

function resolveWikilinkColor(target: string) {
  return resolveColor(_wikilinkEntriesRef.current, target)
}

const WikiLink = createReactInlineContentSpec(
  {
    type: "wikilink" as const,
    propSchema: {
      target: { default: "" },
    },
    content: "none",
  },
  {
    render: (props) => {
      const target = props.inlineContent.props.target
      const { color, isBroken } = resolveWikilinkColor(target)
      return (
        <span
          className={`wikilink${isBroken ? ' wikilink--broken' : ''}`}
          data-target={target}
          style={{ color }}
        >
          {target}
        </span>
      )
    },
  }
)

// --- Schema with wikilink ---

const schema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    wikilink: WikiLink,
  },
})

/** Single BlockNote editor view — content is swapped via replaceBlocks */
function SingleEditorView({ editor, entries, onNavigateWikilink, onChange }: { editor: ReturnType<typeof useCreateBlockNote>; entries: VaultEntry[]; onNavigateWikilink: (target: string) => void; onChange?: () => void }) {
  const navigateRef = useRef(onNavigateWikilink)
  useEffect(() => { navigateRef.current = onNavigateWikilink }, [onNavigateWikilink])
  const { cssVars } = useEditorTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const { isDragOver } = useImageDrop({ containerRef })

  // Keep module-level ref in sync so WikiLink renderer can access vault entries
  useEffect(() => {
    _wikilinkEntriesRef.current = entries
  }, [entries])

  useEffect(() => {
    const container = document.querySelector('.editor__blocknote-container')
    if (!container) return
    const handler = (e: MouseEvent) => {
      const wikilink = (e.target as HTMLElement).closest('.wikilink')
      if (wikilink) {
        e.preventDefault()
        e.stopPropagation()
        const target = (wikilink as HTMLElement).dataset.target
        if (target) navigateRef.current(target)
      }
    }
    container.addEventListener('click', handler as EventListener, true)
    return () => container.removeEventListener('click', handler as EventListener, true)
  }, [editor])

  const typeEntryMap = useMemo(() => buildTypeEntryMap(entries), [entries])

  const baseItems = useMemo(
    () => deduplicateByPath(entries.map(entry => ({
      title: entry.title,
      aliases: [...new Set([entry.filename.replace(/\.md$/, ''), ...entry.aliases])],
      group: entry.isA || 'Note',
      entryTitle: entry.title,
      path: entry.path,
    }))),
    [entries]
  )

  const getWikilinkItems = useCallback(async (query: string): Promise<WikilinkSuggestionItem[]> => {
    if (query.length < MIN_QUERY_LENGTH) return []

    const candidates = preFilterWikilinks(baseItems, query)
    const items = candidates.map(item => ({
      ...item,
      onItemClick: () => {
        editor.insertInlineContent([
          {
            type: 'wikilink' as const,
            props: { target: item.entryTitle },
          },
          " ",
        ])
      },
    }))
    const filtered = filterSuggestionItems(items, query).slice(0, MAX_RESULTS)
    const final = disambiguateTitles(deduplicateByPath(filtered))
    return final.map(({ group, ...rest }) => {
      const noteType = group !== 'Note' ? group : undefined
      const te = typeEntryMap[group]
      return {
        ...rest,
        noteType,
        typeColor: noteType ? getTypeColor(group, te?.color) : undefined,
        typeLightColor: noteType ? getTypeLightColor(group, te?.color) : undefined,
        TypeIcon: noteType ? getTypeIcon(group, te?.icon) : undefined,
      }
    })
  }, [baseItems, editor, typeEntryMap])

  const getPersonMentionItems = useCallback(async (query: string): Promise<WikilinkSuggestionItem[]> => {
    if (query.length < PERSON_MENTION_MIN_QUERY) return []

    const candidates = filterPersonMentions(baseItems, query)
    const items = candidates.map(item => ({
      ...item,
      onItemClick: () => {
        editor.insertInlineContent([
          {
            type: 'wikilink' as const,
            props: { target: item.entryTitle },
          },
          " ",
        ])
      },
    }))
    const filtered = filterSuggestionItems(items, query).slice(0, MAX_RESULTS)
    const final = disambiguateTitles(deduplicateByPath(filtered))
    return final.map(({ group, ...rest }) => {
      const noteType = group !== 'Note' ? group : undefined
      const te = typeEntryMap[group]
      return {
        ...rest,
        noteType,
        typeColor: noteType ? getTypeColor(group, te?.color) : undefined,
        typeLightColor: noteType ? getTypeLightColor(group, te?.color) : undefined,
        TypeIcon: noteType ? getTypeIcon(group, te?.icon) : undefined,
      }
    })
  }, [baseItems, editor, typeEntryMap])

  return (
    <div ref={containerRef} className={`editor__blocknote-container${isDragOver ? ' editor__blocknote-container--drag-over' : ''}`} style={cssVars as React.CSSProperties}>
      {isDragOver && (
        <div className="editor__drop-overlay">
          <div className="editor__drop-overlay-label">Drop image here</div>
        </div>
      )}
      <BlockNoteView
        editor={editor}
        theme="light"
        onChange={onChange}
      >
        <SuggestionMenuController
          triggerCharacter="[["
          getItems={getWikilinkItems}
          suggestionMenuComponent={WikilinkSuggestionMenu}
          onItemClick={(item: WikilinkSuggestionItem) => item.onItemClick()}
        />
        <SuggestionMenuController
          triggerCharacter="@"
          getItems={getPersonMentionItems}
          suggestionMenuComponent={WikilinkSuggestionMenu}
          onItemClick={(item: WikilinkSuggestionItem) => item.onItemClick()}
        />
      </BlockNoteView>
    </div>
  )
}

export const Editor = memo(function Editor({
  tabs, activeTabPath, entries, onSwitchTab, onCloseTab, onReorderTabs, onNavigateWikilink, onLoadDiff, onLoadDiffAtCommit, getNoteStatus, onCreateNote,
  inspectorCollapsed, onToggleInspector, inspectorWidth, onInspectorResize,
  inspectorEntry, inspectorContent, allContent, gitHistory,
  onUpdateFrontmatter, onDeleteProperty, onAddProperty,
  showAIChat, onToggleAIChat,
  vaultPath,
  onTrashNote, onRestoreNote,
  onArchiveNote, onUnarchiveNote,
  onRenameTab,
  onContentChange,
  canGoBack, canGoForward, onGoBack, onGoForward,
}: EditorProps) {
  const [diffMode, setDiffMode] = useState(false)
  const [diffContent, setDiffContent] = useState<string | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)

  // Ref for vaultPath so the uploadFile closure always sees the latest value
  const vaultPathRef = useRef(vaultPath)
  vaultPathRef.current = vaultPath

  // Single editor instance — reused across all tabs
  const editor = useCreateBlockNote({
    schema,
    uploadFile: (file: File) => uploadImageFile(file, vaultPathRef.current),
  })
  // Tab content-swap machinery (mount tracking, block caching, content serialization)
  const { handleEditorChange, editorMountedRef } = useEditorTabSwap({ tabs, activeTabPath, editor, onContentChange })

  // Focus editor when a new note is created (signaled via custom event).
  // Uses adaptive timing: fast rAF path when editor is already mounted,
  // short timeout when waiting for first mount.
  useEffect(() => {
    const handler = (e: Event) => {
      const t0 = (e as CustomEvent).detail?.t0 as number | undefined
      const doFocus = () => {
        editor.focus()
        if (t0) console.debug(`[perf] createNote → focus: ${(performance.now() - t0).toFixed(1)}ms`)
      }
      if (editorMountedRef.current) {
        requestAnimationFrame(doFocus)
      } else {
        setTimeout(doFocus, 80)
      }
    }
    window.addEventListener('laputa:focus-editor', handler)
    return () => window.removeEventListener('laputa:focus-editor', handler)
  }, [editor])

  const activeTab = tabs.find((t) => t.entry.path === activeTabPath) ?? null
  const isLoadingNewTab = activeTabPath !== null && !activeTab
  const activeStatus = activeTab ? getNoteStatus?.(activeTab.entry.path) ?? 'clean' : 'clean'
  const showDiffToggle = activeTab && (diffMode || activeStatus === 'modified')

  useEffect(() => {
    setDiffMode(false)
    setDiffContent(null)
  }, [activeTabPath])

  const handleToggleDiff = useCallback(async () => {
    if (diffMode) {
      setDiffMode(false)
      setDiffContent(null)
      return
    }
    if (!activeTabPath || !onLoadDiff) return
    setDiffLoading(true)
    try {
      const diff = await onLoadDiff(activeTabPath)
      setDiffContent(diff)
      setDiffMode(true)
    } catch (err) {
      console.warn('Failed to load diff:', err)
    } finally {
      setDiffLoading(false)
    }
  }, [diffMode, activeTabPath, onLoadDiff])

  const handleViewCommitDiff = useCallback(async (commitHash: string) => {
    if (!activeTabPath || !onLoadDiffAtCommit) return
    setDiffLoading(true)
    try {
      const diff = await onLoadDiffAtCommit(activeTabPath, commitHash)
      setDiffContent(diff)
      setDiffMode(true)
    } catch (err) {
      console.warn('Failed to load commit diff:', err)
    } finally {
      setDiffLoading(false)
    }
  }, [activeTabPath, onLoadDiffAtCommit])

  const wordCount = activeTab ? countWords(activeTab.content) : 0

  const tabBar = (
    <TabBar
      tabs={tabs}
      activeTabPath={activeTabPath}
      getNoteStatus={getNoteStatus}
      onSwitchTab={onSwitchTab}
      onCloseTab={onCloseTab}
      onCreateNote={onCreateNote}
      onReorderTabs={onReorderTabs}
      onRenameTab={onRenameTab}
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      onGoBack={onGoBack}
      onGoForward={onGoForward}
    />
  )

  const breadcrumbBar = activeTab ? (
    <BreadcrumbBar
      entry={activeTab.entry}
      wordCount={wordCount}
      noteStatus={activeStatus}
      showDiffToggle={!!showDiffToggle}
      diffMode={diffMode}
      diffLoading={diffLoading}
      onToggleDiff={handleToggleDiff}
      showAIChat={showAIChat}
      onToggleAIChat={onToggleAIChat}
      inspectorCollapsed={inspectorCollapsed}
      onToggleInspector={onToggleInspector}
      onTrash={onTrashNote ? () => onTrashNote(activeTab.entry.path) : undefined}
      onRestore={onRestoreNote ? () => onRestoreNote(activeTab.entry.path) : undefined}
      onArchive={onArchiveNote ? () => onArchiveNote(activeTab.entry.path) : undefined}
      onUnarchive={onUnarchiveNote ? () => onUnarchiveNote(activeTab.entry.path) : undefined}
    />
  ) : null

  const rightPanel = showAIChat ? (
    <div
      className="shrink-0 flex flex-col min-h-0"
      style={{ width: inspectorWidth, height: '100%' }}
    >
      <AIChatPanel
        entry={inspectorEntry}
        allContent={allContent}
        entries={entries}
        onClose={() => onToggleAIChat?.()}
      />
    </div>
  ) : inspectorCollapsed ? null : (
    <div
      className="shrink-0 flex flex-col min-h-0"
      style={{ width: inspectorWidth, height: '100%' }}
    >
      <Inspector
        collapsed={inspectorCollapsed}
        onToggle={onToggleInspector}
        entry={inspectorEntry}
        content={inspectorContent}
        entries={entries}
        gitHistory={gitHistory}
        onNavigate={onNavigateWikilink}
        onViewCommitDiff={handleViewCommitDiff}
        onUpdateFrontmatter={onUpdateFrontmatter}
        onDeleteProperty={onDeleteProperty}
        onAddProperty={onAddProperty}
      />
    </div>
  )

  if (tabs.length === 0) {
    return (
      <div className="editor flex flex-col min-h-0 overflow-hidden bg-background text-foreground">
        {tabBar}
        <div className="flex flex-1 min-h-0">
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <p className="m-0 text-[15px]">Select a note to start editing</p>
            <span className="text-xs text-muted-foreground">Cmd+P to search &middot; Cmd+N to create</span>
          </div>
          {(showAIChat || !inspectorCollapsed) && <ResizeHandle onResize={onInspectorResize} />}
          {rightPanel}
        </div>
      </div>
    )
  }

  return (
    <div className="editor flex flex-col min-h-0 overflow-hidden bg-background text-foreground">
      {tabBar}
      <div className="flex flex-1 min-h-0">
        <div className="flex flex-1 flex-col min-w-0 min-h-0">
          {breadcrumbBar}
          {diffMode && (
            <div className="flex-1 overflow-auto">
              <button
                className="flex items-center gap-1.5 px-4 py-2 text-xs text-primary bg-muted border-b border-border cursor-pointer hover:bg-accent transition-colors w-full border-t-0 border-l-0 border-r-0"
                onClick={handleToggleDiff}
                title="Back to editor"
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>&larr;</span>
                Back to editor
              </button>
              <DiffView diff={diffContent ?? ''} />
            </div>
          )}
          {!diffMode && activeTab && (
            <div
              style={{
                display: 'flex',
                flex: 1,
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              <SingleEditorView
                editor={editor}
                entries={entries}
                onNavigateWikilink={onNavigateWikilink}
                onChange={handleEditorChange}
              />
            </div>
          )}
          {isLoadingNewTab && !diffMode && (
            <div className="flex flex-1 flex-col gap-3 p-8 animate-pulse" style={{ minHeight: 0 }}>
              <div className="h-6 w-2/5 rounded bg-muted" />
              <div className="h-4 w-4/5 rounded bg-muted" />
              <div className="h-4 w-3/5 rounded bg-muted" />
              <div className="h-4 w-4/5 rounded bg-muted" />
              <div className="h-4 w-2/5 rounded bg-muted" />
            </div>
          )}
        </div>
        {(showAIChat || !inspectorCollapsed) && <ResizeHandle onResize={onInspectorResize} />}
        {rightPanel}
      </div>
    </div>
  )
})
