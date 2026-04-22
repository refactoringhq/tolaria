import { useRef, useEffect } from 'react'
import { EditorView, lineNumbers, highlightActiveLine, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { frontmatterHighlightPlugin, frontmatterHighlightTheme } from '../extensions/frontmatterHighlight'
import { markdownLanguage } from '../extensions/markdownHighlight'
import { zoomCursorFix } from '../extensions/zoomCursorFix'

export interface CodeMirrorCallbacks {
  onDocChange: (doc: string) => void
  onCursorActivity: (view: EditorView) => void
  onSave: () => void
  onEscape: () => boolean
}

function buildBaseTheme(isDarkMode: boolean) {
  void isDarkMode
  return EditorView.theme({
    '&': {
      fontSize: '13px',
      fontFamily: 'var(--font-mono)',
      backgroundColor: 'var(--background)',
      color: 'var(--foreground)',
      flex: '1',
      minHeight: '0',
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono)',
      lineHeight: '1.6',
      padding: '16px 0',
      overflow: 'auto',
    },
    '.cm-content': {
      padding: '0 32px 0 16px',
      caretColor: 'var(--foreground)',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--sidebar)',
      color: 'var(--muted-foreground)',
      borderRight: '1px solid var(--border)',
      paddingLeft: '16px',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      paddingRight: '12px',
      minWidth: '28px',
      textAlign: 'right',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--bg-selected)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--bg-selected)',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-line': { padding: '0' },
  })
}

function buildSaveKeymap(callbacks: { current: CodeMirrorCallbacks }) {
  return keymap.of([{
    key: 'Mod-s',
    run: () => { callbacks.current.onSave(); return true },
  }, {
    key: 'Escape',
    run: () => callbacks.current.onEscape(),
  }])
}

export function useCodeMirror(
  containerRef: React.RefObject<HTMLDivElement | null>,
  content: string,
  isDarkMode: boolean,
  callbacks: CodeMirrorCallbacks,
) {
  const viewRef = useRef<EditorView | null>(null)
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks
  // Track whether we're dispatching an external sync so the updateListener skips it
  const externalSyncRef = useRef(false)

  // Sync content prop changes to the editor (e.g. after frontmatter update on disk)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === content) return
    externalSyncRef.current = true
    view.dispatch({ changes: { from: 0, to: current.length, insert: content } })
    externalSyncRef.current = false
  }, [content])

  useEffect(() => {
    const parent = containerRef.current
    if (!parent) return

    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        EditorView.lineWrapping,
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        buildSaveKeymap(callbacksRef),
        buildBaseTheme(isDarkMode),
        markdownLanguage(),
        frontmatterHighlightTheme(isDarkMode),
        frontmatterHighlightPlugin,
        zoomCursorFix(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !externalSyncRef.current) {
            callbacksRef.current.onDocChange(update.state.doc.toString())
          }
          if (update.selectionSet || update.docChanged) {
            callbacksRef.current.onCursorActivity(update.view)
          }
        }),
      ],
    })

    const view = new EditorView({ state, parent })
    viewRef.current = view
    // Expose EditorView on the parent DOM for Playwright test access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(parent as any).__cmView = view

    // When CSS zoom changes on the document, CodeMirror's cached measurements
    // (scaleX/scaleY, line heights, character widths) become stale because
    // ResizeObserver doesn't fire for ancestor zoom changes. Force a re-measure
    // so cursor placement stays accurate at any zoom level.
    const handleZoomChange = () => { view.requestMeasure() }
    window.addEventListener('laputa-zoom-change', handleZoomChange)

    return () => {
      window.removeEventListener('laputa-zoom-change', handleZoomChange)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (parent as any).__cmView
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDarkMode])

  return viewRef
}
