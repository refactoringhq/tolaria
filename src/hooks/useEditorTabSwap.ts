import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import type { useCreateBlockNote } from '@blocknote/react'
import type { VaultEntry } from '../types'
import { splitFrontmatter, preProcessWikilinks, injectWikilinks, restoreWikilinksInBlocks } from '../utils/wikilinks'
import { compactMarkdown } from '../utils/compact-markdown'

interface Tab {
  entry: VaultEntry
  content: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- BlockNote block arrays
type EditorBlocks = any[]
type CachedTabState = { blocks: EditorBlocks; scrollTop: number }

interface UseEditorTabSwapOptions {
  tabs: Tab[]
  activeTabPath: string | null
  editor: ReturnType<typeof useCreateBlockNote>
  onContentChange?: (path: string, content: string) => void
  /** When true, the BlockNote editor is hidden (raw/CodeMirror mode active). */
  rawMode?: boolean
}

/** Strip the YAML frontmatter from raw file content, returning the body
 *  (including any H1 heading) that should appear in the editor. */
export function extractEditorBody(rawFileContent: string): string {
  const [, rawBody] = splitFrontmatter(rawFileContent)
  return rawBody.trimStart()
}

/** Extract H1 text from the editor's first block, or null if not an H1. */
export function getH1TextFromBlocks(blocks: unknown[]): string | null {
  const first = blocks?.[0] as {
    type?: string
    props?: { level?: number }
    content?: Array<{ type?: string; text?: string }>
  } | undefined
  const content = first?.type === 'heading' && first.props?.level === 1 && Array.isArray(first.content)
    ? first.content
    : null
  if (!content) return null

  const text = content
    .filter(item => item.type === 'text')
    .map(item => item.text || '')
    .join('')
  return text.trim() || null
}

/** Replace the title: line in YAML frontmatter with a new title value. */
export function replaceTitleInFrontmatter(frontmatter: string, newTitle: string): string {
  return frontmatter.replace(/^(title:\s*).+$/m, `$1${newTitle}`)
}

function readEditorScrollTop(): number {
  const scrollEl = document.querySelector('.editor__blocknote-container')
  return scrollEl?.scrollTop ?? 0
}

function cacheEditorState(
  cache: Map<string, CachedTabState>,
  path: string,
  blocks: EditorBlocks,
) {
  cache.set(path, {
    blocks,
    scrollTop: readEditorScrollTop(),
  })
}

function buildFastPathBlocks(preprocessed: string): EditorBlocks | null {
  if (!preprocessed.trim()) {
    return [{ type: 'paragraph', content: [] }]
  }

  const h1OnlyMatch = preprocessed.trim().match(/^# (.+)$/)
  if (!h1OnlyMatch) return null

  return [
    { type: 'heading', props: { level: 1, textColor: 'default', backgroundColor: 'default', textAlignment: 'left' }, content: [{ type: 'text', text: h1OnlyMatch[1], styles: {} }], children: [] },
    { type: 'paragraph', content: [], children: [] },
  ]
}

async function parseMarkdownBlocks(
  editor: ReturnType<typeof useCreateBlockNote>,
  preprocessed: string,
): Promise<EditorBlocks> {
  const result = editor.tryParseMarkdownToBlocks(preprocessed)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tryParseMarkdownToBlocks returns sync or async BlockNote blocks
  if (result && typeof (result as any).then === 'function') {
    return (result as unknown as Promise<EditorBlocks>)
  }
  return result as EditorBlocks
}

async function resolveBlocksForTarget(
  editor: ReturnType<typeof useCreateBlockNote>,
  cache: Map<string, CachedTabState>,
  targetPath: string,
  content: string,
): Promise<CachedTabState> {
  const cached = cache.get(targetPath)
  if (cached) return cached

  const body = extractEditorBody(content)
  const preprocessed = preProcessWikilinks(body)
  const fastPathBlocks = buildFastPathBlocks(preprocessed)
  if (fastPathBlocks) {
    const nextState = { blocks: fastPathBlocks, scrollTop: 0 }
    cache.set(targetPath, nextState)
    return nextState
  }

  const parsed = await parseMarkdownBlocks(editor, preprocessed)
  const withWikilinks = injectWikilinks(parsed)
  if (withWikilinks.length > 0) {
    cache.set(targetPath, { blocks: withWikilinks, scrollTop: 0 })
  }
  return { blocks: withWikilinks, scrollTop: 0 }
}

function applyBlocksToEditor(
  editor: ReturnType<typeof useCreateBlockNote>,
  blocks: EditorBlocks,
  scrollTop: number,
  suppressChangeRef: MutableRefObject<boolean>,
) {
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
    queueMicrotask(() => { suppressChangeRef.current = false })
  }

  requestAnimationFrame(() => {
    const scrollEl = document.querySelector('.editor__blocknote-container')
    if (scrollEl) scrollEl.scrollTop = scrollTop
  })
}

function findActiveTab(tabs: Tab[], activeTabPath: string | null): Tab | undefined {
  return activeTabPath
    ? tabs.find(tab => tab.entry.path === activeTabPath)
    : undefined
}

function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}

