const ROOT_EDITABLE_SELECTOR = '.ProseMirror[contenteditable="true"]'
const FALLBACK_EDITABLE_SELECTOR = '.bn-editor [contenteditable="true"]'
const MAX_FOCUS_ATTEMPTS = 12

interface TiptapChain {
  setTextSelection: (pos: { from: number; to: number }) => TiptapChain
  run: () => void
}

export interface TiptapEditor {
  state: { doc: { descendants: (cb: (node: { type: { name: string }; nodeSize: number }, pos: number) => boolean | void) => void } }
  chain: () => TiptapChain
}

export interface FocusableEditor {
  focus: () => void
  _tiptapEditor?: TiptapEditor
}

/** Select all text in the first heading block via the TipTap chain API. */
function selectFirstHeading(editor: FocusableEditor): void {
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

  if (from === -1 || to === -1 || from > to) return
  tiptap.chain().setTextSelection({ from, to }).run()
}

function hasEditableFocus(): boolean {
  const active = document.activeElement as HTMLElement | null
  return Boolean(active?.isContentEditable || active?.closest('[contenteditable="true"]'))
}

function canFocusWindow(): boolean {
  return !navigator.userAgent.toLowerCase().includes('jsdom')
}

function focusEditableCandidate(editable: HTMLElement): boolean {
  if (canFocusWindow()) {
    window.focus?.()
  }
  editable.focus()

  if (hasEditableFocus()) return true

  const selection = window.getSelection()
  if (selection && editable.isContentEditable) {
    const range = document.createRange()
    range.selectNodeContents(editable)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    editable.focus()
  }

  return hasEditableFocus()
}

function focusEditableNode(): boolean {
  const rootEditable = document.querySelector<HTMLElement>(ROOT_EDITABLE_SELECTOR)
  if (rootEditable && focusEditableCandidate(rootEditable)) {
    return true
  }

  const fallbackEditable = document.querySelector<HTMLElement>(FALLBACK_EDITABLE_SELECTOR)
  if (fallbackEditable && focusEditableCandidate(fallbackEditable)) {
    return true
  }

  return false
}

function logFocusTiming(t0: number | undefined, label: 'focus' | 'focus+select'): void {
  if (!t0) return
  console.debug(`[perf] createNote → ${label}: ${(performance.now() - t0).toFixed(1)}ms`)
}

export function focusEditorWithRetries(
  editor: FocusableEditor,
  selectTitle: boolean,
  t0: number | undefined,
  attempt = 0,
): void {
  editor.focus()
  if (!hasEditableFocus()) {
    focusEditableNode()
  }
  if (!hasEditableFocus() && attempt < MAX_FOCUS_ATTEMPTS) {
    requestAnimationFrame(() => focusEditorWithRetries(editor, selectTitle, t0, attempt + 1))
    return
  }
  if (!selectTitle) {
    logFocusTiming(t0, 'focus')
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
    logFocusTiming(t0, 'focus+select')
  })
}
