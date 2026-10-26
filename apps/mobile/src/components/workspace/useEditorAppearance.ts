import { useEffect, useMemo, type MutableRefObject } from 'react'
import { useMobileColors, useMobileMetrics } from '../../ui/theme/useMobileTheme'
import type { MobileNoteWidth } from '../../workspace/mobileWorkspaceModel'
import { mobileTentapEditorCss } from './MobileWysiwygMarkdownEditorCss'

type CssEditor = {
  injectCSS?: (css: string, tag?: string) => void
  injectJS?: (javascript: string) => void
}

const revealEditorRoot = "document.getElementById('root')?.style.setProperty('visibility', 'visible'); true;"

export function injectMobileEditorAppearance(editor: CssEditor | null, css: string): boolean {
  if (!editor?.injectCSS) {
    editor?.injectJS?.(revealEditorRoot)
    return false
  }
  editor.injectCSS(css, 'tolaria-editor')
  return true
}

export function useEditorAppearance({ compact, noteWidth, editorRef }: {
  compact: boolean
  noteWidth: MobileNoteWidth | null | undefined
  editorRef: MutableRefObject<CssEditor | null>
}) {
  const colors = useMobileColors()
  const metrics = useMobileMetrics()
  const css = useMemo(() => mobileTentapEditorCss(compact, noteWidth, colors, metrics), [compact, noteWidth, colors, metrics])
  useEffect(() => { injectMobileEditorAppearance(editorRef.current, css) }, [editorRef, css])
  return css
}