function useEditorMountState(
  editor: ReturnType<typeof useCreateBlockNote>,
  editorMountedRef: MutableRefObject<boolean>,
  pendingSwapRef: MutableRefObject<(() => void) | null>,
) {
  useEffect(() => {
    if (editor.prosemirrorView) {
      editorMountedRef.current = true
    }
    const cleanup = editor.onMount(() => {
      editorMountedRef.current = true
      if (pendingSwapRef.current) {
        const swap = pendingSwapRef.current
        pendingSwapRef.current = null
        queueMicrotask(swap)
      }
    })
    return cleanup
  }, [editor, editorMountedRef, pendingSwapRef])
}

function useEditorChangeHandler(options: {
  editor: ReturnType<typeof useCreateBlockNote>
  tabsRef: MutableRefObject<Tab[]>
  onContentChangeRef: MutableRefObject<((path: string, content: string) => void) | undefined>
  prevActivePathRef: MutableRefObject<string | null>
  suppressChangeRef: MutableRefObject<boolean>
}) {
  const {
    editor,
    tabsRef,
    onContentChangeRef,
    prevActivePathRef,
    suppressChangeRef,
  } = options

  return useCallback(() => {
    if (suppressChangeRef.current) return
    const path = prevActivePathRef.current
    if (!path) return

    const tab = tabsRef.current.find(t => t.entry.path === path)
    if (!tab) return

    const blocks = editor.document
    const restored = restoreWikilinksInBlocks(blocks)
    const bodyMarkdown = compactMarkdown(editor.blocksToMarkdownLossy(restored as typeof blocks))
    const [frontmatter] = splitFrontmatter(tab.content)
    onContentChangeRef.current?.(path, `${frontmatter}${bodyMarkdown}`)
  }, [editor, onContentChangeRef, prevActivePathRef, suppressChangeRef, tabsRef])
}

function consumeRawModeTransition(
  prevRawModeRef: MutableRefObject<boolean>,
  rawMode: boolean | undefined,
) {
  const rawModeJustEnded = prevRawModeRef.current && !rawMode
  prevRawModeRef.current = !!rawMode
  return rawModeJustEnded
}

function cachePreviousTabOnPathChange(options: {
  prevPath: string | null
  pathChanged: boolean
  editorMountedRef: MutableRefObject<boolean>
  cache: Map<string, CachedTabState>
  editor: ReturnType<typeof useCreateBlockNote>
}) {
  const { prevPath, pathChanged, editorMountedRef, cache, editor } = options
  if (!prevPath || !pathChanged || !editorMountedRef.current) return
  cacheEditorState(cache, prevPath, editor.document)
}

