import { describe, expect, it } from 'vitest'
import { desktopEditorParity } from '../../ui/desktopParity'
import { mobileTentapEditorCss } from './MobileWysiwygMarkdownEditorCss'

describe('mobile TenTap editor CSS', () => {
  it('keeps H4 spacing separate from H3 using desktop editor tokens', () => {
    const css = mobileTentapEditorCss(false)

    expect(cssBlock(css, '.ProseMirror h3')).toContain(
      `margin: ${desktopEditorParity.h3MarginTop}px 0 ${desktopEditorParity.h3MarginBottom}px;`,
    )
    expect(cssBlock(css, '.ProseMirror h4')).toContain(
      `margin: ${desktopEditorParity.h4MarginTop}px 0 ${desktopEditorParity.h4MarginBottom}px;`,
    )
  })

  it('removes the normal desktop max width in wide-note mode', () => {
    const css = mobileTentapEditorCss(false, 'wide')
    const proseMirror = cssBlock(css, '.ProseMirror')

    expect(proseMirror).toContain('max-width: none;')
    expect(proseMirror).toContain('margin: 0;')
    expect(proseMirror).toContain('padding: 20px clamp(24px, 4vw, 72px) 96px;')
  })

  it('reveals the editor only after its appearance stylesheet is injected', () => {
    expect(cssBlock(mobileTentapEditorCss(false), '#root')).toContain('visibility: visible;')
  })
})

function cssBlock(css: string, selector: string): string {
  const opening = `    ${selector} {\n`
  const start = css.indexOf(opening)
  if (start === -1) return ''

  const bodyStart = start + opening.length
  const end = css.indexOf('\n    }', bodyStart)
  return end === -1 ? '' : css.slice(bodyStart, end)
}
