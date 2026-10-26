import { describe, expect, it, vi } from 'vitest'
import { mobilePalettes } from '../../ui/theme/mobilePalette'
import { mobileTentapEditorCss } from './MobileWysiwygMarkdownEditorCss'
import { injectMobileEditorAppearance } from './useEditorAppearance'

describe('rich editor appearance', () => {
  it('uses desktop dark tokens in the actual WebView stylesheet', () => {
    const css = mobileTentapEditorCss(false, null, mobilePalettes.dark)
    expect(css).toContain('background: #1F1E1B')
    expect(css).toContain('color: #E6E1D8')
    expect(css).toContain('caret-color: #78A4FF')
    expect(css).toContain('1px solid #34322D')
    expect(css).not.toContain('#FFFFFF')
  })

  it('changes only CSS, preserving the document and selection', () => {
    const editor = { injectCSS: vi.fn(), setContent: vi.fn(), setSelection: vi.fn() }
    expect(injectMobileEditorAppearance(editor, 'body { color: white; }')).toBe(true)
    expect(editor.injectCSS).toHaveBeenCalledWith('body { color: white; }', 'tolaria-editor')
    expect(editor.setContent).not.toHaveBeenCalled()
    expect(editor.setSelection).not.toHaveBeenCalled()
    expect(injectMobileEditorAppearance(null, '')).toBe(false)
  })

  it('reveals the editor if its native bridge cannot inject CSS', () => {
    const editor = { injectJS: vi.fn() }

    expect(injectMobileEditorAppearance(editor, 'body { color: white; }')).toBe(false)
    expect(editor.injectJS).toHaveBeenCalledWith(
      "document.getElementById('root')?.style.setProperty('visibility', 'visible'); true;",
    )
  })
})
