import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react'
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
import { splitFrontmatter, preProcessWikilinks, injectWikilinks, restoreWikilinksInBlocks, countWords } from '../utils/wikilinks'
import { preFilterWikilinks, deduplicateByPath, disambiguateTitles, MAX_RESULTS, MIN_QUERY_LENGTH } from '../utils/wikilinkSuggestions'
import { filterPersonMentions, PERSON_MENTION_MIN_QUERY } from '../utils/personMentionSuggestions'
import { resolveWikilinkColor as resolveColor } from '../utils/wikilinkColors'
import { getTypeColor } from '../utils/typeColors'
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
    return final.map(({ group, ...rest }) => ({
      ...rest,
      noteType: group !== 'Note' ? group : undefined,
      typeColor: group !== 'Note' ? getTypeColor(group) : undefined,
    }))
  }, [baseItems, editor])

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
    return final.map(({ group, ...rest }) => ({
      ...rest,
      noteType: group,
      typeColor: getTypeColor(group),
    }))
  }, [baseItems, editor])

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
  // Cache parsed blocks per tab path for instant switching
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- BlockNote block arrays
  const tabCacheRef = useRef<Map<string, any[]>>(new Map())
  const prevActivePathRef = useRef<string | null>(null)
  const editorMountedRef = useRef(false)
  const pendingSwapRef = useRef<(() => void) | null>(null)

  // Track editor mount state
  useEffect(() => {
    // Check if already mounted (prosemirrorView exists)
    if (editor.prosemirrorView) {
      editorMountedRef.current = true
    }
    const cleanup = editor.onMount(() => {
      editorMountedRef.current = true
      // Execute any pending content swap that was queued before mount.
      // Defer via queueMicrotask so BlockNote's internal flushSync calls
      // don't collide with React's commit phase.
      if (pendingSwapRef.current) {
        const swap = pendingSwapRef.current
        pendingSwapRef.current = null
        queueMicrotask(swap)
      }
    })
    return cleanup
  }, [editor])

  // Suppress onChange during programmatic content swaps (tab switching / initial load)
  const suppressChangeRef = useRef(false)

  // Keep refs to callbacks for the onChange handler
  const onContentChangeRef = useRef(onContentChange)
  onContentChangeRef.current = onContentChange
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  // onChange handler: serialize editor blocks → markdown, reconstruct full file, call save
  const handleEditorChange = useCallback(() => {
    if (suppressChangeRef.current) return
    const path = prevActivePathRef.current
    if (!path) return

    const tab = tabsRef.current.find(t => t.entry.path === path)
    if (!tab) return

    // Convert blocks → markdown, restoring wikilinks first
    const blocks = editor.document
    const restored = restoreWikilinksInBlocks(blocks)
    const bodyMarkdown = editor.blocksToMarkdownLossy(restored as typeof blocks)

    // Reconstruct the full file: preserve original frontmatter + title heading
    const [frontmatter] = splitFrontmatter(tab.content)
    const title = tab.entry.title
    const fullContent = `${frontmatter}# ${title}\n\n${bodyMarkdown}`

    onContentChangeRef.current?.(path, fullContent)
  }, [editor])

  // Swap document content when active tab changes.
  // Uses queueMicrotask to defer BlockNote mutations outside React's commit phase,
  // avoiding flushSync-inside-lifecycle errors that silently prevent content from rendering.
  useEffect(() => {
    const cache = tabCacheRef.current
    const prevPath = prevActivePathRef.current
    const pathChanged = prevPath !== activeTabPath

    // Save current editor state for the tab we're leaving
    if (prevPath && pathChanged && editorMountedRef.current) {
      cache.set(prevPath, editor.document)
    }
    prevActivePathRef.current = activeTabPath

    // When tab content updates but the active tab stays the same (e.g. after
    // Cmd+S save), refresh the cache with the current editor blocks so a later
    // tab switch doesn't revert to stale content. Do NOT re-apply blocks —
    // the editor already shows the user's edits.
    if (!pathChanged) {
      if (activeTabPath && editorMountedRef.current) {
        cache.set(activeTabPath, editor.document)
      }
      return
    }

    if (!activeTabPath) return

    const tab = tabs.find(t => t.entry.path === activeTabPath)
    if (!tab) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- BlockNote's PartialBlock generic is extremely complex
    const applyBlocks = (blocks: any[]) => {
      suppressChangeRef.current = true
      try {
        const current = editor.document
        if (current.length > 0 && blocks.length > 0) {
          editor.replaceBlocks(current, blocks)
        } else if (blocks.length > 0) {
          editor.insertBlocks(blocks, current[0], 'before')
        }
      } catch (err) {
        console.error('applyBlocks failed, trying fallback:', err)
        try {
          const html = editor.blocksToHTMLLossy(blocks)
          editor._tiptapEditor.commands.setContent(html)
        } catch (err2) {
          console.error('Fallback also failed:', err2)
        }
      } finally {
        // Re-enable change detection on next microtask, after BlockNote
        // finishes its internal state updates from the content swap
        queueMicrotask(() => { suppressChangeRef.current = false })
      }
    }

    const targetPath = activeTabPath

    const doSwap = () => {
      // Guard: bail if user switched tabs since this swap was scheduled
      if (prevActivePathRef.current !== targetPath) return

      if (cache.has(targetPath)) {
        applyBlocks(cache.get(targetPath)!)
        return
      }

      const [, rawBody] = splitFrontmatter(tab.content)
      const body = rawBody.replace(/^# [^\n]*\n?/, '').trimStart()
      const preprocessed = preProcessWikilinks(body)

      try {
        const result = editor.tryParseMarkdownToBlocks(preprocessed)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- BlockNote block arrays
        const handleBlocks = (blocks: any[]) => {
          if (prevActivePathRef.current !== targetPath) return
          const withWikilinks = injectWikilinks(blocks)
          // Only cache non-empty results to avoid poisoning the cache
          if (withWikilinks.length > 0) {
            cache.set(targetPath, withWikilinks)
          }
          applyBlocks(withWikilinks)
        }
        /* eslint-disable @typescript-eslint/no-explicit-any -- tryParseMarkdownToBlocks returns sync or async BlockNote blocks */
        if (result && typeof (result as any).then === 'function') {
          (result as unknown as Promise<any[]>).then(handleBlocks).catch((err: unknown) => {
            console.error('Async markdown parse failed:', err)
          })
        } else {
          handleBlocks(result as any[])
        }
        /* eslint-enable @typescript-eslint/no-explicit-any */
      } catch (err) {
        console.error('Failed to parse/swap editor content:', err)
      }
    }

    if (editor.prosemirrorView) {
      // Defer the swap outside React's commit phase so BlockNote's internal
      // flushSync calls don't collide with React's rendering lifecycle.
      queueMicrotask(doSwap)
    } else {
      pendingSwapRef.current = doSwap
    }
  }, [activeTabPath, tabs, editor])

  // Clean up cache entries when tabs are closed
  const tabPathsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const currentPaths = new Set(tabs.map(t => t.entry.path))
    for (const path of tabPathsRef.current) {
      if (!currentPaths.has(path)) {
        tabCacheRef.current.delete(path)
      }
    }
    tabPathsRef.current = currentPaths
  }, [tabs])

  // Focus editor when a new note is created (signaled via custom event)
  useEffect(() => {
    const handler = () => {
      setTimeout(() => editor.focus(), 150)
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
