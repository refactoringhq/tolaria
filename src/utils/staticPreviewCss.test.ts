import { describe, expect, it } from 'vitest'
import { buildStaticPreviewRevealCss } from './staticPreviewCss'

describe('buildStaticPreviewRevealCss', () => {
  it('reveals elements hidden with opacity and visibility', () => {
    const css = buildStaticPreviewRevealCss(
      '.slide{position:absolute;inset:0;opacity:0;visibility:hidden;transform:translateY(16px);pointer-events:none}',
    )

    expect(css).toContain('.slide{')
    expect(css).toContain('opacity:1 !important')
    expect(css).toContain('visibility:visible !important')
    expect(css).toContain('position:static !important')
    expect(css).toContain('inset:auto !important')
    expect(css).toContain('transform:none !important')
    expect(css).toContain('pointer-events:auto !important')
  })

  it('unlocks document scrolling locked by html and body rules', () => {
    const css = buildStaticPreviewRevealCss('html,body{height:100%;overflow:hidden}')

    expect(css).toContain('overflow:auto !important')
    expect(css).toContain('height:auto !important')
  })

  it('pins fullscreen absolute containers into the document flow', () => {
    const css = buildStaticPreviewRevealCss('.deck{position:fixed;top:0;left:0;right:0;bottom:0}')

    expect(css).toContain('position:static !important')
    expect(css).toContain('top:auto !important')
    expect(css).toContain('left:auto !important')
  })

  it('skips interaction-state selectors so hover styling survives', () => {
    const css = buildStaticPreviewRevealCss(
      '.menu:hover{opacity:1}.tip:focus-within{visibility:hidden}.tab:checked~.pane{opacity:0}',
    )

    expect(css).toBe('')
  })

  it('leaves display:none fallback layers untouched', () => {
    const css = buildStaticPreviewRevealCss('.overlay{position:fixed;inset:0;display:none}.hidden{display:none}')

    expect(css).not.toContain('display')
  })

  it('skips rules nested inside at-rules such as media and keyframes', () => {
    const css = buildStaticPreviewRevealCss(
      '@media (max-width:860px){.grid{opacity:0}}@keyframes fade{from{opacity:0}to{opacity:1}}.shown{color:red}',
    )

    expect(css).not.toContain('.grid')
    expect(css).not.toContain('from')
    expect(css).not.toContain('fade')
  })

  it('returns empty output for css without hidden or pinned declarations', () => {
    const css = buildStaticPreviewRevealCss('.card{color:red;border:1px solid blue}.card p{margin:0}')

    expect(css).toBe('')
  })

  it('handles comments and preserves per-selector splits', () => {
    const css = buildStaticPreviewRevealCss('/* intro */ .step, .wizard a:hover { opacity: 0; visibility: hidden; }')

    expect(css).toContain('.step{')
    expect(css).not.toContain('.wizard')
  })

  it('keeps selectors with descendant combinators intact', () => {
    const css = buildStaticPreviewRevealCss('.deck .slide{opacity:0}')

    expect(css).toContain('.deck .slide{')
    expect(css).toContain('opacity:1 !important')
  })
})
