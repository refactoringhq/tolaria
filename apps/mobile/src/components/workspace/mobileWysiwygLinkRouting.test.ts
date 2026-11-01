import { describe, expect, it, vi } from 'vitest'
import { routeMobileWysiwygLink } from './mobileWysiwygLinkRouting'

describe('routeMobileWysiwygLink', () => {
  it('routes encoded wikilinks to note navigation', () => {
    const onNavigateWikilink = vi.fn()
    const onOpenLink = vi.fn()

    expect(routeMobileWysiwygLink('tolaria://wikilink/folder%2FNote%20Name', {
      onNavigateWikilink,
      onOpenLink,
    })).toBe('wikilink')
    expect(onNavigateWikilink).toHaveBeenCalledWith('folder/Note Name')
    expect(onOpenLink).not.toHaveBeenCalled()
  })

  it.each(['https://example.com/a', 'mailto:hello@example.com', 'tel:+1234'])(
    'routes supported URL %s to the external opener',
    (href) => {
      const onOpenLink = vi.fn()
      const onNavigateWikilink = vi.fn()

      expect(routeMobileWysiwygLink(href, { onOpenLink, onNavigateWikilink })).toBe('external')
      expect(onOpenLink).toHaveBeenCalledWith(href)
      expect(onNavigateWikilink).not.toHaveBeenCalled()
    },
  )

  it('routes a Tolaria note deep link to the incoming-link handler', () => {
    const onOpenLink = vi.fn()
    expect(routeMobileWysiwygLink('tolaria://laputa-vault/Folder/Note.md', { onOpenLink })).toBe('deepLink')
    expect(onOpenLink).toHaveBeenCalledWith('tolaria://laputa-vault/Folder/Note.md')
  })

  it.each(['javascript:alert(1)', 'data:text/html,hello', 'file:///note.png', 'tolaria://wikilink/%E0%A4%A', '']) (
    'rejects unsupported or malformed href %s',
    (href) => {
      const onOpenLink = vi.fn()
      const onNavigateWikilink = vi.fn()

      expect(routeMobileWysiwygLink(href, { onOpenLink, onNavigateWikilink })).toBe(null)
      expect(onOpenLink).not.toHaveBeenCalled()
      expect(onNavigateWikilink).not.toHaveBeenCalled()
    },
  )
})
