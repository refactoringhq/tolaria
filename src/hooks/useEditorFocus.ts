import { useEffect } from 'react'

interface TiptapChain {
  setTextSelection: (pos: { from: number; to: number }) => TiptapChain
  run: () => void
}

interface TiptapEditor {
  state: { doc: { descendants: (cb: (node: { type: { name: string }; nodeSize: number }, pos: number) => boolean | void) => void } }
  chain: () => TiptapChain
}

/** Select all text in the first heading block via the TipTap chain API. */
function selectFirstHeading(editor: { _tiptapEditor?: TiptapEditor }): void {
  const tiptap = editor._tiptapEditor
  if (!tiptap?.state?.doc) return

  let from = -1
  let to = -1

  tiptap.state.doc.descendants((node, pos) => {
    if (from !== -1) return false
    if (node.type.name === 'heading') {
      from = pos + 1
      to = pos + node.nodeSize - 1
      return false
    }
  })

  if (from === -1 || from >= to) return
  tiptap.chain().setTextSelection({ from, to }).run()
}

/**
 * Focus editor when a new note is created (signaled via custom event).
 * Uses adaptive timing: fast rAF path when editor is already mounted,
 * short timeout when waiting for first mount.
 * When selectTitle is true, also selects all text in the first H1 block.
 */
export function useEditorFocus(
  editor: { focus: () => void; _tiptapEditor?: TiptapEditor },
  editorMountedRef: React.RefObject<boolean>,
) {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { t0?: number; selectTitle?: boolean } | undefined
      const t0 = detail?.t0
      const selectTitle = detail?.selectTitle ?? false
      const doFocus = () => {
        editor.focus()
        if (!selectTitle) {
          if (t0) console.debug(`[perf] createNote → focus: ${(performance.now() - t0).toFixed(1)}ms`)
          return
        }
        // Defer selection to the next animation frame so the new note's content
        // (applied via queueMicrotask inside a React effect triggered by the tab
        // change) is in the document before we try to select the heading.
        // Between two rAF callbacks, all pending macrotasks — including React's
        // MessageChannel re-render and the subsequent queueMicrotask content swap
        // — complete, so the heading block is guaranteed to exist by rAF 2.
        requestAnimationFrame(() => {
          selectFirstHeading(editor)
          if (t0) console.debug(`[perf] createNote → focus+select: ${(performance.now() - t0).toFixed(1)}ms`)
        })
      }
      if (editorMountedRef.current) {
        requestAnimationFrame(doFocus)
      } else {
        setTimeout(doFocus, 80)
      }
    }
    window.addEventListener('laputa:focus-editor', handler)
    return () => window.removeEventListener('laputa:focus-editor', handler)
  }, [editor, editorMountedRef])
}