function rememberPendingTabArrival(
  activeTabPath: string | null,
  activeTab: Tab | undefined,
  pendingTabArrivalPathRef: MutableRefObject<string | null>,
) {
  if (!activeTabPath) {
    pendingTabArrivalPathRef.current = null
    return false
  }
  if (activeTab) {
    pendingTabArrivalPathRef.current = null
    return true
  }
  pendingTabArrivalPathRef.current = activeTabPath
  return false
}

function handleStableActivePath(options: {
  pathChanged: boolean
  rawModeJustEnded: boolean
  activeTabPath: string | null
  activeTab: Tab | undefined
  pendingTabArrival: boolean
  cache: Map<string, CachedTabState>
  editor: ReturnType<typeof useCreateBlockNote>
  editorMountedRef: MutableRefObject<boolean>
  rawSwapPendingRef: MutableRefObject<boolean>
}) {
  const {
    pathChanged,
    rawModeJustEnded,
    activeTabPath,
    activeTab,
    pendingTabArrival,
    cache,
    editor,
    editorMountedRef,
    rawSwapPendingRef,
  } = options

  if (pathChanged) return false
  if (rawModeJustEnded && activeTabPath) {
    cache.delete(activeTabPath)
    rawSwapPendingRef.current = true
    return false
  }
  if (pendingTabArrival) return false
  if (rawSwapPendingRef.current) return true

  if (activeTabPath && activeTab && editorMountedRef.current) {
    cacheEditorState(cache, activeTabPath, editor.document)
  }
  return true
}

function scheduleTabSwap(options: {
  editor: ReturnType<typeof useCreateBlockNote>
  cache: Map<string, CachedTabState>
  targetPath: string
  activeTab: Tab
  pendingSwapRef: MutableRefObject<(() => void) | null>
  prevActivePathRef: MutableRefObject<string | null>
  rawSwapPendingRef: MutableRefObject<boolean>
  suppressChangeRef: MutableRefObject<boolean>
}) {
  const {
    editor,
    cache,
    targetPath,
    activeTab,
    pendingSwapRef,
    prevActivePathRef,
    rawSwapPendingRef,
    suppressChangeRef,
  } = options

  const doSwap = () => {
    if (prevActivePathRef.current !== targetPath) return
    rawSwapPendingRef.current = false
    void resolveBlocksForTarget(editor, cache, targetPath, activeTab.content)
      .then(({ blocks, scrollTop }) => {
        if (prevActivePathRef.current !== targetPath) return
        applyBlocksToEditor(editor, blocks, scrollTop, suppressChangeRef)
      })
      .catch((err: unknown) => {
        console.error('Failed to parse/swap editor content:', err)
      })
  }

  if (editor.prosemirrorView) {
    queueMicrotask(doSwap)
    return
  }
  pendingSwapRef.current = doSwap
}

