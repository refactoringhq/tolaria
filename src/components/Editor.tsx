import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react'
import { BlockNoteSchema, defaultInlineContentSpecs } from '@blocknote/core'
import { filterSuggestionItems } from '@blocknote/core/extensions'
import { createReactInlineContentSpec, useCreateBlockNote, SuggestionMenuController } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'
import type { VaultEntry, GitCommit } from '../types'
import { Inspector, type FrontmatterValue } from './Inspector'
import { AIChatPanel } from './AIChatPanel'
import { DiffView } from './DiffView'
import { ResizeHandle } from './ResizeHandle'
import { TabBar } from './TabBar'
import { BreadcrumbBar } from './BreadcrumbBar'
import { useEditorTheme } from '../hooks/useTheme'
import { splitFrontmatter, preProcessWikilinks, injectWikilinks, countWords } from '../utils/wikilinks'
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
  isModified?: (path: string) => boolean
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
}

// --- Custom Inline Content: WikiLink ---

// Module-level cache so the WikiLink renderer (defined outside React) can access entries
const _wikilinkEntriesRef: { current: VaultEntry[] } = { current: [] }

const TYPE_COLOR_MAP: Record<string, string> = {
  red: 'var(--accent-red)',
  orange: 'var(--accent-orange)',
  yellow: 'var(--accent-yellow)',
  green: 'var(--accent-green)',
  blue: 'var(--accent-blue)',
  purple: 'var(--accent-purple)',
}

function resolveWikilinkColor(target: string): string | undefined {
  const entries = _wikilinkEntriesRef.current
  if (!entries.length) return undefined
  // Find the target entry by title or filename slug
  const entry = entries.find(
    e => e.title === target || e.filename.replace(/\.md$/, '') === target
  )
  if (!entry) return undefined
  // If entry is itself a Type, use its own color
  if (entry.isA === 'Type' && entry.color) return TYPE_COLOR_MAP[entry.color]
  // Otherwise look up the type entry
  if (entry.isA) {
    const typeEntry = entries.find(e => e.isA === 'Type' && e.title === entry.isA)
    if (typeEntry?.color) return TYPE_COLOR_MAP[typeEntry.color]
  }
  return undefined
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
      const color = resolveWikilinkColor(target)
      return (
        <span
          className="wikilink"
          data-target={target}
          style={color ? { color, textDecorationColor: color } : undefined}
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
function SingleEditorView({ editor, entries, onNavigateWikilink }: { editor: ReturnType<typeof useCreateBlockNote>; entries: VaultEntry[]; onNavigateWikilink: (target: string) => void }) {
  const navigateRef = useRef(onNavigateWikilink)
  navigateRef.current = onNavigateWikilink
  const { cssVars } = useEditorTheme()

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
    () => entries.map(entry => ({
      title: entry.title,
      aliases: [entry.filename.replace(/\.md$/, ''), ...entry.aliases],
      group: entry.isA || 'Note',
      entryTitle: entry.title,
    })),
    [entries]
  )

  const getWikilinkItems = useCallback(async (query: string) => {
    const items = baseItems.map(item => ({
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
    return filterSuggestionItems(items, query)
  }, [baseItems, editor])

  return (
    <div className="editor__blocknote-container" style={cssVars as React.CSSProperties}>
      <BlockNoteView
        editor={editor}
        theme="light"
      >
        <SuggestionMenuController
          triggerCharacter="[["
          getItems={getWikilinkItems}
        />
      </BlockNoteView>
    </div>
  )
}

export const Editor = memo(function Editor({
  tabs, activeTabPath, entries, onSwitchTab, onCloseTab, onReorderTabs, onNavigateWikilink, onLoadDiff, isModified, onCreateNote,
  inspectorCollapsed, onToggleInspector, inspectorWidth, onInspectorResize,
  inspectorEntry, inspectorContent, allContent, gitHistory,
  onUpdateFrontmatter, onDeleteProperty, onAddProperty,
  showAIChat, onToggleAIChat,
  vaultPath,
  onTrashNote, onRestoreNote,
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
    uploadFile: async (file: File) => {
      if (isTauri() && vaultPathRef.current) {
        // Tauri mode: save to vault/attachments and return a stable asset URL
        const buf = await file.arrayBuffer()
        const bytes = new Uint8Array(buf)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        const base64 = btoa(binary)
        const savedPath = await invoke<string>('save_image', {
          vaultPath: vaultPathRef.current,
          filename: file.name,
          data: base64,
        })
        return convertFileSrc(savedPath)
      }
      // Browser dev mode: use data URL (survives reload, acceptable for dev)
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
    },
  })
  // Cache parsed blocks per tab path for instant switching
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

  // Swap document content when active tab changes.
  // Uses queueMicrotask to defer BlockNote mutations outside React's commit phase,
  // avoiding flushSync-inside-lifecycle errors that silently prevent content from rendering.
  useEffect(() => {
    const cache = tabCacheRef.current
    const prevPath = prevActivePathRef.current

    // Save current editor state for the tab we're leaving
    if (prevPath && prevPath !== activeTabPath && editorMountedRef.current) {
      cache.set(prevPath, editor.document)
    }
    prevActivePathRef.current = activeTabPath

    if (!activeTabPath) return

    const tab = tabs.find(t => t.entry.path === activeTabPath)
    if (!tab) return

    const applyBlocks = (blocks: any[]) => {
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
        const handleBlocks = (blocks: any[]) => {
          if (prevActivePathRef.current !== targetPath) return
          const withWikilinks = injectWikilinks(blocks)
          // Only cache non-empty results to avoid poisoning the cache
          if (withWikilinks.length > 0) {
            cache.set(targetPath, withWikilinks)
          }
          applyBlocks(withWikilinks)
        }
        if (result && typeof (result as any).then === 'function') {
          (result as unknown as Promise<any[]>).then(handleBlocks).catch((err) => {
            console.error('Async markdown parse failed:', err)
          })
        } else {
          handleBlocks(result as any[])
        }
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

  const activeTab = tabs.find((t) => t.entry.path === activeTabPath) ?? null
  const isLoadingNewTab = activeTabPath !== null && !activeTab
  const showDiffToggle = activeTab && isModified?.(activeTab.entry.path)

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

  const activeModified = activeTab ? isModified?.(activeTab.entry.path) ?? false : false
  const wordCount = activeTab ? countWords(activeTab.content) : 0

  const tabBar = (
    <TabBar
      tabs={tabs}
      activeTabPath={activeTabPath}
      onSwitchTab={onSwitchTab}
      onCloseTab={onCloseTab}
      onCreateNote={onCreateNote}
      onReorderTabs={onReorderTabs}
    />
  )

  const breadcrumbBar = activeTab ? (
    <BreadcrumbBar
      entry={activeTab.entry}
      wordCount={wordCount}
      isModified={activeModified}
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
        allContent={allContent}
        gitHistory={gitHistory}
        onNavigate={onNavigateWikilink}
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
