import { useRef, useEffect } from 'react'
import { EditorView, lineNumbers, highlightActiveLine, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { frontmatterHighlightPlugin, frontmatterHighlightTheme } from '../extensions/frontmatterHighlight'
import { zoomCursorFix } from '../extensions/zoomCursorFix'

const FONT_FAMILY = '"Berkeley Mono", "JetBrains Mono", "Fira Mono", ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

export interface CodeMirrorCallbacks {
  onDocChange: (doc: string) => void
  onCursorActivity: (view: EditorView) => void
  onSave: () => void
  onEscape: () => boolean
}

function buildBaseTheme(isDark: boolean) {
  const bg = isDark ? '#1e1e1e' : '#ffffff'
  const fg = isDark ? '#d4d4d4' : '#1e1e1e'
  const gutterBg = isDark ? '#1e1e1e' : '#ffffff'
  const gutterColor = isDark ? '#555' : '#aaa'
  const activeLineBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,100,255,0.06)'
  const gutterBorder = isDark ? '#333' : '#eee'

  return EditorView.theme({
    '&': {
      fontSize: '13px',
      fontFamily: FONT_FAMILY,
      backgroundColor: bg,
      color: fg,
      flex: '1',
      minHeight: '0',
    },
    '.cm-scroller': {
      fontFamily: FONT_FAMILY,
      lineHeight: '1.6',
      padding: '16px 0',
      overflow: 'auto',
    },
    '.cm-content': {
      padding: '0 32px 0 16px',
      caretColor: fg,
    },
    '.cm-gutters': {
      backgroundColor: gutterBg,
      color: gutterColor,
      borderRight: `1px solid ${gutterBorder}`,
      paddingLeft: '16px',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      paddingRight: '12px',
      minWidth: '28px',
      textAlign: 'right',
    },
    '.cm-activeLine': {
      backgroundColor: activeLineBg,
    },
    '.cm-activeLineGutter': {
      backgroundColor: activeLineBg,
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-line': { padding: '0' },
  }, { dark: isDark })
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
  isDark: boolean,
  callbacks: CodeMirrorCallbacks,
) {
  const viewRef = useRef<EditorView | null>(null)
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

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
        buildBaseTheme(isDark),
        frontmatterHighlightTheme(isDark),
        frontmatterHighlightPlugin,
        zoomCursorFix(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
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

    // When CSS zoom changes on the document, CodeMirror's cached measurements
    // (scaleX/scaleY, line heights, character widths) become stale because
    // ResizeObserver doesn't fire for ancestor zoom changes. Force a re-measure
    // so cursor placement stays accurate at any zoom level.
    const handleZoomChange = () => { view.requestMeasure() }
    window.addEventListener('laputa-zoom-change', handleZoomChange)

    return () => {
      window.removeEventListener('laputa-zoom-change', handleZoomChange)
      view.destroy()
      viewRef.current = null
    }
    // Re-create editor when isDark changes (theme is baked into extensions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark])

  return viewRef
}