function useTabSwapEffect(options: {
  tabs: Tab[]
  activeTabPath: string | null
  editor: ReturnType<typeof useCreateBlockNote>
  rawMode?: boolean
  tabCacheRef: MutableRefObject<Map<string, CachedTabState>>
  prevActivePathRef: MutableRefObject<string | null>
  editorMountedRef: MutableRefObject<boolean>
  pendingSwapRef: MutableRefObject<(() => void) | null>
  pendingTabArrivalPathRef: MutableRefObject<string | null>
  prevRawModeRef: MutableRefObject<boolean>
  rawSwapPendingRef: MutableRefObject<boolean>
  suppressChangeRef: MutableRefObject<boolean>
}) {
  const {
    tabs,
    activeTabPath,
    editor,
    rawMode,
    tabCacheRef,
    prevActivePathRef,
    editorMountedRef,
    pendingSwapRef,
    pendingTabArrivalPathRef,
    prevRawModeRef,
    rawSwapPendingRef,
    suppressChangeRef,
  } = options

  useEffect(() => {
    const cache = tabCacheRef.current
    const prevPath = prevActivePathRef.current
    const pathChanged = prevPath !== activeTabPath
    const activeTab = findActiveTab(tabs, activeTabPath)
    const pendingTabArrival = activeTabPath !== null
      && pendingTabArrivalPathRef.current === activeTabPath
    const rawModeJustEnded = consumeRawModeTransition(prevRawModeRef, rawMode)

    if (rawMode) return
    cachePreviousTabOnPathChange({ prevPath, pathChanged, editorMountedRef, cache, editor })
    prevActivePathRef.current = activeTabPath

    if (handleStableActivePath({
      pathChanged,
      rawModeJustEnded,
      activeTabPath,
      activeTab,
      pendingTabArrival,
      cache,
      editor,
      editorMountedRef,
      rawSwapPendingRef,
    })) {
      return
    }

    if (!rememberPendingTabArrival(activeTabPath, activeTab, pendingTabArrivalPathRef)) {
      return
    }
    const targetPath = activeTabPath
    const readyActiveTab = activeTab
    if (!targetPath || !readyActiveTab) return

    scheduleTabSwap({
      editor,
      cache,
      targetPath,
      activeTab: readyActiveTab,
      pendingSwapRef,
      prevActivePathRef,
      rawSwapPendingRef,
      suppressChangeRef,
    })
  }, [
    activeTabPath,
    editor,
    editorMountedRef,
    pendingSwapRef,
    pendingTabArrivalPathRef,
    prevActivePathRef,
    prevRawModeRef,
    rawMode,
    rawSwapPendingRef,
    suppressChangeRef,
    tabCacheRef,
    tabs,
  ])
}

function useTabCacheCleanup(
  tabs: Tab[],
  tabCacheRef: MutableRefObject<Map<string, CachedTabState>>,
) {
  const tabPathsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const currentPaths = new Set(tabs.map(t => t.entry.path))
    for (const path of tabPathsRef.current) {
      if (!currentPaths.has(path)) {
        tabCacheRef.current.delete(path)
      }
    }
    tabPathsRef.current = currentPaths
  }, [tabs, tabCacheRef])
}

/**
 * Manages the tab content-swap machinery for the BlockNote editor.
 *
 * Owns all refs and effects related to:
 * - Tracking editor mount state (editorMountedRef, pendingSwapRef)
 * - Swapping document content when the active tab changes (with caching)
 * - Cleaning up the block cache when tabs are closed
 * - Serializing editor blocks → markdown on change (suppressChangeRef)
 *
 * Returns `handleEditorChange`, the onChange callback for SingleEditorView.
 */
export function useEditorTabSwap({ tabs, activeTabPath, editor, onContentChange, rawMode }: UseEditorTabSwapOptions) {
  const tabCacheRef = useRef<Map<string, CachedTabState>>(new Map())
  const prevActivePathRef = useRef<string | null>(null)
  const editorMountedRef = useRef(false)
  const pendingSwapRef = useRef<(() => void) | null>(null)
  const pendingTabArrivalPathRef = useRef<string | null>(null)
  const prevRawModeRef = useRef(!!rawMode)
  const rawSwapPendingRef = useRef(false)
  const suppressChangeRef = useRef(false)
  const onContentChangeRef = useLatestRef(onContentChange)
  const tabsRef = useLatestRef(tabs)
  const handleEditorChange = useEditorChangeHandler({
    editor,
    tabsRef,
    onContentChangeRef,
    prevActivePathRef,
    suppressChangeRef,
  })

  useEditorMountState(editor, editorMountedRef, pendingSwapRef)
  useTabSwapEffect({
    tabs,
    activeTabPath,
    editor,
    rawMode,
    tabCacheRef,
    prevActivePathRef,
    editorMountedRef,
    pendingSwapRef,
    pendingTabArrivalPathRef,
    prevRawModeRef,
    rawSwapPendingRef,
    suppressChangeRef,
  })
  useTabCacheCleanup(tabs, tabCacheRef)

  return { handleEditorChange, editorMountedRef }
}
