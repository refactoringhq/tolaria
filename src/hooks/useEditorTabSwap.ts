import type React from 'react'
import { useCallback, useEffect, useRef } from 'react'
import type { useCreateBlockNote } from '@blocknote/react'
import type { VaultEntry } from '../types'
import { splitFrontmatter, preProcessWikilinks, injectWikilinks, restoreWikilinksInBlocks } from '../utils/wikilinks'

interface Tab {
  entry: VaultEntry
  content: string
}

interface UseEditorTabSwapOptions {
  tabs: Tab[]
  activeTabPath: string | null
  editor: ReturnType<typeof useCreateBlockNote>
  onContentChange?: (path: string, content: string) => void
  /** Called on every editor change with the H1 text (null if no H1 first block). */
  onH1Change?: (h1Text: string | null) => void
  /** When .current is false, handleEditorChange won't update frontmatter title from H1. */
  syncActiveRef?: React.MutableRefObject<boolean>
}

/** Strip the YAML frontmatter from raw file content, returning the body
 *  (including any H1 heading) that should appear in the editor. */
export function extractEditorBody(rawFileContent: string): string {
  const [, rawBody] = splitFrontmatter(rawFileContent)
  return rawBody.trimStart()
}

/** Extract H1 text from the editor's first block, or null if not an H1. */
export function getH1TextFromBlocks(blocks: unknown[]): string | null {
  if (!blocks?.length) return null
  const first = blocks[0] as {
    type?: string
    props?: { level?: number }
    content?: Array<{ type?: string; text?: string }>
  }
  if (first.type !== 'heading' || first.props?.level !== 1) return null
  if (!Array.isArray(first.content)) return null
  const text = first.content
    .filter(item => item.type === 'text')
    .map(item => item.text || '')
    .join('')
  return text.trim() || null
}

/** Replace the title: line in YAML frontmatter with a new title value. */
export function replaceTitleInFrontmatter(frontmatter: string, newTitle: string): string {
  return frontmatter.replace(/^(title:\s*).+$/m, `$1${newTitle}`)
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
export function useEditorTabSwap({ tabs, activeTabPath, editor, onContentChange, onH1Change, syncActiveRef }: UseEditorTabSwapOptions) {
  // Cache parsed blocks per tab path for instant switching
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- BlockNote block arrays
  const tabCacheRef = useRef<Map<string, any[]>>(new Map())
  const prevActivePathRef = useRef<string | null>(null)
  const editorMountedRef = useRef(false)
  const pendingSwapRef = useRef<(() => void) | null>(null)

  // Suppress onChange during programmatic content swaps (tab switching / initial load)
  const suppressChangeRef = useRef(false)

  // Keep refs to callbacks for the onChange handler
  const onContentChangeRef = useRef(onContentChange)
  onContentChangeRef.current = onContentChange
  const onH1ChangeRef = useRef(onH1Change)
  onH1ChangeRef.current = onH1Change
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

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

    // Reconstruct full file: frontmatter + body (which now includes H1 if present)
    const [frontmatter] = splitFrontmatter(tab.content)
    const h1Text = getH1TextFromBlocks(blocks)

    // Keep frontmatter title: in sync with H1 when sync is active
    const isSyncActive = syncActiveRef?.current !== false
    const fm = (isSyncActive && h1Text)
      ? replaceTitleInFrontmatter(frontmatter, h1Text)
      : frontmatter
    const fullContent = `${fm}${bodyMarkdown}`

    onContentChangeRef.current?.(path, fullContent)
    onH1ChangeRef.current?.(h1Text)
  }, [editor, syncActiveRef])

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

      const body = extractEditorBody(tab.content)
      const preprocessed = preProcessWikilinks(body)

      // Fast path: empty body (e.g. newly created notes). Skip the
      // potentially-async markdown parser and set a single empty paragraph
      // so the editor is immediately interactive.
      if (!preprocessed.trim()) {
        const emptyDoc = [{ type: 'paragraph', content: [] }]
        cache.set(targetPath, emptyDoc)
        applyBlocks(emptyDoc)
        return
      }

      // Fast path: H1-only content (e.g. newly created notes that just have
      // the title heading). Build blocks directly to stay instant.
      const h1OnlyMatch = preprocessed.trim().match(/^# (.+)$/)
      if (h1OnlyMatch) {
        const h1Doc = [
          { type: 'heading', props: { level: 1, textColor: 'default', backgroundColor: 'default', textAlignment: 'left' }, content: [{ type: 'text', text: h1OnlyMatch[1], styles: {} }], children: [] },
          { type: 'paragraph', content: [], children: [] },
        ]
        cache.set(targetPath, h1Doc)
        applyBlocks(h1Doc)
        return
      }

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

  return { handleEditorChange, editorMountedRef }
}
